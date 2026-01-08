
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, X } from 'lucide-react';

export default function DashboardSummaryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get('summary_range') || '7d';
  
  // Local state for custom range
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    if (val === 'custom') {
        setIsOpen(!isOpen);
        return;
    }
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('summary_range', val);
    // Clear custom dates if switching to preset
    params.delete('summary_start');
    params.delete('summary_end');
    
    router.replace(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  const applyCustom = () => {
      if (!customStart || !customEnd) return;
      
      const params = new URLSearchParams(searchParams.toString());
      params.set('summary_range', 'custom');
      params.set('summary_start', customStart);
      params.set('summary_end', customEnd);
      
      router.replace(`?${params.toString()}`, { scroll: false });
      setIsOpen(false);
  };

  const ranges = [
    { value: 'today', label: '今日' },
    { value: '7d', label: '近 7 天' },
    { value: '30d', label: '近 30 天' },
    { value: 'custom', label: '自定义...' },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex bg-gray-100 p-1 rounded-lg">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => handleSelect(r.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              currentRange === r.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom Date Picker Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 origin-top-right">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wide">选择时间范围</h4>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-gray-500 block mb-1">开始日期</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 pl-8 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                        />
                        <Calendar className="absolute left-2 top-2 text-gray-400" size={14} />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-500 block mb-1">结束日期</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 pl-8 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                        />
                        <Calendar className="absolute left-2 top-2 text-gray-400" size={14} />
                    </div>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={applyCustom} 
                        disabled={!customStart || !customEnd} 
                        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 transition-colors"
                    >
                        确认
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
