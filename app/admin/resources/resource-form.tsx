'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Save, Globe, Layout, FileText, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { Resource } from '@/types';
import Link from 'next/link';

interface ResourceFormProps {
  initialData?: Resource;
}

const TYPE_CAROUSEL = 'latest_updates_carousel';
const TYPE_FIXED = 'latest_updates_fixed';

export default function ResourceForm({ initialData }: ResourceFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    category: initialData?.category || 'report',
    summary: initialData?.summary || '',
    content: initialData?.content || '',
    status: initialData?.status || 'draft',
    published_at: initialData?.published_at 
      ? new Date(initialData.published_at).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0],
  });

  // Homepage Slots State
  const [homepageFlags, setHomepageFlags] = useState({
    carousel: false, // latest_updates_carousel
    sidebar: false,  // latest_updates_fixed
  });

  // Load Homepage Config (Slots) from homepage_modules
  useEffect(() => {
    if (!initialData?.id) return;

    const fetchHomepageSlots = async () => {
      // Fetch based on 'type' column
      const { data, error } = await supabase
        .from('homepage_modules')
        .select('type, content_item_ids')
        .in('type', [TYPE_CAROUSEL, TYPE_FIXED]);
      
      if (error) {
        console.error("Error fetching homepage slots:", error);
        return;
      }

      const flags = { carousel: false, sidebar: false };
      
      if (data) {
        data.forEach((row: any) => {
          const ids: string[] = Array.isArray(row.content_item_ids) ? row.content_item_ids : [];
          if (ids.includes(initialData.id)) {
            if (row.type === TYPE_CAROUSEL) flags.carousel = true;
            if (row.type === TYPE_FIXED) flags.sidebar = true;
          }
        });
      }
      setHomepageFlags(flags);
    };
    
    fetchHomepageSlots();
  }, [initialData?.id, supabase]);

  // Slug auto-generation logic
  useEffect(() => {
    const generateSlug = (text: string) => {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     
        .replace(/[^\w\-]+/g, '') 
        .replace(/\-\-+/g, '-');  
    };
    
    if (!initialData?.id && formData.title) {
       setFormData(prev => ({ ...prev, slug: generateSlug(prev.title) }));
    }
  }, [formData.title, initialData?.id]);

  const handleRegenerateSlug = () => {
    const generateSlug = (text: string) => {
        return text
          .toString()
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]+/g, '')
          .replace(/\-\-+/g, '-');
      };
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

  const toggleStatus = () => {
    setFormData(prev => ({
      ...prev,
      status: prev.status === 'published' ? 'draft' : 'published'
    }));
  };

  // Helper to update homepage_modules array
  const updateHomepageSlot = async (typeKey: string, shouldBeIn: boolean, resourceId: string) => {
    // 1. Fetch current list AND other required fields to preserve them
    const { data: currentData, error: fetchError } = await supabase
      .from('homepage_modules')
      .select('content_item_ids, status, data')
      .eq('type', typeKey)
      .maybeSingle();
    
    if (fetchError) {
        console.error(`Error fetching ${typeKey}:`, fetchError);
        // Don't throw here to allow saving the resource even if module fetch fails
    }
    
    let ids: string[] = [];
    if (currentData?.content_item_ids && Array.isArray(currentData.content_item_ids)) {
        ids = [...currentData.content_item_ids];
    }

    const isCurrentlyIn = ids.includes(resourceId);

    // 2. Determine if update is needed
    let needsUpdate = false;

    if (shouldBeIn && !isCurrentlyIn) {
        // Add to front
        ids.unshift(resourceId);
        needsUpdate = true;
    } else if (!shouldBeIn && isCurrentlyIn) {
        // Remove
        ids = ids.filter(id => id !== resourceId);
        needsUpdate = true;
    } else if (!currentData && shouldBeIn) {
        // Row doesn't exist, but we want to add it
        ids = [resourceId];
        needsUpdate = true;
    }

    if (!needsUpdate && currentData) {
        return;
    }

    // Prepare fields for payload. If row didn't exist, set defaults.
    const status = currentData?.status || 'active';
    const dataField = currentData?.data || {};

    // 3. Upsert using 'type' as the key
    const { error: upsertError } = await supabase
        .from('homepage_modules')
        .upsert({
            type: typeKey,
            content_item_ids: ids,
            status: status,
            data: dataField
            // created_at is handled by DB default
        }, { onConflict: 'type' });

    if (upsertError) {
        console.error(`Error updating ${typeKey}:`, upsertError);
        throw upsertError;
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
        alert("请输入标题");
        return;
    }

    setLoading(true);

    try {
      // 1. Prepare Payload
      const payload: any = {
        title: formData.title,
        slug: formData.slug || `resource-${Date.now()}`, 
        category: formData.category,
        summary: formData.summary,
        content: formData.content,
        status: formData.status,
      };

      if (formData.status === 'published') {
         payload.published_at = formData.published_at 
            ? new Date(formData.published_at).toISOString() 
            : new Date().toISOString();
      } else {
         if (formData.published_at) {
             payload.published_at = new Date(formData.published_at).toISOString();
         }
      }

      let resourceId = initialData?.id;

      // 2. Save Resource
      if (resourceId) {
        const { error } = await supabase
          .from('resources')
          .update(payload)
          .eq('id', resourceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('resources')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select('id')
          .single();
        if (error) throw error;
        resourceId = data.id;
      }

      // 3. Update Homepage Slots (homepage_modules) using 'type'
      if (resourceId) {
        await Promise.all([
          updateHomepageSlot(TYPE_CAROUSEL, homepageFlags.carousel, resourceId),
          updateHomepageSlot(TYPE_FIXED, homepageFlags.sidebar, resourceId)
        ]);
      }

      router.push('/admin/resources');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(`保存失败: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between sticky top-0 bg-gray-50/95 backdrop-blur z-20 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Link href="/admin/resources" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">{initialData ? '编辑资源' : '新建资源'}</h1>
            {initialData && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${formData.status === 'published' ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formData.status}
                  </span>
                  {formData.published_at && (
                    <span className="text-xs text-gray-400">
                      {formData.published_at}
                    </span>
                  )}
                </div>
            )}
          </div>
        </div>
        
        {/* Right Actions: Toggle + Save */}
        <div className="flex items-center gap-4">
            {/* Status Toggle */}
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
                <span className={`text-sm font-medium transition-colors ${formData.status === 'published' ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formData.status === 'published' ? '已发布 (On)' : '草稿 (Off)'}
                </span>
                <button
                    type="button"
                    onClick={toggleStatus}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                        formData.status === 'published' ? 'bg-gray-900' : 'bg-gray-200'
                    }`}
                >
                    <span className="sr-only">Toggle publish status</span>
                    <span
                        className={`${
                            formData.status === 'published' ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-6 py-2 rounded-full font-medium transition disabled:opacity-50 shadow-md"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              保存更改
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Block 1: Basic Information */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FileText size={18} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">基础信息 (Basic Info)</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题 (Title) <span className="text-red-500">*</span></label>
                <input
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="请输入资源标题"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">发布日期 (Date)</label>
                  <div className="relative">
                    <input
                        type="date"
                        name="published_at"
                        value={formData.published_at}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 pl-10"
                    />
                    <CalendarIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">内容类型 (Category) <span className="text-red-500">*</span></label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
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
                      <button 
                        type="button" 
                        onClick={handleRegenerateSlug}
                        className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
                        title="Regenerate based on title"
                      >
                          <RefreshCw size={12} /> Regenerate
                      </button>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 font-mono break-all">
                      <span className="text-gray-400">/library/</span>
                      <span className="text-gray-900 font-medium">{formData.slug || '{slug}'}</span>
                  </div>
              </div>
            </div>
          </section>

          {/* Block 2: Content */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Layout size={18} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">内容编辑 (Content)</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">摘要 (Summary)</label>
                <textarea
                  name="summary"
                  rows={3}
                  value={formData.summary}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="用于列表卡片展示的简短描述..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">正文 (Body)</label>
                <textarea
                  name="content"
                  rows={15}
                  value={formData.content}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono text-sm"
                  placeholder="在此输入正文内容 (支持 Markdown)..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-8">
           <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Globe size={18} className="text-gray-900" />
              <h2 className="font-semibold text-gray-900">首页推广 (Homepage)</h2>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">首页位置 (Homepage Slots)</label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      name="carousel"
                      checked={homepageFlags.carousel}
                      onChange={handleHomepageFlagChange}
                      className="mt-1 h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900">最新动态 · 轮播位</span>
                      <span className="block text-xs text-gray-500 mt-0.5">Top Carousel (Featured)</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      name="sidebar"
                      checked={homepageFlags.sidebar}
                      onChange={handleHomepageFlagChange}
                      className="mt-1 h-4 w-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900">最新动态 · 固定位</span>
                      <span className="block text-xs text-gray-500 mt-0.5">Sidebar List (Fixed)</span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  勾选即自动加入首页对应列表。
                </p>
              </div>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}