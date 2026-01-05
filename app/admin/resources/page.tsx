import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Edit2, Search, Filter } from 'lucide-react';
import { ContentItem } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ResourcesListPage({ searchParams }: { searchParams: { q?: string; category?: string } }) {
  const supabase = await createClient();
  const searchTerm = searchParams.q || '';
  const categoryFilter = searchParams.category || 'All';

  let query = supabase
    .from('content_items')
    .select('*')
    .order('published_at', { ascending: false });

  if (categoryFilter !== 'All') {
    query = query.eq('type', categoryFilter);
  }

  if (searchTerm) {
    query = query.ilike('title', `%${searchTerm}%`);
  }

  const { data: resources, error } = await query;

  if (error) {
    console.error('Error fetching resources:', error);
  }

  const categories = [
    { label: '全部', value: 'All' },
    { label: '报告', value: 'report' },
    { label: '公告', value: 'announcement' },
    { label: '案例', value: 'case_study' },
    { label: '方法论', value: 'methodology' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">资源管理</h1>
        <Link 
          href="/admin/resources/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} /> 新建资源
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto no-scrollbar">
          {categories.map((cat) => (
            <Link
              key={cat.value}
              href={cat.value === 'All' ? '/admin/resources' : `/admin/resources?category=${cat.value}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        <form className="relative w-full md:w-64">
          <input
            name="q"
            defaultValue={searchTerm}
            placeholder="搜索标题..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          {/* Include category in search form to persist filter */}
          {categoryFilter !== 'All' && <input type="hidden" name="category" value={categoryFilter} />}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-4 w-1/3">标题</th>
                <th className="px-6 py-4">分类</th>
                <th className="px-6 py-4">发布时间</th>
                <th className="px-6 py-4 w-1/3">摘要</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resources?.map((item: ContentItem) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    {item.cover_image_url && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-blue-600">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span> 有封面图
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(item.published_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <div className="line-clamp-2">{item.subtitle || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/resources/${item.id}/edit`}
                      className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
              {(!resources || resources.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <p>暂无相关资源</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}