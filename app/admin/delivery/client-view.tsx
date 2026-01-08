
'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DeliveryTask, EmailSendingAccount, EmailTemplate, DeliveryRun } from '@/types';
import { Search, ChevronDown, Check, MoreHorizontal, Clock, Play, Pause, Copy, Trash2, Edit2, Settings, Mail, Repeat, ScrollText, AlertTriangle, UserCheck, Loader2, CheckCircle2, RefreshCw, XCircle, Slash } from 'lucide-react';
import { format } from 'date-fns';
import { updateTaskStatus, deleteTask, duplicateTask, runDeliveryTaskNow } from './actions';
import Link from 'next/link';
import EmailConfigModal from './EmailConfigModal';
import TaskRunHistoryModal from './TaskRunHistoryModal';
import { getTaskDerivedResult, DerivedResult, isDeliveryRunRecordActive } from './utils';

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

    // --- PERMISSION MATRIX ---
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

    // 2. State-based Permissions
    let allowEdit = true;
    let allowRun = false;
    let allowDuplicate = true;
    let allowDelete = true;

    if (derivedResult === 'success') {
        if (isOneTime) {
            allowEdit = false; // Locked
            allowRun = false;
            allowDuplicate = true;
        } else {
            // Recurring success
            allowEdit = true;
            allowRun = false; // Only automated
            allowDuplicate = true;
        }
    } else if (derivedResult === 'failed') {
        allowEdit = true;
        allowRun = true; // Retry allowed
        allowDuplicate = false; // Prohibit copy of failed
    } else if (derivedResult === 'skipped') {
        allowEdit = true;
        allowRun = true;
        allowDuplicate = true;
    } else {
        // Not Started
        allowEdit = true;
        allowRun = isOneTime && task.schedule_rule?.one_time_type === 'immediate';
        allowDuplicate = true;
    }

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
                            <Edit2 size={14} /> 编辑任务
                        </Link>
                    ) : (
                        <button disabled className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-300 cursor-not-allowed">
                            <Edit2 size={14} /> 编辑任务 (锁定)
                        </button>
                    )}

                    {/* RUN / RETRY */}
                    {allowRun && (
                        <button onClick={() => { onAction(derivedResult === 'failed' ? 'retry' : 'run_now', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 rounded font-medium">
                            {derivedResult === 'failed' ? <RefreshCw size={14} /> : <Play size={14} />}
                            {derivedResult === 'failed' ? '重新执行' : '立即执行'}
                        </button>
                    )}

                    {/* ENABLE / DISABLE (For Scheduled/Recurring) */}
                    {task.schedule_rule?.mode === 'recurring' && (
                        task.status === 'active' ? (
                            <button onClick={() => { onAction('pause', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                                <Pause size={14} /> 暂停任务
                            </button>
                        ) : (
                            <button onClick={() => { onAction('enable', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                                <Play size={14} /> 启用任务
                            </button>
                        )
                    )}

                    {/* DUPLICATE */}
                    {allowDuplicate ? (
                        <button onClick={() => { onAction('duplicate', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                            <Copy size={14} /> 复制任务
                        </button>
                    ) : (
                        <button disabled className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-300 cursor-not-allowed">
                            <Copy size={14} /> 复制任务
                        </button>
                    )}

                    <div className="h-px bg-gray-100 my-1"></div>

                    {/* LOGS */}
                    <button onClick={() => { onAction('logs', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 rounded text-gray-700">
                        <ScrollText size={14} /> 执行记录
                    </button>

                    {/* DELETE */}
                    {allowDelete && (
                        <button onClick={() => { onAction('delete', task); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-50 text-red-600 rounded">
                            <Trash2 size={14} /> 删除任务
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function TaskClientView({ 
    initialTasks,
    emailAccounts,
    emailTemplates,
    latestRunsMap = {} 
}: { 
    initialTasks: DeliveryTask[]; 
    emailAccounts: EmailSendingAccount[];
    emailTemplates: EmailTemplate[];
    latestRunsMap?: Record<string, DeliveryRun>;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);

    // Search Params Handling
    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') params.set(key, value); else params.delete(key);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Handlers
    const handleAction = async (action: string, task: DeliveryTask) => {
        if (action === 'logs') {
            setHistoryTaskId(task.id);
            return;
        }

        if (action === 'delete') {
            if (!confirm('确定要删除此任务吗？')) return;
            startTransition(async () => {
                const res = await deleteTask(task.id);
                if (res.success) router.refresh(); else alert(res.error);
            });
        }
        else if (action === 'duplicate') {
            if (!confirm('确定要复制此任务吗？')) return;
            startTransition(async () => {
                const res = await duplicateTask(task);
                if (res.success) router.refresh(); else alert(res.error);
            });
        }
        else if (action === 'enable' || action === 'pause') {
            const newStatus = action === 'enable' ? 'active' : 'paused';
            startTransition(async () => {
                const res = await updateTaskStatus(task.id, newStatus);
                if (res.success) router.refresh(); else alert(res.error);
            });
        }
        else if (action === 'run_now' || action === 'retry') {
             if (!confirm(`确定要立即执行任务 "${task.name}" 吗？`)) return;
             // Optimistic feedback provided by task detail page logic, here we just trigger
             const res = await runDeliveryTaskNow(task.id);
             if (res.success) {
                 alert(`执行已触发: ${res.message}`);
                 router.refresh();
             } else {
                 alert(`执行失败: ${res.error}`);
             }
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜索任务名称..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm"
                        defaultValue={searchParams.get('q') || ''}
                        onKeyDown={(e) => e.key === 'Enter' && updateFilter('q', e.currentTarget.value)}
                    />
                </div>
                <FilterDropdown 
                    label="状态" 
                    value={searchParams.get('status') || 'all'}
                    options={[{label:'全部', value:'all'}, {label:'草稿', value:'draft'}, {label:'启用中', value:'active'}, {label:'已暂停', value:'paused'}, {label:'已完成', value:'completed'}, {label:'执行失败', value:'failed'}]}
                    onChange={(v: string) => updateFilter('status', v)}
                />
                <button onClick={() => setIsConfigModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                    <Settings size={16} /> 渠道配置
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">
                <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 font-medium w-[25%]">任务名称</th>
                            <th className="px-6 py-4 font-medium w-[15%]">类型/渠道</th>
                            <th className="px-6 py-4 font-medium w-[15%]">受众</th>
                            <th className="px-6 py-4 font-medium w-[20%]">执行计划</th>
                            <th className="px-6 py-4 font-medium w-[15%]">最近状态</th>
                            <th className="px-6 py-4 font-medium text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialTasks.map(task => {
                            const latestRun = latestRunsMap[task.id];
                            const derivedResult = getTaskDerivedResult(task, latestRun);
                            const scheduleMode = task.schedule_rule?.mode === 'one_time' ? '一次性' : '周期';
                            
                            return (
                                <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 truncate max-w-[200px]" title={task.name}>{task.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {/* Config Status Badge */}
                                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                                                task.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' :
                                                task.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                task.status === 'draft' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                'bg-gray-100 text-gray-500 border-gray-200'
                                            }`}>
                                                {task.status === 'active' && <Play size={10} fill="currentColor"/>}
                                                {task.status === 'paused' && <Pause size={10} fill="currentColor"/>}
                                                {task.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded w-fit">{task.type}</span>
                                            <span className="flex items-center gap-1 text-xs text-gray-600">
                                                {task.channel === 'email' ? <Mail size={12}/> : <Settings size={12}/>} 
                                                {task.channel === 'email' ? 'Email' : 'In-app'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                         <div className="flex items-center gap-1.5 text-gray-700">
                                            <UserCheck size={14} className="text-gray-400" />
                                            {task.audience_rule?.user_type === 'all' ? '全部用户' : task.audience_rule?.user_type === 'personal' ? '个人用户' : '企业用户'}
                                         </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-gray-900 flex items-center gap-1.5 mb-1">
                                            {scheduleMode === '一次性' ? <Clock size={12} className="text-gray-400" /> : <Repeat size={12} className="text-indigo-400" />}
                                            {scheduleMode}
                                        </div>
                                        {task.next_run_at ? (
                                            <div className="text-[10px] text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded w-fit">
                                                下一次: {format(new Date(task.next_run_at), 'MM-dd HH:mm')}
                                            </div>
                                        ) : task.status === 'completed' ? (
                                            <div className="text-[10px] text-gray-400">-</div>
                                        ) : (
                                            <div className="text-[10px] text-gray-400 italic">未调度</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {/* Real Execution Status */}
                                        {derivedResult === 'running' ? (
                                            <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-medium animate-pulse">
                                                <Loader2 size={12} className="animate-spin" /> 运行中
                                            </div>
                                        ) : derivedResult === 'failed' ? (
                                             <div className="text-red-600 text-xs flex items-center gap-1" title={latestRun?.message || task.last_run_message || 'Unknown error'}>
                                                <XCircle size={12} /> 失败
                                             </div>
                                        ) : derivedResult === 'success' ? (
                                             <div className="text-green-600 text-xs flex items-center gap-1">
                                                <CheckCircle2 size={12} /> 成功
                                             </div>
                                        ) : derivedResult === 'skipped' ? (
                                             <div className="text-yellow-600 text-xs flex items-center gap-1">
                                                <Slash size={12} /> 跳过
                                             </div>
                                        ) : (
                                            <span className="text-gray-300 text-xs">未开始</span>
                                        )}
                                        
                                        {/* Latest Run Time */}
                                        {(latestRun?.started_at || task.last_run_at) && derivedResult !== 'running' && derivedResult !== 'not_started' && (
                                            <div className="text-[10px] text-gray-400 mt-1 font-mono">
                                                {format(new Date(latestRun?.started_at || task.last_run_at!), 'MM-dd HH:mm')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
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
                                <td colSpan={6} className="text-center py-16 text-gray-400">
                                    暂无分发任务
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <EmailConfigModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} accounts={emailAccounts} templates={emailTemplates} />
            
            {historyTaskId && (
                <TaskRunHistoryModal 
                    isOpen={!!historyTaskId} 
                    onClose={() => setHistoryTaskId(null)} 
                    taskId={historyTaskId}
                    taskName={initialTasks.find(t => t.id === historyTaskId)?.name || ''}
                />
            )}
        </div>
    );
}
