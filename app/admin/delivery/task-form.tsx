
'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upsertDeliveryTask, estimateAudienceCount, previewAudience, searchResources, getResourcesByIds, getEmailAccounts, getEmailTemplates, getUniqueInterestTags, preflightCheckDeliveryTask, runDeliveryTaskNow, duplicateTask } from './actions';
import { DeliveryTask, DeliveryTaskType, DeliveryChannel, DeliveryTaskStatus, DeliveryContentMode, DeliveryAudienceRule, DeliveryContentRule, DeliveryScheduleRule, EmailSendingAccount, EmailTemplate, EmailChannelConfig, DeliveryRun, UserProfile } from '@/types';
import { Loader2, Save, Play, Search, X, Check, Calculator, CalendarClock, Users, FileText, Settings, AlertTriangle, Mail, Calendar, ArrowRight, ExternalLink, ChevronDown, Tag, Send, History, Eye, Info, PlusCircle, Lock, Unlock, Copy, RefreshCw, Sparkles } from 'lucide-react';
import EmailConfigModal from './EmailConfigModal';
import { format } from 'date-fns';
import { getTaskDerivedResult, DerivedResult } from './utils';

interface Props {
  initialData?: DeliveryTask;
  initialRuns?: DeliveryRun[];
  hasActiveRun?: boolean;
}

// --- Custom Select Component (Unchanged) ---
interface Option { label: string; value: string | number; disabled?: boolean; }
interface CustomSelectProps { value: string | number | undefined; onChange: (value: string) => void; options: Option[]; placeholder?: string; className?: string; disabled?: boolean; }
const CustomSelect = ({ value, onChange, options, placeholder, className, disabled }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false); const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);
  const selectedOption = options.find(o => String(o.value) === String(value));
  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-all duration-200 bg-white ${isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300 hover:border-gray-400'} ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-gray-900'}`}>{selectedOption ? selectedOption.label : (placeholder || '请选择...')} <ChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'text-gray-400'}`} /></button>
      {isOpen && !disabled && ( <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto"><div className="p-1">{options.map(opt => (<button key={opt.value} disabled={opt.disabled} type="button" onClick={() => { if(!opt.disabled) { onChange(String(opt.value)); setIsOpen(false); }}} className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${String(value) === String(opt.value) ? 'bg-gray-50 text-gray-900 font-medium' : opt.disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-50'}`}>{opt.label}{String(value) === String(opt.value) && <Check size={14} />}</button>))}</div></div>)}
    </div>
  );
};


export default function TaskForm({ initialData, initialRuns = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // --- Calculate Derived State ---
  const latestRun = initialRuns.length > 0 ? initialRuns[0] : null;
  const derivedResult: DerivedResult = getTaskDerivedResult(latestRun);
  const isOneTime = initialData?.schedule_rule?.mode === 'one_time';
  
  const isFormLocked = derivedResult === 'running' || (derivedResult === 'success' && isOneTime);

  // --- State ---
  const [basic, setBasic] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'automated' as DeliveryTaskType,
    channel: initialData?.channel || 'email' as DeliveryChannel,
    status: initialData?.status || 'draft' as DeliveryTaskStatus,
    locale: 'zh-CN',
  });

  const [audience, setAudience] = useState<DeliveryAudienceRule>(initialData?.audience_rule || {
    scope: 'all', user_type: 'all', marketing_opt_in: 'yes', has_communicated: 'all', has_demo_request: 'all', last_login_range: 'all', country: '', city: '', company: '', title: '', interest_tags: [], estimated_count: undefined
  });
  
  const [contentMode, setContentMode] = useState<DeliveryContentMode>(initialData?.content_mode || 'manual');
  
  const [contentSource, setContentSource] = useState<'resource' | 'custom'>(
      (initialData?.content_ids && initialData.content_ids.length > 0) ? 'resource' : 'custom'
  );

  const [contentRule, setContentRule] = useState<DeliveryContentRule>(initialData?.content_rule || { 
      category: [], time_range: '30d', limit: 3, featured_slot: 'none',
      match_mode: 'any', fallback: 'skip_user'
  });
  
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>(initialData?.content_ids || []);
  const [schedule, setSchedule] = useState<DeliveryScheduleRule>(initialData?.schedule_rule || { mode: 'one_time', one_time_type: 'immediate', timezone: 'Asia/Shanghai' });
  
  const [emailConfig, setEmailConfig] = useState<EmailChannelConfig>(initialData?.channel_config?.email || { account_id: '', template_id: '', subject: '', header_note: '', footer_note: '' });
  const [overrideTemplate, setOverrideTemplate] = useState(false);
  
  const [availableAccounts, setAvailableAccounts] = useState<EmailSendingAccount[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<EmailTemplate[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [availableInterestTags, setAvailableInterestTags] = useState<string[]>([]);

  // --- Helper State ---
  const [estimating, setEstimating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUsers, setPreviewUsers] = useState<UserProfile[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<{id: string, title: string}[]>([]);
  const [selectedResources, setSelectedResources] = useState<{id: string, title: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);


  // --- Refs ---
  const sectionRefs: {[key: string]: React.RefObject<HTMLDivElement>} = { basic: useRef(null), audience: useRef(null), content: useRef(null), schedule: useRef(null), runs: useRef(null) };
  const [activeSection, setActiveSection] = useState('basic');

  useEffect(() => { loadOptions(); }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      setAudience(prev => ({ ...prev, estimated_count: undefined }));
  }, [
      audience.user_type, audience.marketing_opt_in, audience.has_communicated, 
      audience.country, audience.city, audience.registered_from, audience.registered_to,
      audience.last_login_start, audience.last_login_end, audience.interest_tags
  ]);

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
    if (contentSource === 'custom') {
        setSelectedContentIds([]);
    } else {
        setSelectedContentIds(selectedResources.map(r => r.id));
    }
  }, [selectedResources, contentSource]);

  useEffect(() => {
      if (basic.channel === 'email' && emailConfig.template_id && !overrideTemplate) {
          const tmpl = availableTemplates.find(t => t.id === emailConfig.template_id);
          if (tmpl) {
              setEmailConfig(prev => ({ ...prev, subject: tmpl.subject }));
          }
      }
  }, [emailConfig.template_id, basic.channel, overrideTemplate, availableTemplates]);

  useEffect(() => {
    let error = null;
    if (schedule.mode === 'one_time' && schedule.one_time_type === 'scheduled') {
        const { one_time_date, one_time_time } = schedule;
        if (!one_time_date || !one_time_time) {
             // Basic validation
        }
    } else if (schedule.mode === 'recurring') {
        if (schedule.start_date && schedule.end_date) {
            if (new Date(schedule.end_date) < new Date(schedule.start_date)) {
                error = '结束日期不能早于开始日期。';
            }
        }
    }
    setScheduleError(error);
  }, [schedule]);


  const loadOptions = async () => {
    const [accs, tmps, tags] = await Promise.all([ getEmailAccounts(), getEmailTemplates(), getUniqueInterestTags() ]);
    setAvailableAccounts(accs.filter(a => a.is_active));
    setAvailableTemplates(tmps.filter(t => t.is_active));
    setAvailableInterestTags(tags);
  };

  const scrollToSection = (id: string) => {
      sectionRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
  };

  const handleAudienceEstimate = async () => {
    setEstimating(true);
    const res = await estimateAudienceCount(audience);
    if (res.success === false) {
        alert(res.error);
    } else {
        setAudience(prev => ({ ...prev, estimated_count: res.count }));
    }
    setEstimating(false);
  };

  const handleAudiencePreview = async () => {
      setLoadingPreview(true);
      setIsPreviewOpen(true);
      const res = await previewAudience(audience);
      if (res.success === false) {
          alert(res.error);
          setIsPreviewOpen(false);
      } else {
          setPreviewUsers(res.users);
      }
      setLoadingPreview(false);
  };
  
  const handleSave = (isDraft: boolean) => {
    setPreflightError(null);

    // Front-end Validation
    if (!isDraft) {
        if (basic.channel === 'email') {
            if (!emailConfig.account_id) { alert('请选择发送账户'); scrollToSection('basic'); return; }
            if (!emailConfig.template_id) { alert('请选择邮件模板'); scrollToSection('basic'); return; }
        }
    }

    // Determine content mode: if recurring and resource selected, use 'rule'
    const isRuleMode = schedule.mode === 'recurring' && contentSource === 'resource';
    const finalContentMode = isRuleMode ? 'rule' : contentMode;

    const taskData: Partial<DeliveryTask> = {
        id: initialData?.id, ...basic, audience_rule: audience, 
        content_mode: finalContentMode,
        content_rule: finalContentMode === 'rule' ? contentRule : null,
        content_ids: contentSource === 'resource' && !isRuleMode ? selectedContentIds : [],
        schedule_rule: schedule,
        channel_config: basic.channel === 'email' 
            ? { email: emailConfig } 
            : { in_app: { subject: emailConfig.subject, message: emailConfig.header_note } } as any
    };

    if (isDraft) {
        taskData.status = 'draft';
        startTransition(async () => {
            const res = await upsertDeliveryTask(taskData);
            if (res.success) { alert('草稿已保存'); router.push('/admin/delivery'); router.refresh(); }
            else { alert(`保存失败: ${res.error}`); }
        });
    } else {
        if (scheduleError) return;
        setIsChecking(true);
        startTransition(async () => {
            const check = await preflightCheckDeliveryTask(taskData);
            if (!check.success) { setPreflightError(check.error || '未知错误'); setIsChecking(false); return; }
            taskData.status = 'active';
            const res = await upsertDeliveryTask(taskData, check.data);
            setIsChecking(false);
            if (res.success) { alert(`任务已启用!`); router.push('/admin/delivery'); router.refresh(); }
            else { setPreflightError(`启用失败: ${res.error}`); }
        });
    }
  };

  const handleRunNow = async () => {
    if (!initialData?.id) return;
    if (!confirm(`确定要执行任务 "${initialData.name}" 吗？\n这将向预计 ${audience.estimated_count || 'N/A'} 位用户真实发送内容。`)) return;

    setIsManualRunning(true);
    const result = await runDeliveryTaskNow(initialData.id);
    setIsManualRunning(false);
    
    if (result.success) { alert(`执行成功: ${result.message}`); } 
    else { alert(`执行失败: ${result.error}`); }
    router.refresh();
  };

  const handleDuplicate = async () => {
    if (!initialData) return;
    if (!confirm('确定要复制此任务吗？')) return;
    startTransition(async () => {
        const res = await duplicateTask(initialData);
        if (res.success) { router.push('/admin/delivery'); router.refresh(); } 
        else { alert(`复制失败: ${res.error}`); }
    });
  };

  const handleResourceSearch = async (keyword: string) => {
    setSearchKeyword(keyword);
    if (keyword.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    const results = await searchResources(keyword);
    setSearchResults(results);
    setIsSearching(false);
  };

  const toggleResource = (resource: {id: string, title: string}) => {
    setSelectedResources(prev => {
        if (prev.some(r => r.id === resource.id)) return prev.filter(r => r.id !== resource.id);
        else return [...prev, resource];
    });
  };

  const toggleInterestTag = (tag: string) => {
    setAudience(prev => {
        const current = prev.interest_tags || [];
        if (current.includes(tag)) return { ...prev, interest_tags: current.filter(t => t !== tag) };
        else return { ...prev, interest_tags: [...current, tag] };
    });
  };

  const isEmail = basic.channel === 'email';
  const labelSubject = isEmail ? '邮件主题' : '标题';
  const labelBody = isEmail ? '邮件正文' : '消息内容';
  const isContentDisabled = isEmail && !!emailConfig.template_id && !overrideTemplate;
  const placeholderSubject = isEmail ? 'e.g., [重要] 您的月度账单' : 'e.g., 系统通知';
  const placeholderBody = isEmail ? '在此输入邮件内容...' : '在此输入消息内容...';

  // Rule config visibility
  const showRuleConfig = schedule.mode === 'recurring' && contentSource === 'resource';

  // --- BUTTON RENDERING LOGIC ---
  const renderActionButtons = () => {
      // 1. Running: Only show loading state
      if (derivedResult === 'running') {
          return (
              <div className="w-full flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed">
                  <Loader2 className="animate-spin" size={16} /> 任务执行中...
              </div>
          );
      }

      // 2. Failed: Allow Retry, Save Draft. No Duplicate here.
      if (derivedResult === 'failed') {
          return (
              <>
                  <button onClick={() => handleSave(true)} disabled={isPending} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                      <Save size={16} /> 保存草稿
                  </button>
                  {initialData && (
                      <button onClick={handleRunNow} disabled={isManualRunning} className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                          {isManualRunning ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                          重新执行 (Retry)
                      </button>
                  )}
              </>
          );
      }

      // 3. Success (One-time): Only Duplicate
      if (derivedResult === 'success' && isOneTime) {
          return (
              <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1 text-xs text-green-600 font-medium bg-green-50 p-2 rounded">
                      <Check size={14} /> 任务已完成
                  </div>
                  <button onClick={handleDuplicate} disabled={isPending} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      <Copy size={16} /> 复制任务
                  </button>
                  <p className="text-[10px] text-gray-400 text-center">如需再次发送，请复制创建新任务</p>
              </div>
          );
      }

      // 4. Default / Not Started / Recurring: Standard Actions
      return (
          <>
              <button onClick={() => handleSave(true)} disabled={isPending} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  <Save size={16} /> 保存草稿
              </button>
              
              {/* Execute / Enable logic */}
              {schedule.mode === 'one_time' && schedule.one_time_type === 'immediate' && initialData ? (
                   <button onClick={handleRunNow} disabled={isManualRunning} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                      {isManualRunning ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                      执行一次 (Run Once)
                   </button>
              ) : (
                   <button onClick={() => handleSave(false)} disabled={isChecking} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                      {isChecking ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                      启用任务
                   </button>
              )}
          </>
      );
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
                {renderActionButtons()}
                 
                 {preflightError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs flex items-start gap-2">
                        <span title="Error"><AlertTriangle size={14} className="mt-0.5 shrink-0" /></span>
                        <span>{preflightError}</span>
                    </div>
                 )}
            </div>
        </div>

        <div className="lg:col-span-3 space-y-8 pb-20">
            {/* ... Form Content Sections ... */}
            <div ref={sectionRefs.basic} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <Settings className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">基础信息 (Basic Info)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">任务名称</label>
                            <input type="text" value={basic.name} onChange={(e) => setBasic(p => ({...p, name: e.target.value}))} required disabled={isFormLocked} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500" placeholder="e.g., 月度产品更新速递" />
                        </div>
                        {/* ... (Rest of Basic Info) ... */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">渠道</label>
                            <CustomSelect 
                                value={basic.channel} 
                                onChange={(v) => setBasic(p => ({...p, channel: v as any}))} 
                                disabled={isFormLocked}
                                options={[
                                    {label:'Email', value:'email'},
                                    {label:'站内信 (In-app)', value:'in_app'}
                                ]} 
                            />
                        </div>
                        {isEmail && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">发送账户 <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        {availableAccounts.length > 0 ? (
                                            <CustomSelect 
                                                value={emailConfig.account_id}
                                                onChange={(v) => setEmailConfig(p => ({...p, account_id: v}))}
                                                options={availableAccounts.map(a => ({ label: `${a.name} (${a.from_email})`, value: a.id }))}
                                                placeholder="选择发送账户"
                                                className="flex-1"
                                                disabled={isFormLocked}
                                            />
                                        ) : (
                                            <div className="flex-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                                                <AlertTriangle size={14}/> 未配置发送账户
                                            </div>
                                        )}
                                        <button onClick={() => setIsConfigModalOpen(true)} disabled={isFormLocked} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50" title="管理账户">
                                            <Settings size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">邮件模板 (Template) <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        {availableTemplates.length > 0 ? (
                                            <CustomSelect
                                                value={emailConfig.template_id}
                                                onChange={(v) => {
                                                    setEmailConfig(p => ({...p, template_id: v}));
                                                    setOverrideTemplate(false);
                                                }}
                                                options={availableTemplates.map(t => ({ label: t.name, value: t.id }))}
                                                placeholder="选择邮件模板"
                                                className="flex-1"
                                                disabled={isFormLocked}
                                            />
                                        ) : (
                                             <div className="flex-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                                                <AlertTriangle size={14}/> 未配置邮件模板
                                            </div>
                                        )}
                                        <button onClick={() => setIsConfigModalOpen(true)} disabled={isFormLocked} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50" title="管理模板">
                                            <Settings size={18} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">语言/地区</label>
                            <CustomSelect 
                                value={basic.locale} 
                                onChange={(v) => setBasic(p => ({...p, locale: v}))} 
                                disabled={isFormLocked}
                                options={[
                                    {label:'Auto (zh-CN)', value:'zh-CN'},
                                    {label:'English (en-US)', value:'en-US'}
                                ]} 
                            />
                            <p className="text-[10px] text-gray-400 mt-1">注：当前版本仅用于预览展示，保存时不写入数据库。</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">备注 (Optional)</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50" placeholder="内部备注..." disabled={isFormLocked} />
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
                     <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 ${isFormLocked ? 'opacity-70 pointer-events-none' : ''}`}>
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

                        <div className="md:col-span-2 lg:col-span-3">
                             <label className="block text-sm font-medium text-gray-700 mb-2">兴趣标签 (Tags)</label>
                             <div className="flex flex-wrap gap-2">
                                {availableInterestTags.length > 0 ? availableInterestTags.map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleInterestTag(tag)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${audience.interest_tags?.includes(tag) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {tag}
                                    </button>
                                )) : <span className="text-sm text-gray-400">暂无标签数据</span>}
                             </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">国家 (Country)</label>
                             <input type="text" value={audience.country || ''} onChange={(e) => setAudience(p => ({...p, country: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="包含..." />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">城市 (City)</label>
                             <input type="text" value={audience.city || ''} onChange={(e) => setAudience(p => ({...p, city: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="包含..." />
                        </div>
                        <div className="hidden lg:block"></div>

                        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">注册时间 (From - To)</label>
                                <div className="flex items-center gap-2">
                                    <input type="date" value={audience.registered_from || ''} onChange={(e) => setAudience(p => ({...p, registered_from: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                    <span className="text-gray-400">-</span>
                                    <input type="date" value={audience.registered_to || ''} onChange={(e) => setAudience(p => ({...p, registered_to: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">最近登录 (From - To)</label>
                                <div className="flex items-center gap-2">
                                    <input type="date" value={audience.last_login_start || ''} onChange={(e) => setAudience(p => ({...p, last_login_start: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                    <span className="text-gray-400">-</span>
                                    <input type="date" value={audience.last_login_end || ''} onChange={(e) => setAudience(p => ({...p, last_login_end: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                </div>
                            </div>
                        </div>

                     </div>
                     <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-100 sticky bottom-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-indigo-800">当前条件下预计触达:</span>
                            {estimating ? (
                                <Loader2 className="animate-spin text-indigo-900" size={20}/>
                            ) : (
                                audience.estimated_count !== undefined ? (
                                    <>
                                        <span className={`text-xl font-bold ${audience.estimated_count === 0 ? 'text-yellow-600' : 'text-indigo-900'}`}>
                                            {audience.estimated_count}
                                        </span>
                                        <span className="text-xs text-indigo-600">位用户</span>
                                        {audience.estimated_count === 0 && <span title="命中0人，任务无法启用"><AlertTriangle size={16} className="text-yellow-600" /></span>}
                                    </>
                                ) : (
                                    <span className="text-sm text-gray-400">点击刷新获取 &rarr;</span>
                                )
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={handleAudiencePreview} className="flex items-center gap-2 text-xs text-indigo-700 font-medium hover:underline bg-white px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-50 transition-colors"><Eye size={12} /> 预览用户</button>
                            <button type="button" onClick={handleAudienceEstimate} disabled={estimating} className="flex items-center gap-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50"><Calculator size={12} /> 手动刷新</button>
                        </div>
                    </div>
                 </section>
            </div>
            
            <div ref={sectionRefs.content} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <FileText className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">内容配置 (Content)</h2>
                    </div>
                    
                    <div className={`space-y-6 ${isFormLocked ? 'opacity-70 pointer-events-none' : ''}`}>
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">是否引用站内内容？</label>
                            <div className="flex gap-4">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="content_source" 
                                        className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                                        checked={contentSource === 'resource'}
                                        onChange={() => setContentSource('resource')}
                                    />
                                    <span className="ml-2 text-sm text-gray-900">引用站内内容</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="content_source" 
                                        className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                                        checked={contentSource === 'custom'}
                                        onChange={() => setContentSource('custom')}
                                    />
                                    <span className="ml-2 text-sm text-gray-900">不引用（纯文本/自定义）</span>
                                </label>
                            </div>
                        </div>

                        {showRuleConfig ? (
                            // --- AUTOMATED RULE UI ---
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-4">
                                    <div className="flex items-center gap-2 text-purple-800 font-semibold text-sm">
                                        <Sparkles size={16} />
                                        自动引用规则 (Automated Content Rule)
                                    </div>
                                    <p className="text-xs text-purple-600">
                                        系统将在每次执行时，基于用户的兴趣标签自动检索最新的匹配资源。
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-purple-700 mb-1">匹配模式 (Match Mode)</label>
                                            <CustomSelect 
                                                value={contentRule.match_mode} 
                                                onChange={(v) => setContentRule(p => ({...p, match_mode: v as any}))} 
                                                options={[
                                                    {label:'任意匹配 (Any Tag)', value:'any'},
                                                    {label:'完全匹配 (All Tags)', value:'all', disabled: true}
                                                ]} 
                                                className="border-purple-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-purple-700 mb-1">检索范围 (Time Range)</label>
                                            <CustomSelect 
                                                value={contentRule.time_range || '30d'} 
                                                onChange={(v) => setContentRule(p => ({...p, time_range: v as any}))} 
                                                options={[
                                                    {label:'最近 7 天', value:'7d'},
                                                    {label:'最近 30 天', value:'30d'},
                                                    {label:'最近 90 天', value:'90d'},
                                                    {label:'全部时间', value:'all'}
                                                ]} 
                                                className="border-purple-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-purple-700 mb-1">数量限制 (Limit)</label>
                                            <CustomSelect 
                                                value={contentRule.limit || 3} 
                                                onChange={(v) => setContentRule(p => ({...p, limit: Number(v)}))} 
                                                options={[1,2,3,4,5].map(n => ({label:`${n} 条`, value: n}))} 
                                                className="border-purple-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-purple-700 mb-1">兜底策略 (Fallback)</label>
                                            <CustomSelect 
                                                value={contentRule.fallback || 'skip_user'} 
                                                onChange={(v) => setContentRule(p => ({...p, fallback: v as any}))} 
                                                options={[
                                                    {label:'跳过该用户 (Skip)', value:'skip_user'},
                                                    {label:'全站最新 (Latest Global)', value:'latest_global'}
                                                ]} 
                                                className="border-purple-200"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : contentSource === 'resource' && (
                            // --- MANUAL SELECTION UI ---
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-medium text-gray-700 mb-1">选择内容资源 (Resources)</label>
                                <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                        <input type="text" placeholder="搜索站内资源标题..." value={searchKeyword} onChange={(e) => handleResourceSearch(e.target.value)} className="w-full border rounded-md px-3 py-1.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
                                    </div>
                                    
                                    { isSearching && <div className="p-2 text-sm text-gray-500">搜索中...</div> }
                                    { !isSearching && searchKeyword.length >= 2 && searchResults.length === 0 && (
                                        <div className="p-4 text-center text-sm text-gray-500 bg-white border border-gray-100 rounded-lg">
                                            暂无可引用的站内内容
                                        </div>
                                    )}

                                    { searchResults.length > 0 && (
                                        <div className="max-h-40 overflow-y-auto border rounded-md bg-white">
                                            {searchResults.map(res => (
                                                <button type="button" key={res.id} onClick={() => toggleResource(res)} className="w-full text-left p-2 text-sm hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 last:border-0">
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedResources.some(r => r.id === res.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                                                        {selectedResources.some(r => r.id === res.id) && <Check size={12} className="text-white" />}
                                                    </div>
                                                    {res.title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {selectedResources.length > 0 ? selectedResources.map(res => (
                                            <div key={res.id} className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs flex items-center gap-1 shadow-sm">
                                                <span className="max-w-[200px] truncate">{res.title}</span>
                                                <button type="button" onClick={() => toggleResource(res)} className="hover:text-red-500"><X size={12} /></button>
                                            </div>
                                        )) : <p className="text-xs text-gray-400 px-1">请搜索并添加资源</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isEmail && emailConfig.template_id ? (
                            <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-blue-600"/>
                                    <span className="text-sm text-blue-900">
                                        已选模板: <strong>{availableTemplates.find(t => t.id === emailConfig.template_id)?.name}</strong>
                                    </span>
                                </div>
                                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-blue-800 hover:text-blue-900">
                                    <input type="checkbox" checked={overrideTemplate} onChange={e => setOverrideTemplate(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                    {overrideTemplate ? <Unlock size={14} /> : <Lock size={14} />}
                                    允许覆盖内容
                                </label>
                            </div>
                        ) : isEmail && (
                            <div className="mb-2 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-center gap-2 text-sm text-yellow-700">
                                <AlertTriangle size={16} />
                                请先在“基础信息”区块中选择邮件模板。
                            </div>
                        )}

                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{labelSubject}</label>
                            <input 
                                type="text" 
                                value={emailConfig.subject} 
                                onChange={(e) => setEmailConfig(p => ({...p, subject: e.target.value}))} 
                                disabled={isContentDisabled}
                                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${isContentDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white'}`}
                                placeholder={isContentDisabled ? '主题由模板提供 (勾选上方允许覆盖以编辑)' : placeholderSubject} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{labelBody}</label>
                            <textarea 
                                value={emailConfig.header_note || ''} 
                                onChange={(e) => setEmailConfig(p => ({...p, header_note: e.target.value}))} 
                                rows={5} 
                                disabled={isContentDisabled}
                                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono ${isContentDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white'}`}
                                placeholder={isContentDisabled ? '正文由模板提供 (勾选上方允许覆盖以编辑)' : placeholderBody} 
                            />
                        </div>
                    </div>
                </section>
            </div>
            
            <div ref={sectionRefs.schedule} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                    <CalendarClock className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">执行计划 (Schedule)</h2>
                    </div>
                    
                    <div className={`space-y-2 ${isFormLocked ? 'opacity-70 pointer-events-none' : ''}`}>
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
                    
                    <div className={isFormLocked ? 'opacity-70 pointer-events-none' : ''}>
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
                            <div className="col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">频率</label>
                                    <CustomSelect value={schedule.frequency || 'daily'} onChange={(v) => setSchedule(p => ({...p, frequency: v as any}))} options={[{label:'每天', value:'daily'}, {label:'每周', value:'weekly'}, {label:'每月', value:'monthly'}]} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">执行时间</label>
                                    <input type="time" value={schedule.time || ''} onChange={(e) => setSchedule(p => ({...p, time: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                </div>
                            </div>
                            <div className="col-span-2 grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">开始日期 (From)</label>
                                    <input type="date" value={schedule.start_date || ''} onChange={(e) => setSchedule(p => ({...p, start_date: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">结束日期 (To) - 可选</label>
                                    <input type="date" value={schedule.end_date || ''} onChange={(e) => setSchedule(p => ({...p, end_date: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="长期有效" />
                                </div>
                            </div>
                            {scheduleError && <div className="col-span-2 text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {scheduleError}</div>}
                        </div>
                        )}
                    </div>
                </section>
            </div>

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
                                        <span className={`font-bold uppercase px-2 py-0.5 rounded ${run.status === 'success' ? 'bg-green-100 text-green-800' : run.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' : run.status === 'running' ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'}`}>{run.status}</span>
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
        
        {isPreviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-indigo-600" />
                            <h3 className="font-semibold text-gray-900">受众预览</h3>
                        </div>
                        <button onClick={() => setIsPreviewOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
                    </div>
                    
                    <div className="p-0 overflow-y-auto bg-white flex-1">
                        {loadingPreview ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-500">
                                <Loader2 className="animate-spin" size={24} />
                                <span className="text-sm">正在加载用户列表...</span>
                            </div>
                        ) : previewUsers.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Info className="mx-auto mb-2 text-gray-300" size={32} />
                                <p>当前筛选条件未命中任何用户</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 flex justify-between border-b border-gray-100 sticky top-0">
                                    <span>用户 (前 {previewUsers.length} 位)</span>
                                    <span>注册时间</span>
                                </div>
                                {previewUsers.map(user => (
                                    <div key={user.id} className="px-4 py-3 hover:bg-gray-50 flex justify-between items-center gap-4">
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-gray-900 truncate">{user.name || '未命名'}</p>
                                            <p className="text-xs text-gray-500 truncate font-mono">{user.email}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 capitalize">{user.user_type}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                            {format(new Date(user.created_at), 'yyyy-MM-dd')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-2">
                        <Info size={14} className="text-gray-400 shrink-0" />
                        仅预览部分用户，用于确认筛选条件是否正确。实际发送时将包含所有命中用户。
                    </div>
                </div>
            </div>
        )}

        <EmailConfigModal isOpen={isConfigModalOpen} onClose={() => { setIsConfigModalOpen(false); loadOptions(); }} accounts={availableAccounts} templates={availableTemplates} />
    </div>
  );
}
