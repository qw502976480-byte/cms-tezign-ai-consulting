'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { HomepageLatestNewsConfig } from '@/types';

interface EditorProps {
  allResources: { id: string; title: string; status: string }[];
  initialCarouselIds: string[];
  initialFixedIds: string[];
}

export default function LatestNewsEditor({ allResources, initialCarouselIds, initialFixedIds }: EditorProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use Sets for efficient lookups and manipulation
  const [selectedCarouselIds, setSelectedCarouselIds] = useState(new Set(initialCarouselIds));
  const [selectedFixedIds, setSelectedFixedIds] = useState(new Set(initialFixedIds));

  const handleToggle = (id: string, type: 'carousel' | 'fixed') => {
    const setter = type === 'carousel' ? setSelectedCarouselIds : setSelectedFixedIds;
    setter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: current, error: fetchError } = await supabase
        .from('homepage_config')
        .select('config')
        .eq('type', 'latest_news')
        .single();
      
      if (fetchError) throw fetchError;

      const newConfig: HomepageLatestNewsConfig = {
        ...(current.config as HomepageLatestNewsConfig), // Preserve other fields if any
        featured_items: Array.from(selectedCarouselIds),
        list_items: Array.from(selectedFixedIds),
      };

      const { error: updateError } = await supabase
        .from('homepage_config')
        .update({ config: newConfig as any, updated_at: new Date().toISOString() })
        .eq('type', 'latest_news');

      if (updateError) throw updateError;
      
      router.push('/admin/homepage');
      router.refresh();

    } catch (e: any) {
      setError(e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end items-center gap-4 mb-6 sticky top-20 py-4 bg-gray-50/90 backdrop-blur-sm z-10 border-b border-gray-200 -mx-8 px-8">
        {error && <p className="text-sm text-red-600 mr-auto">保存失败: {error}</p>}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
          style={{minWidth: '110px'}}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : '保存配置'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-3">最新消息 · 轮播 (Carousel)</h2>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm max-h-[60vh] overflow-y-auto space-y-2">
            {allResources.map(resource => (
              <label key={resource.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedCarouselIds.has(resource.id)}
                  onChange={() => handleToggle(resource.id, 'carousel')}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-medium text-gray-800">{resource.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">最新消息 · 固定 (Fixed)</h2>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm max-h-[60vh] overflow-y-auto space-y-2">
            {allResources.map(resource => (
              <label key={resource.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedFixedIds.has(resource.id)}
                  onChange={() => handleToggle(resource.id, 'fixed')}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-medium text-gray-800">{resource.title}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}