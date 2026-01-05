'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SectionEditor({ initialData }: { initialData?: any }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contentItems, setContentItems] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    subtitle: initialData?.subtitle || '',
    type: initialData?.type || 'featured_resources',
    content: initialData?.content || '',
    linked_resources: initialData?.linked_resources || [], // Array of IDs
    is_active: initialData?.is_active ?? true,
    display_order: initialData?.display_order ?? 0
  });

  useEffect(() => {
    // Load published content for selection if type is featured_resources
    const loadContent = async () => {
      const { data } = await supabase.from('content_items').select('id, title, status').eq('status', 'Published').order('published_at', { ascending: false });
      setContentItems(data || []);
    };
    loadContent();
  }, []);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleResourceToggle = (id: string) => {
    const current = [...formData.linked_resources];
    if (current.includes(id)) {
      setFormData(prev => ({ ...prev, linked_resources: current.filter(x => x !== id) }));
    } else {
      setFormData(prev => ({ ...prev, linked_resources: [...current, id] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { ...formData };

      if (initialData?.id) {
        const { error } = await supabase.from('homepage_sections').update(payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        // Get max order to append to end
        const { data: maxOrderData } = await supabase.from('homepage_sections').select('display_order').order('display_order', { ascending: false }).limit(1);
        const nextOrder = (maxOrderData?.[0]?.display_order ?? -1) + 1;
        
        const { error } = await supabase.from('homepage_sections').insert({ ...payload, display_order: nextOrder });
        if (error) throw error;
      }

      router.push('/admin/homepage');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">模块标题</label>
            <input name="title" required value={formData.title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" placeholder="例如：最新洞察" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">模块类型</label>
            <select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border">
              <option value="hero">首屏 (Hero)</option>
              <option value="featured_resources">精选资源 (Featured Resources)</option>
              <option value="value_points">价值主张 (Value Points)</option>
              <option value="cta">行动号召 (CTA)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">副标题 (可选)</label>
          <input name="subtitle" value={formData.subtitle} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" placeholder="简短的描述性文字" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">内容 (Markdown)</label>
          <p className="text-xs text-gray-400 mb-2">用于 Hero 的介绍文案，或 CTA 的引导语。</p>
          <textarea name="content" value={formData.content} onChange={handleChange} rows={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border font-mono text-sm" />
        </div>

        {formData.type === 'featured_resources' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">关联资源内容</label>
            <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto p-2 grid gap-1 bg-gray-50">
              {contentItems.map(item => (
                <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.linked_resources.includes(item.id)}
                    onChange={() => handleResourceToggle(item.id)}
                  />
                  <span className="text-sm text-gray-700">{item.title}</span>
                </label>
              ))}
              {contentItems.length === 0 && <p className="text-gray-400 text-sm p-2">暂无已发布的内容</p>}
            </div>
            <p className="text-xs text-gray-400 mt-1">勾选的内容将展示在此模块中。</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="is_active"
            checked={formData.is_active} 
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">立即启用此模块</label>
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          type="button" 
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          取消
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          {loading && <Loader2 className="animate-spin" size={16} />}
          保存模块
        </button>
      </div>
    </form>
  );
}
