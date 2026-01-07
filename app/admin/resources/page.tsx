
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus } from 'lucide-react';
import { ResourceStatus } from '@/types';
import ResourceList from './ResourceList';

interface ResourceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  status: ResourceStatus;
  published_at: string | null;
  created_at: string;
}

export const dynamic = 'force-dynamic';

export default async function ResourcesListPage() {
  const supabase = await createClient();

  const [resourcesResult, modulesResult] = await Promise.all([
    supabase
      .from('resources')
      .select('id, title, slug, category, summary, status, published_at, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('homepage_modules')
      .select('type, content_item_ids')
      .in('type', ['latest_updates_carousel', 'latest_updates_fixed'])
  ]);

  const resources = resourcesResult.data as ResourceRow[] | null;
  const error = resourcesResult.error || modulesResult.error;

  if (error) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded-lg border border-red-100">
        Error loading data: {error.message}
      </div>
    );
  }

  const modules = modulesResult.data || [];
  const carouselModule = modules.find(m => m.type === 'latest_updates_carousel');
  const fixedModule = modules.find(m => m.type === 'latest_updates_fixed');

  const featuredIds = new Set<string>(carouselModule?.content_item_ids || []);
  const fixedIds = new Set<string>(fixedModule?.content_item_ids || []);

  const enrichedResources = (resources || []).map(resource => ({
    ...resource,
    isFeatured: featuredIds.has(resource.id),
    isFixed: fixedIds.has(resource.id)
  }));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">内容资源 (Resources)</h1>
        </div>
        <Link 
          href="/admin/resources/new"
          className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> 新建资源
        </Link>
      </div>

      <ResourceList initialResources={enrichedResources} />
    </div>
  );
}
