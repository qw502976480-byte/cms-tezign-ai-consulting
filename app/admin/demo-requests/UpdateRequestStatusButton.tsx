
'use client';

import { useState, useRef, useEffect } from 'react';
import { DemoRequest, DemoRequestOutcome } from '@/types';
import { Loader2, ChevronDown, CheckCircle2, XCircle, Minus, Check, Circle } from 'lucide-react';

interface Props {
  request: DemoRequest;
  onUpdate: (id: string, outcome: DemoRequestOutcome) => Promise<void>;
}

export default function RequestActions({ request, onUpdate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Current value logic
  const currentOutcome = request.outcome; // 'completed' | 'cancelled' | null

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (val: string) => {
    const targetOutcome = val as DemoRequestOutcome;
    setIsOpen(false);
    if (targetOutcome === request.outcome) return;

    setLoading(true);
    try {
      await onUpdate(request.id, targetOutcome);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Visual Styles based on state (Trigger Button)
  const getTriggerStyle = () => {
    if (loading) return 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed';
    if (isOpen) return 'ring-1 ring-gray-900 border-gray-900 bg-white text-gray-900';

    if (currentOutcome === 'completed') {
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100';
    }
    if (currentOutcome === 'cancelled') {
        return 'bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-100';
    }
    
    // Default / NULL state
    return 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900';
  };

  const getIcon = () => {
      if (loading) return <Loader2 className="animate-spin" size={14} />;
      if (currentOutcome === 'completed') return <CheckCircle2 size={14} className="shrink-0" />;
      if (currentOutcome === 'cancelled') return <XCircle size={14} className="shrink-0" />;
      return <Circle size={14} className={`shrink-0 ${isOpen ? 'text-gray-900' : 'text-gray-400'}`} />;
  };

  const getLabel = () => {
      if (loading) return '处理中...';
      if (currentOutcome === 'completed') return '已完成';
      if (currentOutcome === 'cancelled') return '已取消';
      return '选择结果'; 
  }

  // Options configuration
  const options = [
      { value: 'completed', label: '已完成', icon: CheckCircle2, colorClass: 'text-emerald-600' },
      { value: 'cancelled', label: '已取消', icon: XCircle, colorClass: 'text-rose-600' },
  ];

  return (
    <div className="relative inline-block w-[120px]" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={loading}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3 py-1.5 border rounded-md text-xs font-medium transition-all duration-200 ${getTriggerStyle()}`}
      >
         <div className="flex items-center gap-2 truncate">
            {getIcon()}
            <span>{getLabel()}</span>
         </div>
         <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'opacity-50'}`} />
      </button>

      {/* Custom Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
            {options.map((opt) => {
                const isSelected = String(currentOutcome) === opt.value;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors text-left mb-0.5 last:mb-0
                            ${isSelected 
                                ? 'bg-gray-50 text-gray-900 font-medium' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                    >
                        <div className="flex items-center gap-2">
                            <Icon size={14} className={opt.colorClass} />
                            <span>{opt.label}</span>
                        </div>
                        {isSelected && <Check size={12} className="text-gray-900" />}
                    </button>
                );
            })}
        </div>
      )}
    </div>
  );
}
