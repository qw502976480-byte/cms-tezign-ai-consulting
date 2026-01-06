
'use client';

import { useState, useRef, useEffect } from 'react';
import { DemoRequest, DemoRequestOutcome } from '@/types';
import { Loader2, Check, X, ChevronDown, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface Props {
  request: DemoRequest;
  onUpdate: (id: string, outcome: DemoRequestOutcome) => Promise<void>;
}

// Map outcome to display properties
const outcomeMap = {
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-600',
  },
  cancelled: {
    label: '已取消',
    icon: XCircle,
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    iconColor: 'text-rose-600',
  },
  default: {
    label: '选择结果',
    icon: HelpCircle,
    className: 'bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300',
    iconColor: 'text-gray-500',
  }
};

export default function RequestActions({ request, onUpdate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (targetOutcome: DemoRequestOutcome) => {
    // Prevent action if already loading or selecting the same outcome
    if (isLoading || request.outcome === targetOutcome) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(false);
    try {
      await onUpdate(request.id, targetOutcome);
    } catch (e) {
      console.error(e);
      // Feedback is handled by parent component
    } finally {
      setIsLoading(false);
    }
  };

  const currentOutcome = request.outcome ? outcomeMap[request.outcome] : outcomeMap.default;
  const CurrentIcon = currentOutcome.icon;

  return (
    <div className="relative w-32" ref={dropdownRef}>
      {isLoading ? (
        <div className="flex items-center justify-center px-3 py-1.5 text-gray-500 h-[30px]">
          <Loader2 className="animate-spin" size={16} />
        </div>
      ) : (
        <>
          {/* Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center justify-between w-full px-3 py-1.5 border rounded-full text-xs font-medium transition-all duration-200 ${currentOutcome.className}`}
          >
            <div className="flex items-center gap-1.5">
              <CurrentIcon size={14} className={currentOutcome.iconColor} />
              <span>{currentOutcome.label}</span>
            </div>
            <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-10 p-1 animate-in fade-in zoom-in-95 origin-top">
              <button
                onClick={() => handleSelect('completed')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-md transition-colors"
              >
                <Check size={14} />
                <span>已完成</span>
              </button>
              <button
                onClick={() => handleSelect('cancelled')}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-800 rounded-md transition-colors"
              >
                <X size={14} />
                <span>已取消</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}