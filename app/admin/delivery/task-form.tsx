
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
  
  const [contentMode, setContentMode] = useState<DeliveryContentMode>(initialData?.content_mode || 'manual');
  const [contentRule, setContentRule] = useState<DeliveryContentRule>(initialData?.content_rule || { category: [], time_range: '30d', limit: 3, featured_slot: 'none' });
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>(initialData?.content_ids || []);
  const [schedule, setSchedule] = useState<DeliveryScheduleRule>(initialData?.schedule_rule || { mode: 'one_time', one_time_type: 'immediate', timezone: 'Asia/Shanghai' });
  const [emailConfig, setEmailConfig] = useState<EmailChannelConfig>(initialData?.channel_config?.email || { account_id: '', template_id: '', subject: '', header_note: '', footer_note: '' });
  
  const [availableAccounts, setAvailableAccounts] = useState<EmailSendingAccount[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<EmailTemplate[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // --- Helper State ---
  const [estimating, setEstimating] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<{id: string, title: string}[]>([]);
  const [selectedResources, setSelectedResources] = useState<{id: string, title: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);


  // --- Refs ---
  const sectionRefs: {[key: string]: React.RefObject<HTMLDivElement>} = { basic: useRef(null), audience: useRef(null), content: useRef(null), schedule: useRef(null), runs: useRef(null) };
  const [activeSection, setActiveSection] = useState('basic');

  useEffect(() => { loadOptions(); }, []);

  // FIX: Use ReturnType<typeof setTimeout> for environment-agnostic timer ID typing
  const debouncedEstimate = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (debouncedEstimate.current) clearTimeout(debouncedEstimate.current);
    debouncedEstimate.current = setTimeout(() => { handleAudienceEstimate(); }, 800);
    return () => { if (debouncedEstimate.current) clearTimeout(debouncedEstimate.current) };
  }, [audience]);

  useEffect(() => {
    if (initialData?.content_ids && initialData.content_ids.length > 0) {
        const loadInitialResources = async () => {
            const res = await getResourcesByIds(initialData.content_ids!);
            setSelectedResources(res);
        };
        loadInitialResources();
    }
  }, [initialData?.content_ids]);

  useEffect(() => {
    setSelectedContentIds(selectedResources.map(r => r.id));
  }, [selectedResources]);

  useEffect(() => {
    if (schedule.mode === 'one_time' && schedule.one_time_type === 'scheduled') {
        const { one_time_date, one_time_time } = schedule;
        if (one_time_date && one_time_time) {
            const targetTime = new Date(`${one_time_date} ${one_time_time}`);
            if (targetTime < new Date()) {
                setScheduleError('定时执行时间不能早于当前时间。');
            } else {
                setScheduleError(null);
            }
        } else {
            setScheduleError(null);
        }
    } else {
        setScheduleError(null);
    }
  }, [schedule]);


  const loadOptions = async () => {
    const [accs, tmps] = await Promise.all([ getEmailAccounts(), getEmailTemplates() ]);
    setAvailableAccounts(accs.filter(a => a.is_active));
    setAvailableTemplates(tmps.filter(t => t.is_active));
  };

  const scrollToSection = (id: string) => {
      sectionRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
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

  const handleResourceSearch = async (keyword: string) => {
    setSearchKeyword(keyword);
    if (keyword.length < 2) {
        setSearchResults([]);
        return;
    }
    setIsSearching(true);
    const results = await searchResources(keyword);
    setSearchResults(results);
    setIsSearching(false);
  };

  const toggleResource = (resource: {id: string, title: string}) => {
    setSelectedResources(prev => {
        if (prev.some(r => r.id === resource.id)) {
            return prev.filter(r => r.id !== resource.id);
        } else {
            return [...prev, resource];
        }
    });
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
                 <button onClick={() => handleSave(false)} disabled={isPending || isChecking || isManualRunning || !!scheduleError} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm">
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
                        <span title="Error"><AlertTriangle size={14} className="mt-0.5 shrink-0" /></span>
                        <span>{preflightError}</span>
                    </div>
                 )}
            </div>
        </div>

        <div className="lg:col-span-3 space-y-8 pb-20">
            <div ref={sectionRefs.basic} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <Settings className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">基础信息 (Basic Info)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">任务名称</label>
                            <input type="text" value={basic.name} onChange={(e) => setBasic(p => ({...p, name: e.target.value}))} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g., 月度产品更新速递" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">渠道</label>
                            <CustomSelect value={basic.channel} onChange={(v) => setBasic(p => ({...p, channel: v as any}))} options={[{label:'Email', value:'email'}]} disabled />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">语言/地区 (Optional)</label>
                            <CustomSelect value="zh-CN" onChange={() => {}} options={[{label:'Auto (zh-CN)', value:'zh-CN'}]} disabled />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">备注 (Optional)</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="内部备注..." />
                        </div>
                    </div>
                </section>
            </div>
            
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
                            {audience.estimated_count === 0 && !estimating && <span title="命中0人，任务无法启用"><AlertTriangle size={16} className="text-yellow-600" /></span>}
                        </div>
                        <button type="button" onClick={handleAudienceEstimate} disabled={estimating} className="flex items-center gap-2 text-xs text-indigo-700 font-medium hover:underline disabled:opacity-50"><Calculator size={12} /> 手动刷新</button>
                    </div>
                 </section>
            </div>
            
            <div ref={sectionRefs.content} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <FileText className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">内容配置 (Content)</h2>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">邮件主题 (Subject)</label>
                        <input type="text" value={emailConfig.subject} onChange={(e) => setEmailConfig(p => ({...p, subject: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="邮件标题" />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">选择内容资源 (Resources)</label>
                    <div className="border rounded-lg p-2 space-y-2">
                        <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input type="text" placeholder="搜索资源..." value={searchKeyword} onChange={(e) => handleResourceSearch(e.target.value)} className="w-full border rounded-md px-3 py-1.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                        </div>
                        { (isSearching || searchResults.length > 0) &&
                        <div className="max-h-40 overflow-y-auto border rounded-md">
                            {isSearching ? <div className="p-2 text-sm text-gray-500">搜索中...</div> : 
                            searchResults.map(res => (
                                <button type="button" key={res.id} onClick={() => toggleResource(res)} className="w-full text-left p-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedResources.some(r => r.id === res.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                                    {selectedResources.some(r => r.id === res.id) && <Check size={12} className="text-white" />}
                                </div>
                                {res.title}
                                </button>
                            ))
                            }
                        </div>
                        }
                        <div className="flex flex-wrap gap-2 pt-2">
                        {selectedResources.length > 0 ? selectedResources.map(res => (
                            <div key={res.id} className="bg-gray-100 rounded-full px-2 py-1 text-xs flex items-center gap-1">
                            <span>{res.title}</span>
                            <button type="button" onClick={() => toggleResource(res)}><X size={12} /></button>
                            </div>
                        )) : <p className="text-xs text-gray-400 px-1">暂未选择资源</p>}
                        </div>
                    </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">邮件正文 (Body)</label>
                        <textarea value={emailConfig.header_note || ''} onChange={(e) => setEmailConfig(p => ({...p, header_note: e.target.value}))} rows={5} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="请输入邮件正文..." />
                    </div>
                </section>
            </div>
            
            <div ref={sectionRefs.schedule} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <CalendarClock className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">执行计划 (Schedule)</h2>
                    </div>
                    
                    <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">执行方式</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${schedule.mode === 'one_time' && schedule.one_time_type === 'immediate' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="schedule_mode" checked={schedule.mode === 'one_time' && schedule.one_time_type === 'immediate'} onChange={() => setSchedule(p => ({...p, mode: 'one_time', one_time_type: 'immediate'}))} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">立即执行</span>
                        </label>
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${schedule.mode === 'one_time' && schedule.one_time_type === 'scheduled' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="schedule_mode" checked={schedule.mode === 'one_time' && schedule.one_time_type === 'scheduled'} onChange={() => setSchedule(p => ({...p, mode: 'one_time', one_time_type: 'scheduled'}))} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">定时执行一次</span>
                        </label>
                        <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${schedule.mode === 'recurring' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="schedule_mode" checked={schedule.mode === 'recurring'} onChange={() => setSchedule(p => ({...p, mode: 'recurring'}))} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">周期执行</span>
                        </label>
                    </div>
                    </div>
                    
                    {schedule.mode === 'one_time' && schedule.one_time_type === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">执行日期</label>
                        <input type="date" value={schedule.one_time_date || ''} onChange={(e) => setSchedule(p => ({...p, one_time_date: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" min={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">执行时间</label>
                        <input type="time" value={schedule.one_time_time || ''} onChange={(e) => setSchedule(p => ({...p, one_time_time: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                        </div>
                        {scheduleError && <div className="col-span-2 text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {scheduleError}</div>}
                    </div>
                    )}

                    {schedule.mode === 'recurring' && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">频率</label>
                        <CustomSelect value={schedule.frequency || 'daily'} onChange={(v) => setSchedule(p => ({...p, frequency: v as any}))} options={[{label:'每天', value:'daily'}, {label:'每周', value:'weekly'}, {label:'每月', value:'monthly'}]} />
                        </div>
                        <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">执行时间</label>
                        <input type="time" value={schedule.time || ''} onChange={(e) => setSchedule(p => ({...p, time: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                        </div>
                    </div>
                    )}
                </section>
            </div>

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
