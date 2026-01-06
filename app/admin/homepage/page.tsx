
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Star, Pin, Edit2 } from 'lucide-react';
// FIX: Import ResourceStatus to strongly type data from Supabase
import { Resource, ResourceStatus } from '@/types';
// FIX: Import React to correctly type the component and resolve the 'key' prop error.
import React from 'react';

export const dynamic = 'force-dynamic';

async function getHomepageSlotsData() {
    const supabase = await createClient();
    
    // Fetch modules and all resources in parallel
    const [modulesResult, resourcesResult] = await Promise.all([
        supabase
            .from('homepage_modules')
            .select('type, content_item_ids')
            .in('type', ['latest_updates_carousel', 'latest_updates_fixed']),
        supabase
            .from('resources')
            .select('id, title, status, slug')
    ]);

    if (modulesResult.error) throw modulesResult.error;
    if (resourcesResult.error) throw resourcesResult.error;
    
    // FIX: Add explicit types for data coming from Supabase to prevent `any` propagation.
    const modules: { type: string; content_item_ids: string[] }[] = modulesResult.data || [];
    const allResources: { id: string; title: string; status: ResourceStatus; slug: string }[] = resourcesResult.data || [];
    
    const resourceMap = new Map(allResources.map(r => [r.id, r]));

    const carouselModule = modules.find(m => m.type === 'latest_updates_carousel');
    const fixedModule = modules.find(m => m.type === 'latest_updates_fixed');

    const carouselIds = carouselModule?.content_item_ids || [];
    const fixedIds = fixedModule?.content_item_ids || [];
    
    // Resolve IDs to full resource objects, handling cases where a resource might be deleted
    // With strong types above, casts are no longer needed here.
    const carouselItems = carouselIds.map(id => resourceMap.get(id) || { id, title: 'Resource not found or deleted', status: 'unknown', slug: '' });
    const fixedItems = fixedIds.map(id => resourceMap.get(id) || { id, title: 'Resource not found or deleted', status: 'unknown', slug: '' });

    return { carouselItems, fixedItems };
}

// FIX: Define a dedicated props interface for the component.
interface ResourceListItemProps {
  item: Resource | { id: string; title: string; status: string; slug: string };
}

// FIX: Type the component as a React.FC to correctly handle special props like 'key',
// and move it outside the main component body.
const ResourceListItem: React.FC<ResourceListItemProps> = ({ item }) => (
  <li className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
    <div className="flex-1 pr-4">
      <p className="font-medium text-gray-800 truncate" title={item.title}>{item.title}</p>
    </div>
    <div className="flex items-center gap-4">
      {item.status !== 'unknown' && (
         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
            item.status === 'published' 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-gray-50 text-gray-600 border-gray-200'
         }`}>
          {item.status}
        </span>
      )}
      {item.slug && (
        <Link href={`/admin/resources/${item.id}/edit`} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md">
          <Edit2 size={16} />
        </Link>
      )}
    </div>
  </li>
);

export default async function HomepageSlotsPage() {
  const { carouselItems, fixedItems } = await getHomepageSlotsData();

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">首页配置 (Homepage)</h1>
        <p className="text-sm text-gray-500 mt-1">
          此页面仅用于展示「最新动态」模块的当前配置。如需修改，请前往
          <Link href="/admin/resources" className="text-gray-900 font-medium underline hover:text-black">内容资源</Link>
          进行操作。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Carousel Slot */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">最新动态 · 轮播位</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/75 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {carouselItems.length > 0 ? (
                carouselItems.map((item) => <ResourceListItem key={item.id} item={item} />)
              ) : (
                <li className="p-6 text-center text-sm text-gray-500">
                  当前轮播位没有配置内容
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Fixed Slot */}
        <div className="space-y-3">
           <div className="flex items-center gap-2">
            <Pin size={18} className="text-slate-600" />
            <h2 className="text-lg font-semibold text-gray-900">最新动态 · 固定位</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/75 overflow-hidden">
            <ul className="divide-y divide-gray-100">
               {fixedItems.length > 0 ? (
                fixedItems.map((item) => <ResourceListItem key={item.id} item={item} />)
              ) : (
                <li className="p-6 text-center text-sm text-gray-500">
                  当前固定位没有配置内容
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
