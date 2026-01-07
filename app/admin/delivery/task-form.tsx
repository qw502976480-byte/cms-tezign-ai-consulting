'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { upsertDeliveryTask, estimateAudienceCount, searchResources, getResourcesByIds, getEmailAccounts, getEmailTemplates } from './actions';
import { DeliveryTask, DeliveryTaskType, DeliveryChannel, DeliveryTaskStatus, DeliveryContentMode, DeliveryAudienceRule, DeliveryContentRule, DeliveryScheduleRule, EmailSendingAccount, EmailTemplate, EmailChannelConfig } from '@/types';
import { Loader2, Save, Play, Search, X, Check, Calculator, CalendarClock, Users, FileText, Settings, AlertTriangle, Mail } from 'lucide-react';
import Link from 'next/link';

interface Props {
  initialData?: DeliveryTask;
}

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
    country: '',
    city: '',
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

  const [schedule, setSchedule] = useState<DeliveryScheduleRule>(initialData?.schedule_rule || {
    type: 'immediate',
    frequency: 'weekly',
    time: '10:00',
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

  // --- Helper State ---
  const [estimating, setEstimating] = useState(false);
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [resourceSearchResults, setResourceSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'basic'|'audience'|'content'|'schedule'>('basic');

  // Load initial resources if manual mode & Email Options
  useEffect(() => {
    if (initialData?.content_ids && initialData.content_ids.length > 0) {
        getResourcesByIds(initialData.content_ids).then(setSelectedResourcesPreview);
    }
    // Load email config options
    const loadOptions = async () => {
        const [accs, tmps] = await Promise.all([getEmailAccounts(), getEmailTemplates()]);
        setAvailableAccounts(accs.filter(a => a.is_active));
        setAvailableTemplates(tmps.filter(t => t.is_active));
    };
    loadOptions();
  }, [initialData]);

  // When template selected, auto-fill subject if empty
  useEffect(() => {
      if (emailConfig.template_id && !emailConfig.subject) {
          const tmpl = availableTemplates.find(t => t.id === emailConfig.template_id);
          if (tmpl) setEmailConfig(prev => ({ ...prev, subject: tmpl.subject }));
      }
  }, [emailConfig.template_id, availableTemplates, emailConfig.subject]);

  // --- Handlers ---

  const handleAudienceEstimate = async () => {
    setEstimating(true);
    const res = await estimateAudienceCount(audience);
    if (res.success) {
        setAudience(prev => ({ ...prev, estimated_count: res.count }));
    } else {
        alert('预估失败');
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

  const handleSave = (activate = false) => {
      if (!basic.name) return alert('请输入任务名称');
      
      // Validation for Active Email Tasks
      if ((activate || basic.status === 'active') && basic.channel === 'email') {
          if (!emailConfig.account_id) return alert('启用 Email 任务必须选择发送账户');
          if (!emailConfig.template_id) return alert('启用 Email 任务必须选择邮件模板');
          if (!emailConfig.subject) return alert('启用 Email 任务必须填写邮件主题');
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left: Navigation Steps (Desktop) */}
        <div className="hidden lg:block space-y-2">
            {[
                { id: 'basic', label: '基础信息', icon: Settings },
                { id: 'audience', label: '目标受众', icon: Users },
                { id: 'content', label: '内容配置', icon: FileText },
                { id: 'schedule', label: '执行计划', icon: CalendarClock },
            ].map((step) => (
                <button
                    key={step.id}
                    onClick={() => setActiveTab(step.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === step.id 
                        ? 'bg-gray-900 text-white' 
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
            <section id="basic" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-2">
                    <Settings className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">基础信息</h2>
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
                        <select 
                            value={basic.type} 
                            onChange={(e) => setBasic(prev => ({...prev, type: e.target.value as DeliveryTaskType}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none bg-white"
                        >
                            <option value="automated">自动化 (Automated)</option>
                            <option value="one_off">临时任务 (Ad-hoc)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">分发渠道</label>
                        <select 
                            value={basic.channel} 
                            onChange={(e) => setBasic(prev => ({...prev, channel: e.target.value as DeliveryChannel}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none bg-white"
                        >
                            <option value="email">邮件 (Email)</option>
                            <option value="in_app">站内信 (In-App)</option>
                        </select>
                    </div>
                </div>
                <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">当前状态</label>
                        <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={basic.status === 'draft'} onChange={() => setBasic(prev => ({...prev, status: 'draft'}))} className="text-gray-900 focus:ring-gray-900" />
                            <span className="text-sm">草稿 (Draft)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={basic.status === 'active'} onChange={() => setBasic(prev => ({...prev, status: 'active'}))} className="text-green-600 focus:ring-green-600" />
                            <span className="text-sm">启用 (Active)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={basic.status === 'paused'} onChange={() => setBasic(prev => ({...prev, status: 'paused'}))} className="text-yellow-600 focus:ring-yellow-600" />
                            <span className="text-sm">暂停 (Paused)</span>
                        </label>
                        </div>
                </div>

                {/* Email Config Block */}
                {basic.channel === 'email' && (
                     <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-2 text-indigo-800 font-semibold text-sm border-b border-indigo-100 pb-2 mb-2">
                             <Mail size={16} /> Email 配置 (Email Config)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-medium text-indigo-900 mb-1">发送账户 <span className="text-red-500">*</span></label>
                                <select 
                                    value={emailConfig.account_id}
                                    onChange={(e) => setEmailConfig(prev => ({...prev, account_id: e.target.value}))}
                                    className="w-full text-sm border-indigo-200 rounded-lg focus:ring-indigo-500"
                                >
                                    <option value="">-- 选择账户 --</option>
                                    {availableAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.from_email})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-indigo-900 mb-1">邮件模板 <span className="text-red-500">*</span></label>
                                <select 
                                    value={emailConfig.template_id}
                                    onChange={(e) => setEmailConfig(prev => ({...prev, template_id: e.target.value}))}
                                    className="w-full text-sm border-indigo-200 rounded-lg focus:ring-indigo-500"
                                >
                                    <option value="">-- 选择模板 --</option>
                                    {availableTemplates.map(tmp => (
                                        <option key={tmp.id} value={tmp.id}>{tmp.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-indigo-900 mb-1">邮件主题 <span className="text-red-500">*</span></label>
                             <input 
                                type="text"
                                value={emailConfig.subject}
                                onChange={(e) => setEmailConfig(prev => ({...prev, subject: e.target.value}))}
                                className="w-full text-sm border-indigo-200 rounded-lg"
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
                                    className="w-full text-sm border-indigo-200 rounded-lg"
                                    placeholder="Hi {{name}}, ..."
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-indigo-900 mb-1">结尾落款 (Footer Note)</label>
                                <textarea 
                                    rows={2}
                                    value={emailConfig.footer_note || ''}
                                    onChange={(e) => setEmailConfig(prev => ({...prev, footer_note: e.target.value}))}
                                    className="w-full text-sm border-indigo-200 rounded-lg"
                                    placeholder="Thanks, Team"
                                />
                             </div>
                        </div>
                     </div>
                )}
            </section>

             {/* Section 2: Audience */}
             <section id="audience" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                    <Users className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">目标受众</h2>
                </div>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">受众范围</label>
                            <select 
                                value={audience.scope} 
                                onChange={(e) => setAudience(prev => ({...prev, scope: e.target.value as any}))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none bg-white"
                            >
                                <option value="all">全部注册用户</option>
                                <option value="communicated">仅发生过线上沟通</option>
                                <option value="not_communicated">未发生过线上沟通</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">用户类型</label>
                            <select 
                                value={audience.user_type} 
                                onChange={(e) => setAudience(prev => ({...prev, user_type: e.target.value as any}))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none bg-white"
                            >
                                <option value="all">不限</option>
                                <option value="company">企业用户</option>
                                <option value="personal">个人用户</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">预估覆盖人数:</span>
                            <span className="text-xl font-bold text-gray-900">{audience.estimated_count ?? '-'}</span>
                            <span className="text-xs text-gray-400">人</span>
                        </div>
                        <button 
                            type="button"
                            onClick={handleAudienceEstimate}
                            disabled={estimating}
                            className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:underline disabled:opacity-50"
                        >
                            {estimating && <Loader2 className="animate-spin" size={14} />}
                            重新计算
                        </button>
                    </div>
                </div>
            </section>
            
            {/* Section 3: Content */}
            <section id="content" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                    <FileText className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">内容配置</h2>
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
                                    <select 
                                        value={contentRule.time_range}
                                        onChange={(e) => setContentRule(prev => ({...prev, time_range: e.target.value as any}))}
                                        className="w-full text-sm border-gray-300 rounded-lg"
                                    >
                                        <option value="7d">最近 7 天</option>
                                        <option value="30d">最近 30 天</option>
                                        <option value="90d">最近 90 天</option>
                                        <option value="all">不限时间</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">选取数量限制</label>
                                    <input 
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={contentRule.limit}
                                        onChange={(e) => setContentRule(prev => ({...prev, limit: parseInt(e.target.value)}))}
                                        className="w-full text-sm border-gray-300 rounded-lg"
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
                                    className="flex-1 text-sm border-gray-300 rounded-lg"
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
                        <select 
                            value={contentRule.featured_slot || 'none'}
                            onChange={(e) => setContentRule(prev => ({...prev, featured_slot: e.target.value as any}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                            <option value="none">不推广</option>
                            <option value="carousel">Feature Carousel (轮播位)</option>
                            <option value="fixed">Fixed List (固定列表)</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">若选择推广，任务执行时将自动把选中内容更新到首页对应模块。</p>
                    </div>

                </div>
            </section>
            
            {/* Section 4: Schedule */}
            <section id="schedule" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
                    <CalendarClock className="text-gray-400" size={20} />
                    <h2 className="text-lg font-semibold text-gray-900">执行计划</h2>
                </div>
                 <div className="space-y-6">
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-3">执行方式</label>
                         <div className="flex gap-4">
                            <button 
                                type="button"
                                onClick={() => setSchedule(prev => ({...prev, type: 'immediate'}))}
                                className={`flex-1 p-4 rounded-xl border text-left transition-all ${schedule.type === 'immediate' ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="font-semibold text-gray-900 flex items-center justify-between">
                                    立即执行 (Immediate)
                                    {schedule.type === 'immediate' && <Check size={16} />}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">任务保存并启用后，立即运行一次</p>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setSchedule(prev => ({...prev, type: 'scheduled'}))}
                                className={`flex-1 p-4 rounded-xl border text-left transition-all ${schedule.type === 'scheduled' ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="font-semibold text-gray-900 flex items-center justify-between">
                                    定时执行 (Scheduled)
                                    {schedule.type === 'scheduled' && <Check size={16} />}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">按照设定的频率和时间自动重复运行</p>
                            </button>
                         </div>
                    </div>
                    
                    {schedule.type === 'scheduled' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-gray-200 rounded-lg bg-gray-50/50 animate-in fade-in zoom-in-95">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">频率</label>
                                <select 
                                    value={schedule.frequency}
                                    onChange={(e) => setSchedule(prev => ({...prev, frequency: e.target.value as any}))}
                                    className="w-full text-sm border-gray-300 rounded-lg"
                                >
                                    <option value="daily">每天 (Daily)</option>
                                    <option value="weekly">每周 (Weekly)</option>
                                    <option value="monthly">每月 (Monthly)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">执行时间 (HH:MM)</label>
                                <input 
                                    type="time"
                                    value={schedule.time}
                                    onChange={(e) => setSchedule(prev => ({...prev, time: e.target.value}))}
                                    className="w-full text-sm border-gray-300 rounded-lg"
                                />
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">时区</label>
                                <input 
                                    type="text"
                                    value={schedule.timezone}
                                    disabled
                                    className="w-full text-sm border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div className="md:col-span-2 text-xs text-gray-500 flex items-center gap-1">
                                <Calculator size={12} />
                                <span>下次执行时间将在保存后自动计算。</span>
                            </div>
                        </div>
                    )}
                 </div>
            </section>
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
    </div>
  );
}