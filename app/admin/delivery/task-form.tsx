'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { upsertDeliveryTask, estimateAudienceCount, searchResources, getResourcesByIds, getEmailAccounts, getEmailTemplates, getUniqueInterestTags } from './actions';
import { DeliveryTask, DeliveryTaskType, DeliveryChannel, DeliveryTaskStatus, DeliveryContentMode, DeliveryAudienceRule, DeliveryContentRule, DeliveryScheduleRule, EmailSendingAccount, EmailTemplate, EmailChannelConfig } from '@/types';
import { Loader2, Save, Play, Search, X, Check, Calculator, CalendarClock, Users, FileText, Settings, AlertTriangle, Mail, Calendar, ArrowRight, ExternalLink, ChevronDown, Tag } from 'lucide-react';
import EmailConfigModal from './EmailConfigModal';

interface Props {
  initialData?: DeliveryTask;
}

// --- Custom Select Component ---
interface Option {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  value: string | number | undefined;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CustomSelect = ({ value, onChange, options, placeholder, className, disabled }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));

  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-all duration-200 bg-white
          ${isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-gray-900'}
        `}
      >
        <span className={`truncate ${!selectedOption && placeholder ? 'text-gray-400' : ''}`}>
          {selectedOption ? selectedOption.label : (placeholder || '请选择...')}
        </span>
        <ChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'text-gray-400'}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(String(opt.value));
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left
                  ${String(value) === String(opt.value) 
                    ? 'bg-gray-50 text-gray-900 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <span className="truncate">{opt.label}</span>
                {String(value) === String(opt.value) && <Check size={14} className="flex-shrink-0 ml-2" />}
              </button>
            ))}
            {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400 text-center">无选项</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function TaskForm({ initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- State ---
  const [basic, setBasic] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'automated' as DeliveryTaskType,
    channel: initialData?.channel || 'email' as DeliveryChannel,
    status: initialData?.status || 'draft' as DeliveryTaskStatus,
  });

  const [audience, setAudience] = useState<DeliveryAudienceRule>(initialData?.audience_rule || {
    scope: 'all',
    user_type: 'all',
    marketing_opt_in: 'yes', // Default to 'yes'
    has_communicated: 'all',
    has_demo_request: 'all',
    last_login_range: 'all',
    country: '',
    city: '',
    company: '',
    title: '',
    interest_tags: [],
    estimated_count: 0
  });
  
  const [contentMode, setContentMode] = useState<DeliveryContentMode>(initialData?.content_mode || 'rule');
  const [contentRule, setContentRule] = useState<DeliveryContentRule>(initialData?.content_rule || {
    category: [],
    time_range: '30d',
    limit: 3,
    featured_slot: 'none'
  });
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>(initialData?.content_ids || []);
  const [selectedResourcesPreview, setSelectedResourcesPreview] = useState<any[]>([]); 

  // Initialize schedule with new "mode" logic
  const [schedule, setSchedule] = useState<DeliveryScheduleRule>(initialData?.schedule_rule || {
    mode: 'one_time',
    one_time_type: 'immediate',
    timezone: 'Asia/Shanghai'
  });

  // Email Config State
  const [emailConfig, setEmailConfig] = useState<EmailChannelConfig>(initialData?.channel_config?.email || {
    account_id: '',
    template_id: '',
    subject: '',
    header_note: '',
    footer_note: ''
  });

  // Available Options
  const [availableAccounts, setAvailableAccounts] = useState<EmailSendingAccount[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<EmailTemplate[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // --- Helper State ---
  const [estimating, setEstimating] = useState(false);
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [resourceSearchResults, setResourceSearchResults] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState('basic');
  const [tagInput, setTagInput] = useState('');

  // Refs for scrolling
  const sectionRefs: {[key: string]: React.RefObject<HTMLDivElement>} = {
      basic: useRef(null),
      audience: useRef(null),
      content: useRef(null),
      schedule: useRef(null),
  };

  // Load initial resources if manual mode & Email Options
  useEffect(() => {
    if (initialData?.content_ids && initialData.content_ids.length > 0) {
        getResourcesByIds(initialData.content_ids).then(setSelectedResourcesPreview);
    }
    loadOptions();
  }, [initialData]);

  // Real-time Audience Estimation (Debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
        handleAudienceEstimate();
    }, 800); // 800ms debounce
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
      audience.scope, audience.user_type, audience.marketing_opt_in, 
      audience.has_communicated, audience.last_login_range, 
      audience.country, audience.city, audience.company, audience.title,
      audience.last_login_start, audience.last_login_end,
      audience.registered_from, audience.registered_to,
      audience.interest_tags
  ]);

  const loadOptions = async () => {
    const [accs, tmps, tags] = await Promise.all([
        getEmailAccounts(), 
        getEmailTemplates(),
        getUniqueInterestTags()
    ]);
    setAvailableAccounts(accs.filter(a => a.is_active));
    setAvailableTemplates(tmps.filter(t => t.is_active));
    setAvailableTags(tags);
  };

  // When template selected, auto-fill subject if empty
  useEffect(() => {
      if (emailConfig.template_id && !emailConfig.subject) {
          const tmpl = availableTemplates.find(t => t.id === emailConfig.template_id);
          if (tmpl) setEmailConfig(prev => ({ ...prev, subject: tmpl.subject }));
      }
  }, [emailConfig.template_id, availableTemplates, emailConfig.subject]);

  // Scroll Spy Logic
  useEffect(() => {
      const handleScroll = () => {
          const scrollPosition = window.scrollY + 150; // Offset
          for (const key in sectionRefs) {
              const ref = sectionRefs[key];
              if (ref.current && ref.current.offsetTop <= scrollPosition && (ref.current.offsetTop + ref.current.offsetHeight) > scrollPosition) {
                  setActiveSection(key);
              }
          }
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Handlers ---

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

  const handleResourceSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await searchResources(resourceSearchQuery);
    setResourceSearchResults(res);
  };

  const toggleResource = (r: any) => {
      if (selectedContentIds.includes(r.id)) {
          setSelectedContentIds(prev => prev.filter(id => id !== r.id));
          setSelectedResourcesPreview(prev => prev.filter(item => item.id !== r.id));
      } else {
          setSelectedContentIds(prev => [...prev, r.id]);
          setSelectedResourcesPreview(prev => [...prev, r]);
      }
  };

  const addTag = (tag: string) => {
      const cleaned = tag.trim();
      if (!cleaned) return;
      if (!audience.interest_tags?.includes(cleaned)) {
          setAudience(prev => ({ ...prev, interest_tags: [...(prev.interest_tags || []), cleaned] }));
      }
      setTagInput('');
  };

  const removeTag = (tag: string) => {
      setAudience(prev => ({ ...prev, interest_tags: (prev.interest_tags || []).filter(t => t !== tag) }));
  };

  const handleSave = (activate = false) => {
      if (!basic.name) return alert('请输入任务名称');
      
      // Validation for Active Email Tasks
      if ((activate || basic.status === 'active') && basic.channel === 'email') {
          if (!emailConfig.account_id) {
              alert('启用 Email 任务必须选择发送账户');
              scrollToSection('basic');
              return;
          }
          if (!emailConfig.template_id) {
              alert('启用 Email 任务必须选择邮件模板');
              scrollToSection('basic');
              return;
          }
          if (!emailConfig.subject) {
              alert('启用 Email 任务必须填写邮件主题');
              scrollToSection('basic');
              return;
          }
      }
      
      // Validation for Schedule
      if ((activate || basic.status === 'active')) {
          if (schedule.mode === 'one_time' && schedule.one_time_type === 'scheduled') {
              if (!schedule.one_time_date || !schedule.one_time_time) {
                  alert('请选择一次性执行的日期和时间');
                  scrollToSection('schedule');
                  return;
              }
          }
          if (schedule.mode === 'recurring') {
              if (!schedule.frequency || !schedule.time) {
                  alert('请完善循环执行的频率和时间');
                  scrollToSection('schedule');
                  return;
              }
          }
      }

      const payload: Partial<DeliveryTask> = {
          id: initialData?.id,
          ...basic,
          status: activate ? 'active' : basic.status, 
          audience_rule: audience,
          content_mode: contentMode,
          content_rule: contentMode === 'rule' ? contentRule : null,
          content_ids: contentMode === 'manual' ? selectedContentIds : null,
          schedule_rule: schedule,
          channel_config: basic.channel === 'email' ? { email: emailConfig } : null
      };

      startTransition(async () => {
          const res = await upsertDeliveryTask(payload);
          if (res.success) {
              alert(activate ? '任务已启用' : '草稿已保存');
              router.push('/admin/delivery');
              router.refresh();
          } else {
              alert(`保存失败: ${res.error}`);
          }
      });
  };

  // --- Render ---

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
        
        {/* Left: Sticky Navigation */}
        <div className="hidden lg:block space-y-2 sticky top-6 h-fit">
            {[
                { id: 'basic', label: '基础信息 (Basic)', icon: Settings },
                { id: 'audience', label: '目标受众 (Audience)', icon: Users },
                { id: 'content', label: '内容配置 (Content)', icon: FileText },
                { id: 'schedule', label: '执行计划 (Schedule)', icon: CalendarClock },
            ].map((step) => (
                <button
                    key={step.id}
                    onClick={() => scrollToSection(step.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        activeSection === step.id 
                        ? 'bg-gray-900 text-white shadow-md transform scale-105' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <step.icon size={18} />
                    {step.label}
                </button>
            ))}
            
            <div className="pt-6 border-t border-gray-100 mt-6 space-y-3">
                 <button 
                    onClick={() => handleSave(false)}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                 >
                    {isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    保存草稿
                 </button>
                 <button 
                    onClick={() => handleSave(true)}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                 >
                    <Play size={16} />
                    启用任务
                 </button>
            </div>
        </div>

        {/* Right: Form Sections */}
        <div className="lg:col-span-3 space-y-8 pb-20">
            
            {/* Section 1: Basic */}
            <div ref={sectionRefs.basic} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-4">
                        <Settings className="text-gray-400" size={20} />
                        <h2 className="text-lg font-semibold text-gray-900">基础信息 (Basic)</h2>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">任务名称 <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            value={basic.name}
                            onChange={(e) => setBasic(prev => ({...prev, name: e.target.value}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none"
                            placeholder="例如：2024 春季产品更新推送"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">任务类型</label>
                            <CustomSelect 
                                value={basic.type} 
                                onChange={(val) => setBasic(prev => ({...prev, type: val as DeliveryTaskType}))}
                                options={[
                                    { label: '自动化 (Automated)', value: 'automated' },
                                    { label: '临时任务 (Ad-hoc)', value: 'one_off' }
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">分发渠道</label>
                            <CustomSelect 
                                value={basic.channel} 
                                onChange={(val) => setBasic(prev => ({...prev, channel: val as DeliveryChannel}))}
                                options={[
                                    { label: '邮件 (Email)', value: 'email' },
                                    { label: '站内信 (In-App)', value: 'in_app' }
                                ]}
                            />
                        </div>
                    </div>

                    {/* Email Config Block */}
                    {basic.channel === 'email' && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
                            <div className="flex items-center justify-between border-b border-indigo-100 pb-2 mb-2">
                                <div className="flex items-center gap-2 text-indigo-800 font-semibold text-sm">
                                    <Mail size={16} /> Email 配置 (Email Config)
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setIsConfigModalOpen(true)}
                                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    去配置渠道 (Channels) <ExternalLink size={10} />
                                </button>
                            </div>

                            {/* Empty State Warning */}
                            {(availableAccounts.length === 0 || availableTemplates.length === 0) && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs flex items-start gap-2">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <span>
                                        检测到未配置发送账户或模板，无法启用任务。请先点击右上角“去配置渠道”完善信息。
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-indigo-900 mb-1">发送账户 <span className="text-red-500">*</span></label>
                                    <CustomSelect 
                                        value={emailConfig.account_id}
                                        onChange={(val) => setEmailConfig(prev => ({...prev, account_id: val}))}
                                        placeholder="-- 选择账户 --"
                                        options={availableAccounts.map(acc => ({
                                            label: `${acc.name} (${acc.from_email})`,
                                            value: acc.id
                                        }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-indigo-900 mb-1">邮件模板 <span className="text-red-500">*</span></label>
                                    <CustomSelect 
                                        value={emailConfig.template_id}
                                        onChange={(val) => setEmailConfig(prev => ({...prev, template_id: val}))}
                                        placeholder="-- 选择模板 --"
                                        options={availableTemplates.map(tmp => ({
                                            label: tmp.name,
                                            value: tmp.id
                                        }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-indigo-900 mb-1">邮件主题 <span className="text-red-500">*</span></label>
                                <input 
                                    type="text"
                                    value={emailConfig.subject}
                                    onChange={(e) => setEmailConfig(prev => ({...prev, subject: e.target.value}))}
                                    className="w-full text-sm border-indigo-200 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="输入邮件主题..."
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-indigo-900 mb-1">开头问候语 (Header Note)</label>
                                    <textarea 
                                        rows={2}
                                        value={emailConfig.header_note || ''}
                                        onChange={(e) => setEmailConfig(prev => ({...prev, header_note: e.target.value}))}
                                        className="w-full text-sm border-indigo-200 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        placeholder="Hi {{name}}, ..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-indigo-900 mb-1">结尾落款 (Footer Note)</label>
                                    <textarea 
                                        rows={2}
                                        value={emailConfig.footer_note || ''}
                                        onChange={(e) => setEmailConfig(prev => ({...prev, footer_note: e.target.value}))}
                                        className="w-full text-sm border-indigo-200 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        placeholder="Thanks, Team"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

             {/* Section 2: Audience */}
             <div ref={sectionRefs.audience} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                        <Users className="text-gray-400" size={20} />
                        <h2 className="text-lg font-semibold text-gray-900">目标受众 (Audience)</h2>
                    </div>
                    
                    <div className="space-y-6">
                        
                        {/* Group 1: Basic Scope */}
                        <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">1. 基础范围</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">受众范围 (Scope)</label>
                                    <CustomSelect 
                                        value={audience.scope} 
                                        onChange={(val) => setAudience(prev => ({...prev, scope: val as any}))}
                                        options={[
                                            { label: '全部注册用户 (All Registered)', value: 'all' },
                                            { label: '仅已登录过的用户 (Logged In)', value: 'logged_in' },
                                            { label: '仅从未登录的用户 (Never Logged In)', value: 'never_logged_in' }
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">用户类型 (User Type)</label>
                                    <CustomSelect 
                                        value={audience.user_type} 
                                        onChange={(val) => setAudience(prev => ({...prev, user_type: val as any}))}
                                        options={[
                                            { label: '不限 (All)', value: 'all' },
                                            { label: '企业用户 (Company)', value: 'company' },
                                            { label: '个人用户 (Personal)', value: 'personal' }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Group 2: Compliance & Tags */}
                        <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">2. 推荐与合规 (Compliance)</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">是否接受推荐 (Marketing Opt-in)</label>
                                    <div className="w-full md:w-1/2">
                                        <CustomSelect 
                                            value={audience.marketing_opt_in} 
                                            onChange={(val) => setAudience(prev => ({...prev, marketing_opt_in: val as any}))}
                                            options={[
                                                { label: '已接受推荐 (Opted-in) [默认]', value: 'yes' },
                                                { label: '未接受推荐 (Opted-out)', value: 'no' },
                                                { label: '不限 (All) [慎用]', value: 'all' }
                                            ]}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">仅用于系统通知时才可选择“不限”，营销内容必须选“已接受”。</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">兴趣标签 (Interest Tags)</label>
                                    <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                                            placeholder="输入标签并回车 (e.g. AI, Retail)"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => addTag(tagInput)}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                                        >
                                            添加
                                        </button>
                                    </div>
                                    {/* Selected Tags */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {audience.interest_tags?.map(tag => (
                                            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100">
                                                {tag}
                                                <button type="button" onClick={() => removeTag(tag)} className="hover:text-indigo-900"><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                    {/* Available Tags Hints */}
                                    {availableTags.length > 0 && (
                                        <div className="text-xs text-gray-500">
                                            <span className="mr-2">推荐标签:</span>
                                            {availableTags.slice(0, 10).map(tag => (
                                                <button 
                                                    key={tag} 
                                                    type="button" 
                                                    onClick={() => addTag(tag)}
                                                    className="inline-block mr-2 mb-1 hover:text-indigo-600 hover:underline cursor-pointer"
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Group 3: User Behavior */}
                        <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">3. 行为状态 (Behavior)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">是否发生过线上沟通</label>
                                    <CustomSelect 
                                        value={audience.has_communicated} 
                                        onChange={(val) => setAudience(prev => ({...prev, has_communicated: val as any}))}
                                        options={[
                                            { label: '不限 (All)', value: 'all' },
                                            { label: '已发生 (Yes)', value: 'yes' },
                                            { label: '未发生 (No)', value: 'no' }
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">是否提交过演示申请</label>
                                    <CustomSelect 
                                        value={audience.has_demo_request} 
                                        onChange={(val) => setAudience(prev => ({...prev, has_demo_request: val as any}))}
                                        options={[
                                            { label: '不限 (All)', value: 'all' },
                                            { label: '已提交 (Yes)', value: 'yes' },
                                            { label: '未提交 (No)', value: 'no' }
                                        ]}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">最近一次登录时间</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <CustomSelect 
                                            value={audience.last_login_range} 
                                            onChange={(val) => setAudience(prev => ({...prev, last_login_range: val as any}))}
                                            options={[
                                                { label: '不限 (All)', value: 'all' },
                                                { label: '近 7 天 (Last 7 days)', value: '7d' },
                                                { label: '近 30 天 (Last 30 days)', value: '30d' },
                                                { label: '自定义 (Custom)', value: 'custom' }
                                            ]}
                                        />
                                        
                                        {audience.last_login_range === 'custom' && (
                                            <>
                                                <input 
                                                    type="date" 
                                                    value={audience.last_login_start || ''}
                                                    onChange={(e) => setAudience(prev => ({...prev, last_login_start: e.target.value}))}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                />
                                                <input 
                                                    type="date" 
                                                    value={audience.last_login_end || ''}
                                                    onChange={(e) => setAudience(prev => ({...prev, last_login_end: e.target.value}))}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Group 4: Attributes & Geo */}
                        <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">4. 属性筛选 (Attributes)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">国家 (模糊匹配)</label>
                                    <input 
                                        type="text"
                                        value={audience.country || ''}
                                        onChange={(e) => setAudience(prev => ({...prev, country: e.target.value}))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                        placeholder="e.g. China" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">城市 (模糊匹配)</label>
                                    <input 
                                        type="text"
                                        value={audience.city || ''}
                                        onChange={(e) => setAudience(prev => ({...prev, city: e.target.value}))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                        placeholder="e.g. Shanghai" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">公司名称 (模糊匹配)</label>
                                    <input 
                                        type="text"
                                        value={audience.company || ''}
                                        onChange={(e) => setAudience(prev => ({...prev, company: e.target.value}))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                        placeholder="e.g. Acme Corp" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">职位 (模糊匹配)</label>
                                    <input 
                                        type="text"
                                        value={audience.title || ''}
                                        onChange={(e) => setAudience(prev => ({...prev, title: e.target.value}))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                        placeholder="e.g. Manager" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">注册时间范围</label>
                                <div className="flex gap-4">
                                    <input 
                                        type="date" 
                                        value={audience.registered_from || ''}
                                        onChange={(e) => setAudience(prev => ({...prev, registered_from: e.target.value}))}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Start Date"
                                    />
                                    <input 
                                        type="date" 
                                        value={audience.registered_to || ''}
                                        onChange={(e) => setAudience(prev => ({...prev, registered_to: e.target.value}))}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="End Date"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Estimate Result */}
                        <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-100 sticky bottom-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-indigo-800">当前条件下预计触达:</span>
                                <span className="text-xl font-bold text-indigo-900">
                                    {estimating ? <Loader2 className="animate-spin inline" size={16}/> : (audience.estimated_count ?? '-')}
                                </span>
                                <span className="text-xs text-indigo-600">位用户</span>
                            </div>
                            <button 
                                type="button"
                                onClick={handleAudienceEstimate}
                                disabled={estimating}
                                className="flex items-center gap-2 text-xs text-indigo-700 font-medium hover:underline disabled:opacity-50"
                            >
                                <Calculator size={12} />
                                手动刷新
                            </button>
                        </div>
                    </div>
                </section>
            </div>
            
            {/* Section 3: Content */}
            <div ref={sectionRefs.content} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                        <FileText className="text-gray-400" size={20} />
                        <h2 className="text-lg font-semibold text-gray-900">内容配置 (Content)</h2>
                    </div>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">内容选取模式</label>
                            <div className="flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setContentMode('rule')}
                                    className={`flex-1 p-4 rounded-xl border text-left transition-all ${contentMode === 'rule' ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="font-semibold text-gray-900 flex items-center justify-between">
                                        自动选取 (Rule-based)
                                        {contentMode === 'rule' && <Check size={16} />}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">根据分类和时间自动抓取最新内容</p>
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setContentMode('manual')}
                                    className={`flex-1 p-4 rounded-xl border text-left transition-all ${contentMode === 'manual' ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="font-semibold text-gray-900 flex items-center justify-between">
                                        手动选择 (Manual)
                                        {contentMode === 'manual' && <Check size={16} />}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">从资源库中手动指定具体内容</p>
                                </button>
                            </div>
                        </div>

                        {contentMode === 'rule' && (
                            <div className="p-4 border border-gray-200 rounded-lg space-y-4 bg-gray-50/50 animate-in fade-in zoom-in-95">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">时间范围</label>
                                        <CustomSelect 
                                            value={contentRule.time_range}
                                            onChange={(val) => setContentRule(prev => ({...prev, time_range: val as any}))}
                                            options={[
                                                { label: '最近 7 天', value: '7d' },
                                                { label: '最近 30 天', value: '30d' },
                                                { label: '最近 90 天', value: '90d' },
                                                { label: '不限时间', value: 'all' }
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">选取数量限制</label>
                                        <input 
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={contentRule.limit}
                                            onChange={(e) => setContentRule(prev => ({...prev, limit: parseInt(e.target.value)}))}
                                            className="w-full text-sm border-gray-300 rounded-lg px-3 py-2 border focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    <span>预览功能暂不可用，系统将在执行时动态计算。</span>
                                </div>
                            </div>
                        )}

                        {contentMode === 'manual' && (
                            <div className="p-4 border border-gray-200 rounded-lg space-y-4 bg-gray-50/50 animate-in fade-in zoom-in-95">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={resourceSearchQuery}
                                        onChange={(e) => setResourceSearchQuery(e.target.value)}
                                        placeholder="输入标题搜索资源..."
                                        className="flex-1 text-sm border-gray-300 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 focus:outline-none"
                                    />
                                    <button type="button" onClick={handleResourceSearch} className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium">
                                        <Search size={16} />
                                    </button>
                                </div>
                                
                                {/* Search Results */}
                                {resourceSearchResults.length > 0 && (
                                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                                        {resourceSearchResults.map(r => (
                                            <button 
                                                key={r.id}
                                                type="button"
                                                onClick={() => toggleResource(r)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between items-center border-b last:border-0"
                                            >
                                                <span className="truncate">{r.title}</span>
                                                {selectedContentIds.includes(r.id) && <Check size={14} className="text-green-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Selected Preview */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-500">已选内容 ({selectedContentIds.length})</label>
                                    <div className="space-y-2">
                                        {selectedResourcesPreview.map(r => (
                                            <div key={r.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-sm">
                                                <span className="truncate flex-1">{r.title}</span>
                                                <button type="button" onClick={() => toggleResource(r)} className="text-gray-400 hover:text-red-500 ml-2">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Homepage Promotion Slot */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">首页推广位 (可选)</label>
                            <CustomSelect 
                                value={contentRule.featured_slot || 'none'}
                                onChange={(val) => setContentRule(prev => ({...prev, featured_slot: val as any}))}
                                options={[
                                    { label: '不推广', value: 'none' },
                                    { label: 'Feature Carousel (轮播位)', value: 'carousel' },
                                    { label: 'Fixed List (固定列表)', value: 'fixed' }
                                ]}
                            />
                            <p className="text-xs text-gray-400 mt-1">若选择推广，任务执行时将自动把选中内容更新到首页对应模块。</p>
                        </div>

                    </div>
                </section>
            </div>
            
            {/* Section 4: Schedule */}
            <div ref={sectionRefs.schedule} className="scroll-mt-6">
                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                        <CalendarClock className="text-gray-400" size={20} />
                        <h2 className="text-lg font-semibold text-gray-900">执行计划 (Schedule)</h2>
                    </div>
                    <div className="space-y-6">
                        {/* Mode Selection */}
                        <div className="flex gap-4">
                            <button 
                                type="button"
                                onClick={() => setSchedule(prev => ({...prev, mode: 'one_time', one_time_type: 'immediate'}))}
                                className={`flex-1 p-4 rounded-xl border text-left transition-all ${schedule.mode === 'one_time' ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="font-semibold text-gray-900 flex items-center justify-between">
                                    一次性执行 (One-time)
                                    {schedule.mode === 'one_time' && <Check size={16} />}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">单次运行任务，适合临时推送</p>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setSchedule(prev => ({...prev, mode: 'recurring', frequency: 'daily'}))}
                                className={`flex-1 p-4 rounded-xl border text-left transition-all ${schedule.mode === 'recurring' ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="font-semibold text-gray-900 flex items-center justify-between">
                                    循环执行 (Recurring)
                                    {schedule.mode === 'recurring' && <Check size={16} />}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">按频率自动重复运行，适合定期报告</p>
                            </button>
                        </div>

                        {/* One-time Config */}
                        {schedule.mode === 'one_time' && (
                            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50/50 animate-in fade-in zoom-in-95">
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300">
                                        <input 
                                            type="radio" 
                                            name="one_time_type" 
                                            value="immediate"
                                            checked={schedule.one_time_type === 'immediate'}
                                            onChange={() => setSchedule(prev => ({...prev, one_time_type: 'immediate'}))}
                                            className="text-gray-900 focus:ring-gray-900" 
                                        />
                                        <div>
                                            <span className="block text-sm font-medium text-gray-900">立刻执行 (Run now)</span>
                                            <span className="block text-xs text-gray-500">保存并启用后，系统将尽快开始执行</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300">
                                        <input 
                                            type="radio" 
                                            name="one_time_type" 
                                            value="scheduled"
                                            checked={schedule.one_time_type === 'scheduled'}
                                            onChange={() => setSchedule(prev => ({...prev, one_time_type: 'scheduled'}))}
                                            className="text-gray-900 focus:ring-gray-900" 
                                        />
                                        <div>
                                            <span className="block text-sm font-medium text-gray-900">定时执行 (Schedule)</span>
                                            <span className="block text-xs text-gray-500">指定未来的某个时间点执行一次</span>
                                        </div>
                                    </label>
                                </div>

                                {schedule.one_time_type === 'scheduled' && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">日期 (Date)</label>
                                            <input 
                                                type="date"
                                                value={schedule.one_time_date || ''}
                                                onChange={(e) => setSchedule(prev => ({...prev, one_time_date: e.target.value}))}
                                                className="w-full text-sm border-gray-300 border rounded-lg px-3 py-2 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">时间 (Time)</label>
                                            <input 
                                                type="time"
                                                value={schedule.one_time_time || ''}
                                                onChange={(e) => setSchedule(prev => ({...prev, one_time_time: e.target.value}))}
                                                className="w-full text-sm border-gray-300 border rounded-lg px-3 py-2 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Recurring Config */}
                        {schedule.mode === 'recurring' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-gray-200 rounded-lg bg-gray-50/50 animate-in fade-in zoom-in-95">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">频率 (Frequency)</label>
                                    <CustomSelect 
                                        value={schedule.frequency}
                                        onChange={(val) => setSchedule(prev => ({...prev, frequency: val as any}))}
                                        options={[
                                            { label: '每天 (Daily)', value: 'daily' },
                                            { label: '每周 (Weekly)', value: 'weekly' },
                                            { label: '每月 (Monthly)', value: 'monthly' }
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">执行时间 (Time)</label>
                                    <input 
                                        type="time"
                                        value={schedule.time || ''}
                                        onChange={(e) => setSchedule(prev => ({...prev, time: e.target.value}))}
                                        className="w-full text-sm border-gray-300 border rounded-lg px-3 py-2 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">开始日期 (Start Date)</label>
                                    <input 
                                        type="date"
                                        value={schedule.start_date || new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setSchedule(prev => ({...prev, start_date: e.target.value}))}
                                        className="w-full text-sm border-gray-300 border rounded-lg px-3 py-2 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">结束日期 (Optional)</label>
                                    <input 
                                        type="date"
                                        value={schedule.end_date || ''}
                                        onChange={(e) => setSchedule(prev => ({...prev, end_date: e.target.value}))}
                                        className="w-full text-sm border-gray-300 border rounded-lg px-3 py-2 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2 text-xs text-gray-500 flex items-center gap-1">
                                    <Calculator size={12} />
                                    <span>系统将根据频率和开始日期自动计算下次执行时间。</span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>

        {/* Footer for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-30 flex gap-3">
             <button 
                onClick={() => handleSave(false)}
                disabled={isPending}
                className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium"
             >
                保存草稿
             </button>
             <button 
                onClick={() => handleSave(true)}
                disabled={isPending}
                className="flex-1 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
             >
                启用任务
             </button>
        </div>

        <EmailConfigModal 
            isOpen={isConfigModalOpen} 
            onClose={() => { setIsConfigModalOpen(false); loadOptions(); }} 
            accounts={availableAccounts}
            templates={availableTemplates}
        />
    </div>
  );
}