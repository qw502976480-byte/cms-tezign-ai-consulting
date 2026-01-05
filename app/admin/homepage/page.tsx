'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// Simple multiselect component logic inline for simplicity
export default function HomepageManager() {
  const supabase = createClient();
  const [slots, setSlots] = useState<any[]>([]);
  const [contentItems, setContentItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sData } = await supabase.from('homepage_slots').select('*');
      const { data: cData } = await supabase.from('content_items').select('id, title, status').order('published_at', { ascending: false });
      
      setSlots(sData || []);
      setContentItems(cData || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleUpdate = async (id: string, newIds: string[]) => {
    await supabase.from('homepage_slots').update({ content_item_ids: newIds }).eq('id', id);
    // Refresh local
    setSlots(slots.map(s => s.id === id ? { ...s, content_item_ids: newIds } : s));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Homepage Slots</h1>
      <div className="grid gap-8">
        {slots.map((slot) => (
          <div key={slot.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 capitalize">{slot.section_key.replace('_', ' ')}</h2>
            
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Select content items (drag to reorder not implemented in MVP, order by selection):</p>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border p-2 rounded">
                 {contentItems.map(item => {
                   const isSelected = (slot.content_item_ids || []).includes(item.id);
                   return (
                     <label key={item.id} className="flex items-center space-x-2 text-sm p-1 hover:bg-gray-50 rounded">
                       <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          let newIds = [...(slot.content_item_ids || [])];
                          if (e.target.checked) {
                            newIds.push(item.id);
                          } else {
                            newIds = newIds.filter(id => id !== item.id);
                          }
                          handleUpdate(slot.id, newIds);
                        }}
                       />
                       <span className={item.status === 'Draft' ? 'text-gray-400' : 'text-gray-900'}>
                         {item.title} ({item.status})
                       </span>
                     </label>
                   )
                 })}
              </div>
            </div>
            
            <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Order:</h3>
                <ol className="list-decimal list-inside text-sm mt-2 text-gray-700">
                    {(slot.content_item_ids || []).map((id: string) => {
                        const found = contentItems.find(c => c.id === id);
                        return <li key={id}>{found ? found.title : 'Unknown ID'}</li>
                    })}
                </ol>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
