'use client';

import { DemoRequest, DemoAppointment, DemoRequestLog } from '@/types';
import { X, Calendar, Clock, User, Building2, FileText, CheckCircle2, XCircle, History, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

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
  const supabase = createClient();

  const loadLogs = useCallback(async () => {
    if (!request?.id) return;

    setLoadingLogs(true);
    setLogError(null);

    try {
      const { data, error } = await supabase
        .from('demo_request_logs')
        .select('*')
        .eq('demo_request_id', request.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[logs] supabase error:', error);
        throw new Error(error.message);
      }

      setLogs(data as DemoRequestLog[]);
    } catch (e: any) {
      console.error('[logs] unexpected error:', e);
      setLogError(e.message || '加载失败');
    } finally {
      setLoadingLogs(false);
    }
  }, [request?.id, supabase]);
  
  useEffect(() => {
    if (isOpen && request?.id) {
      loadLogs();
    } else {
      setLogs([]);
      setLoadingLogs(false);
      setLogError(null);
    }
  }, [isOpen, request?.id, loadLogs]);


  if (!isOpen) return null;

  const translateOutcome = (val: string | null) => {
    if (val === 'completed') return '已完成';
    if (val === 'cancelled') return '已取消';
    return '未设置';
  };

  const translateStatus = (val: string | null) => {
      if (val === 'pending') return '待处理';
      if (val === 'processed') return '已处理';
      return val || '-';
  };

  const renderLogContent = (log: DemoRequestLog) => {
    if (log.action === 'outcome_update') {
      // 优先展示结果变更
      if (log.new_outcome !== log.prev_outcome) {
          return (
            <div className="flex flex-col gap-1">
                <span className="text-gray-900 font-medium">更新沟通结果</span>
                <span className="text-gray-600 text-xs">
                  {translateOutcome(log.prev_outcome)} <span className="text-gray-400">→</span> {translateOutcome(log.new_outcome)}
                </span>
            </div>
          );
      }
      // 如果仅状态变更
      if (log.new_status !== log.prev_status) {
          return (
            <div className="flex flex-col gap-1">
                <span className="text-gray-900 font-medium">状态变更</span>
                <span className="text-gray-600 text-xs">
                  {translateStatus(log.prev_status)} <span className="text-gray-400">→</span> {translateStatus(log.new_status)}
                </span>
            </div>
          );
      }
    }
    return <span className="text-gray-700">{log.action}</span>;
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
                {loadingLogs && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <RefreshCw className="animate-spin" size={12} />
                    正在加载...
                  </div>
                )}
             </div>
             
             <div className="space-y-3">
                {logError ? (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 text-red-600">
                       <div className="flex items-center gap-2">
                         <AlertCircle size={16} />
                         <span className="text-xs font-medium">操作记录加载失败</span>
                       </div>
                       <button 
                         onClick={loadLogs}
                         className="text-xs bg-white border border-red-200 px-2 py-1 rounded hover:bg-red-50 font-medium transition-colors"
                       >
                         重试
                       </button>
                    </div>
                ) : !loadingLogs && logs.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-2">暂无操作记录</div>
                ) : (
                    <ul className="space-y-4 relative ml-2 before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gray-100">
                       {logs.map((log) => (
                           <li key={log.id} className="relative flex items-start gap-4">
                               <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-300 shadow-sm z-10"></div>
                               <div className="ml-4 flex-1">
                                   <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-1">
                                      <span className="font-mono text-gray-400">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="font-medium text-gray-600 truncate max-w-[150px]" title={log.actor || 'System'}>
                                        {log.actor || '—'}
                                      </span>
                                   </div>
                                   <div className="text-sm bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                      {renderLogContent(log)}
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
