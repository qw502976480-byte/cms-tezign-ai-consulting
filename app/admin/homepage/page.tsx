import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Edit2, Eye, EyeOff } from 'lucide-react';
import { HomepageConfig, HomepageModuleType } from '@/types';
import ToggleActiveButton from './ToggleActiveButton';

export const dynamic = 'force-dynamic';

const MODULE_DEFINITIONS: { type: HomepageModuleType; name: string; description: string }[] = [
  { type: 'hero', name: '模块 1: Hero', description: '官网首屏，包含主标题、副标题和 CTA 按钮文案。' },
  { type: 'gpt_search', name: '模块 2: GPT 交互搜索', description: '配置搜索框的占位提示语和示例问题。' },
  { type: 'latest_news', name: '模块 3: 最新消息', description: '从内容库中选择要在首页展示的精选文章和列表文章。' },
  { type: 'core_capabilities', name: '模块 4: 核心能力', description: '编辑大标题和固定的 3 个能力介绍卡片。' },
  { type: 'product_claim', name: '模块 5: 产品主张', description: '配置品牌级叙事，包含标题、正文和配图。' },
  { type: 'primary_cta', name: '模块 6: 底部 CTA', description: '配置页面底部的转化模块，引导用户预约。' },
];

export default async function HomepageManager() {
  const supabase = createClient();
  
  // Fetch all 6 config items
  const { data } = await supabase
    .from('homepage_config')
    .select('*');

  const configs = new Map((data as HomepageConfig[] || []).map(item => [item.type, item]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">首页模块配置</h1>
        <p className="text-sm text-gray-500">共 6 个固定模块，不可增删或排序</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {MODULE_DEFINITIONS.map(({ type, name, description }) => {
            const config = configs.get(type);
            if (!config) return null;

            return (
              <li key={type} className="flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                     {config.is_active 
                       ? <Eye size={16} className="text-green-500" />
                       : <EyeOff size={16} className="text-gray-400" />
                     }
                    <h3 className="text-base font-semibold text-gray-800">{name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 max-w-xl">{description}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <ToggleActiveButton type={type} isActive={config.is_active} />
                  <Link
                    href={`/admin/homepage/${type}/edit`}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    <Edit2 size={14} />
                    编辑
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
