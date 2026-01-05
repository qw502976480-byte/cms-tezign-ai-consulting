import ContentEditor from '@/components/ContentEditor';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EditContentPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data } = await supabase.from('content_items').select('*').eq('id', params.id).single();

  if (!data) return <div>内容不存在</div>;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">编辑内容</h1>
      </div>
      <ContentEditor initialData={data} />
    </div>
  );
}