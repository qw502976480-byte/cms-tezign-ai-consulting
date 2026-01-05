import SectionEditor from '../../section-editor';
import { createClient } from '@/utils/supabase/server';
import { HomepageConfig } from '@/types';

export const dynamic = 'force-dynamic';

export default async function EditSectionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  // FIX: Query correct table 'homepage_config' instead of 'homepage_sections'
  const { data } = await supabase.from('homepage_config').select('*').eq('id', params.id).single();

  if (!data) return <div>Section not found</div>;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">编辑模块</h1>
      </div>
      {/* FIX: Pass 'moduleConfig' prop instead of 'initialData' */}
      <SectionEditor moduleConfig={data as HomepageConfig} />
    </div>
  );
}
