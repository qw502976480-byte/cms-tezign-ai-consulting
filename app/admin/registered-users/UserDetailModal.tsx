'use client';

import { RegisteredUser } from '@/types';
import { X, User, Building2, Mail, Phone, MapPin, Tag, FileText, CheckCircle2, XCircle, Save, Loader2 } from 'lucide-react';
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
      setNote(user.note || '');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('registered_users')
        .update({ note: note })
        .eq('id', user.id);

      if (error) throw error;
      
      onNoteSaved();
      // Optional: Show a quick success toast here via a parent callback or local state
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('备注保存失败');
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
             <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
             </div>
             <div>
                <h3 className="font-semibold text-gray-900">{user.name || '未命名用户'}</h3>
                <p className="text-xs text-gray-500">ID: {user.id}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Key Metrics / Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
             <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">注册时间</span>
                <span className="text-sm font-medium text-gray-900">
                    {format(new Date(user.created_at), 'yyyy-MM-dd HH:mm')}
                </span>
             </div>
             <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">营销许可</span>
                {user.marketing_consent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> 已同意
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">
                        <XCircle size={12} /> 未同意
                    </span>
                )}
             </div>
             <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">来源</span>
                <span className="text-sm font-medium text-gray-900">{user.source || '—'}</span>
             </div>
             <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">地区/语言</span>
                <span className="text-sm font-medium text-gray-900">{user.locale || '—'}</span>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                    <User size={16} /> 联系方式
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-gray-900">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-gray-900">{user.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="text-gray-900">{user.locale || '—'}</span>
                    </div>
                </div>
              </div>

              {/* Professional Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Building2 size={16} /> 职业信息
                </h4>
                 <div className="space-y-3">
                    <div className="grid grid-cols-3 text-sm gap-2">
                        <span className="text-gray-500">公司:</span>
                        <span className="col-span-2 font-medium text-gray-900">{user.company || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 text-sm gap-2">
                        <span className="text-gray-500">职位:</span>
                        <span className="col-span-2 font-medium text-gray-900">{user.title || '—'}</span>
                    </div>
                </div>
              </div>
          </div>

          {/* Interests */}
          <div className="space-y-3">
             <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                <Tag size={16} /> 兴趣标签
            </h4>
            <div className="flex flex-wrap gap-2">
                {user.interests && user.interests.length > 0 ? (
                    user.interests.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-sm text-gray-400 italic">无标签数据</span>
                )}
            </div>
          </div>

          {/* Notes (Editable) */}
          <div className="space-y-3 bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
             <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={16} /> 备注 (Internal Note)
                </h4>
                {note !== (user.note || '') && (
                    <button 
                        onClick={handleSaveNote}
                        disabled={saving}
                        className="flex items-center gap-1.5 text-xs bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        保存备注
                    </button>
                )}
             </div>
             <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full text-sm border border-yellow-200 rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400"
                placeholder="在此输入关于该用户的内部备注..."
             />
          </div>

        </div>
      </div>
    </div>
  );
}
