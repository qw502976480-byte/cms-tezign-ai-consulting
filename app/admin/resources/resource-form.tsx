
'use client';

import React, { useState, useEffect, useTransition, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Save, Globe, Layout, FileText, RefreshCw, Calendar as CalendarIcon, Trash2, MoreHorizontal, ChevronDown, Check, Tag } from 'lucide-react';
import { Resource } from '@/types';
import Link from 'next/link';
import { deleteResource } from './actions';

/**
 * Reusable function to update a homepage module's content IDs.
 * It handles upserting, deduplication, and ensures required fields are set.
 */
async function updateHomepageModuleIds(
  supabase: ReturnType<typeof createClient>,
  type: string,
  ids: string[]
) {
  const uniqueIds = Array.from(new Set(ids));
  const { error } = await supabase
    .from('homepage_modules')
    .upsert({ type, content_item_ids: uniqueIds, status: 'draft' }, { onConflict: 'type' });

  if (error) {
    console.error(`Error updating homepage module ${type}:`, error);
    throw error;
  }
}

interface ResourceFormProps {
  initialData?: Resource;
}

export default function ResourceForm({ initialData }: ResourceFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const getDefaultFormData = () => ({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    category: initialData?.category || 'report',
    summary: initialData?.summary || '',
    content: initialData?.content || '',
    status: initialData?.status || 'draft',
    published_at: initialData?.published_at 
      ? new Date(initialData.published_at).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0],
    interests: initialData?.interests || [] as string[],
  });

  const [formData, setFormData] = useState(getDefaultFormData());
  const [homepageFlags, setHomepageFlags] = useState({ carousel: false, sidebar: false });
  
  // Local state for interests input (comma separated)
  const [interestsInput, setInterestsInput] = useState(initialData?.interests?.join(', ') || '');

  // State for dirty check
  const [initialFormState, setInitialFormState] = useState(getDefaultFormData());
  const [initialHomepageFlags, setInitialHomepageFlags] = useState({ carousel: false, sidebar: false });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isDirty = useMemo(() => {
    // Basic deep check approximation
    return JSON.stringify(formData) !== JSON.stringify(initialFormState) ||
           JSON.stringify(homepageFlags) !== JSON.stringify(initialHomepageFlags) ||
           interestsInput !== (initialData?.interests?.join(', ') || '');
  }, [formData, homepageFlags, initialFormState, initialHomepageFlags, interestsInput, initialData?.interests]);
  
  // Custom hook to handle clicks outside of a ref
  const useClickOutside = (ref: React.RefObject<HTMLDivElement>, handler: () => void) => {
    useEffect(() => {
      const listener = (event: MouseEvent) => {
        if (!ref.current || ref.current.contains(event.target as Node)) return;
        handler();
      };
      document.addEventListener('mousedown', listener);
      return () => document.removeEventListener('mousedown', listener);
    }, [ref, handler]);
  };

  useClickOutside(saveMenuRef, () => setIsSaveMenuOpen(false));
  useClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));

  useEffect(() => {
    if (!initialData?.id) return;
    const fetchHomepageSlots = async () => {
      const { data: modules, error } = await supabase
        .from('homepage_modules')
        .select('type, content_item_ids')
        .in('type', ['latest_updates_carousel', 'latest_updates_fixed']);
      
      if (error) { console.error("Error fetching homepage modules:", error); return; }

      const carouselModule = modules.find(m => m.type === 'latest_updates_carousel');
      const fixedModule = modules.find(m => m.type === 'latest_updates_fixed');

      const flags = {
        carousel: carouselModule?.content_item_ids?.includes(initialData.id) || false,
        sidebar: fixedModule?.content_item_ids?.includes(initialData.id) || false,
      };
      setHomepageFlags(flags);
      setInitialHomepageFlags(flags);
    };
    fetchHomepageSlots();
  }, [initialData?.id, supabase]);

  useEffect(() => {
    const generateSlug = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
    if (!initialData?.id && formData.title) {
       setFormData(prev => ({ ...prev, slug: generateSlug(prev.title) }));
    }
  }, [formData.title, initialData?.id]);

  const handleRegenerateSlug = () => {
    const generateSlug = (text: string) => text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
    setFormData(prev => ({ ...prev, slug: generateSlug(prev.title) }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleHomepageFlagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setHomepageFlags(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleDiscardChanges = () => {
     if (confirm("确定要丢弃所有未保存的更改吗？")) {
        setFormData(initialFormState);
        setInterestsInput(initialData?.interests?.join(', ') || '');
        setHomepageFlags(initialHomepageFlags);
        setIsMoreMenuOpen(false);
     }
  };

  const handleBackNavigation = (e: React.MouseEvent) => {
    if (isDirty) {
      if (!confirm("您有未保存的更改。确定要离开吗？")) {
        e.preventDefault();
      }
    }
  };

  const handleSave = (options: { publish?: boolean; unpublish?: boolean } = {}) => {
    startTransition(async () => {
      if (!formData.title) { alert("请输入标题"); return; }

      try {
        const payload = { ...formData };
        
        // Parse interests
        payload.interests = interestsInput
            .split(/[,，]/)
            .map(s => s.trim())
            .filter(Boolean);

        if (options.publish) payload.status = 'published';
        if (options.unpublish) payload.status = 'draft';
        
        if (payload.status === 'published' && (!initialData || initialData.status !== 'published')) {
          payload.published_at = new Date().toISOString().split('T')[0];
        } else if (formData.published_at) {
          payload.published_at = new Date(formData.published_at).toISOString().split('T')[0];
        }

        let resourceId = initialData?.id;

        if (resourceId) {
          const { error } = await supabase.from('resources').update(payload).eq('id', resourceId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('resources').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single();
          if (error) throw error;
          resourceId = data.id;
        }

        if (resourceId) {
          const { data: modules } = await supabase.from('homepage_modules').select('type, content_item_ids').in('type', ['latest_updates_carousel', 'latest_updates_fixed']);
          const carouselIds = new Set<string>(modules?.find(m => m.type === 'latest_updates_carousel')?.content_item_ids || []);
          const fixedIds = new Set<string>(modules?.find(m => m.type === 'latest_updates_fixed')?.content_item_ids || []);

          homepageFlags.carousel ? carouselIds.add(resourceId) : carouselIds.delete(resourceId);
          homepageFlags.sidebar ? fixedIds.add(resourceId) : fixedIds.delete(resourceId);

          await Promise.all([
            updateHomepageModuleIds(supabase, 'latest_updates_carousel', Array.from(carouselIds)),
            updateHomepageModuleIds(supabase, 'latest_updates_fixed', Array.from(fixedIds)),
          ]);
        }

        alert("保存成功!");
        router.push('/admin/resources');
        router.refresh();
      } catch (error: any) {
        console.error(error);
        alert(`保存失败: ${error.message || 'Unknown error'}`);
      }
    });
  };
  
  const handleDelete = () => {
    if (!initialData?.id) return;
    startTransition(async () => {
        const result = await deleteResource(initialData.id);
        if (result.success) {
            alert("资源已删除");
            router.push('/admin/resources');
            router.refresh();
        } else {
            alert(`删除失败: ${result.error}`);
        }
        setShowDeleteConfirm(false);
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between sticky top-0 bg-gray-50/95 backdrop-blur z-20 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Link href="/admin/resources" onClick={handleBackNavigation} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{initialData ? '编辑资源' : '新建资源'}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${formData.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'} capitalize`}>
                {formData.status}
            </span>
            <div className="relative inline-flex shadow-sm rounded-full" ref={saveMenuRef}>
                <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={isPending || !isDirty}
                    className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-6 py-2 rounded-l-full font-medium transition disabled:opacity-50"
                >
                    {isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    保存 (Save)
                </button>
                <button
                    type="button"
                    onClick={() => setIsSaveMenuOpen(prev => !prev)}
                    disabled={isPending || !isDirty}
                    className="px-3 py-2 bg-gray-900 hover:bg-black text-white rounded-r-full border-l border-gray-700 disabled:opacity-50"
                >
                    <ChevronDown size={16} />
                </button>
                {isSaveMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10 p-1">
                        {formData.status !== 'published' && (
                            <button onClick={() => { handleSave({ publish: true }); setIsSaveMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">保存并发布</button>
                        )}
                        {formData.status === 'published' && (
                            <button onClick={() => { handleSave({ unpublish: true }); setIsSaveMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">保存并下架</button>
                        )}
                    </div>
                )}
            </div>
            
            <div className="relative" ref={moreMenuRef}>
                <button onClick={() => setIsMoreMenuOpen(prev => !prev)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <MoreHorizontal size={20} />
                </button>
                {isMoreMenuOpen && (
                     <div className="absolute top-full right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-10 p-1">
                        <button onClick={handleDiscardChanges} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">丢弃更改</button>
                         {initialData && (
                            <button onClick={() => { setShowDeleteConfirm(true); setIsMoreMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded">删除</button>
                         )}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        <div className="lg:col-span-2 space-y-8">
          
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FileText size={18} className="text-gray-400" /><h2 className="font-semibold text-gray-900">基础信息</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题 <span className="text-red-500">*</span></label>
                <input name="title" required value={formData.title} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">发布日期</label>
                  <div className="relative">
                    <input type="date" name="published_at" value={formData.published_at} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 pl-10" />
                    <CalendarIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">内容类型 <span className="text-red-500">*</span></label>
                  <select name="category" value={formData.category} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="report">Report</option>
                    <option value="announcement">Announcement</option>
                    <option value="case_study">Case Study</option>
                    <option value="methodology">Methodology</option>
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">URL Preview</label>
                      <button type="button" onClick={handleRegenerateSlug} className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors" title="Regenerate based on title">
                          <RefreshCw size={12} /> Regenerate
                      </button>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 font-mono break-all">
                      <span className="text-gray-400">/library/</span>
                      <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="text-gray-900 font-medium bg-transparent p-0 border-0 focus:ring-0" />
                  </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Layout size={18} className="text-gray-400" /><h2 className="font-semibold text-gray-900">内容编辑</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
                <textarea name="summary" rows={3} value={formData.summary} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">兴趣标签 (Tags)</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={interestsInput} 
                        onChange={(e) => setInterestsInput(e.target.value)} 
                        placeholder="e.g. AI, Marketing, Design (逗号分隔)"
                        className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" 
                    />
                    <Tag className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-500 mt-1">用于自动化分发时的规则匹配，请使用半角逗号分隔。</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">正文 (Markdown)</label>
                <textarea name="content" rows={15} value={formData.content} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono text-sm" />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-36">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Globe size={18} className="text-gray-900" /><h2 className="font-semibold text-gray-900">首页推广</h2>
            </div>
            <div className="p-6 space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"><input type="checkbox" name="carousel" checked={homepageFlags.carousel} onChange={handleHomepageFlagChange} className="mt-1 h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900" /><div><span className="block text-sm font-medium text-gray-900">最新动态 · 轮播位</span><span className="block text-xs text-gray-500 mt-0.5">Top Carousel (Featured)</span></div></label>
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"><input type="checkbox" name="sidebar" checked={homepageFlags.sidebar} onChange={handleHomepageFlagChange} className="mt-1 h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900" /><div><span className="block text-sm font-medium text-gray-900">最新动态 · 固定位</span><span className="block text-xs text-gray-500 mt-0.5">Sidebar List (Fixed)</span></div></label>
              <p className="text-xs text-gray-400 mt-3">勾选即自动加入首页对应列表。</p>
            </div>
          </section>
        </div>
      </div>
      
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">确认删除资源</h3>
            <p className="mt-2 text-sm text-gray-500">
              确定要永久删除「{initialData?.title}」吗？此操作不可撤销。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleDelete} disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {isPending ? <Loader2 className="animate-spin" size={16} /> : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
