import SectionEditor from '../../section-editor';
import { createClient } from '@/utils/supabase/server';
import { HomepageConfig, HomepageModuleType } from '@/types';

export const dynamic = 'force-dynamic';

const MODULE_NAMES: Record<HomepageModuleType, string> = {
  hero: 'Hero',
  gpt_search: 'GPT 交互搜索',
  latest_news: '最新消息',
  core_capabilities: '核心能力',
  product_claim: '产品主张',
  primary_cta: '底部 CTA',
};

export default async function EditSectionPage({ params }: { params: { type: HomepageModuleType } }) {
  const supabase = createClient();
  const { data } = await supabase.from('homepage_config').select('*').eq('type', params.type).single();

  if (!data) return <div>模块配置不存在: {params.type}</div>;

  const configData = data as HomepageConfig;
  const moduleName = MODULE_NAMES[params.type] || '模块';

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">编辑模块: {moduleName}</h1>
      </div>
      <SectionEditor moduleConfig={configData} />
    </div>
  );
}
