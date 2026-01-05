'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Plus, Edit2, MoveUp, MoveDown, CheckCircle, XCircle } from 'lucide-react';
import { HomepageSection } from '@/types';

export default function HomepageManager() {
  const supabase = createClient();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    const { data } = await supabase
      .from('homepage_sections')
      .select('*')
      .order('display_order', { ascending: true });
    setSections(data || []);
    setLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('homepage_sections').update({ is_active: !current }).eq('id', id);
    loadSections();
  };

  const moveSection = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap in array
    [newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]];
    
    // Update display_order for all to be safe (or just the two)
    // Simpler to just re-index everything to avoid gaps
    const updates = newSections.map((s, idx) => ({
      id: s.id,
      display_order: idx
    }));

    // Optimistic update
    setSections(newSections);

    // Batch update via Upsert
    await supabase.from('homepage_sections').upsert(updates);
    loadSections(); // Refresh to be sure
  };

  const handleDelete = async (id: string) => {
    if(!confirm('确定要删除这个模块吗？')) return;
    await supabase.from('homepage_sections').delete().eq('id', id);
    loadSections();
  }

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      hero: '首屏 (Hero)',
      featured_resources: '精选资源',
      value_points: '价值主张',
      cta: '行动号召 (CTA)'
    };
    return map[type] || type;
  }

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">首页模块管理</h1>
        <Link 
          href="/admin/homepage/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> 新增模块
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 w-16">排序</th>
              <th className="px-6 py-4">模块标题</th>
              <th className="px-6 py-4">类型</th>
              <th className="px-6 py-4">启用状态</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sections.map((section, index) => (
              <tr key={section.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 flex gap-1">
                  <button onClick={() => moveSection(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30">
                    <MoveUp size={14} />
                  </button>
                  <button onClick={() => moveSection(index, 'down')} disabled={index === sections.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30">
                    <MoveDown size={14} />
                  </button>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">
                  {section.title}
                  {section.subtitle && <p className="text-gray-400 text-xs font-normal">{section.subtitle}</p>}
                </td>
                <td className="px-6 py-4 text-gray-500">{getTypeLabel(section.type)}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => toggleActive(section.id, section.is_active)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                      section.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {section.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {section.is_active ? '已启用' : '已禁用'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-3 items-center">
                  <Link href={`/admin/homepage/${section.id}/edit`} className="text-blue-600 hover:underline">
                    编辑
                  </Link>
                  <button onClick={() => handleDelete(section.id)} className="text-red-500 hover:underline text-xs">
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">暂无模块，请点击右上角新建</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
