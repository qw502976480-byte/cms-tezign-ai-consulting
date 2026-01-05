import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Edit2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { HomepageConfig, HomepageModuleType } from '@/types';
import ToggleActiveButton from './ToggleActiveButton';

export const dynamic = 'force-dynamic';

const MODULE_DEFINITIONS: { type: HomepageModuleType; name: string; description: string }[] = [
  { type: 'hero', name: '模块 1: Hero (首屏)', description: '包含主标题、副标题和 CTA 按钮文案。无背景图。' },
  { type: 'gpt_search', name: '模块 2: GPT 交互搜索', description: '配置搜索框的占位提示语和示例问题。' },
  { type: 'latest_news', name: '模块 3: 最新消息', description: '左侧轮播 (5条) + 右侧列表 (3条)。' },
  { type: 'core_capabilities', name: '模块 4: 核心能力', description: '大标题 + 3 个固定的能力卡片。' },
  { type: 'product_claim', name: '模块 5: 产品主张', description: '品牌级叙事，包含标题、HTML正文和配图。' },
  { type: 'primary_cta', name: '模块 6: 底部 CTA', description: '页面底部的转化引导模块。' },
];

export default async function HomepageManager() {
  const supabase = await createClient();
  
  // Fetch configs
  const { data } = await supabase.from('homepage_config').select('*');
  const configs = new Map((data as HomepageConfig[] || []).map(item => [item.type, item]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">首页模块配置</h1>
          <p className="text-sm text-gray-500 mt-1">
            严格对齐官网首页结构，共 6 个固定模块。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {MODULE_DEFINITIONS.map(({ type, name, description }) => {
            const config = configs.get(type);
            const isInitialized = !!config;

            // 构建编辑链接，确保使用 type 作为路径参数
            const editHref = `/admin/homepage/${type}/edit`;

            return (
              <li key={type} className="flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3">
                    {isInitialized ? (
                      config.is_active 
                        ? <Eye size={18} className="text-green-600" />
                        : <EyeOff size={18} className="text-gray-400" />
                    ) : (
                      <AlertCircle size={18} className="text-amber-500" />
                    )}
                    <h3 className="text-base font-semibold text-gray-900">{name}</h3>
                    {!isInitialized && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        等待初始化
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                </div>

                <div className="flex items-center gap-4">
                  {isInitialized ? (
                    <>
                      <ToggleActiveButton type={type} isActive={config.is_active} />
                      <Link
                        href={editHref}
                        className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                      >
                        <Edit2 size={14} />
                        配置
                      </Link>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 italic">
                      请运行 SQL Migration 初始化数据
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}