'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { ContentItem } from '@/types';
import Link from 'next/link';

interface ResourceFormProps {
  initialData?: ContentItem;
}

export default function ResourceForm({ initialData }: ResourceFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Extract initial plain text content from body_blocks if possible
  const getInitialContent = () => {
    if (initialData?.body_blocks && Array.isArray(initialData.body_blocks)) {
      const textBlock = initialData.body_blocks.find(b => b.type === 'markdown' || b.type === 'paragraph');
      return textBlock?.content || '';
    }
    return '';
  };

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    category: initialData?.type || 'report',
    published_at: initialData?.published_at ? new Date(initialData.published_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    summary: initialData?.subtitle || '',
    cover_url: initialData?.cover_image_url || '',
    content: getInitialContent(),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate a simple slug from title if not present (simplified logic)
      const slug = initialData?.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `res-${Date.now()}`;
      
      // Wrap content in a simple block structure
      const body_blocks = [
        {
          type: 'markdown',
          content: formData.content
        }
      ];

      const payload = {
        title: formData.title,
        type: formData.category,
        published_at: formData.published_at,
        subtitle: formData.summary, // Mapping summary to subtitle
        cover_image_url: formData.cover_url,
        body_blocks: body_blocks,
        slug: slug,
        updated_at: new Date().toISOString(),
        status: 'Published', // Defaulting to Published for this resource flow as per prompt simplicity
        reading_minutes: Math.ceil(formData.content.length / 500) || 1, // Rough estimate
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('content_items')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('content_items')
          .insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/resources" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{initialData ? '编辑资源' : '新建资源'}</h1>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          保存
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资源标题</label>
              <input
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="请输入资源标题"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">摘要 (Summary)</label>
              <textarea
                name="summary"
                rows={3}
                value={formData.summary}
                onChange={handleChange}
                placeholder="简短描述资源内容..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">正文内容 (Markdown/Text)</label>
              <textarea
                name="content"
                rows={15}
                value={formData.content}
                onChange={handleChange}
                placeholder="在此输入详细内容..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分类 (Category)</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="report">Report (行业报告)</option>
                <option value="announcement">Announcement (公告)</option>
                <option value="case_study">Case Study (案例研究)</option>
                <option value="methodology">Methodology (方法论)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发布日期</label>
              <input
                type="date"
                name="published_at"
                required
                value={formData.published_at}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">封面图 URL</label>
              <input
                name="cover_url"
                value={formData.cover_url}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {formData.cover_url && (
                <div className="mt-2 relative aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img src={formData.cover_url} alt="Cover preview" className="object-cover w-full h-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}