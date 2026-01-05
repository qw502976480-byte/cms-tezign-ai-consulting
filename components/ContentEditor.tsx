'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const SAMPLE_BLOCKS = [
  {
    "type": "paragraph",
    "content": "This is an introductory paragraph describing the context of the AI study."
  },
  {
    "type": "heading",
    "level": 2,
    "content": "Key Findings"
  },
  {
    "type": "list",
    "items": ["Efficiency increased by 40%", "Cost reduced by 20%", "Satisfaction stable"]
  }
];

export default function ContentEditor({ initialData }: { initialData?: any }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    type: initialData?.type || 'Case Study',
    title: initialData?.title || '',
    subtitle: initialData?.subtitle || '',
    slug: initialData?.slug || '',
    cover_image_url: initialData?.cover_image_url || '',
    published_at: initialData?.published_at || new Date().toISOString().split('T')[0],
    reading_minutes: initialData?.reading_minutes || 5,
    status: initialData?.status || 'Draft',
    language: initialData?.language || 'en',
    interests: initialData?.interests ? initialData.interests.join(', ') : '',
    body_blocks: initialData?.body_blocks ? JSON.stringify(initialData.body_blocks, null, 2) : '[]'
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Parse JSON blocks
      let parsedBlocks = [];
      try {
        parsedBlocks = JSON.parse(formData.body_blocks);
      } catch (err) {
        alert('Invalid JSON in Body Blocks');
        setLoading(false);
        return;
      }

      // Parse Interests
      const parsedInterests = formData.interests.split(',').map((s: string) => s.trim()).filter(Boolean);

      const payload = {
        ...formData,
        interests: parsedInterests,
        body_blocks: parsedBlocks
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
          .insert(payload);
        if (error) throw error;
      }

      router.push('/admin/content');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setFormData(prev => ({ ...prev, body_blocks: JSON.stringify(SAMPLE_BLOCKS, null, 2) }));
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input name="title" required value={formData.title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subtitle</label>
            <input name="subtitle" required value={formData.subtitle} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input name="slug" required value={formData.slug} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700">Reading Minutes</label>
              <input type="number" name="reading_minutes" required value={formData.reading_minutes} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
            </div>
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700">Cover Image URL</label>
            <input name="cover_image_url" value={formData.cover_image_url} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
           <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Body Blocks (JSON)</label>
              <button type="button" onClick={loadSample} className="text-xs text-blue-600 hover:underline">Load Sample</button>
           </div>
           <textarea 
            name="body_blocks" 
            required 
            value={formData.body_blocks} 
            onChange={handleChange} 
            rows={15} 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border font-mono text-xs" 
           />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border">
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border">
              <option value="Case Study">Case Study</option>
              <option value="Report">Report</option>
              <option value="Methodology">Methodology</option>
              <option value="Announcement">Announcement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Publish Date</label>
            <input type="date" name="published_at" required value={formData.published_at} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Language</label>
             <select name="language" value={formData.language} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border">
              <option value="en">English</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Interests (comma separated)</label>
            <input name="interests" value={formData.interests} onChange={handleChange} placeholder="AI, Design, Marketing" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border" />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="animate-spin" size={16} />}
          Save Content
        </button>
      </div>
    </form>
  );
}
