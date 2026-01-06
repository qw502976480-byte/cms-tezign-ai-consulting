'use client';

import { DemoRequest, DemoAppointment, DemoRequestLog } from '@/types';
import { X, Calendar, Clock, User, Mail, Phone, Building2, FileText, CheckCircle2, XCircle, History, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: DemoRequest;
  appointment: DemoAppointment | undefined;
}

export default function RequestDetailDialog({ isOpen, onClose, request, appointment }: Props) {
  const [logs, setLogs] = useState<DemoRequestLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && request.id) {
      fetchLogs();
    }
  }, [isOpen, request.id]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogError(null);
    try {
      const res = await fetch(`/api/demo-requests/${request.id}/logs`);
      if (!res.ok) throw new Error('Failed to load logs');
      const data = await res.json();
      setLogs(data);
    } catch (e: any) {
      console.error(e);
      setLogError('记录加载失败');
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!isOpen) return null;

  const translateOutcome = (val: string | null) => {
    if (val === 'completed') return '已完成';
    if (val === 'cancelled') return '已取消';
    return '—';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h3 className="font-semibold text-gray-900">申请详情</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
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

          {/* Audit Logs */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
             <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <History size={16} /> 操作记录
                </h4>
                {loadingLogs && <RefreshCw className="animate-spin text-gray-400" size={12} />}
             </div>
             
             <div className="space-y-3">
                {loadingLogs && logs.length === 0 ? (
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                    </div>
                ) : logError ? (
                    <div className="text-xs text-red-500">{logError}</div>
                ) : logs.length === 0 ? (
                    <div className="text-xs text-gray-400 italic">暂无操作记录</div>
                ) : (
                    <ul className="space-y-3 relative before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                       {logs.map((log) => (
                           <li key={log.id} className="relative flex items-start gap-3">
                               <div className="absolute left-0 top-1 h-3 w-3 rounded-full border border-white bg-gray-200 shadow-sm"></div>
                               <div className="ml-5 text-xs">
                                   <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                                      <span>{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}</span>
                                      <span>•</span>
                                      <span className="font-medium text-gray-600 truncate max-w-[120px]">{log.actor || 'System'}</span>
                                   </div>
                                   <div className="text-gray-700">
                                       沟通结果：
                                       <span className="mx-1 line-through text-gray-400">
                                            {translateOutcome(log.prev_outcome)}
                                       </span> 
                                       ➔ 
                                       <span className="mx-1 font-medium text-gray-900">
                                            {translateOutcome(log.new_outcome)}
                                       </span>
                                   </div>
                               </div>
                           </li>
                       ))}
                    </ul>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}