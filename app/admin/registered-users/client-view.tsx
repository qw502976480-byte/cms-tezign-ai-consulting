
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { UserProfile } from '@/types';
import { 
    Search, Calendar, Filter, ChevronDown, Check, 
    Eye, Users, ChevronLeft, ChevronRight, AlertTriangle,
    MapPin, Globe, MessageSquare, Monitor, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import UserDetailModal from './UserDetailModal';

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
            <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${isOpen ? 'border-gray-900 ring-1 ring-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'}`}>
                {Icon && <Icon size={16} className="text-gray-500" />}
                <span>{currentLabel}</span>
                <ChevronDown size={14} className="text-gray-400" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                    {options.map((opt: any) => (
                        <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${value === opt.value ? 'font-medium text-gray-900 bg-gray-50' : 'text-gray-600'}`}>
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
  initialUsers: UserProfile[];
  totalCount: number;
  availableRegions: string[];
  searchParams: any;
  error: string | null;
}

export default function RegisteredUsersClientView({ 
  initialUsers, 
  totalCount, 
  availableRegions,
  searchParams,
  error 
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const currentSearchParams = useSearchParams(); 
    
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempKeyword, setTempKeyword] = useState(searchParams.q || '');
    const [customDates, setCustomDates] = useState({ start: searchParams.start || '', end: searchParams.end || '' });

    useEffect(() => {
        setTempKeyword(searchParams.q || '');
        setCustomDates({ start: searchParams.start || '', end: searchParams.end || '' });
    }, [searchParams]);

    const updateFilter = (key: string, value: string, extras?: Record<string, string>) => {
        const params = new URLSearchParams(currentSearchParams.toString());
        if (value && value !== 'all') params.set(key, value); else params.delete(key);
        if (extras) Object.entries(extras).forEach(([k, v]) => { if (v) params.set(k, v); else params.delete(k); });
        if (key !== 'page') params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };

    const formatLocation = (u: UserProfile) => {
        const parts = [u.country, u.city].filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : (u.locale || '—');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <h1 className="text-2xl font-bold text-gray-900">用户管理 (User Profiles)</h1>
                <div className="text-sm text-gray-500">共 {totalCount} 位用户</div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col xl:flex-row gap-4 justify-between">
                <div className="flex flex-col md:flex-row flex-wrap gap-3 w-full">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="搜姓名/邮箱/公司" 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                            value={tempKeyword}
                            onChange={(e) => setTempKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && updateFilter('q', tempKeyword)}
                            onBlur={() => updateFilter('q', tempKeyword)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        <FilterDropdown 
                            label="用户类型" 
                            value={searchParams.type}
                            options={[{ label: '全部', value: 'all' }, { label: '个人', value: 'personal' }, { label: '企业', value: 'company' }]}
                            onChange={(v: string) => updateFilter('type', v)}
                        />

                        <FilterDropdown 
                            label="地区" 
                            value={searchParams.region}
                            options={[{ label: '全部', value: 'all' }, ...availableRegions.map(l => ({ label: l, value: l }))]}
                            onChange={(v: string) => updateFilter('region', v)}
                        />

                        <FilterDropdown 
                            label="线上沟通" 
                            value={searchParams.comm}
                            icon={MessageSquare}
                            options={[{ label: '全部', value: 'all' }, { label: '已发生 (Has Demo)', value: 'communicated' }, { label: '未发生', value: 'not_communicated' }]}
                            onChange={(v: string) => updateFilter('comm', v)}
                        />

                        {/* Date Picker (Simplified) */}
                        <div className="relative">
                            <button onClick={() => setShowDatePicker(!showDatePicker)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${searchParams.range !== 'all' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 bg-white text-gray-700'}`}>
                                <Calendar size={16} />
                                <span>{searchParams.range === 'all' ? '时间' : searchParams.range}</span>
                            </button>
                            {showDatePicker && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30">
                                    <div className="space-y-2">
                                        <button onClick={() => { updateFilter('range', 'all'); setShowDatePicker(false); }} className="w-full text-left text-sm p-1 hover:bg-gray-50">全部</button>
                                        <button onClick={() => { updateFilter('range', '7d'); setShowDatePicker(false); }} className="w-full text-left text-sm p-1 hover:bg-gray-50">7天</button>
                                        <button onClick={() => { updateFilter('range', '30d'); setShowDatePicker(false); }} className="w-full text-left text-sm p-1 hover:bg-gray-50">30天</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 w-[200px]">用户信息</th>
                            <th className="px-6 py-4 w-[200px]">联系方式</th>
                            <th className="px-6 py-4 w-[180px]">国家/城市</th>
                            <th className="px-6 py-4 w-[200px]">类型/公司</th>
                            <th className="px-6 py-4 w-[120px]">线上沟通</th>
                            <th className="px-6 py-4 w-[150px]">注册时间</th>
                            <th className="px-6 py-4 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 align-top">
                                    <div onClick={() => setSelectedUser(user)} className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 flex items-center gap-1.5">
                                        <Users size={16} className="text-gray-400" />
                                        {user.name}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 pl-5">ID: {user.id.substring(0,6)}...</div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="text-gray-900">{user.email}</div>
                                    <div className="text-xs text-gray-500 mt-1">{user.phone || '-'}</div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="flex items-center gap-1.5 text-gray-700">
                                        <MapPin size={14} className="text-gray-400" />
                                        <span className="truncate max-w-[140px]">{formatLocation(user)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    {user.user_type === 'company' ? (
                                        <div>
                                            <div className="flex items-center gap-1.5 text-gray-900 font-medium">
                                                <Building2 size={14} className="text-indigo-500" />
                                                {user.company_name || '-'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1 pl-5">{user.title || '-'}</div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500 italic">个人用户</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 align-top">
                                    {user.has_communicated ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                            <MessageSquare size={12} /> 已发生
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                            <Monitor size={12} /> 未发生
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-gray-500 align-top text-xs">
                                    {format(new Date(user.created_at), 'yyyy-MM-dd HH:mm')}
                                </td>
                                <td className="px-6 py-4 text-right align-top">
                                    <button onClick={() => setSelectedUser(user)} className="text-gray-400 hover:text-blue-600 p-2">
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {initialUsers.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无数据</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

             {/* Pagination */}
             <div className="flex items-center justify-between pt-4">
                <div className="text-xs text-gray-500">页码 {searchParams.page || 1}</div>
                <div className="flex gap-2">
                    <button onClick={() => updateFilter('page', String(Math.max(1, (parseInt(searchParams.page)||1)-1)))} className="p-2 border rounded hover:bg-gray-50"><ChevronLeft size={16}/></button>
                    <button onClick={() => updateFilter('page', String((parseInt(searchParams.page)||1)+1))} className="p-2 border rounded hover:bg-gray-50"><ChevronRight size={16}/></button>
                </div>
            </div>

            <UserDetailModal 
                user={selectedUser} 
                isOpen={!!selectedUser} 
                onClose={() => setSelectedUser(null)}
                onNoteSaved={() => router.refresh()}
            />
        </div>
    );
}
