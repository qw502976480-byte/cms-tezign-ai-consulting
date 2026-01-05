'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Save, Globe, Layout, FileText } from 'lucide-react';
import { Resource, HomepageLatestNewsConfig } from '@/types';
import Link from 'next/link';

interface ResourceFormProps {
  initialData?: Resource;
}

export default function ResourceForm({ initialData }: ResourceFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [newsConfig, setNewsConfig] = useState<HomepageLatestNewsConfig | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    category: initialData?.category || 'report',
    summary: initialData?.summary || '',
    content: initialData?.content || '',
    published: initialData?.published || false,
  });

  // Homepage Slots State
  const [homepageFlags, setHomepageFlags] = useState({
    featured: false, // 轮播位
    latest: false,   // 固定位
  });

  // Load Homepage Config on Mount
  useEffect(() => {
    const fetchHomepageConfig = async () => {
      const { data } = await supabase
        .from('homepage_config')
        .select('config')
        .eq('type', 'latest_news')
        .single();
      
      if (data && data.config) {
        const config = data.config as HomepageLatestNewsConfig;
        setNewsConfig(config);
        
        if (initialData?.id) {
          setHomepageFlags({
            featured: config.featured_items?.includes(initialData.id) || false,
            latest: config.list_items?.includes(initialData.id) || false,
          });
        }
      }
    };
    
    fetchHomepageConfig();
  }, [initialData?.id, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Handle Checkbox for 'published'
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleHomepageFlagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setHomepageFlags(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Save Resource
      const payload = {
        title: formData.title,
        slug: formData.slug,
        category: formData.category,
        summary: formData.summary,
        content: formData.content,
        published: formData.published,
      };

      let resourceId = initialData?.id;

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

      // 2. Update Homepage Config if available and resourceId exists
      if (newsConfig && resourceId) {
        const newConfig = { ...newsConfig };
        const id = resourceId;

        // Update Featured Items (Carousel)
        let featured = newConfig.featured_items || [];
        featured = featured.filter(item => item !== id); // Remove first
        if (homepageFlags.featured) {
            featured.unshift(id); // Add to top
        }
        newConfig.featured_items = featured;

        // Update List Items (Fixed)
        let list = newConfig.list_items || [];
        list = list.filter(item => item !== id); // Remove first
        if (homepageFlags.latest) {
            list.unshift(id); // Add to top
        }
        newConfig.list_items = list;

        const { error: configError } = await supabase
            .from('homepage_config')
            .update({ config: newConfig, updated_at: new Date().toISOString() })
            .eq('type', 'latest_news');
        
        if (configError) throw configError;
      }

      router.push('/admin/resources');
      router.refresh();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/resources" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{initialData ? '编辑资源' : '新建资源'}</h1>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50 shadow-sm"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          保存所有更改
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Block 1: Basic Information */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <FileText size={18} className="text-gray-500" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="请输入资源标题"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">内容类型 (Category) <span className="text-red-500">*</span></label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  >
                    <option value="report">Report</option>
                    <option value="announcement">Announcement</option>
                    <option value="case_study">Case Study</option>
                    <option value="methodology">Methodology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL 标识 (Slug) <span className="text-red-500">*</span></label>
                  <input
                    name="slug"
                    required
                    value={formData.slug}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm"
                    placeholder="e.g. ai-trends-report-2024"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Block 3: Content */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Layout size={18} className="text-gray-500" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm"
                  placeholder="在此输入正文内容 (支持 Markdown)..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-8">
           {/* Block 2: Website Display */}
           <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Globe size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">官网展示 (Display)</h2>
            </div>
            <div className="p-6 space-y-6">
              
              {/* Published Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900 block">发布到官网</label>
                  <p className="text-xs text-gray-500">Resource is public</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="published" 
                    checked={formData.published} 
                    onChange={handleChange} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <hr className="border-gray-100" />

              {/* Homepage Slots */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">首页位置 (Homepage Slots)</label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      name="featured"
                      checked={homepageFlags.featured}
                      onChange={handleHomepageFlagChange}
                      className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900">最新动态 · 轮播位</span>
                      <span className="block text-xs text-gray-500 mt-0.5">Top Carousel (Featured)</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      name="latest"
                      checked={homepageFlags.latest}
                      onChange={handleHomepageFlagChange}
                      className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
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
    </form>
  );
}