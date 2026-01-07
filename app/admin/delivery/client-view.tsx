'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DeliveryTask, DeliveryTaskStatus } from '@/types';
import { Search, ChevronDown, Check, MoreHorizontal, Zap, Clock, Play, Pause, Copy, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { updateTaskStatus, deleteTask, duplicateTask } from './actions';
import Link from 'next/link';

function FilterDropdown({ label, value, options, onChange }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const clickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', clickOutside);
        return () => document.removeEventListener('mousedown', clickOutside);
    }, []);
    const currentLabel = options.find((o: any) => o.value === value)?.label || options[0].label;
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className={`flex w-full items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${isOpen ? 'border-gray-900 ring-1 ring-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'}`}>
                <span className="text-gray-500">{label}:</span>
                <span className="font-medium text-gray-900">{currentLabel}</span>
                <ChevronDown size={14} className="text-gray-400 ml-auto" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[120px] bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1">
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

const statusMap: Record<DeliveryTaskStatus, { label: string, color: string }> = {
    draft: { label: '草稿', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    active: { label: '运行中', color: 'bg-green-50 text-green-700 border-green-200' },
    paused: { label: '已暂停', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    completed: { label: '已完成', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function TaskClientView({ initialTasks }: { initialTasks: DeliveryTask[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [keyword, setKeyword] = useState(searchParams.get('q') || '');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') params.set(key, value); else params.delete(key);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearch = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') updateFilter('q', keyword);
    };

    const handleAction = async (action: string, task: DeliveryTask) => {
        setMenuOpenId(null);
        startTransition(async () => {
            if (action === 'toggle_status') {
                const newStatus = task.status === 'active' ? 'paused' : 'active';
                await updateTaskStatus(task.id, newStatus);
            } else if (action === 'delete') {
                if (confirm('确定要删除此任务吗？')) await deleteTask(task.id);
            } else if (action === 'duplicate') {
                await duplicateTask(task);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} strokeWidth={1.5} />
                    <input 
                        type="text" 
                        placeholder="搜索任务名称" 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                </div>
                <FilterDropdown 
                    label="状态"
                    value={searchParams.get('status') || 'all'}
                    options={[{label:'全部',value:'all'}, ...Object.keys(statusMap).map(k => ({label:statusMap[k as DeliveryTaskStatus].label, value:k}))]}
                    onChange={(v: string) => updateFilter('status', v)}
                />
                <FilterDropdown 
                    label="类型"
                    value={searchParams.get('type') || 'all'}
                    options={[{label:'全部',value:'all'},{label:'自动化',value:'automated'},{label:'临时任务',value:'one_off'}]}
                    onChange={(v: string) => updateFilter('type', v)}
                />
                <FilterDropdown 
                    label="渠道"
                    value={searchParams.get('channel') || 'all'}
                    options={[{label:'全部',value:'all'},{label:'Email',value:'email'},{label:'站内信',value:'in_app'}]}
                    onChange={(v: string) => updateFilter('channel', v)}
                />
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">
                 <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 w-[250px] font-medium">任务名称</th>
                            <th className="px-6 py-4 w-[120px] font-medium">类型</th>
                            <th className="px-6 py-4 w-[120px] font-medium">渠道</th>
                            <th className="px-6 py-4 w-[120px] font-medium">状态</th>
                            <th className="px-6 py-4 w-[180px] font-medium">最近执行</th>
                            <th className="px-6 py-4 w-[180px] font-medium">下次执行</th>
                            <th className="px-6 py-4 text-right font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialTasks.map((task) => (
                            <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    <Link href={`/admin/delivery/${task.id}`} className="hover:text-indigo-600 hover:underline">{task.name}</Link>
                                </td>
                                <td className="px-6 py-4">
                                    {task.type === 'automated' ? (
                                        <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-fit">
                                            <Zap size={12} /> 自动化
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                                            <Clock size={12} /> 临时
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-gray-600 capitalize">
                                    {task.channel === 'email' ? 'Email' : '站内'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${statusMap[task.status].color}`}>
                                        {statusMap[task.status].label}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-xs tabular-nums">
                                    {task.last_run_at ? format(new Date(task.last_run_at), 'yyyy-MM-dd HH:mm') : '—'}
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-xs tabular-nums">
                                    {task.next_run_at ? format(new Date(task.next_run_at), 'yyyy-MM-dd HH:mm') : '—'}
                                </td>
                                <td className="px-6 py-4 text-right relative">
                                    {/* Actions Dropdown */}
                                     <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === task.id ? null : task.id); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors">
                                        <MoreHorizontal size={18} />
                                    </button>
                                    
                                    {menuOpenId === task.id && (
                                        <div className="absolute right-8 top-8 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-1">
                                            {/* Action buttons */}
                                            {task.status !== 'completed' && task.status !== 'draft' && (
                                                <button onClick={() => handleAction('toggle_status', task)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                                                    {task.status === 'active' ? <><Pause size={14} /> 暂停任务</> : <><Play size={14} /> 启用任务</>}
                                                </button>
                                            )}
                                            <button onClick={() => handleAction('duplicate', task)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                                                <Copy size={14} /> 复制任务
                                            </button>
                                            <button onClick={() => handleAction('delete', task)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-50 text-red-600 rounded">
                                                <Trash2 size={14} /> 删除任务
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                         {initialTasks.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-16 text-gray-400">暂无分发任务</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}