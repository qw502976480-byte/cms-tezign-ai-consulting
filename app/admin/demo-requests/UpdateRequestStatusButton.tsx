'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DemoRequest, DemoRequestStatus, DemoRequestOutcome } from '@/types';
import { Loader2, Check, X } from 'lucide-react';

interface Props {
  request: DemoRequest;
}

export default function RequestActions({ request }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Determine if we should show buttons or the outcome state
  // If an outcome is set, we show that instead of buttons
  const isCompleted = request.outcome === 'completed';
  const isCancelled = request.outcome === 'cancelled';
  const hasOutcome = isCompleted || isCancelled;

  const handleUpdate = async (status: DemoRequestStatus, outcome: DemoRequestOutcome) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/demo-requests/${request.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, outcome }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        let errorMessage = 'Failed to update status';
        try {
          const json = JSON.parse(errorText);
          if (json.error) errorMessage = json.error;
        } catch (e) {
          if (errorText) errorMessage = errorText;
        }
        
        throw new Error(errorMessage);
      }

      router.refresh();
    } catch (error: any) {
      console.error('Failed to update request status:', error);
      alert(`An error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
     return (
        <div className="flex justify-end items-center h-[30px] w-full">
          <Loader2 className="animate-spin text-gray-500" size={16} />
        </div>
     );
  }

  // If already has an outcome, display it
  if (hasOutcome) {
      if (isCompleted) {
          return <span className="flex items-center justify-end gap-1 text-xs font-medium text-green-700"><Check size={12}/> 已完成</span>;
      }
      if (isCancelled) {
          return <span className="flex items-center justify-end gap-1 text-xs font-medium text-gray-400"><X size={12}/> 已取消</span>;
      }
  }

  // Default actions for items without an outcome (usually Pending, but could be Processed without outcome)
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => handleUpdate('pending', 'cancelled')}
        title="标记为取消 (未发生沟通)"
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        取消
      </button>
      <button
        onClick={() => handleUpdate('processed', 'completed')}
        title="标记为完成 (已发生沟通)"
        className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-900 rounded-md hover:bg-black transition-colors"
      >
        完成
      </button>
    </div>
  );
}
