

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { UserProfile } from '@/types';
import { 
    Search, Calendar, Filter, ChevronDown, Check, 
    Eye, Users, ChevronLeft, ChevronRight, AlertTriangle,
    MapPin, Globe, MessageSquare, Monitor, Building2, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import UserDetailModal from './UserDetailModal';

function FilterDropdown({ label, value, options, onChange, icon: Icon }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        const clickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', clickOutside);
        return () => document.removeEventListener('mousedown', clickOutside);
    }, []);
    const currentLabel = options.find((o: any) => o.value === value)?.label || options.find((o:any) => o.value === 'all')?.label;
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className={`flex w-full items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${isOpen ? 'border-gray-900 ring-1 ring-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'}`}>
                {Icon && <Icon size={16} className="text-gray-500" strokeWidth={1.5} />}
                <span className="text-gray-500">{label}:</span>
                <span className="font-medium text-gray-900">{currentLabel}</span>
                <ChevronDown size={14} className="text-gray-400 ml-auto" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
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
  searchParams: any;
  error: string | null;
}

export default function RegisteredUsersClientView({ 
  initialUsers, 
  totalCount, 
  searchParams,
  error 
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const currentSearchParams = useSearchParams(); 
    
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    
    const [keyword, setKeyword] = useState(searchParams.q || '');
    const [country, setCountry] = useState(searchParams.country || '');
    const [city, setCity] = useState(searchParams.city || '');

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(currentSearchParams.toString());
        if (value) params.set(key, value); else params.delete(key);
        if (key !== 'page') params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };
    
    const handleClearFilters = () => {
        router.push(pathname);
    };

    const formatLocation = (u: UserProfile) => {
        const parts = [u.country, u.city].filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : ('—');
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">注册用户 (User Profiles)</h1>
                <div className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">Total: {totalCount}</div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                     <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} strokeWidth={1.5} />
                        <input 
                            type="text" 
                            placeholder="搜姓名/邮箱/公司/职位" 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && updateFilter('q', keyword)}
                        />
                    </div>
                    <FilterDropdown 
                        label="用户类型" 
                        value={searchParams.type}
                        options={[{ label: '全部', value: 'all' }, { label: '个人', value: 'personal' }, { label: '企业', value: 'company' }]}
                        onChange={(v: string) => updateFilter('type', v)}
                    />
                     <input 
                        type="text" 
                        placeholder="国家 (Country)" 
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && updateFilter('country', country)}
                    />
                     <input 
                        type="text" 
                        placeholder="城市 (City)" 
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && updateFilter('city', city)}
                    />
                </div>
                <div className="flex flex-col md:flex-row flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <label>注册时间:</label>
                        <input type="date" value={searchParams.reg_from || ''} onChange={(e) => updateFilter('reg_from', e.target.value)} className="border border-gray-200 rounded-md px-2 py-1" />
                        <span>-</span>
                        <input type="date" value={searchParams.reg_to || ''} onChange={(e) => updateFilter('reg_to', e.target.value)} className="border border-gray-200 rounded-md px-2 py-1" />
                    </div>
                     <FilterDropdown 
                        label="线上沟通" 
                        value={searchParams.online}
                        icon={MessageSquare}
                        options={[{ label: '全部', value: 'all' }, { label: '已发生', value: 'yes' }, { label: '未发生', value: 'no' }]}
                        onChange={(v: string) => updateFilter('online', v)}
                    />
                    <button onClick={handleClearFilters} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 ml-auto transition-colors">
                        <Trash2 size={14} strokeWidth={1.5} /> 清空筛选
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">
                <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left w-[200px] font-medium">用户信息</th>
                            <th className="px-6 py-4 text-left w-[200px] font-medium">公司/职位</th>
                            <th className="px-6 py-4 text-left w-[180px] font-medium">国家/城市</th>
                            <th className="px-6 py-4 text-left w-[120px] font-medium">线上沟通</th>
                            <th className="px-6 py-4 text-left w-[150px] font-medium">注册时间</th>
                            <th className="px-6 py-4 text-left w-[150px] font-medium">最近登录</th>
                            <th className="px-6 py-4 text-right font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 align-top">
                                    <div onClick={() => setSelectedUser(user)} className="font-medium text-gray-900 cursor-pointer hover:text-indigo-600 flex items-center gap-2">
                                        <Users size={16} className="text-gray-400" strokeWidth={1.5} />
                                        {user.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 pl-6 truncate" title={user.email}>{user.email}</div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    {user.user_type === 'company' ? (
                                        <div>
                                            <div className="flex items-center gap-2 text-gray-900 font-medium">
                                                <Building2 size={14} className="text-indigo-500" />
                                                <span className="truncate max-w-[150px]">{user.company_name || '-'}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1 pl-5.5">{user.title || '-'}</div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">个人用户</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <MapPin size={14} className="text-gray-400" strokeWidth={1.5} />
                                        <span className="truncate max-w-[140px]">{formatLocation(user)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    {user.has_communicated ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-green-50 text-green-700 border border-green-100 whitespace-nowrap">
                                            <MessageSquare size={12} strokeWidth={1.5} /> 已发生
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-100 whitespace-nowrap">
                                            <Monitor size={12} strokeWidth={1.5} /> 未发生
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-gray-500 align-top text-xs tabular-nums">
                                    {format(new Date(user.created_at), 'yyyy-MM-dd HH:mm')}
                                </td>
                                <td className="px-6 py-4 text-gray-500 align-top text-xs tabular-nums">
                                    {user.last_login_at ? format(new Date(user.last_login_at), 'yyyy-MM-dd HH:mm') : '—'}
                                </td>
                                <td className="px-6 py-4 text-right align-top">
                                    <button onClick={() => setSelectedUser(user)} className="text-gray-400 hover:text-gray-900 p-2 transition-colors">
                                        <Eye size={18} strokeWidth={1.5} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {initialUsers.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-16 text-gray-400">无符合条件的用户</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

             {/* Pagination */}
             <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-gray-500">
                    第 {searchParams.page || 1} 页 / 共 {Math.ceil(totalCount / 20)} 页
                </div>
                <div className="flex gap-2">
                    <button disabled={searchParams.page <= 1} onClick={() => updateFilter('page', String(Math.max(1, (parseInt(searchParams.page)||1)-1)))} className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                    <button disabled={searchParams.page >= Math.ceil(totalCount / 20)} onClick={() => updateFilter('page', String((parseInt(searchParams.page)||1)+1))} className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16}/></button>
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
