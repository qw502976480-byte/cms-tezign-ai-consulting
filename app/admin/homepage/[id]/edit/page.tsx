import SectionEditor from '../../section-editor';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EditSectionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('homepage_sections').select('*').eq('id', params.id).single();

  if (!data) return <div>Section not found</div>;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">编辑模块</h1>
      </div>
      <SectionEditor initialData={data} />
    </div>
  );
}