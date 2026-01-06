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
        console.error(`Update failed. Status: ${response.status}. Response: ${errorText}`);
        
        let errorMessage = `更新失败 (Status: ${response.status})`;
        try {
          const json = JSON.parse(errorText);
          if (json.error) errorMessage += `: ${json.error}`;
        } catch (e) {
          if (errorText) errorMessage += `: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      // Success - refresh UI immediately
      router.refresh();
      
    } catch (error: any) {
      console.error('Failed to update request status:', error);
      alert(`${error.message}\n请检查控制台获取详细信息。`);
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

  // If already has an outcome, display it with status indicator
  if (hasOutcome) {
      if (isCompleted) {
          return <span className="flex items-center justify-end gap-1 text-xs font-medium text-green-700"><Check size={12}/> 已完成</span>;
      }
      if (isCancelled) {
          return <span className="flex items-center justify-end gap-1 text-xs font-medium text-gray-400"><X size={12}/> 已取消</span>;
      }
  }

  // Action Buttons
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        // Cancel logic: status -> pending, outcome -> cancelled
        onClick={() => handleUpdate('pending', 'cancelled')}
        title="标记为取消 (未发生沟通)"
        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        取消
      </button>
      <button
        // Complete logic: status -> processed, outcome -> completed
        onClick={() => handleUpdate('processed', 'completed')}
        title="标记为完成 (已发生沟通)"
        className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-900 rounded-md hover:bg-black transition-colors"
      >
        完成
      </button>
    </div>
  );
}
