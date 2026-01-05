import ResourceForm from '../../resource-form';
import { createClient } from '@/utils/supabase/server';
import { ContentItem } from '@/types';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditResourcePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-bold text-gray-900">资源未找到</h2>
        <Link href="/admin/resources" className="mt-4 text-blue-600 hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <ResourceForm initialData={data as ContentItem} />
    </div>
  );
}