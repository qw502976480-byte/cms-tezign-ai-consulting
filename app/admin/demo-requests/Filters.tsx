'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { ListFilter, Calendar, Clock, ChevronDown, ArrowRight, Search, Check } from 'lucide-react';

interface SearchParams {
  status?: 'pending' | 'processed' | 'all';
  range?: '7d' | '30d' | 'custom';
  start?: string;
  end?: string;
  appointment_status?: 'all' | 'none' | 'scheduled' | 'overdue' | 'completed';
}

// --- Reusable Custom Dropdown Component ---
function FilterDropdown({ 
  icon: Icon, 
  label,
  value, 
  onChange, 
  options 
}: { 
  icon: any, 
  label: string,
  value: string, 
  onChange: (val: string) => void, 
  options: { label: string, value: string }[] 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || options[0].label;

  return (
    <div className="relative w-full sm:w-48" ref={containerRef}>
        <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 bg-white border rounded-lg shadow-sm text-sm transition-all duration-200 group
                ${isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}
            `}
        >
            <div className="flex items-center gap-2 truncate">
                <Icon size={16} className={`flex-shrink-0 transition-colors ${isOpen ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`} />
                <span className="text-gray-500">{label}:</span>
                <span className="font-medium text-gray-900 truncate">{selectedLabel}</span>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180 text-gray-900' : ''}`} />
        </button>

        {isOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100 origin-top">
                {options.map((opt) => (
                    <button
                        type="button"
                        key={opt.value}
                        onClick={() => {
                            onChange(opt.value);
                            setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left
                            ${opt.value === value 
                                ? 'bg-gray-50 text-gray-900 font-medium' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                    >
                        <span className="truncate">{opt.label}</span>
                        {opt.value === value && <Check size={14} className="flex-shrink-0 ml-2" />}
                    </button>
                ))}
            </div>
        )}
    </div>
  )
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

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 bg-white p-1 rounded-none">
      
      {/* Filters Group */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto z-10">
        
        {/* Status Filter */}
        <FilterDropdown 
            icon={ListFilter}
            label="状态"
            value={status}
            onChange={(val) => handleFilterChange('status', val)}
            options={[
              { label: '全部', value: 'all' },
              { label: '待处理', value: 'pending' },
              { label: '已处理', value: 'processed' },
            ]}
        />

        {/* Appointment Status Filter */}
        <FilterDropdown 
            icon={Clock}
            label="预约"
            value={appointmentStatus}
            onChange={(val) => handleFilterChange('appointment_status', val)}
            options={[
              { label: '全部', value: 'all' },
              { label: '未安排', value: 'none' },
              { label: '已安排', value: 'scheduled' },
              { label: '已逾期', value: 'overdue' },
              { label: '已完成', value: 'completed' },
            ]}
        />

        {/* Date Range Filter */}
        <FilterDropdown 
            icon={Calendar}
            label="时间"
            value={range}
            onChange={(val) => handleFilterChange('range', val)}
            options={[
              { label: '最近7天', value: '7d' },
              { label: '最近30天', value: '30d' },
              { label: '自定义', value: 'custom' },
            ]}
        />
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
