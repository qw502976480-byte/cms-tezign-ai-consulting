'use client';

import { useState } from 'react';
import { DemoRequest, DemoRequestOutcome } from '@/types';
import { Loader2, ChevronDown, CheckCircle2, XCircle, CircleDashed } from 'lucide-react';

interface Props {
  request: DemoRequest;
  onUpdate: (id: string, outcome: DemoRequestOutcome) => Promise<void>;
}

export default function RequestActions({ request, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  // Current value logic
  const currentOutcome = request.outcome || 'null'; // 'completed' | 'cancelled' | 'null'

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    const targetOutcome = newVal === 'null' ? null : (newVal as DemoRequestOutcome);
    
    // Prevent redundant updates
    if (targetOutcome === request.outcome) return;

    setLoading(true);
    try {
      await onUpdate(request.id, targetOutcome);
    } catch (e) {
      // Error handling is done in parent, but we stop loading here if needed
    } finally {
      setLoading(false);
    }
  };

  // Visual Styles based on state
  const getContainerStyle = () => {
    if (currentOutcome === 'completed') return 'bg-green-50 border-green-200 text-green-700';
    if (currentOutcome === 'cancelled') return 'bg-gray-100 border-gray-200 text-gray-500';
    return 'bg-white border-gray-300 text-gray-700 hover:border-gray-400';
  };

  const getIcon = () => {
      if (loading) return <Loader2 className="animate-spin text-gray-400" size={14} />;
      if (currentOutcome === 'completed') return <CheckCircle2 size={14} />;
      if (currentOutcome === 'cancelled') return <XCircle size={14} />;
      return <CircleDashed size={14} className="text-gray-400" />;
  };

  return (
    <div className="relative inline-block w-36">
      {/* Visual Facade */}
      <div className={`flex items-center justify-between px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${getContainerStyle()}`}>
         <div className="flex items-center gap-2 truncate">
            {getIcon()}
            <span>
                {currentOutcome === 'completed' && '已完成'}
                {currentOutcome === 'cancelled' && '已取消'}
                {currentOutcome === 'null' && '待处理'}
            </span>
         </div>
         {!loading && <ChevronDown size={12} className="opacity-50" />}
      </div>

      {/* Invisible Select Overlay for interaction */}
      <select
        value={currentOutcome}
        onChange={handleChange}
        disabled={loading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        title="更改沟通结果"
      >
        <option value="null">待处理 (未结果)</option>
        <option value="completed">已完成沟通</option>
        <option value="cancelled">已取消沟通</option>
      </select>
    </div>
  );
}
