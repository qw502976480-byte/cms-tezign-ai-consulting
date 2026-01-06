'use client';

import { useState } from 'react';
import { DemoRequest, DemoRequestStatus, DemoRequestOutcome } from '@/types';
import { Loader2, Check, X } from 'lucide-react';

interface Props {
  request: DemoRequest;
  onUpdate: (id: string, status: DemoRequestStatus, outcome: DemoRequestOutcome) => Promise<void>;
}

export default function RequestActions({ request, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  // Determine if we should show buttons or the outcome state
  // Rule C: Visual Consistency
  const isCompleted = request.outcome === 'completed';
  const isCancelled = request.outcome === 'cancelled';
  const hasOutcome = isCompleted || isCancelled;

  const handleClick = async (status: DemoRequestStatus, outcome: DemoRequestOutcome) => {
    if (loading) return;
    setLoading(true);
    try {
      await onUpdate(request.id, status, outcome);
      // Note: We don't set loading false here because the component might unmount/re-render via parent
      // But if it stays, we want it to reflect the new state immediately passed down via props
    } catch (e) {
      setLoading(false);
    }
  };

  // If already has an outcome, display it
  if (hasOutcome) {
      if (isCompleted) {
          return <span className="flex items-center justify-end gap-1 text-xs font-medium text-green-700"><Check size={12}/> 已完成</span>;
      }
      if (isCancelled) {
          return <span className="flex items-center justify-end gap-1 text-xs font-medium text-gray-400"><X size={12}/> 已取消</span>;
      }
  }

  // Loading State
  if (loading) {
     return (
        <div className="flex justify-end items-center h-[30px] w-full gap-2">
           <Loader2 className="animate-spin text-gray-400" size={14} />
           <span className="text-xs text-gray-400">处理中...</span>
        </div>
     );
  }

  // Action Buttons
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        // Rule A: Cancel -> status: processed, outcome: cancelled
        onClick={() => handleClick('processed', 'cancelled')}
        title="标记为取消 (未发生沟通)"
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        取消
      </button>
      <button
        // Rule A: Complete -> status: processed, outcome: completed
        onClick={() => handleClick('processed', 'completed')}
        title="标记为完成 (已发生沟通)"
        className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-900 rounded-md hover:bg-black transition-colors"
      >
        完成
      </button>
    </div>
  );
}
