'use client';

import { DemoRequest, DemoAppointment } from '@/types';
import { X, Calendar, Clock, User, Mail, Phone, Building2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: DemoRequest;
  appointment: DemoAppointment | undefined;
}

export default function RequestDetailDialog({ isOpen, onClose, request, appointment }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900">申请详情</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
             <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">当前状态</p>
                <div className="flex items-center gap-2">
                    {request.status === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            待处理
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            已处理
                        </span>
                    )}
                    
                    {request.outcome === 'completed' && (
                         <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                            <CheckCircle2 size={16} /> 已完成
                         </span>
                    )}
                    {request.outcome === 'cancelled' && (
                         <span className="flex items-center gap-1 text-sm font-medium text-gray-500">
                            <XCircle size={16} /> 已取消
                         </span>
                    )}
                </div>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">申请时间</p>
                <p className="text-sm font-medium text-gray-900">
                    {format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}
                </p>
             </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <User size={16} /> 联系信息
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">姓名</span>
                    <span className="text-sm font-medium block">{request.name}</span>
                </div>
                <div className="p-3 border rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">手机号</span>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium block">{request.phone || '—'}</span>
                    </div>
                </div>
                <div className="p-3 border rounded-lg sm:col-span-2">
                    <span className="text-xs text-gray-500 block mb-1">邮箱</span>
                    <span className="text-sm font-medium block">{request.email}</span>
                </div>
            </div>
          </div>

          {/* Professional Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Building2 size={16} /> 公司信息
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">公司</span>
                    <span className="text-sm font-medium block">{request.company || '—'}</span>
                </div>
                <div className="p-3 border rounded-lg">
                    <span className="text-xs text-gray-500 block mb-1">职位</span>
                    <span className="text-sm font-medium block">{request.title || '—'}</span>
                </div>
            </div>
          </div>

          {/* Appointment Info */}
          {appointment && (
             <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar size={16} /> 预约信息
                </h4>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Clock size={20} className="text-blue-600" />
                        <div>
                            <p className="text-sm font-bold text-blue-900">
                                {format(new Date(appointment.scheduled_at), 'yyyy-MM-dd HH:mm')}
                            </p>
                            <p className="text-xs text-blue-700 mt-0.5">
                                状态: {appointment.status}
                            </p>
                        </div>
                    </div>
                </div>
             </div>
          )}

           {/* Notes */}
           <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={16} /> 备注留言
            </h4>
            <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap">
                {request.notes || '无留言内容'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
