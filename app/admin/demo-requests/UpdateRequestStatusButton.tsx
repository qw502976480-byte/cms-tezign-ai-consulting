
'use client';

import { useState } from 'react';
import { DemoRequest, DemoRequestOutcome } from '@/types';
import { Loader2, Check, X } from 'lucide-react';

interface Props {
  request: DemoRequest;
  onUpdate: (id: string, outcome: DemoRequestOutcome) => Promise<void>;
}

export default function RequestActions({ request, onUpdate }: Props) {
  // State to track which button is loading, if any
  const [loadingOutcome, setLoadingOutcome] = useState<DemoRequestOutcome | null>(null);

  const handleSelect = async (targetOutcome: DemoRequestOutcome) => {
    // Do nothing if already loading or if clicking the currently active state
    if (loadingOutcome || request.outcome === targetOutcome) return;

    setLoadingOutcome(targetOutcome);
    try {
      await onUpdate(request.id, targetOutcome);
    } catch (e) {
      console.error(e);
      // Optional: Add user feedback for error
    } finally {
      setLoadingOutcome(null);
    }
  };

  const isCompleted = request.outcome === 'completed';
  const isCancelled = request.outcome === 'cancelled';
  const isLoading = !!loadingOutcome;

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Completed Button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleSelect('completed')}
        className={`flex items-center justify-center gap-1.5 w-[88px] px-3 py-1.5 border rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
          ${isCompleted
            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
            : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
          }
        `}
      >
        {loadingOutcome === 'completed' 
            ? <Loader2 className="animate-spin" size={12} /> 
            : <Check size={12} />
        }
        <span>已完成</span>
      </button>

      {/* Cancelled Button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleSelect('cancelled')}
        className={`flex items-center justify-center gap-1.5 w-[88px] px-3 py-1.5 border rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
          ${isCancelled
            ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
            : 'bg-white border-gray-200 text-gray-500 hover:border-rose-400 hover:text-rose-600'
          }
        `}
      >
        {loadingOutcome === 'cancelled' 
            ? <Loader2 className="animate-spin" size={12} /> 
            : <X size={12} />
        }
        <span>已取消</span>
      </button>
    </div>
  );
}
