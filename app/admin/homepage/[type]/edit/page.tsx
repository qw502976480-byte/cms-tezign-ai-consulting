import SectionEditor from '../../section-editor';
import { createClient } from '@/utils/supabase/server';
import { HomepageConfig } from '@/types';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MODULE_NAMES: Record<string, string> = {
  hero: 'Hero (首屏)',
  gpt_search: 'GPT 交互搜索',
  latest_news: '最新消息',
  core_capabilities: '核心能力',
  product_claim: '产品主张',
  primary_cta: '底部 CTA',
};

export default async function EditSectionPage({
  params,
}: {
  params: { type: string };
}) {
  const { type } = params;
  const moduleName = MODULE_NAMES[type];

  // 1️⃣ type 不合法
  if (!moduleName) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">404 - 模块类型未知</h1>
        <p className="mt-2 text-gray-600">系统不支持模块类型: {type}</p>
        <Link href="/admin/homepage" className="mt-4 inline-block text-blue-600 hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('homepage_config') // Reverted to homepage_config
    .select('*')
    .eq('type', type)
    .single();

  // 2️⃣ 数据不存在或加载失败
  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-red-600 mt-1" size={24} />
          <div>
            <h2 className="text-lg font-bold text-red-800">模块配置加载失败</h2>
            <p className="mt-2 text-sm text-red-700">
              无法加载 <strong>{type}</strong> ({moduleName}) 的配置。
            </p>
            {error && (
              <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded font-mono">
                <code>{error.message}</code>
              </pre>
            )}
            <Link href="/admin/homepage" className="mt-4 inline-block text-sm underline text-red-800">
              返回列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const configData = data as HomepageConfig;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/homepage" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">编辑模块</h1>
          <p className="text-sm text-gray-500">{moduleName}</p>
        </div>
      </div>

      <SectionEditor moduleConfig={configData} />
    </div>
  );
}