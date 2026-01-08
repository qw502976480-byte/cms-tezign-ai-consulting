
'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DeliveryTask, EmailSendingAccount, EmailTemplate, DeliveryRun } from '@/types';
import { Search, ChevronDown, Check, MoreHorizontal, Clock, Play, Pause, Copy, Trash2, Edit2, Settings, Mail, Repeat, ScrollText, AlertTriangle, UserCheck, Loader2, CheckCircle2, AlertCircle, Ban, RefreshCw } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { updateTaskStatus, deleteTask, duplicateTask, runDeliveryTaskNow } from './actions';
import Link from 'next/link';
import EmailConfigModal from './EmailConfigModal';
import TaskRunHistoryModal from './TaskRunHistoryModal';
import { getTaskDerivedResult, DerivedResult, isRunActive } from './utils';

// --- Components ---

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

// Separate component to handle menu state and click-outside independently per row
function TaskActionMenu({ 
    task,
    derivedResult, 
    onAction 
}: { 
    task: DeliveryTask; 
    derivedResult: DerivedResult;
    onAction: (action: string, task: DeliveryTask) => void 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen]);

    const isOneTime = task.schedule_rule?.mode === 'one_time';
    const isRecurring = task.schedule_rule?.mode === 'recurring';

    // PERMISSION MATRIX LOGIC
    // 1. Running: Only Logs allowed.
    if (derivedResult === 'running') {
        return (
            <div className="relative" ref={menuRef}>
                <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                    <MoreHorizontal size={18} />
                </button>
                {isOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-1">
                        <button onClick={() => { onAction('logs', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            <ScrollText size={14} /> 查看执行记录
                        </button>
                        <div className="px-3 py-2 text-xs text-indigo-600 flex items-center gap-2 cursor-not-allowed bg-indigo-50 rounded mx-1 my-1">
                            <Loader2 size={14} className="animate-spin" /> 执行中...
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 2. Failed: Edit, Log, Retry. No Duplicate.
    // 3. Success (One-time): Log, Duplicate. No Edit, No Run.
    // 4. Success (Recurring): Edit, Duplicate, Log.
    // 5. Not Started: Edit, Duplicate, Log, Delete.

    const allowEdit = derivedResult !== 'success' || !isOneTime; // Locked if one-time success
    const allowDuplicate = derivedResult !== 'failed'; // Forbidden if failed
    const allowRetry = derivedResult === 'failed'; // Only explicit retry if failed
    const allowRunOnce = derivedResult === 'not_started' && isOneTime && task.schedule_rule?.one_time_type === 'immediate';
    const allowStatusToggle = derivedResult === 'not_started' || (derivedResult === 'success' && isRecurring);

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                <MoreHorizontal size={18} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    
                    {/* EDIT */}
                    {allowEdit ? (
                        <Link href={`/admin/delivery/${task.id}`} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            <Edit2 size={14} /> 编辑配置
                        </Link>
                    ) : (
                        <div className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-300 cursor-not-allowed">
                            <Edit2 size={14} /> 编辑配置
                        </div>
                    )}

                    {/* LOGS */}
                    <button onClick={() => { onAction('logs', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                        <ScrollText size={14} /> 查看执行记录
                    </button>
                    
                    {/* DUPLICATE */}
                    {allowDuplicate && (
                        <button onClick={() => { onAction('duplicate', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            <Copy size={14} /> 复制任务
                        </button>
                    )}

                    {/* ACTIONS: Retry or Toggle */}
                    {allowRetry && (
                        <button onClick={() => { onAction('run_now', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-amber-50 text-amber-700 rounded">
                            <RefreshCw size={14} /> 重新执行
                        </button>
                    )}
                    
                    {allowRunOnce && (
                         <button onClick={() => { onAction('run_now', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 rounded">
                            <Play size={14} /> 执行一次
                        </button>
                    )}

                    {allowStatusToggle && isRecurring && (
                        <button onClick={() => { onAction('toggle_status', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            {task.status === 'active' ? <><Pause size={14} /> 暂停任务</> : <><Play size={14} /> 启用任务</>}
                        </button>
                    )}
                    
                    <div className="h-px bg-gray-100 my-1"></div>
                    
                    <button onClick={() => { onAction('delete', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-50 text-red-600 rounded">
                        <Trash2 size={14} /> 删除任务
                    </button>
                </div>
            )}
        </div>
    );
}

export default function TaskClientView({ 
    initialTasks, 
    emailAccounts, 
    emailTemplates,
    latestRunMap,
    runningTaskIds
}: { 
    initialTasks: DeliveryTask[], 
    emailAccounts: EmailSendingAccount[],
    emailTemplates: EmailTemplate[],
    latestRunMap: Record<string, DeliveryRun>,
    runningTaskIds: string[]
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [keyword, setKeyword] = useState(searchParams.get('q') || '');
    
    // Modals
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [historyModalTask, setHistoryModalTask] = useState<{id: string, name: string} | null>(null);

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') params.set(key, value); else params.delete(key);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearch = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') updateFilter('q', keyword);
    };

    const handleAction = async (action: string, task: DeliveryTask) => {
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
            } else if (action === 'run_now') {
                if(confirm('确定要立即执行此任务吗？')) {
                    const res = await runDeliveryTaskNow(task.id);
                    if(res.success) {
                        alert(res.message);
                        router.refresh();
                    } else {
                        alert(`执行失败: ${res.error}`);
                    }
                }
            }
        });
    };

    const getEmailDetails = (task: DeliveryTask) => {
        if (task.channel !== 'email' || !task.channel_config?.email) return null;
        const conf = task.channel_config.email;
        const acct = emailAccounts.find(a => a.id === conf.account_id);
        return {
            accountName: acct ? acct.name : 'Unknown Account',
            accountEmail: acct ? acct.from_email : '',
        };
    };

    // --- Time & Status Helpers ---

    const formatDurationSimple = (start: Date, end: Date) => {
        const seconds = differenceInSeconds(end, start);
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ${seconds % 60}s`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const getPlannedTimeDisplay = (task: DeliveryTask, lastRun?: DeliveryRun) => {
        const { schedule_rule: s } = task;
        if (!s) return <span className="text-gray-300 text-xs">—</span>;

        // 1. One Time Task
        if (s.mode === 'one_time') {
            // Immediate Type
            if (s.one_time_type === 'immediate') {
                const triggerTime = lastRun ? lastRun.started_at : task.created_at;
                return (
                    <div className="flex flex-col">
                        <span className="text-gray-900 text-xs font-medium">立即执行 (Immediate)</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                            创建于: {format(new Date(triggerTime), 'MM-dd HH:mm')}
                        </span>
                    </div>
                );
            }
            
            // Scheduled Type
            if (s.one_time_type === 'scheduled') {
                const dateStr = `${s.one_time_date || ''} ${s.one_time_time || ''}`;
                return (
                    <div className="flex flex-col">
                        <span className="text-gray-900 text-xs font-medium">定时: {dateStr}</span>
                    </div>
                );
            }
        }
        
        // 2. Recurring Task
        if (s.mode === 'recurring') {
            const freqMap: any = { daily: '每天', weekly: '每周', monthly: '每月' };
            const freq = freqMap[s.frequency || ''] || s.frequency;
            return (
                <div className="flex flex-col">
                    <span className="text-gray-900 text-xs font-medium">周期: {freq}</span>
                    {task.next_run_at ? (
                        <span className="text-[10px] text-gray-500">下次: {format(new Date(task.next_run_at), 'MM-dd HH:mm')}</span>
                    ) : null}
                </div>
            );
        }
        return <span className="text-gray-300">—</span>;
    };

    const getActualTimeDisplay = (run?: DeliveryRun) => {
        if (!run) return <span className="text-gray-300 text-xs font-mono">—</span>;
        
        const start = new Date(run.started_at);
        const startStr = format(start, 'MM-dd HH:mm');
        const isActive = isRunActive(run); // Handles 5m timeout
        const isRunning = run.status === 'running';
        
        const end = run.finished_at ? new Date(run.finished_at) : new Date();
        const duration = formatDurationSimple(start, end);

        if (isRunning && isActive) {
             return (
                <div className="flex flex-col">
                    <span className="text-gray-900 text-xs font-mono">Start: {startStr}</span>
                    <span className="text-[10px] text-indigo-600 font-medium animate-pulse">运行中 (已运行 {duration})</span>
                </div>
            );
        }
        
        if (isRunning && !isActive) {
             return (
                <div className="flex flex-col">
                    <span className="text-gray-900 text-xs font-mono">Start: {startStr}</span>
                    <span className="text-[10px] text-red-500 font-medium">失败 (超时)</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col">
                <span className="text-gray-900 text-xs font-mono">Start: {startStr}</span>
                <span className="text-[10px] text-gray-400">结束 (耗时 {duration})</span>
            </div>
        );
    };

    const getStatusBadge = (derivedResult: DerivedResult) => {
        switch (derivedResult) {
            case 'running':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-indigo-50 text-indigo-700 border-indigo-200">
                        <Loader2 size={12} className="animate-spin" /> 执行中
                    </span>
                );
            case 'success':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 size={12} /> 成功
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-red-50 text-red-700 border-red-200">
                        <AlertTriangle size={12} /> 失败
                    </span>
                );
            case 'not_started':
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-gray-50 text-gray-600 border-gray-200">
                        未开始
                    </span>
                );
        }
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
                        options={[{label:'全部',value:'all'}, {label:'草稿',value:'draft'}, {label:'运行中',value:'active'}, {label:'已暂停',value:'paused'}, {label:'已完成',value:'completed'}]}
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
                            <th className="px-6 py-4 w-[220px] font-medium">任务名称 / 类型</th>
                            <th className="px-6 py-4 w-[160px] font-medium">渠道配置</th>
                            <th className="px-6 py-4 w-[140px] font-medium">结果 / 状态</th>
                            <th className="px-6 py-4 w-[150px] font-medium">计划执行 (Planned)</th>
                            <th className="px-6 py-4 w-[150px] font-medium">实际执行 (Actual)</th>
                            <th className="px-6 py-4 w-[100px] font-medium">受众</th>
                            <th className="px-6 py-4 text-right font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialTasks.map((task) => {
                            const emailDetails = getEmailDetails(task);
                            const isRecurring = task.schedule_rule?.mode === 'recurring';
                            const lastRun = latestRunMap[task.id];
                            const derivedResult = getTaskDerivedResult(lastRun);

                            return (
                                <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <div className="flex flex-col gap-1.5 items-start">
                                            {derivedResult === 'running' ? (
                                                <span className="block truncate max-w-[200px]" title={task.name}>{task.name}</span>
                                            ) : (
                                                <Link href={`/admin/delivery/${task.id}`} className="hover:text-indigo-600 hover:underline block truncate max-w-[200px]" title={task.name}>
                                                    {task.name}
                                                </Link>
                                            )}
                                            {isRecurring ? (
                                                <div className="flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-fit">
                                                    <Repeat size={10} /> 周期性
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[10px] text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 w-fit">
                                                    <Clock size={10} /> 一次性
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900 font-medium flex items-center gap-1.5 text-xs">
                                            {task.channel === 'email' ? <Mail size={14} className="text-gray-400" /> : null}
                                            <span className="capitalize">{task.channel}</span>
                                        </div>
                                        {emailDetails && (
                                            <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
                                                <div title={emailDetails.accountEmail} className="truncate max-w-[140px]">Via: {emailDetails.accountName}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(derivedResult)}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        {getPlannedTimeDisplay(task, lastRun)}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        {getActualTimeDisplay(lastRun)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
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
                                    <td className="px-6 py-4 text-right relative align-top">
                                        <TaskActionMenu 
                                            task={task} 
                                            derivedResult={derivedResult}
                                            onAction={handleAction} 
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {initialTasks.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-16 text-gray-400">暂无任务</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <EmailConfigModal isOpen={isConfigModalOpen} onClose={() => { setIsConfigModalOpen(false); }} accounts={emailAccounts} templates={emailTemplates} />
            
            {historyModalTask && (
                <TaskRunHistoryModal 
                    isOpen={!!historyModalTask} 
                    onClose={() => setHistoryModalTask(null)} 
                    taskId={historyModalTask.id}
                    taskName={historyModalTask.name}
                />
            )}
        </div>
    );
}
