

'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upsertDeliveryTask, estimateAudienceCount, searchResources, getResourcesByIds, getEmailAccounts, getEmailTemplates, getUniqueInterestTags, preflightCheckDeliveryTask, runDeliveryTaskNow } from './actions';
import { DeliveryTask, DeliveryTaskType, DeliveryChannel, DeliveryTaskStatus, DeliveryContentMode, DeliveryAudienceRule, DeliveryContentRule, DeliveryScheduleRule, EmailSendingAccount, EmailTemplate, EmailChannelConfig, DeliveryRun } from '@/types';
import { Loader2, Save, Play, Search, X, Check, Calculator, CalendarClock, Users, FileText, Settings, AlertTriangle, Mail, Calendar, ArrowRight, ExternalLink, ChevronDown, Tag, Send, History } from 'lucide-react';
import EmailConfigModal from './EmailConfigModal';
import { format } from 'date-fns';

interface Props {
  initialData?: DeliveryTask;
  initialRuns?: DeliveryRun[];
}

// --- Custom Select Component (Unchanged) ---
interface Option { label: string; value: string | number; }
interface CustomSelectProps { value: string | number | undefined; onChange: (value: string) => void; options: Option[]; placeholder?: string; className?: string; disabled?: boolean; }
const CustomSelect = ({ value, onChange, options, placeholder, className, disabled }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false); const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);
  const selectedOption = options.find(o => String(o.value) === String(value));
  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-all duration-200 bg-white ${isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300 hover:border-gray-400'} ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-gray-900'}`}>{selectedOption ? selectedOption.label : (placeholder || '请选择...')} <ChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'text-gray-400'}`} /></button>
      {isOpen && !disabled && ( <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto"><div className="p-1">{options.map(opt => (<button key={opt.value} type="button" onClick={() => { onChange(String(opt.value)); setIsOpen(false);}} className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${String(value) === String(opt.value) ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>{opt.label}{String(value) === String(opt.value) && <Check size={14} />}</button>))}</div></div>)}
    </div>
  );
};


export default function TaskForm({ initialData, initialRuns = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // --- State ---
  const [basic, setBasic] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'automated' as DeliveryTaskType,
    channel: initialData?.channel || 'email' as DeliveryChannel,
    status: initialData?.status || 'draft' as DeliveryTaskStatus,
  });

  const [audience, setAudience] = useState<DeliveryAudienceRule>(initialData?.audience_rule || {
    scope: 'all', user_type: 'all', marketing_opt_in: 'yes', has_communicated: 'all', has_demo_request: 'all', last_login_range: 'all', country: '', city: '', company: '', title: '', interest_tags: [], estimated_count: 0
  });
  
  const [contentMode, setContentMode] = useState<DeliveryContentMode>(initialData?.content_mode || 'rule');
  const [contentRule, setContentRule] = useState<DeliveryContentRule>(initialData?.content_rule || { category: [], time_range: '30d', limit: 3, featured_slot: 'none' });
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>(initialData?.content_ids || []);
  const [schedule, setSchedule] = useState<DeliveryScheduleRule>(initialData?.schedule_rule || { mode: 'one_time', one_time_type: 'immediate', timezone: 'Asia/Shanghai' });
  const [emailConfig, setEmailConfig] = useState<EmailChannelConfig>(initialData?.channel_config?.email || { account_id: '', template_id: '', subject: '', header_note: '', footer_note: '' });
  
  const [availableAccounts, setAvailableAccounts] = useState<EmailSendingAccount[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<EmailTemplate[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // --- Helper State ---
  const [estimating, setEstimating] = useState(false);

  // --- Refs ---
  const sectionRefs: {[key: string]: React.RefObject<HTMLDivElement>} = { basic: useRef(null), audience: useRef(null), content: useRef(null), schedule: useRef(null), runs: useRef(null) };
  const [activeSection, setActiveSection] = useState('basic');

  useEffect(() => {
    loadOptions();
  }, []);

  // FIX: Use ReturnType<typeof setTimeout> for environment-agnostic timer ID typing, resolving the 'NodeJS' namespace error in browser contexts.
  const debouncedEstimate = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debouncedEstimate.current) clearTimeout(debouncedEstimate.current);
    debouncedEstimate.current = setTimeout(() => { handleAudienceEstimate(); }, 800);
    return () => { if (debouncedEstimate.current) clearTimeout(debouncedEstimate.current) };
  }, [audience]);

  const loadOptions = async () => {
    const [accs, tmps] = await Promise.all([ getEmailAccounts(), getEmailTemplates() ]);
    setAvailableAccounts(accs.filter(a => a.is_active));
    setAvailableTemplates(tmps.filter(t => t.is_active));
  };

  const scrollToSection = (id: string) => {
      sectionRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAudienceEstimate = async () => {
    setEstimating(true);
    const res = await estimateAudienceCount(audience);
    if (res.success) {
        setAudience(prev => ({ ...prev, estimated_count: res.count }));
    }
    setEstimating(false);
  };
  
  const handleSave = (isDraft: boolean) => {
    setPreflightError(null);
    const taskData: Partial<DeliveryTask> = {
        id: initialData?.id, ...basic, audience_rule: audience, content_mode: contentMode,
        content_rule: contentMode === 'rule' ? contentRule : null,
        content_ids: contentMode === 'manual' ? selectedContentIds : null,
        schedule_rule: schedule,
        channel_config: basic.channel === 'email' ? { email: emailConfig } : null
    };

    if (isDraft) {
        taskData.status = 'draft';
        startTransition(async () => {
            const res = await upsertDeliveryTask(taskData);
            if (res.success) {
                alert('草稿已保存');
                router.push('/admin/delivery');
                router.refresh();
            } else {
                alert(`保存失败: ${res.error}`);
            }
        });
    } else {
        // --- Preflight Check Logic ---
        setIsChecking(true);
        startTransition(async () => {
            const check = await preflightCheckDeliveryTask(taskData);
            if (!check.success) {
                setPreflightError(check.error || '未知校验错误');
                setIsChecking(false);
                return;
            }

            taskData.status = 'active';
            const res = await upsertDeliveryTask(taskData, check.data);
            setIsChecking(false);
            if (res.success) {
                alert(`任务已启用! 预计命中 ${check.data?.estimated_recipients} 人。`);
                router.push('/admin/delivery');
                router.refresh();
            } else {
                setPreflightError(`启用失败: ${res.error}`);
            }
        });
    }
  };

  const handleRunNow = async () => {
    if (!initialData?.id) return;
    if (!confirm(`确定要立即执行任务 "${initialData.name}" 吗？\n这将向预计 ${audience.estimated_count || 'N/A'} 位用户真实发送内容。`)) return;

    setIsManualRunning(true);
    const result = await runDeliveryTaskNow(initialData.id);
    setIsManualRunning(false);
    
    if (result.success) {
        alert(`执行成功: ${result.message}`);
    } else {
        alert(`执行失败: ${result.error}`);
    }
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
        <div className="hidden lg:block space-y-2 sticky top-6 h-fit">
            {[
                { id: 'basic', label: '基础信息', icon: Settings },
                { id: 'audience', label: '目标受众', icon: Users },
                { id: 'content', label: '内容配置', icon: FileText },
                { id: 'schedule', label: '执行计划', icon: CalendarClock },
                ...(initialData ? [{ id: 'runs', label: '执行记录', icon: History }] : [])
            ].map((step) => (
                <button key={step.id} onClick={() => scrollToSection(step.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === step.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <step.icon size={18} /> {step.label}
                </button>
            ))}
            
            <div className="pt-6 border-t border-gray-100 mt-6 space-y-3">
                 <button onClick={() => handleSave(true)} disabled={isPending || isChecking || isManualRunning} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    <Save size={16} /> 保存草稿
                 </button>
                 <button onClick={() => handleSave(false)} disabled={isPending || isChecking || isManualRunning} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm">
                    {isChecking ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                    {isChecking ? '校验中...' : '启用任务'}
                 </button>
                 {initialData && (
                     <button onClick={handleRunNow} disabled={isManualRunning || isPending || isChecking} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm">
                        {isManualRunning ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        {isManualRunning ? '执行中...' : '立即执行'}
                     </button>
                 )}
                 {preflightError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>{preflightError}</span>
                    </div>
                 )}
            </div>
        </div>

        <div className="lg:col-span-3 space-y-8 pb-20">
            {/* --- FORM SECTIONS (BASIC, AUDIENCE, CONTENT, SCHEDULE) --- */}
            {/* Key changes are in AUDIENCE section and the addition of RUNS section */}
            <div ref={sectionRefs.basic} className="scroll-mt-6">... Basic Info Section ...</div>
            
            <div ref={sectionRefs.audience} className="scroll-mt-6">
                 <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                     <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                        <Users className="text-gray-400" size={20} />
                        <h2 className="text-lg font-semibold text-gray-900">目标受众 (Audience)</h2>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">用户类型</label>
                            <CustomSelect value={audience.user_type} onChange={(v) => setAudience(p => ({...p, user_type: v as any}))} options={[{label:'全部',value:'all'},{label:'个人',value:'personal'},{label:'企业',value:'company'}]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">是否接受推荐</label>
                            <CustomSelect value={audience.marketing_opt_in} onChange={(v) => setAudience(p => ({...p, marketing_opt_in: v as any}))} options={[{label:'不限',value:'all'},{label:'已接受',value:'yes'},{label:'未接受',value:'no'}]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">是否发生过演示申请</label>
                            <CustomSelect value={audience.has_communicated} onChange={(v) => setAudience(p => ({...p, has_communicated: v as any}))} options={[{label:'不限',value:'all'},{label:'是',value:'yes'},{label:'否',value:'no'}]} />
                        </div>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-100 sticky bottom-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-indigo-800">当前条件下预计触达:</span>
                            <span className={`text-xl font-bold ${audience.estimated_count === 0 ? 'text-yellow-600' : 'text-indigo-900'}`}>
                                {estimating ? <Loader2 className="animate-spin inline" size={16}/> : (audience.estimated_count ?? '-')}
                            </span>
                            <span className="text-xs text-indigo-600">位用户</span>
                            {audience.estimated_count === 0 && !estimating && <AlertTriangle size={16} className="text-yellow-600" title="命中0人，任务无法启用" />}
                        </div>
                        <button type="button" onClick={handleAudienceEstimate} disabled={estimating} className="flex items-center gap-2 text-xs text-indigo-700 font-medium hover:underline disabled:opacity-50"><Calculator size={12} /> 手动刷新</button>
                    </div>
                 </section>
            </div>
            
            <div ref={sectionRefs.content} className="scroll-mt-6">... Content Section ...</div>
            <div ref={sectionRefs.schedule} className="scroll-mt-6">... Schedule Section ...</div>

            {/* Section 5: Execution Runs */}
            {initialData && (
                <div ref={sectionRefs.runs} className="scroll-mt-6">
                    <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                            <History className="text-gray-400" size={20} />
                            <h2 className="text-lg font-semibold text-gray-900">执行记录 (Execution History)</h2>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {initialRuns.length > 0 ? initialRuns.map(run => (
                                <div key={run.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className={`font-bold uppercase px-2 py-0.5 rounded ${run.status === 'success' ? 'bg-green-100 text-green-800' : run.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{run.status}</span>
                                        <span className="text-gray-500 font-mono">{format(new Date(run.started_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2">{run.message}</p>
                                    <div className="text-xs text-gray-400 mt-2 border-t border-gray-200 pt-2 flex gap-4">
                                        <span>目标: {run.recipient_count}</span>
                                        <span>成功: {run.success_count}</span>
                                        <span>失败: {run.failure_count}</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-sm text-gray-400 py-8">暂无执行记录</p>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
        <EmailConfigModal isOpen={isConfigModalOpen} onClose={() => { setIsConfigModalOpen(false); loadOptions(); }} accounts={availableAccounts} templates={availableTemplates} />
    </div>
  );
}
