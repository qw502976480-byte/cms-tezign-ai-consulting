
'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DeliveryTask, EmailSendingAccount, EmailTemplate, DeliveryRun } from '@/types';
import { Search, ChevronDown, Check, MoreHorizontal, Clock, Play, Pause, Copy, Trash2, Edit2, Settings, Mail, Repeat, ScrollText, AlertTriangle, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { updateTaskStatus, deleteTask, duplicateTask } from './actions';
import Link from 'next/link';
import EmailConfigModal from './EmailConfigModal';
import TaskRunHistoryModal from './TaskRunHistoryModal';
import { deriveDeliveryTaskState, DerivedTaskStatus } from './utils';

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

// Updated Status Map to handle Derived Statuses
const statusMap: Record<DerivedTaskStatus, { label: string; color: string; icon?: React.ElementType }> = {
    draft: { label: '草稿', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    active: { label: '运行中', color: 'bg-green-50 text-green-700 border-green-200', icon: Play },
    scheduled: { label: '已排期', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
    paused: { label: '已暂停', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Pause },
    completed: { label: '已完成', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Check },
    failed: { label: '失败', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle },
    overdue: { label: '已逾期', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle },
};

export default function TaskClientView({ 
    initialTasks, 
    emailAccounts, 
    emailTemplates,
    latestRunMap
}: { 
    initialTasks: DeliveryTask[], 
    emailAccounts: EmailSendingAccount[],
    emailTemplates: EmailTemplate[],
    latestRunMap: Record<string, DeliveryRun>
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [keyword, setKeyword] = useState(searchParams.get('q') || '');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // Modals
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [historyModalTask, setHistoryModalTask] = useState<{id: string, name: string} | null>(null);

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
            } else if (action === 'logs') {
                setHistoryModalTask({ id: task.id, name: task.name });
            }
        });
    };

    const getEmailDetails = (task: DeliveryTask) => {
        if (task.channel !== 'email' || !task.channel_config?.email) return null;
        const conf = task.channel_config.email;
        const acct = emailAccounts.find(a => a.id === conf.account_id);
        const tmpl = emailTemplates.find(t => t.id === conf.template_id);
        return {
            accountName: acct ? acct.name : 'Unknown Account',
            accountEmail: acct ? acct.from_email : '',
            templateName: tmpl ? tmpl.name : 'Unknown Template'
        };
    };

    const getNextRunDisplay = (task: DeliveryTask, displayStatus: string) => {
        if (displayStatus === 'completed' || displayStatus === 'failed') return '—';
        
        const isOneTime = task.schedule_rule?.mode === 'one_time';
        if (isOneTime) {
             if (task.run_count > 0) return '—';
             if (task.schedule_rule?.one_time_type === 'scheduled') {
                 return `${task.schedule_rule.one_time_date} ${task.schedule_rule.one_time_time}`;
             }
             return '—'; // Immediate, waiting for manual run
        }
        return task.next_run_at ? format(new Date(task.next_run_at), 'yyyy-MM-dd HH:mm') : 'Calculating...';
    };

    return (
        <div className="space-y-6">
            {/* Header Actions & Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
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
                        options={[{label:'全部',value:'all'}, ...Object.keys(statusMap).map(k => ({label:statusMap[k as DerivedTaskStatus].label, value:k}))]}
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
                
                <button
                   onClick={() => setIsConfigModalOpen(true)}
                   className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 h-auto whitespace-nowrap"
                >
                   <Settings size={18} /> 渠道配置 (Channels)
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">
                 <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 w-[220px] font-medium">任务名称</th>
                            <th className="px-6 py-4 w-[100px] font-medium">类型</th>
                            <th className="px-6 py-4 w-[160px] font-medium">渠道配置</th>
                            <th className="px-6 py-4 w-[120px] font-medium">受众/触达</th>
                            <th className="px-6 py-4 w-[120px] font-medium">状态</th>
                            <th className="px-6 py-4 w-[150px] font-medium">最近执行</th>
                            <th className="px-6 py-4 w-[150px] font-medium">下次执行</th>
                            <th className="px-6 py-4 text-right font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialTasks.map((task) => {
                            const emailDetails = getEmailDetails(task);
                            const isRecurring = task.schedule_rule?.mode === 'recurring';
                            const lastRun = latestRunMap[task.id];
                            
                            // Use Central Logic for Status & Permissions
                            const { status: derivedStatus, canEnable } = deriveDeliveryTaskState(task);
                            
                            const statusInfo = statusMap[derivedStatus];
                            const StatusIcon = statusInfo?.icon;
                            const nextRunText = getNextRunDisplay(task, derivedStatus);

                            return (
                                <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <Link href={`/admin/delivery/${task.id}`} className="hover:text-indigo-600 hover:underline block truncate max-w-[200px]" title={task.name}>{task.name}</Link>
                                        {task.last_run_message && (
                                            <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]" title={task.last_run_message}>{task.last_run_message}</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isRecurring ? (
                                            <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-fit">
                                                <Repeat size={12} /> 周期性
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                                                <Clock size={12} /> 一次性
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900 font-medium flex items-center gap-1.5">
                                            {task.channel === 'email' ? <Mail size={14} className="text-gray-400" /> : null}
                                            <span className="capitalize">{task.channel}</span>
                                        </div>
                                        {emailDetails && (
                                            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                <div title={emailDetails.accountEmail} className="truncate max-w-[140px]">Via: {emailDetails.accountName}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lastRun ? (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    <UserCheck size={12} className="text-green-600" />
                                                    {lastRun.success_count}
                                                </span>
                                                <span className="text-[10px] text-gray-400">实际触达</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium text-gray-500 flex items-center gap-1">
                                                    ≈ {task.audience_rule?.estimated_count ?? '-'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">预估人数</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${statusInfo?.color}`}>
                                            {StatusIcon && <StatusIcon size={12} />}
                                            {statusInfo?.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs tabular-nums">
                                        {task.last_run_at ? format(new Date(task.last_run_at), 'yyyy-MM-dd HH:mm') : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs tabular-nums">
                                        {nextRunText}
                                    </td>
                                    <td className="px-6 py-4 text-right relative">
                                        {/* Actions Dropdown */}
                                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === task.id ? null : task.id); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors">
                                            <MoreHorizontal size={18} />
                                        </button>
                                        
                                        {menuOpenId === task.id && (
                                            <div className="absolute right-8 top-8 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-1">
                                                <Link href={`/admin/delivery/${task.id}`} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                                                    <Edit2 size={14} /> 编辑配置
                                                </Link>
                                                <button onClick={() => handleAction('logs', task)} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                                                    <ScrollText size={14} /> 查看执行记录
                                                </button>
                                                {/* Guard: Enable/Pause */}
                                                {canEnable && (
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
                            );
                        })}
                         {initialTasks.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-16 text-gray-400">暂无分发任务</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Modals */}
            <EmailConfigModal 
                isOpen={isConfigModalOpen} 
                onClose={() => setIsConfigModalOpen(false)} 
                accounts={emailAccounts}
                templates={emailTemplates}
            />
            
            <TaskRunHistoryModal 
                isOpen={!!historyModalTask} 
                onClose={() => setHistoryModalTask(null)}
                taskId={historyModalTask?.id || ''}
                taskName={historyModalTask?.name || ''}
            />
        </div>
    );
}
