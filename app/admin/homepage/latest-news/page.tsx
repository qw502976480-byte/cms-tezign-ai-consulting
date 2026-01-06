import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import LatestNewsEditor from '../latest-news-editor';
import { HomepageLatestNewsConfig } from '@/types';

export const dynamic = 'force-dynamic';

export default async function LatestNewsPage() {
  const supabase = await createClient();

  const [resourcesResult, newsConfigResult] = await Promise.all([
    supabase.from('resources').select('id, title, status').order('created_at', { ascending: false }),
    supabase.from('homepage_config').select('config').eq('type', 'latest_news').maybeSingle()
  ]);
  
  const { data: resources, error: resourcesError } = resourcesResult;
  const { data: newsConfigData, error: newsConfigError } = newsConfigResult;
  
  const error = resourcesError || newsConfigError;

  if (error && error.code !== 'PGRST116') { // PGRST116: "exact number of rows expected" - ignore for maybeSingle
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-red-600 mt-1" size={24} />
          <div>
            <h2 className="text-lg font-bold text-red-800">模块配置加载失败</h2>
            <p className="mt-2 text-sm text-red-700">
              无法加载最新消息模块的配置或资源列表。
            </p>
            <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded font-mono">
              <code>{error.message}</code>
            </pre>
            <Link href="/admin/homepage" className="mt-4 inline-block text-sm underline text-red-800">
              返回列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const newsConfig = (newsConfigData?.config || {}) as HomepageLatestNewsConfig;
  const initialCarouselIds = newsConfig.featured_items || [];
  const initialFixedIds = newsConfig.list_items || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/homepage" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">配置最新消息</h1>
          <p className="text-sm text-gray-500">模块 3: 最新消息</p>
        </div>
      </div>
      <LatestNewsEditor
        allResources={resources || []}
        initialCarouselIds={initialCarouselIds}
        initialFixedIds={initialFixedIds}
      />
    </div>
  );
}