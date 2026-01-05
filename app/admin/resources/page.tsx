import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type ResourceRow = {
  id: string;
  title: string | null;
  slug: string | null;
  category: string | null;
  summary: string | null;
  cover_image_url: string | null;
};

export default async function AdminResourcesPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('resources')
    .select('id,title,slug,category,summary,cover_image_url')
    .order('title', { ascending: true }); // 先用 title 排序，避免你没 created_at 字段导致报错

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Resources</h1>
        <p className="mt-2 text-sm text-red-600">读取 resources 表失败：{error.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as ResourceRow[];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-sm text-gray-500">内容资源管理（Report / Announcement / Case Study / Methodology）</p>
        </div>

        {/* 先放一个入口，后面我们再做 new 页面 */}
        <Link
          href="/admin/resources/new"
          className="px-4 py-2 rounded-lg bg-black text-white text-sm hover:opacity-90"
        >
          New Resource
        </Link>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Cover</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  目前 resources 表没有数据。你可以先在 Supabase Table Editor 里 Insert 一条，或稍后用 New Resource 创建。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{r.title ?? '-'}</td>
                  <td className="px-4 py-3">{r.category ?? '-'}</td>
                  <td className="px-4 py-3">{r.slug ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.summary ?? '-'}</td>
                  <td className="px-4 py-3">
                    {r.cover_image_url ? (
                      <a className="underline" href={r.cover_image_url} target="_blank" rel="noreferrer">
                        view
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link className="underline" href={`/admin/resources/${r.id}/edit`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
