'use client';

import React, { useState, useEffect } from 'react';
import { EmailSendingAccount, EmailTemplate } from '@/types';
import { upsertEmailAccount, upsertEmailTemplate } from './actions';
import { X, Plus, Edit2, CheckCircle2, XCircle, Mail, File, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: EmailSendingAccount[];
  templates: EmailTemplate[];
}

export default function EmailConfigModal({ isOpen, onClose, accounts: initialAccounts, templates: initialTemplates }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'accounts' | 'templates'>('accounts');
  const [accounts, setAccounts] = useState(initialAccounts);
  const [templates, setTemplates] = useState(initialTemplates);
  
  // Editing State
  const [editingAccount, setEditingAccount] = useState<Partial<EmailSendingAccount> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAccounts(initialAccounts);
    setTemplates(initialTemplates);
  }, [initialAccounts, initialTemplates]);

  if (!isOpen) return null;

  const handleSaveAccount = async () => {
    if (!editingAccount?.name || !editingAccount?.from_email) return alert('必填项不能为空');
    setIsSaving(true);
    const res = await upsertEmailAccount(editingAccount);
    setIsSaving(false);
    if (res.success) {
      setEditingAccount(null);
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.subject) return alert('必填项不能为空');
    setIsSaving(true);
    const res = await upsertEmailTemplate(editingTemplate);
    setIsSaving(false);
    if (res.success) {
      setEditingTemplate(null);
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900">Email 配置管理</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
           <button 
             onClick={() => { setActiveTab('accounts'); setEditingAccount(null); setEditingTemplate(null); }}
             className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'accounts' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <Mail size={16} /> 发送账户 (Sending Accounts)
           </button>
           <button 
             onClick={() => { setActiveTab('templates'); setEditingAccount(null); setEditingTemplate(null); }}
             className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'templates' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <File size={16} /> 邮件模板 (Email Templates)
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
           
           {/* ACCOUNTS TAB */}
           {activeTab === 'accounts' && (
             <div className="space-y-6">
                {!editingAccount ? (
                    <>
                        <div className="flex justify-end">
                            <button onClick={() => setEditingAccount({ is_active: true, provider: 'resend' })} className="flex items-center gap-2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black">
                                <Plus size={16} /> 新建账户
                            </button>
                        </div>
                        <div className="grid gap-4">
                            {accounts.map(acc => (
                                <div key={acc.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-900">{acc.name}</h4>
                                            {acc.is_active ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-gray-400" />}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">{acc.from_name} &lt;{acc.from_email}&gt;</p>
                                    </div>
                                    <button onClick={() => setEditingAccount(acc)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-lg">
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {accounts.length === 0 && <p className="text-center text-gray-400 py-8">暂无发送账户</p>}
                        </div>
                    </>
                ) : (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4 max-w-2xl mx-auto">
                        <h4 className="font-semibold text-gray-900">{editingAccount.id ? '编辑账户' : '新建账户'}</h4>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">配置名称 (内部识别)</label>
                            <input type="text" value={editingAccount.name || ''} onChange={e => setEditingAccount(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Marketing Team" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">发件人名称</label>
                                <input type="text" value={editingAccount.from_name || ''} onChange={e => setEditingAccount(p => ({...p, from_name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Tezign Team" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">发件邮箱</label>
                                <input type="email" value={editingAccount.from_email || ''} onChange={e => setEditingAccount(p => ({...p, from_email: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. news@tezign.com" />
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Reply-To (可选)</label>
                            <input type="email" value={editingAccount.reply_to || ''} onChange={e => setEditingAccount(p => ({...p, reply_to: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                             <input type="checkbox" checked={editingAccount.is_active} onChange={e => setEditingAccount(p => ({...p, is_active: e.target.checked}))} id="acc_active" />
                             <label htmlFor="acc_active" className="text-sm text-gray-700">启用此账户</label>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <button onClick={() => setEditingAccount(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">取消</button>
                            <button onClick={handleSaveAccount} disabled={isSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black flex items-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 保存
                            </button>
                        </div>
                    </div>
                )}
             </div>
           )}

           {/* TEMPLATES TAB */}
           {activeTab === 'templates' && (
             <div className="space-y-6">
                {!editingTemplate ? (
                     <>
                        <div className="flex justify-end">
                            <button onClick={() => setEditingTemplate({ is_active: true, html_content: '<html><body><p>Hi {{name}},</p><p>Here is your update:</p>{{items}}<p>{{footer}}</p></body></html>' })} className="flex items-center gap-2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black">
                                <Plus size={16} /> 新建模板
                            </button>
                        </div>
                        <div className="grid gap-4">
                            {templates.map(tmp => (
                                <div key={tmp.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-900">{tmp.name}</h4>
                                            {tmp.is_active ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-gray-400" />}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5 truncate max-w-md">{tmp.subject}</p>
                                    </div>
                                    <button onClick={() => setEditingTemplate(tmp)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-lg">
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {templates.length === 0 && <p className="text-center text-gray-400 py-8">暂无邮件模板</p>}
                        </div>
                    </>
                ) : (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4 max-w-3xl mx-auto">
                        <h4 className="font-semibold text-gray-900">{editingTemplate.id ? '编辑模板' : '新建模板'}</h4>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">模板名称</label>
                            <input type="text" value={editingTemplate.name || ''} onChange={e => setEditingTemplate(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Monthly Newsletter" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">默认主题 (Subject)</label>
                            <input type="text" value={editingTemplate.subject || ''} onChange={e => setEditingTemplate(p => ({...p, subject: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Tezign Updates" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">HTML 内容</label>
                            <textarea rows={8} value={editingTemplate.html_content || ''} onChange={e => setEditingTemplate(p => ({...p, html_content: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-xs" />
                            <p className="text-xs text-gray-400 mt-1">支持变量: {"{{name}}"}, {"{{items}}"}, {"{{header}}"}, {"{{footer}}"}</p>
                        </div>
                         <div className="flex items-center gap-2 pt-2">
                             <input type="checkbox" checked={editingTemplate.is_active} onChange={e => setEditingTemplate(p => ({...p, is_active: e.target.checked}))} id="tmp_active" />
                             <label htmlFor="tmp_active" className="text-sm text-gray-700">启用此模板</label>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <button onClick={() => setEditingTemplate(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">取消</button>
                            <button onClick={handleSaveTemplate} disabled={isSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black flex items-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 保存
                            </button>
                        </div>
                    </div>
                )}
             </div>
           )}

        </div>
      </div>
    </div>
  );
}