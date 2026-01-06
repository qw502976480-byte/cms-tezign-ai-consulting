'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ListFilter, Calendar, Clock, ChevronDown, ArrowRight, Search } from 'lucide-react';

interface SearchParams {
  status?: 'pending' | 'processed' | 'all';
  range?: '7d' | '30d' | 'custom';
  start?: string;
  end?: string;
  appointment_status?: 'all' | 'none' | 'scheduled' | 'overdue' | 'completed';
}

export default function Filters({ searchParams }: { searchParams: SearchParams }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  
  const [customStart, setCustomStart] = useState(searchParams.start || '');
  const [customEnd, setCustomEnd] = useState(searchParams.end || '');

  const handleFilterChange = (key: string, value: string) => {
    const current = new URLSearchParams(currentSearchParams.toString());
    current.set(key, value);

    if (key === 'range' && value !== 'custom') {
      current.delete('start');
      current.delete('end');
      setCustomStart('');
      setCustomEnd('');
    }
    
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };

  const handleCustomDateApply = () => {
    if (!customStart || !customEnd) {
      alert('请选择开始和结束日期');
      return;
    }
    const current = new URLSearchParams(currentSearchParams.toString());
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
  const appointmentStatus = searchParams.appointment_status || 'all';

  // Helper component for styled select
  const SelectWrapper = ({ 
    icon: Icon, 
    value, 
    onChange, 
    options 
  }: { 
    icon: any, 
    value: string, 
    onChange: (val: string) => void, 
    options: { label: string, value: string }[] 
  }) => (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <Icon size={16} />
      </div>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-300 transition-all cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <ChevronDown size={14} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 bg-white p-1 rounded-none">
      
      {/* Filters Group */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        
        {/* Status Filter */}
        <div className="w-full sm:w-48">
          <SelectWrapper 
            icon={ListFilter}
            value={status}
            onChange={(val) => handleFilterChange('status', val)}
            options={[
              { label: '状态：全部', value: 'all' },
              { label: '状态：待处理', value: 'pending' },
              { label: '状态：已处理', value: 'processed' },
            ]}
          />
        </div>

        {/* Appointment Status Filter */}
        <div className="w-full sm:w-48">
           <SelectWrapper 
            icon={Clock}
            value={appointmentStatus}
            onChange={(val) => handleFilterChange('appointment_status', val)}
            options={[
              { label: '预约：全部', value: 'all' },
              { label: '预约：未安排', value: 'none' },
              { label: '预约：已安排', value: 'scheduled' },
              { label: '预约：已逾期', value: 'overdue' },
              { label: '预约：已完成', value: 'completed' },
            ]}
          />
        </div>

        {/* Date Range Filter */}
        <div className="w-full sm:w-48">
          <SelectWrapper 
            icon={Calendar}
            value={range}
            onChange={(val) => handleFilterChange('range', val)}
            options={[
              { label: '时间：最近7天', value: '7d' },
              { label: '时间：最近30天', value: '30d' },
              { label: '时间：自定义', value: 'custom' },
            ]}
          />
        </div>
      </div>
      
      {/* Custom Date Inputs (Conditional) */}
      {range === 'custom' && (
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 bg-gray-50 p-1.5 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="relative">
                <input 
                    type="date" 
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="pl-3 pr-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent shadow-sm"
                />
            </div>
            <span className="text-gray-400">
                <ArrowRight size={14} />
            </span>
            <div className="relative">
                <input 
                    type="date" 
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="pl-3 pr-2 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent shadow-sm"
                />
            </div>
            <button
              onClick={handleCustomDateApply}
              className="ml-1 p-1.5 bg-gray-900 text-white rounded-md hover:bg-black transition-colors shadow-sm"
              title="应用日期范围"
            >
              <Search size={14} />
            </button>
        </div>
      )}
    </div>
  );
}
