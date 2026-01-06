'use client';

import { useState, useEffect, useRef } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { PieChart, Calendar, ChevronDown, RefreshCw, AlertCircle, Phone, CheckCircle2, Circle, Check } from 'lucide-react';

type TimeRange = '3d' | '7d' | '30d' | 'custom';

interface StatsData {
  total: number;
  pending: number;
  processed: number;
  completed: number;
  cancelled: number;
}

export default function StatsOverview() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // UI States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ref for updating data without re-triggering effects unnecessarily
  const fetchRef = useRef(0);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        // Only close custom picker if clicking outside, but allow interaction inside it
        // Note: isCustomOpen logic might need separate handling if it was fully separate, 
        // but here they share the container parent for simplicity in this view.
        // If the user clicks completely away, close custom picker too.
        // However, the custom picker needs to persist while interacting with inputs.
        // The containerRef includes the picker, so this check works for both.
        if (!dropdownContainerRef.current.contains(event.target as Node)) {
            setIsCustomOpen(false); 
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dates based on range
  const getDateRange = () => {
    const now = new Date();
    let start = new Date();
    let end = endOfDay(now);

    if (range === 'custom') {
      if (!customStart || !customEnd) return null; // Not ready
      start = startOfDay(new Date(customStart));
      end = endOfDay(new Date(customEnd));
    } else {
      const daysMap = { '3d': 3, '7d': 7, '30d': 30 };
      start = startOfDay(subDays(now, daysMap[range]));
    }
    
    return { 
      start: start.toISOString(), 
      end: end.toISOString() 
    };
  };

  const fetchData = async () => {
    const dates = getDateRange();
    if (!dates) return;

    setLoading(true);
    setError(null);
    const requestId = ++fetchRef.current;

    try {
      const params = new URLSearchParams({
        startDate: dates.start,
        endDate: dates.end
      });

      const res = await fetch(`/api/demo-requests/summary?${params}`);
      
      if (requestId !== fetchRef.current) return; // Ignore if stale

      if (!res.ok) {
        const txt = await res.text();
        console.error('Stats API Error:', res.status, txt);
        throw new Error('概览加载失败');
      }

      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setStats(null);
      setError(err.message);
    } finally {
      if (requestId === fetchRef.current) {
        setLoading(false);
      }
    }
  };

  // Initial fetch and on range change
  useEffect(() => {
    if (range !== 'custom') {
      fetchData();
      setIsCustomOpen(false);
    } else {
        // When switching to custom, open the picker
        setIsCustomOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      setIsCustomOpen(false);
      fetchData();
    }
  };

  const options = [
    { value: '3d', label: '最近 3 天' },
    { value: '7d', label: '最近 7 天' },
    { value: '30d', label: '最近 30 天' },
    { value: 'custom', label: '自定义范围...' },
  ];

  const currentLabel = options.find(o => o.value === range)?.label || '最近 7 天';

  return (
    <div className="bg-white border border-gray-200 px-5 py-4 rounded-xl shadow-sm text-sm space-y-4 md:space-y-0 md:flex md:items-center md:justify-between relative">
      
      {/* Left: Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
        
        {/* Title Block */}
        <div>
           <div className="flex items-center gap-2 font-bold text-gray-900 text-base">
               <PieChart size={18} />
               数据概览
           </div>
           <p className="text-xs text-gray-500 mt-1">
             基于全部数据统计（受右侧时间限制），下方列表仍按筛选展示
           </p>
        </div>

        <div className="hidden md:block h-8 w-px bg-gray-200"></div>

        {/* Stats Content */}
        {loading ? (
             <div className="flex items-center gap-2 text-gray-400">
                <RefreshCw size={14} className="animate-spin" />
                正在加载统计...
             </div>
        ) : error ? (
             <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded">
                <AlertCircle size={14} />
                {error}
             </div>
        ) : stats ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {/* Group 1: Status */}
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1.5">
                        <Circle size={10} className="fill-yellow-400 text-yellow-400" />
                        <span className="text-gray-600">待处理</span>
                        <span className="font-semibold text-gray-900">{stats.pending}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-gray-400" />
                        <span className="text-gray-600">已处理</span>
                        <span className="font-semibold text-gray-900">{stats.processed}</span>
                   </div>
                   <div className="text-gray-400 text-xs">
                        (共 {stats.total})
                   </div>
                </div>

                <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

                {/* Group 2: Outcome */}
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1.5 text-gray-900 font-medium mr-1">
                       <Phone size={14} /> 沟通:
                   </div>
                   <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span className="text-gray-600">已完成</span>
                        <span className="font-semibold text-green-700">{stats.completed}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        <span className="text-gray-600">已取消</span>
                        <span className="font-semibold text-gray-500">{stats.cancelled}</span>
                   </div>
                </div>
            </div>
        ) : null}
      </div>

      {/* Right: Time Control (Custom Dropdown) */}
      <div className="relative border-l border-gray-100 md:pl-6" ref={dropdownContainerRef}>
        
        {/* Dropdown Trigger Button */}
        <button 
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full sm:w-auto min-w-[160px] flex items-center justify-between px-3 py-2.5 border rounded-lg shadow-sm text-sm transition-all duration-200
                ${isDropdownOpen 
                    ? 'border-gray-900 ring-1 ring-gray-900 bg-white text-gray-900' 
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}
            `}
        >
            <div className="flex items-center gap-2">
                <Calendar size={16} className={isDropdownOpen ? 'text-gray-900' : 'text-gray-400'} />
                <span className={isDropdownOpen ? 'text-gray-900' : 'text-gray-500'}>时间筛选:</span>
                <span className={`font-medium ${isDropdownOpen ? 'text-gray-900' : 'text-gray-900'}`}>
                    {currentLabel.replace('自定义范围...', '自定义')}
                </span>
            </div>
            <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-gray-900' : 'text-gray-400'}`} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => {
                            setRange(opt.value as TimeRange);
                            setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left
                            ${range === opt.value 
                                ? 'bg-gray-50 text-gray-900 font-medium' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                    >
                        <span>{opt.label}</span>
                        {range === opt.value && <Check size={14} className="flex-shrink-0 text-gray-900" />}
                    </button>
                ))}
            </div>
        )}

        {/* Custom Date Picker Popover */}
        {range === 'custom' && isCustomOpen && !isDropdownOpen && (
             <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wide">选择日期范围</h4>
                    <div className="space-y-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">开始日期</label>
                            <input 
                                type="date" 
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">结束日期</label>
                            <input 
                                type="date" 
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                            />
                        </div>
                    </div>
                    <div className="pt-2 flex justify-end gap-2">
                        <button 
                            onClick={() => {
                                setRange('7d'); // Revert to default if cancelled
                                setIsCustomOpen(false);
                            }}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleCustomApply}
                            disabled={!customStart || !customEnd}
                            className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 transition-colors"
                        >
                            确认应用
                        </button>
                    </div>
                </div>
             </div>
        )}
      </div>
    </div>
  );
}
