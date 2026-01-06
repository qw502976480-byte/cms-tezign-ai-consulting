
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 font-medium text-left w-1/4">标题</th>
              <th className="px-6 py-4 font-medium text-left">状态</th>
              <th className="px-6 py-4 font-medium text-left">首页推荐</th>
              <th className="px-6 py-4 font-medium text-left">发布日期</th>
              <th className="px-6 py-4 font-medium text-left">分类</th>
              <th className="px-6 py-4 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources?.map((resource) => {
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 border border-green-100 whitespace-nowrap">
                          Published
                        </span>
                     ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200 uppercase whitespace-nowrap">
                          {resource.status || 'Draft'}
                        </span>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      {isFeatured && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                          <Star size={10} fill="currentColor" /> Featured
                        </span>
                      )}
                      {isFixed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                          <Pin size={10} /> Fixed List
                        </span>
                      )}
                      {!isFeatured && !isFixed && (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs tabular-nums">
                    {resource.published_at ? new Date(resource.published_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100 whitespace-nowrap text-xs">
                      {resource.category?.replace(/_/g, ' ') || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/resources/${resource.id}/edit`}
                      className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} strokeWidth={1.5} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!resources || resources.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                  暂无内容资源
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
