'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { ListFilter, Calendar, Clock, ChevronDown, Check } from 'lucide-react';

interface SearchParams {
  status?: 'all' | 'pending' | 'processed';
  appointment_type?: 'all' | 'scheduled' | 'none';
  time_status?: 'all' | 'overdue' | 'future' | 'near_24h';
}

// --- Reusable Custom Dropdown Component ---
function FilterDropdown({ 
  icon: Icon, 
  label,
  value, 
  onChange, 
  options,
  disabled = false
}: { 
  icon: any, 
  label: string,
  value: string, 
  onChange: (val: string) => void, 
  options: { label: string, value: string }[],
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  const selectedLabel = options.find(o => o.value === value)?.label || options[0].label;

  return (
    <div className={`relative w-full sm:w-auto ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} ref={containerRef}>
        <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`w-full sm:w-48 flex items-center justify-between px-3 py-2.5 bg-white border rounded-lg shadow-sm text-sm transition-all duration-200 group
                ${isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'}
                ${!disabled && 'hover:border-gray-300'}
            `}
        >
            <div className="flex items-center gap-2 truncate">
                <Icon size={16} className={`flex-shrink-0 transition-colors ${isOpen ? 'text-gray-900' : 'text-gray-500'} ${!disabled && 'group-hover:text-gray-700'}`} />
                <span className="text-gray-500">{label}:</span>
                <span className="font-medium text-gray-900 truncate">{selectedLabel}</span>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180 text-gray-900' : ''}`} />
        </button>

        {isOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-full sm:w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100 origin-top">
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

  const handleFilterChange = (key: string, value: string) => {
    const current = new URLSearchParams(currentSearchParams.toString());
    current.set(key, value);
    
    // Logic: If user switches Appointment Type away from 'scheduled', clear Time Status
    if (key === 'appointment_type' && value !== 'scheduled') {
        current.delete('time_status');
    }

    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };

  const status = searchParams.status || 'all';
  const appointmentType = searchParams.appointment_type || 'all';
  const timeStatus = searchParams.time_status || 'all';

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 bg-white p-1 rounded-none z-20 relative">
      
        {/* Group A: Status */}
        <FilterDropdown 
            icon={ListFilter}
            label="处理状态"
            value={status}
            onChange={(val) => handleFilterChange('status', val)}
            options={[
              { label: '全部', value: 'all' },
              { label: '待处理', value: 'pending' },
              { label: '已处理', value: 'processed' },
            ]}
        />

        {/* Group B: Appointment Existence */}
        <FilterDropdown 
            icon={Calendar}
            label="预约情况"
            value={appointmentType}
            onChange={(val) => handleFilterChange('appointment_type', val)}
            options={[
              { label: '全部', value: 'all' },
              { label: '已安排 (有时间)', value: 'scheduled' },
              { label: '未安排 (无时间)', value: 'none' },
            ]}
        />

        {/* Group C: Time Logic (Only active if scheduled) */}
        <FilterDropdown 
            icon={Clock}
            label="时间筛选"
            value={timeStatus}
            disabled={appointmentType !== 'scheduled'}
            onChange={(val) => handleFilterChange('time_status', val)}
            options={[
              { label: '全部', value: 'all' },
              { label: '已逾期 (Time < Now)', value: 'overdue' },
              { label: '未逾期 (Time >= Now)', value: 'future' },
              { label: '临近 (24小时内)', value: 'near_24h' },
            ]}
        />
        
    </div>
  );
}
