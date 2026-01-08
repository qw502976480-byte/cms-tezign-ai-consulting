
'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DeliveryTask, EmailSendingAccount, EmailTemplate, DeliveryRun } from '@/types';
import { Search, ChevronDown, Check, MoreHorizontal, Clock, Play, Pause, Copy, Trash2, Edit2, Settings, Mail, Repeat, ScrollText, AlertTriangle, UserCheck, Loader2, CheckCircle2, AlertCircle, Ban } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { updateTaskStatus, deleteTask, duplicateTask } from './actions';
import Link from 'next/link';
import EmailConfigModal from './EmailConfigModal';
import TaskRunHistoryModal from './TaskRunHistoryModal';
import { deriveDeliveryTaskState, DerivedTaskStatus, DeliveryTaskDeriveInput, isRunActive } from './utils';

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
    isLocked, 
    canEnable, 
    onAction 
}: { 
    task: DeliveryTask; 
    isLocked: boolean; 
    canEnable: boolean; 
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

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
                className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
            >
                <MoreHorizontal size={18} />
            </button>
            
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    {/* Edit Config - Disabled if Locked */}
                    {isLocked ? (
                        <div className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-300 cursor-not-allowed">
                            <Edit2 size={14} /> 编辑配置
                        </div>
                    ) : (
                        <Link href={`/admin/delivery/${task.id}`} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            <Edit2 size={14} /> 编辑配置
                        </Link>
                    )}

                    <button onClick={() => { onAction('logs', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                        <ScrollText size={14} /> 查看执行记录
                    </button>
                    
                    <button onClick={() => { onAction('duplicate', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                        <Copy size={14} /> 复制任务
                    </button>
                    
                    {/* Status Toggle - Hidden/Disabled if Locked */}
                    {!isLocked && canEnable && (
                        <button onClick={() => { onAction('toggle_status', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            {task.status === 'active' ? <><Pause size={14} /> 暂停任务</> : <><Play size={14} /> 启用任务</>}
                        </button>
                    )}
                    {isLocked && (
                        <div className="px-3 py-2 text-xs text-indigo-600 flex items-center gap-2 cursor-not-allowed bg-indigo-50 rounded mx-1 my-1">
                            <Loader2 size={14} className="animate-spin" /> 执行中...
                        </div>
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
            }
        });
    };

    const getEmailDetails = (task: DeliveryTask) => {
        if (task.channel !== 'email' || !task.channel_config?.email) return null;
        const conf = task.channel_config.email;
        const acct = emailAccounts.find(a => a.id === conf.account_id);
        // const tmpl = emailTemplates.find(t => t.id === conf.template_id);
        return {
            accountName: acct ? acct.name : 'Unknown Account',
            accountEmail: acct ? acct.from_email : '',
            // templateName: tmpl ? tmpl.name : 'Unknown Template'
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
            const hasRun = task.run_count > 0 || !!lastRun;
            
            // Immediate Type
            if (s.one_time_type === 'immediate') {
                if (hasRun && lastRun) {
                    return (
                        <div className="flex flex-col">
                            <span className="text-gray-900 text-xs font-medium">已触发 (Triggered)</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                {format(new Date(lastRun.started_at), 'MM-dd HH:mm')}
                            </span>
                        </div>
                    );
                }
                return <span className="text-slate-500 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">手动触发</span>;
            }
            
            // Scheduled Type
            if (s.one_time_type === 'scheduled') {
                const dateStr = `${s.one_time_date || ''} ${s.one_time_time || ''}`;
                const isValid = dateStr.trim().length > 5;
                if (hasRun && lastRun) {
                     return (
                        <div className="flex flex-col">
                            <span className="text-gray-400 text-xs line-through">{isValid ? dateStr : 'Schedule'}</span>
                            <span className="text-[10px] text-green-600">已执行 (Executed)</span>
                        </div>
                    );
                }
                return (
                    <div className="flex flex-col">
                        <span className="text-gray-900 text-xs font-medium truncate">{isValid ? dateStr : '未设置'}</span>
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
                        <span className="text-[10px] text-gray-500">Next: {format(new Date(task.next_run_at), 'MM-dd HH:mm')}</span>
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

        // UI Logic: 
        // 1. Actually Running (<5m): Show "Running (Duration)"
        // 2. Stale Running (>5m): Show "Failed (Timeout)"
        // 3. Finished: Show "Finished (Duration)"

        if (isRunning && isActive) {
             return (
                <div className="flex flex-col">
                    <span className="text-gray-900 text-xs font-mono">Start: {startStr}</span>
                    <span className="text-[10px] text-indigo-600 font-medium animate-pulse">Running ({duration})</span>
                </div>
            );
        }
        
        if (isRunning && !isActive) {
             return (
                <div className="flex flex-col">
                    <span className="text-gray-900 text-xs font-mono">Start: {startStr}</span>
                    <span className="text-[10px] text-red-500 font-medium">Failed (超时)</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col">
                <span className="text-gray-900 text-xs font-mono">Start: {startStr}</span>
                <span className="text-[10px] text-gray-400">Finished (耗时 {duration})</span>
            </div>
        );
    };

    const getStatusBadge = (task: DeliveryTask, lastRun: DeliveryRun | undefined, derivedStatus: DerivedTaskStatus) => {
        // 1. Running (Highest Priority)
        if (lastRun?.status === 'running') {
             // Use strict check for UI status
             if (isRunActive(lastRun)) {
                 return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-indigo-50 text-indigo-700 border-indigo-200">
                        <Loader2 size={12} className="animate-spin" />
                        执行中
                    </span>
                 );
             } else {
                 // Timeout fallback badge
                 return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-red-50 text-red-700 border-red-200">
                        <AlertTriangle size={12} /> 失败 (超时)
                    </span>
                 );
             }
        }
        
        // 2. Paused (Explicitly Paused Recurring Task)
        if (derivedStatus === 'paused') {
             return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Pause size={12} /> 已暂停
                </span>
             );
        }

        // 3. Run Result (If available) - Shows the result of the LAST run
        if (lastRun) {
            const map: any = {
                success: { label: '成功', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
                failed: { label: '失败', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle },
                skipped: { label: '跳过', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
            };
            const conf = map[lastRun.status];
            if (conf) {
                return (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${conf.color}`}>
                        <conf.icon size={12} /> {conf.label}
                    </span>
                );
            }
        }

        // 4. Default Task Status
        const defMap: any = {
            draft: { label: '草稿', color: 'bg-gray-100 text-gray-600 border-gray-200' },
            scheduled: { label: '已排期', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
            active: { label: '运行中', color: 'bg-green-50 text-green-700 border-green-200', icon: Play },
            completed: { label: '已完成', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Check },
            overdue: { label: '已逾期', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle },
        };
        const def = defMap[derivedStatus];
        if (def) {
             return (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${def.color}`}>
                    {def.icon && <def.icon size={12} />} {def.label}
                </span>
             );
        }
        
        return <span className="text-gray-400 text-xs">{derivedStatus}</span>;
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
                            
                            // Use strict timeout logic for determining locking
                            const isLocked = isRunActive(lastRun);
                            
                            const deriveInput: DeliveryTaskDeriveInput = {
                                status: task.status,
                                run_count: task.run_count,
                                schedule_rule: task.schedule_rule,
                                last_run_status: isLocked ? 'running' : (lastRun ? lastRun.status : task.last_run_status),
                            };
                            
                            const { status: derivedStatus, canEnable } = deriveDeliveryTaskState(deriveInput);

                            return (
                                <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <div className="flex flex-col gap-1.5 items-start">
                                            {isLocked ? (
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
                                        {getStatusBadge(task, lastRun, derivedStatus)}
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
                                            isLocked={isLocked} 
                                            canEnable={canEnable} 
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
