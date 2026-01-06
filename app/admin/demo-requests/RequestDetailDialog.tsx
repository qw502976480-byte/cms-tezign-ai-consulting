'use client';

import { DemoRequest, DemoAppointment, DemoRequestLog } from '@/types';
import { X, Calendar, Clock, User, Building2, FileText, CheckCircle2, XCircle, History, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

// Cache store: { requestId: { timestamp, data } }
const logCache: Record<string, { ts: number; data: DemoRequestLog[] }> = {};
const CACHE_DURATION = 30 * 1000; // 30 seconds

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
      loadLogsWithCache();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, request.id]);

  const loadLogsWithCache = async () => {
    const cached = logCache[request.id];
    const now = Date.now();

    // Check cache validity
    if (cached && (now - cached.ts < CACHE_DURATION)) {
      setLogs(cached.data);
      setLoadingLogs(false);
      return;
    }

    // Fetch fresh data
    await fetchLogs();
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogError(null);
    try {
      const res = await fetch(`/api/demo-requests/${request.id}/logs`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Logs API Error]', errorText);
        throw new Error('操作记录加载失败');
      }

      const data: DemoRequestLog[] = await res.json();
      
      // Update State & Cache
      setLogs(data);
      logCache[request.id] = { ts: Date.now(), data };

    } catch (e: any) {
      // console.error is already handled above for API errors, or here for network errors
      console.error(e);
      setLogError('操作记录加载失败');
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!isOpen) return null;

  const translateOutcome = (val: string | null) => {
    if (val === 'completed') return '已完成';
    if (val === 'cancelled') return '已取消';
    return '未设置';
  };

  const renderLogContent = (log: DemoRequestLog) => {
    if (log.action === 'outcome_update') {
      return (
        <span className="text-gray-700">
          沟通结果：{translateOutcome(log.prev_outcome)} → {translateOutcome(log.new_outcome)}
        </span>
      );
    }
    // For other actions, display raw action text or map other types if needed
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
                    <div className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded border border-red-100">
                      {logError}
                    </div>
                ) : !loadingLogs && logs.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-2">暂无操作记录</div>
                ) : (
                    <ul className="space-y-4 relative ml-2 before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gray-100">
                       {logs.map((log) => (
                           <li key={log.id} className="relative flex items-start gap-4">
                               <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-300 shadow-sm z-10"></div>
                               <div className="ml-4 flex-1">
                                   <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-0.5">
                                      <span className="font-mono text-gray-400">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="font-medium text-gray-600 truncate max-w-[150px]" title={log.actor || 'System'}>
                                        {log.actor || 'System'}
                                      </span>
                                   </div>
                                   <div className="text-sm bg-gray-50 p-2 rounded-lg border border-gray-100">
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