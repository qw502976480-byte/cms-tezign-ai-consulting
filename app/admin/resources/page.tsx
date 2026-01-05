import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, Edit2 } from 'lucide-react';
import { Resource } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ResourcesListPage() {
  const supabase = await createClient();

  const { data: resources, error } = await supabase
    .from('resources')
    .select('id, title, slug, category, summary, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Error loading resources: {error.message}
      </div>
    );
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
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Slug</th>
              <th className="px-6 py-4">Summary</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources?.map((item: Resource) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{item.title}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    {item.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.slug}</td>
                <td className="px-6 py-4 text-gray-500">
                  <div className="line-clamp-1 max-w-xs">{item.summary || '-'}</div>
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