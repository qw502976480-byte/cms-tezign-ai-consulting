import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Edit2, Star, Pin } from 'lucide-react';
import { ResourceStatus } from '@/types';

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

  // Fetch resources and homepage modules in parallel
  const [resourcesResult, modulesResult] = await Promise.all([
    supabase
      .from('resources')
      .select('id, title, slug, category, summary, status, published_at, created_at')
      .order('created_at', { ascending: false }),
    // Use 'type' column with updated keys
    supabase
      .from('homepage_modules')
      .select('type, content_item_ids')
      .in('type', ['latest_updates_carousel', 'latest_updates_fixed'])
  ]);

  const resources = resourcesResult.data;
  const error = resourcesResult.error;

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Error loading resources: {error.message}
      </div>
    );
  }

  // Process homepage slots into Sets for O(1) lookup
  const featuredIds = new Set<string>(); // latest_updates_carousel
  const fixedIds = new Set<string>();    // latest_updates_fixed

  if (modulesResult.data) {
    modulesResult.data.forEach((mod: any) => {
      const ids = Array.isArray(mod.content_item_ids) ? mod.content_item_ids : [];
      if (mod.type === 'latest_updates_carousel') {
        ids.forEach((id: string) => featuredIds.add(id));
      } else if (mod.type === 'latest_updates_fixed') {
        ids.forEach((id: string) => fixedIds.add(id));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资源管理 (Resources)</h1>
          <p className="text-sm text-gray-500 mt-1">Single source of truth for all content.</p>
        </div>
        <Link 
          href="/admin/resources/new"
          className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> 新建资源
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 w-1/4">Title</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Homepage</th>
              <th className="px-6 py-4">Published At</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources?.map((item: any) => {
              const resource = item as ResourceRow;
              const isPublished = resource.status === 'published';
              const isFeatured = featuredIds.has(resource.id);
              const isFixed = fixedIds.has(resource.id);
              
              return (
                <tr key={resource.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="truncate max-w-xs" title={resource.title}>{resource.title}</div>
                  </td>
                  <td className="px-6 py-4">
                     {isPublished ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Published
                        </span>
                     ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 uppercase">
                          {resource.status || 'Draft'}
                        </span>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      {isFeatured && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <Star size={10} fill="currentColor" /> Featured
                        </span>
                      )}
                      {isFixed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <Pin size={10} /> Fixed List
                        </span>
                      )}
                      {!isFeatured && !isFixed && (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {resource.published_at ? new Date(resource.published_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      {resource.category?.replace(/_/g, ' ') || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/resources/${resource.id}/edit`}
                      className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!resources || resources.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No resources found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}