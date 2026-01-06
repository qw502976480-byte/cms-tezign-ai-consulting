'use client';

import { RegisteredUser } from '@/types';
import { X, User, Building2, Mail, Phone, MapPin, Tag, FileText, CheckCircle2, XCircle, Save, Loader2, AlertCircle, Globe, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Props {
  user: RegisteredUser | null;
  isOpen: boolean;
  onClose: () => void;
  onNoteSaved: () => void;
}

export default function UserDetailModal({ user, isOpen, onClose, onNoteSaved }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      setNote((user as any).note || '');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('registered_users')
        .update({ note: note } as any)
        .eq('id', user.id);

      if (error) throw error;
      onNoteSaved();
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('保存失败 (可能数据库缺少 note 字段)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                {user.name?.[0]?.toUpperCase() || 'U'}
             </div>
             <div>
                <h3 className="font-semibold text-gray-900">{user.name || '未命名用户'}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono">{user.id}</span>
                    <span>•</span>
                    <span>注册于 {format(new Date(user.created_at), 'yyyy-MM-dd')}</span>
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Status Bar */}
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">沟通状态</span>
                    {user.communication_status === 'communicated' ? (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-green-700">
                            <CheckCircle2 size={16} /> 已进行线上沟通
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-gray-500">
                             <MessageSquare size={16} /> 暂未沟通
                        </div>
                    )}
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="flex-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">营销许可</span>
                    <div className="text-sm font-medium text-gray-800">
                        {user.marketing_opt_in ? '已同意接收' : '未同意'}
                    </div>
                </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                    <User size={16} /> 基础信息
                </h4>
                <div className="space-y-3 p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3 text-sm">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-gray-900 select-all">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-gray-900 select-all">{user.phone || '未填写'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="text-gray-900">
                             {[user.country, user.region, user.city].filter(Boolean).join(' / ') || '未知位置'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <Globe size={16} className="text-gray-400" />
                        <span className="text-gray-900">
                             {user.language || '未知语言'}
                        </span>
                    </div>
                </div>
              </div>

              {/* Professional Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Building2 size={16} /> 职业信息
                </h4>
                 <div className="space-y-3 p-3 border border-gray-100 rounded-lg">
                    <div className="grid grid-cols-3 text-sm gap-2">
                        <span className="text-gray-500">类型:</span>
                        <span className="col-span-2 font-medium text-gray-900 capitalize">
                             {user.user_type === 'company' ? '企业用户' : '个人用户'}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 text-sm gap-2">
                        <span className="text-gray-500">公司:</span>
                        <span className="col-span-2 font-medium text-gray-900">{user.company_name || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 text-sm gap-2">
                        <span className="text-gray-500">职位:</span>
                        <span className="col-span-2 font-medium text-gray-900">{user.title || '—'}</span>
                    </div>
                </div>
              </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
             <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                <Tag size={16} /> 标签画像
            </h4>
            
            <div className="space-y-3">
                <div>
                    <span className="text-xs text-gray-500 block mb-1">使用场景 (Use Case):</span>
                    <div className="flex flex-wrap gap-2">
                        {user.use_case_tags && user.use_case_tags.length > 0 ? (
                            user.use_case_tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md border border-indigo-100">
                                    {tag}
                                </span>
                            ))
                        ) : <span className="text-xs text-gray-400">无</span>}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-gray-500 block mb-1">兴趣 (Interests):</span>
                     <div className="flex flex-wrap gap-2">
                        {user.interest_tags && user.interest_tags.length > 0 ? (
                            user.interest_tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md border border-gray-200">
                                    {tag}
                                </span>
                            ))
                        ) : <span className="text-xs text-gray-400">无</span>}
                    </div>
                </div>
            </div>
          </div>

          {/* Pain Points */}
          <div className="space-y-3">
             <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                <AlertCircle size={16} /> 业务痛点
            </h4>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed">
                {user.pain_points || '用户未填写业务痛点。'}
            </div>
          </div>

          {/* Notes (Editable) */}
          <div className="space-y-3 bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
             <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={16} /> 内部备注
                </h4>
                <button 
                    onClick={handleSaveNote}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    保存
                </button>
             </div>
             <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full text-sm border border-yellow-200 rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400"
                placeholder="在此记录关于该用户的跟进情况、潜在需求或其他内部信息..."
             />
          </div>

        </div>
      </div>
    </div>
  );
}
