'use client';
// FIX: Import React to use React types
import React from 'react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { HomepageConfig, CapabilityItem } from '@/types';

export default function SectionEditor({ moduleConfig }: { moduleConfig: HomepageConfig }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(moduleConfig.config);
  
  // Stores simple list of resources for selection
  const [resources, setResources] = useState<{id: string, title: string}[]>([]);

  useEffect(() => {
    // Load resources for "Latest News" module selection
    if (moduleConfig.type === 'latest_news') {
      const loadResources = async () => {
        const { data } = await supabase
          .from('resources')
          .select('id, title')
          .order('created_at', { ascending: false });
        setResources(data || []);
      };
      loadResources();
    }
  }, [moduleConfig.type, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCapabilityChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig(prev => {
      const newItems = [...(prev as any).capability_items];
      newItems[index] = { ...newItems[index], [name]: value };
      return { ...prev, capability_items: newItems };
    });
  };

  const handleResourceToggle = (field: 'featured_items' | 'list_items', id: string, limit: number) => {
    setConfig(prev => {
      const current = [...(prev as any)[field] || []];
      const isSelected = current.includes(id);

      if (isSelected) {
        return { ...prev, [field]: current.filter(x => x !== id) };
      } else if (current.length < limit) {
        return { ...prev, [field]: [...current, id] };
      }
      
      alert(`Limit reached. You can only select ${limit} items.`);
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('homepage_config')
        .update({ config: config as any, updated_at: new Date().toISOString() })
        .eq('type', moduleConfig.type);

      if (error) throw error;

      router.push('/admin/homepage');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const renderFormFields = () => {
    switch (moduleConfig.type) {
      case 'hero':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">主标题</label>
              <input name="title" required value={(config as any).title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">副标题</label>
              <textarea name="subtitle" required value={(config as any).subtitle} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CTA 按钮文案</label>
              <input name="cta_text" required value={(config as any).cta_text} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
          </>
        );
      case 'gpt_search':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">输入框占位提示</label>
              <input name="placeholder_text" required value={(config as any).placeholder_text} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">示例问题 (每个一行)</label>
              <textarea name="example_prompts" value={(config as any).example_prompts.join('\n')} onChange={(e) => setConfig({ ...config, example_prompts: e.target.value.split('\n') })} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
          </>
        );
      case 'latest_news':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Left Carousel (Max 5)</label>
              <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto p-2 grid gap-1 bg-gray-50">
                {resources.map(item => (
                  <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                    <input type="checkbox" checked={(config as any).featured_items?.includes(item.id)} onChange={() => handleResourceToggle('featured_items', item.id!, 5)} className="text-gray-900 focus:ring-gray-900" />
                    <span className="text-sm text-gray-700">{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Right List (Max 3)</label>
              <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto p-2 grid gap-1 bg-gray-50">
                {resources.map(item => (
                  <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                    <input type="checkbox" checked={(config as any).list_items?.includes(item.id)} onChange={() => handleResourceToggle('list_items', item.id!, 3)} className="text-gray-900 focus:ring-gray-900" />
                    <span className="text-sm text-gray-700">{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      case 'core_capabilities':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">大主题标题</label>
              <input name="section_title" required value={(config as any).section_title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div className="space-y-6 pt-4">
              <h3 className="text-base font-medium text-gray-800 border-b pb-2">能力卡片 (固定 3 个)</h3>
              {(config as any).capability_items.map((item: CapabilityItem, index: number) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-600">图片 URL</label>
                    <input name="image" value={item.image} onChange={(e) => handleCapabilityChange(index, e)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:ring-gray-900 focus:border-gray-900" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">能力标题</label>
                      <input name="title" value={item.title} onChange={(e) => handleCapabilityChange(index, e)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:ring-gray-900 focus:border-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">能力说明</label>
                      <textarea name="description" value={item.description} onChange={(e) => handleCapabilityChange(index, e)} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border text-sm focus:ring-gray-900 focus:border-gray-900" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      case 'product_claim':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">主张标题</label>
              <input name="title" required value={(config as any).title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">主张正文 (支持 HTML)</label>
              <textarea name="content" required value={(config as any).content} onChange={handleChange} rows={5} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">配图 URL</label>
              <input name="image" required value={(config as any).image} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
          </>
        );
      case 'primary_cta':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">CTA 标题</label>
              <input name="title" required value={(config as any).title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CTA 描述 (可选)</label>
              <textarea name="description" value={(config as any).description} onChange={handleChange} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">按钮文案</label>
              <input name="cta_text" required value={(config as any).cta_text} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border focus:ring-gray-900 focus:border-gray-900" />
            </div>
          </>
        );
      default:
        return <p>未知的模块类型</p>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        {renderFormFields()}
      </div>
      <div className="flex gap-4">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">取消</button>
        <button type="submit" disabled={loading} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50">
          {loading && <Loader2 className="animate-spin" size={16} />}
          保存配置
        </button>
      </div>
    </form>
  );
}