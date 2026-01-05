import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
// FIX: Import HomepageLatestNewsConfig to cast config object
import { HomepageModuleType, HomepageLatestNewsConfig } from '@/types';

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

  // 2. Identify and collect all content IDs needed for 'latest_news'
  // FIX: Cast newsConfig to the correct type to access its properties
  const newsConfig = configMap.get('latest_news') as HomepageLatestNewsConfig | undefined;
  let allResourceIds: string[] = [];
  if (newsConfig) {
    allResourceIds = [...(newsConfig.featured_items || []), ...(newsConfig.list_items || [])];
  }
  
  // 3. Fetch associated content items if any are linked
  let contentMap = new Map();
  if (allResourceIds.length > 0) {
    const { data: content, error: contentError } = await supabase
        .from('content_items')
        .select('id, type, title, subtitle, published_at, reading_minutes, slug, cover_image_url')
        .in('id', allResourceIds)
        .eq('status', 'Published');

    if (!contentError && content) {
        contentMap = new Map(content.map((c: any) => [c.id, c]));
    }
  }

  // 4. Build the final structured response object
  const response: { [key in HomepageModuleType]?: any } = {};
  
  for (const config of configs) {
    if (config.type === 'latest_news') {
      // FIX: Cast config.config for type safety
      const newsModuleConfig = config.config as HomepageLatestNewsConfig;
      // Resolve content items for the news module
      const resolvedConfig = {
        featured_items: (newsModuleConfig.featured_items || [])
          .map((id: string) => contentMap.get(id))
          .filter(Boolean),
        list_items: (newsModuleConfig.list_items || [])
          .map((id: string) => contentMap.get(id))
          .filter(Boolean),
      };
      response.latest_news = resolvedConfig;
    } else {
      // For all other modules, just add their config
      response[config.type as HomepageModuleType] = config.config;
    }
  }

  return NextResponse.json(response);
}