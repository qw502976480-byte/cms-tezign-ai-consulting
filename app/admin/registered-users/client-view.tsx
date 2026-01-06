'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RegisteredUser } from '@/types';
import { 
    Search, Calendar, Filter, ChevronDown, Check, RefreshCw, 
    Eye, Users, UserCheck, UserX, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import UserDetailModal from './UserDetailModal';

// --- Reusable Dropdown ---
function FilterDropdown({ label, value, options, onChange, icon: Icon }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const clickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', clickOutside);
        return () => document.removeEventListener('mousedown', clickOutside);
    }, []);

    const currentLabel = options.find((o: any) => o.value === value)?.label || label;

    return (
        <div className="relative" ref={ref}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${isOpen ? 'border-gray-900 ring-1 ring-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'}`}
            >
                {Icon && <Icon size={16} className="text-gray-500" />}
                <span>{currentLabel}</span>
                <ChevronDown size={14} className="text-gray-400" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                    {options.map((opt: any) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${value === opt.value ? 'font-medium text-gray-900 bg-gray-50' : 'text-gray-600'}`}
                        >
                            {opt.label}
                            {value === opt.value && <Check size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface Props {
  initialUsers: RegisteredUser[];
  totalCount: number;
  availableLocales: string[];
  searchParams: any;
  error: string | null;
}

export default function RegisteredUsersClientView({ 
  initialUsers, 
  totalCount, 
  availableLocales,
  searchParams,
  error 
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const currentSearchParams = useSearchParams(); // Read-only access to current URL
    
    // UI State
    const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // Local Filter State (synced with props initially)
    const [tempKeyword, setTempKeyword] = useState(searchParams.q || '');
    const [customDates, setCustomDates] = useState({ start: searchParams.start || '', end: searchParams.end || '' });

    // Sync input when URL changes (if user navigates back/forward)
    useEffect(() => {
        setTempKeyword(searchParams.q || '');
        setCustomDates({ start: searchParams.start || '', end: searchParams.end || '' });
    }, [searchParams]);

    // Update URL Helper
    const updateFilter = (key: string, value: string, extras?: Record<string, string>) => {
        const params = new URLSearchParams(currentSearchParams.toString());
        
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        if (extras) {
            Object.entries(extras).forEach(([k, v]) => {
                if (v) params.set(k, v); else params.delete(k);
            });
        }
        
        // Reset page on filter change
        if (key !== 'page') {
            params.set('page', '1');
        }

        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearch = () => {
        updateFilter('q', tempKeyword);
    };

    return (
        <div className="space-y-6">
            
            <div className="flex justify-between items-end">
                <h1 className="text-2xl font-bold text-gray-900">注册用户</h1>
                <div className="text-sm text-gray-500">
                    共找到 {totalCount} 位用户
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* 1. Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex flex-col md:flex-row gap-3 w-full">
                    {/* Search */}
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="搜索姓名 / 邮箱 / 手机 / 公司" 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                            value={tempKeyword}
                            onChange={(e) => setTempKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            onBlur={handleSearch}
                        />
                    </div>
                    
                    {/* Dropdowns */}
                    <div className="flex flex-wrap gap-2">
                        <FilterDropdown 
                            label="地区/语言" 
                            value={searchParams.locale}
                            options={[
                                { label: '全部地区', value: 'all' },
                                ...availableLocales.map(l => ({ label: l, value: l }))
                            ]}
                            onChange={(v: string) => updateFilter('locale', v)}
                        />

                        <FilterDropdown 
                            label="用户类型" 
                            value={searchParams.type}
                            options={[
                                { label: '全部类型', value: 'all' },
                                { label: '个人', value: 'personal' },
                                { label: '企业', value: 'company' },
                            ]}
                            onChange={(v: string) => updateFilter('type', v)}
                        />

                        <FilterDropdown 
                            label="营销许可" 
                            value={searchParams.marketing}
                            options={[
                                { label: '全部', value: 'all' },
                                { label: '已同意', value: 'true' },
                                { label: '未同意', value: 'false' },
                            ]}
                            onChange={(v: string) => updateFilter('marketing', v)}
                        />

                        {/* Date Picker */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${searchParams.range !== 'all' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 bg-white text-gray-700'}`}
                            >
                                <Calendar size={16} />
                                <span>{searchParams.range === 'all' ? '全部时间' : searchParams.range === 'custom' ? '自定义范围' : `最近 ${searchParams.range}`}</span>
                                <ChevronDown size={14} />
                            </button>
                            
                            {showDatePicker && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30">
                                    <div className="space-y-2">
                                        <button onClick={() => { updateFilter('range', 'all'); setShowDatePicker(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">全部时间</button>
                                        <button onClick={() => { updateFilter('range', '7d'); setShowDatePicker(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">最近 7 天</button>
                                        <button onClick={() => { updateFilter('range', '30d'); setShowDatePicker(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">最近 30 天</button>
                                        <hr className="border-gray-100" />
                                        <p className="text-xs text-gray-500 font-medium px-2 mt-2">自定义范围</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="date" className="text-xs border rounded p-1" value={customDates.start} onChange={(e) => setCustomDates(d => ({...d, start: e.target.value}))} />
                                            <input type="date" className="text-xs border rounded p-1" value={customDates.end} onChange={(e) => setCustomDates(d => ({...d, end: e.target.value}))} />
                                        </div>
                                        <button 
                                            onClick={() => { 
                                                updateFilter('range', 'custom', { start: customDates.start, end: customDates.end }); 
                                                setShowDatePicker(false); 
                                            }}
                                            disabled={!customDates.start || !customDates.end}
                                            className="w-full mt-2 bg-gray-900 text-white text-xs py-1.5 rounded hover:bg-black disabled:opacity-50"
                                        >
                                            应用范围
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
                            <tr>
                                <th className="px-6 py-4">姓名</th>
                                <th className="px-6 py-4">联系方式</th>
                                <th className="px-6 py-4">类型/公司</th>
                                <th className="px-6 py-4">标签 (场景)</th>
                                <th className="px-6 py-4">营销许可</th>
                                <th className="px-6 py-4">注册时间</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {initialUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div 
                                            onClick={() => setSelectedUser(user)}
                                            className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline"
                                        >
                                            {user.name || '未命名'}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">{user.locale || '—'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900">{user.email}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{user.phone || '—'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.user_type === 'company' ? (
                                            <div>
                                                <div className="font-medium text-gray-800">{user.company_name || '—'}</div>
                                                <div className="text-xs text-gray-500">{user.title || '职位未知'}</div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 italic">个人用户</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                                            {user.use_case_tags && user.use_case_tags.length > 0 ? (
                                                user.use_case_tags.slice(0, 2).map((tag, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                                                        {tag}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                            {user.use_case_tags && user.use_case_tags.length > 2 && (
                                                <span className="text-xs text-gray-400">+{user.use_case_tags.length - 2}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.marketing_opt_in ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                                <Check size={10} /> 已同意
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                                                未同意
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {format(new Date(user.created_at), 'yyyy-MM-dd')}
                                        <span className="block text-xs text-gray-400">{format(new Date(user.created_at), 'HH:mm')}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setSelectedUser(user)}
                                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                                        >
                                            <Eye size={16} />
                                            <span className="hidden group-hover:inline text-xs font-medium">详情</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {initialUsers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-400">
                                        暂无符合条件的用户
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
                    <div className="text-xs text-gray-500">
                        页码 {searchParams.page || 1}
                    </div>
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <button 
                            onClick={() => updateFilter('page', String(Math.max(1, (parseInt(searchParams.page) || 1) - 1)))}
                            disabled={(parseInt(searchParams.page) || 1) <= 1}
                            className="p-2 hover:bg-gray-50 disabled:opacity-50 border-r border-gray-200"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            onClick={() => updateFilter('page', String((parseInt(searchParams.page) || 1) + 1))}
                            disabled={initialUsers.length < 20} // Simple check: if current page full, likely next page exists. Exact count is in props if needed.
                            className="p-2 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            <UserDetailModal 
                user={selectedUser} 
                isOpen={!!selectedUser} 
                onClose={() => setSelectedUser(null)}
                onNoteSaved={() => {
                    // Trigger a server refresh to get updated data if note changes list view (unlikely but good practice)
                    router.refresh(); 
                }}
            />
        </div>
    );
}
