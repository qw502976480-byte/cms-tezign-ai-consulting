
'use client';

import React, { useEffect, useState } from 'react';
import { DeliveryRun } from '@/types';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { getTaskRuns } from './actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
}

export default function TaskRunHistoryModal({ isOpen, onClose, taskId, taskName }: Props) {
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      setLoading(true);
      getTaskRuns(taskId)
        .then(setRuns)
        .catch(err => console.error("Failed to load runs", err))
        .finally(() => setLoading(false));
    } else {
        setRuns([]);
    }
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-900">执行记录 (Execution Logs)</h3>
            <p className="text-xs text-gray-500 mt-0.5">{taskName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 gap-2">
                <Clock className="animate-spin" size={18} /> 加载记录中...
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                <Calendar size={32} className="opacity-20" />
                <p>任务尚未执行</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 uppercase font-medium sticky top-0 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 w-[180px]">执行时间</th>
                        <th className="px-6 py-3 w-[120px]">结果</th>
                        <th className="px-6 py-3">详情 / 信息</th>
                        <th className="px-6 py-3 text-right">触达数</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {runs.map(run => (
                        <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-gray-600 text-xs whitespace-nowrap">
                                {format(new Date(run.started_at), 'yyyy-MM-dd HH:mm:ss')}
                            </td>
                            <td className="px-6 py-4">
                                {run.status === 'success' && <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium"><CheckCircle2 size={12} /> Success</span>}
                                {run.status === 'failed' && <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-medium"><XCircle size={12} /> Failed</span>}
                                {run.status === 'skipped' && <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded text-xs font-medium"><AlertCircle size={12} /> Skipped</span>}
                            </td>
                            <td className="px-6 py-4 text-gray-600 break-words max-w-xs">
                                {run.message || '-'}
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                {run.success_count} <span className="text-gray-400 text-xs font-normal">/ {run.recipient_count}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
