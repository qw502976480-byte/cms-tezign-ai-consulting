'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createDeliveryTask } from './actions';
import { DeliveryTaskType, DeliveryChannel } from '@/types';
import { Loader2, ArrowLeft, Save, ChevronDown, Check } from 'lucide-react';
import Link from 'next/link';

function CustomSelect({ 
  label, 
  value, 
  onChange, 
  options 
}: { 
  label: string; 
  value: string; 
  onChange: (value: any) => void; 
  options: { value: string; label: string; }[] 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left px-3 py-2 border rounded-lg flex items-center justify-between transition-all duration-200 bg-white ${isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <span className="text-sm text-gray-900">{selectedOption?.label || value}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-100 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {options.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-500 text-white' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 flex items-center justify-center ${isSelected ? 'text-white' : 'opacity-0'}`}>
                        <Check size={14} />
                    </div>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: '',
    type: 'automated' as DeliveryTaskType,
    channel: 'email' as DeliveryChannel,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('请输入任务名称');

    startTransition(async () => {
      const res = await createDeliveryTask({
        ...formData,
        status: 'draft',
        content_mode: 'manual'
      });

      if (res.success) {
        router.push('/admin/delivery');
        router.refresh();
      } else {
        alert(`创建失败: ${res.error}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            任务名称 <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
            placeholder="例如：2024 Q1 行业报告推送"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CustomSelect 
            label="任务类型"
            value={formData.type}
            onChange={(val) => setFormData(prev => ({ ...prev, type: val as DeliveryTaskType }))}
            options={[
                { value: 'automated', label: '自动化 (Automated)' },
                { value: 'one_off', label: '临时任务 (One-off)' }
            ]}
          />

          <CustomSelect 
            label="分发渠道"
            value={formData.channel}
            onChange={(val) => setFormData(prev => ({ ...prev, channel: val as DeliveryChannel }))}
            options={[
                { value: 'email', label: '邮件 (Email)' },
                { value: 'in_app', label: '站内信 (In-App)' }
            ]}
          />
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
        <Link href="/admin/delivery" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">
          取消
        </Link>
        <button 
          type="submit" 
          disabled={isPending}
          className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          保存草稿
        </button>
      </div>
    </form>
  );
}