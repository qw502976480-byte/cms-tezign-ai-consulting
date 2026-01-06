'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface SearchParams {
  status?: 'pending' | 'processed' | 'all';
  range?: '7d' | '30d' | 'custom';
  start?: string;
  end?: string;
}

export default function Filters({ searchParams }: { searchParams: SearchParams }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  
  const [customStart, setCustomStart] = useState(searchParams.start || '');
  const [customEnd, setCustomEnd] = useState(searchParams.end || '');

  const handleFilterChange = (key: string, value: string) => {
    // FIX: Correctly create a mutable copy of URLSearchParams to avoid a type error.
    const current = new URLSearchParams(currentSearchParams);
    current.set(key, value);

    // If changing range to non-custom, clear custom dates and navigate
    if (key === 'range' && value !== 'custom') {
      current.delete('start');
      current.delete('end');
      setCustomStart('');
      setCustomEnd('');
      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.push(`${pathname}${query}`);
    } else if (key !== 'range') { // For status changes, navigate immediately
       const search = current.toString();
       const query = search ? `?${search}` : "";
       router.push(`${pathname}${query}`);
    } else { // It's a switch to custom, just update the UI state
      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.push(`${pathname}${query}`);
    }
  };

  const handleCustomDateApply = () => {
    if (!customStart || !customEnd) {
      alert('Please select both a start and end date.');
      return;
    }
    // FIX: Correctly create a mutable copy of URLSearchParams to avoid a type error.
    const current = new URLSearchParams(currentSearchParams);
    current.set('start', customStart);
    current.set('end', customEnd);
    current.set('range', 'custom');

    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };
  
  useEffect(() => {
    setCustomStart(searchParams.start || '');
    setCustomEnd(searchParams.end || '');
  }, [searchParams.start, searchParams.end]);
  
  const status = searchParams.status || 'all';
  const range = searchParams.range || '30d';

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {/* Status Filter */}
        <div>
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-500 mr-2">状态:</label>
          <select 
            id="status-filter"
            value={status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 text-sm"
          >
            <option value="all">全部</option>
            <option value="pending">待处理</option>
            <option value="processed">已处理</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label htmlFor="range-filter" className="text-sm font-medium text-gray-500 mr-2">时间:</label>
          <select 
            id="range-filter"
            value={range}
            onChange={(e) => handleFilterChange('range', e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 text-sm"
          >
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="custom">自定义</option>
          </select>
        </div>
      </div>
      
      {/* Custom Date Inputs */}
      {range === 'custom' && (
        <div className="flex items-center gap-2">
            <input 
                type="date" 
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input 
                type="date" 
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 text-sm"
            />
            <button
              onClick={handleCustomDateApply}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-black"
            >
              应用
            </button>
        </div>
      )}
    </div>
  );
}
