import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Edit2, Eye } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ContentList({ searchParams }: { searchParams: { type?: string } }) {
  const supabase = await createClient();
  const typeFilter = searchParams.type;

  let query = supabase.from('content_items').select('*').order('published_at', { ascending: false });
  if (typeFilter) {
    query = query.eq('type', typeFilter);
  }

  const { data: content } = await query;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">内容列表</h1>
        <Link 
          href="/admin/content/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> 新建内容
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 p-4 gap-4">
           {['All', 'Case Study', 'Report', 'Methodology', 'Announcement'].map(t => (
             <Link 
               key={t}
               href={t === 'All' ? '/admin/content' : `/admin/content?type=${t}`}
               className={`text-sm font-medium px-3 py-1 rounded-full ${
                 (t === 'All' && !typeFilter) || typeFilter === t 
                   ? 'bg-gray-900 text-white' 
                   : 'text-gray-500 hover:bg-gray-100'
               }`}
             >
               {t === 'All' ? '全部' : t}
             </Link>
           ))}
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4">标题</th>
              <th className="px-6 py-4">类型</th>
              <th className="px-6 py-4">状态</th>
              <th className="px-6 py-4">发布时间</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {content?.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{item.title}</td>
                <td className="px-6 py-4 text-gray-500">{item.type}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'Published' ? 'bg-green-100 text-green-700' :
                    item.status === 'Draft' ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {item.status === 'Published' ? '已发布' : item.status === 'Draft' ? '草稿' : '已归档'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{item.published_at}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <Link href={`/admin/content/${item.id}/edit`} className="p-2 text-gray-400 hover:text-blue-600">
                    <Edit2 size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            {content?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">暂无内容</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}