'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { RegisteredUser } from '@/types';
import { 
    Search, Calendar, Filter, ChevronDown, Check, RefreshCw, 
    Eye, MoreHorizontal, Users, UserCheck, UserX, Clock,
    ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import UserDetailModal from './UserDetailModal';

// --- Types ---
type TimeRange = 'all' | '7d' | '30d' | 'custom';

interface FilterState {
    keyword: string;
    locale: string;
    marketing: 'all' | 'true' | 'false';
    timeRange: TimeRange;
    customStart: string;
    customEnd: string;
}

interface StatsData {
    total: number;
    consentTrue: number;
    consentFalse: number;
    newIn7Days: number;
}

// --- Components ---

// Reusable Dropdown (Simplified from previous)
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
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1">
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

export default function RegisteredUsersPage() {
    const supabase = createClient();
    
    // --- State ---
    const [users, setUsers] = useState<RegisteredUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [locales, setLocales] = useState<string[]>([]);
    
    // Filters
    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
        locale: 'all',
        marketing: 'all',
        timeRange: 'all',
        customStart: '',
        customEnd: ''
    });

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Stats
    const [stats, setStats] = useState<StatsData>({ total: 0, consentTrue: 0, consentFalse: 0, newIn7Days: 0 });

    // Modal
    const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);

    // Date Picker UI
    const [showDatePicker, setShowDatePicker] = useState(false);

    // --- Data Fetching ---

    // 1. Load available locales on mount
    useEffect(() => {
        const fetchLocales = async () => {
            const { data } = await supabase.from('registered_users').select('locale');
            if (data) {
                const unique = Array.from(new Set(data.map(d => d.locale).filter(Boolean))) as string[];
                setLocales(unique.sort());
            }
        };
        fetchLocales();
    }, [supabase]);

    // 2. Main Fetch Function
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // A. Prepare Base Filter Logic
            // We can't reuse the exact Query Builder object easily for separate counts, so we construct conditions.
            // Using a helper to apply filters to any query chain.
            const applyFilters = (query: any) => {
                if (filters.keyword) {
                    const q = `%${filters.keyword}%`;
                    query = query.or(`name.ilike.${q},email.ilike.${q},phone.ilike.${q},company.ilike.${q},title.ilike.${q}`);
                }
                if (filters.locale !== 'all') {
                    query = query.eq('locale', filters.locale);
                }
                if (filters.marketing !== 'all') {
                    query = query.eq('marketing_consent', filters.marketing === 'true');
                }
                
                let start, end;
                const now = new Date();
                if (filters.timeRange === '7d') start = subDays(now, 7);
                else if (filters.timeRange === '30d') start = subDays(now, 30);
                else if (filters.timeRange === 'custom' && filters.customStart && filters.customEnd) {
                    start = startOfDay(new Date(filters.customStart));
                    end = endOfDay(new Date(filters.customEnd));
                }

                if (start) query = query.gte('created_at', start.toISOString());
                if (end) query = query.lte('created_at', end.toISOString());
                
                return query;
            };

            // B. Fetch Table Data
            let query = supabase
                .from('registered_users')
                .select('*', { count: 'exact' });
            
            query = applyFilters(query);
            
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            
            query = query
                .order('created_at', { ascending: false })
                .range(from, to);

            const { data: listData, count, error } = await query;

            if (error) throw error;
            setUsers(listData as RegisteredUser[]);
            setTotalCount(count || 0);

            // C. Fetch Stats (Parallel simplified)
            // Note: Efficiently getting these 3 counts with active filters might require 3 requests or a stored procedure.
            // For CMS scale, 3 lightweight HEAD requests are fine.
            
            // Stats Base Query (Applied Filters)
            // We need to apply ALL filters except the specific dimension we are counting (sometimes), 
            // BUT the requirement says "Stats bar (based on current filter)". 
            // So if I filter by "Locale: EN", "Total" is EN users, "Consent" is EN users who consented.
            
            const fetchCount = async (extraCondition?: (q: any) => any) => {
                let q = supabase.from('registered_users').select('*', { count: 'exact', head: true });
                q = applyFilters(q);
                if (extraCondition) q = extraCondition(q);
                const { count } = await q;
                return count || 0;
            };

            const [countConsent, countNoConsent, countNew7] = await Promise.all([
                fetchCount((q) => q.eq('marketing_consent', true)),
                fetchCount((q) => q.eq('marketing_consent', false)),
                // For "New in 7 days", we overlay a 7-day filter on top of existing filters.
                // If existing filter is already tighter (e.g. today), it respects it.
                fetchCount((q) => q.gte('created_at', subDays(new Date(), 7).toISOString()))
            ]);

            setStats({
                total: count || 0,
                consentTrue: countConsent,
                consentFalse: countNoConsent,
                newIn7Days: countNew7
            });

        } catch (err: any) {
            console.error('Fetch Error:', err);
            // In a real app, show a toast here.
        } finally {
            setLoading(false);
        }
    }, [supabase, filters, page, pageSize]);

    // 3. Trigger Fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Handlers ---

    const handleFilterChange = (key: keyof FilterState, val: any) => {
        setFilters(prev => ({ ...prev, [key]: val }));
        setPage(1); // Reset to page 1 on filter change
    };

    const handleNoteSaved = () => {
        fetchData(); // Refresh list to update note content if displayed, or just to keep sync
        // If we want to keep modal open, we don't close it here.
        // But usually, we might close it. The prompt implies just "refresh current list".
        // We can also optimistic update the local `users` state.
        if (selectedUser) {
            // Optimistic update for the modal is handled inside modal? No, modal fetches or uses props.
            // Let's just re-fetch.
            fetchData(); 
            // Also need to update the `selectedUser` object passed to modal so it shows new note immediately if modal stays open?
            // The modal has local state `note`, so it's fine. 
            // If we close modal, next open will read from `users` list which is now updated.
             setSelectedUser(null);
        }
    };

    return (
        <div className="space-y-6">
            
            {/* 1. Top Bar: Filters */}
            <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="搜索姓名 / 邮箱 / 手机 / 公司 / 职位" 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                            value={filters.keyword}
                            onChange={(e) => handleFilterChange('keyword', e.target.value)}
                        />
                    </div>
                    
                    {/* Filters Group */}
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <FilterDropdown 
                            label="地区/语言" 
                            value={filters.locale}
                            options={[
                                { label: '全部地区', value: 'all' },
                                ...locales.map(l => ({ label: l, value: l }))
                            ]}
                            onChange={(v: string) => handleFilterChange('locale', v)}
                        />

                        <FilterDropdown 
                            label="营销许可" 
                            value={filters.marketing}
                            options={[
                                { label: '全部状态', value: 'all' },
                                { label: '已同意', value: 'true' },
                                { label: '未同意', value: 'false' },
                            ]}
                            onChange={(v: string) => handleFilterChange('marketing', v)}
                        />

                        <div className="relative">
                            <button 
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${filters.timeRange !== 'all' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 bg-white text-gray-700'}`}
                            >
                                <Calendar size={16} />
                                <span>{filters.timeRange === 'all' ? '全部时间' : filters.timeRange === 'custom' ? '自定义范围' : `最近 ${filters.timeRange}`}</span>
                                <ChevronDown size={14} />
                            </button>
                            
                            {showDatePicker && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30">
                                    <div className="space-y-2">
                                        <button onClick={() => { handleFilterChange('timeRange', 'all'); setShowDatePicker(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">全部时间</button>
                                        <button onClick={() => { handleFilterChange('timeRange', '7d'); setShowDatePicker(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">最近 7 天</button>
                                        <button onClick={() => { handleFilterChange('timeRange', '30d'); setShowDatePicker(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">最近 30 天</button>
                                        <hr className="border-gray-100" />
                                        <p className="text-xs text-gray-500 font-medium px-2 mt-2">自定义范围</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="date" className="text-xs border rounded p-1" value={filters.customStart} onChange={(e) => setFilters(prev => ({ ...prev, customStart: e.target.value, timeRange: 'custom' }))} />
                                            <input type="date" className="text-xs border rounded p-1" value={filters.customEnd} onChange={(e) => setFilters(prev => ({ ...prev, customEnd: e.target.value, timeRange: 'custom' }))} />
                                        </div>
                                        <button 
                                            onClick={() => { handleFilterChange('timeRange', 'custom'); setShowDatePicker(false); }}
                                            disabled={!filters.customStart || !filters.customEnd}
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

            {/* 2. Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium uppercase">当前筛选总数</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><UserCheck size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium uppercase">已同意营销</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.consentTrue}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-gray-100 text-gray-600 rounded-lg"><UserX size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium uppercase">未同意营销</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.consentFalse}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Clock size={20} /></div>
                    <div>
                        <p className="text-xs text-gray-500 font-medium uppercase">最近 7 天新增</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.newIn7Days}</p>
                    </div>
                </div>
            </div>

            {/* 3. Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                        <RefreshCw className="animate-spin text-gray-400" size={32} />
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
                            <tr>
                                <th className="px-6 py-4">姓名 / ID</th>
                                <th className="px-6 py-4">联系方式</th>
                                <th className="px-6 py-4">地区/语言</th>
                                <th className="px-6 py-4">营销许可</th>
                                <th className="px-6 py-4">注册时间</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900">{user.name || '未命名'}</p>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[100px]" title={user.id}>{user.id}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-gray-900">{user.email}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{user.phone || '-'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.locale ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                                {user.locale}
                                            </span>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.marketing_consent ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                                <Check size={10} /> 已同意
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
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
                                            <span className="hidden group-hover:inline text-xs font-medium">查看</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-400">
                                        未找到匹配的用户数据
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
                    <div className="text-xs text-gray-500">
                        显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, totalCount)} 条，共 {totalCount} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <select 
                            value={pageSize} 
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="text-xs border-gray-200 rounded-lg p-1.5 focus:ring-gray-900 focus:border-gray-900 bg-white"
                        >
                            <option value={20}>20 条/页</option>
                            <option value={50}>50 条/页</option>
                            <option value={100}>100 条/页</option>
                        </select>
                        <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 hover:bg-gray-50 disabled:opacity-50 border-r border-gray-200"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                onClick={() => setPage(p => (p * pageSize < totalCount ? p + 1 : p))}
                                disabled={page * pageSize >= totalCount}
                                className="p-2 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Detail Modal */}
            <UserDetailModal 
                user={selectedUser} 
                isOpen={!!selectedUser} 
                onClose={() => setSelectedUser(null)}
                onNoteSaved={handleNoteSaved}
            />

        </div>
    );
}
