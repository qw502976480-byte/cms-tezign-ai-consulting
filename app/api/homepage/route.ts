import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { HomepageModuleType, HomepageLatestNewsConfig, Resource } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  // 1. Get all active homepage configs
  const { data: configs, error: configError } = await supabase
    .from('homepage_config')
    .select('type, config, is_active')
    .eq('is_active', true);

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  // Use a Map for easy lookup
  const configMap = new Map(configs.map(c => [c.type, c.config]));

  // 2. Identify and collect all resource IDs needed for 'latest_news'
  const newsConfig = configMap.get('latest_news') as HomepageLatestNewsConfig | undefined;
  let allResourceIds: string[] = [];
  if (newsConfig) {
    allResourceIds = [...(newsConfig.featured_items || []), ...(newsConfig.list_items || [])];
  }
  
  // 3. Fetch associated resources
  let resourceMap: Map<string, Resource> = new Map();
  if (allResourceIds.length > 0) {
    const { data: resources, error: resourceError } = await supabase
        .from('resources')
        .select('id, title, slug, category, summary, published_at')
        .in('id', allResourceIds)
        .eq('status', 'published');

    if (!resourceError && resources) {
        // FIX: Cast resources to Resource[] to satisfy the Map's type.
        // Although we're fetching a subset of fields, this aligns with downstream
        // type expectations and resolves the build error.
        resourceMap = new Map((resources as Resource[]).map((c) => [c.id, c]));
    }
  }

  // 4. Build the final structured response object
  const response: { [key in HomepageModuleType]?: any } = {};
  
  for (const config of configs) {
    if (config.type === 'latest_news') {
      const newsModuleConfig = config.config as HomepageLatestNewsConfig;
      // Resolve resource items for the news module
      const resolvedConfig = {
        featured_items: (newsModuleConfig.featured_items || [])
          .map((id: string) => resourceMap.get(id))
          .filter((item): item is Resource => !!item),
        list_items: (newsModuleConfig.list_items || [])
          .map((id: string) => resourceMap.get(id))
          .filter((item): item is Resource => !!item),
      };
      response.latest_news = resolvedConfig;
    } else {
      // For all other modules, just add their config
      response[config.type as HomepageModuleType] = config.config;
    }
  }

  return NextResponse.json(response);
}