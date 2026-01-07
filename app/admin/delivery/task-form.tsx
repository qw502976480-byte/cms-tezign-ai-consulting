'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDeliveryTask } from './actions';
import { DeliveryTaskType, DeliveryChannel } from '@/types';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="例如：2024 Q1 行业报告推送"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">任务类型</label>
            <select 
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as DeliveryTaskType }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="automated">自动化 (Automated)</option>
              <option value="one_off">临时任务 (One-off)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分发渠道</label>
            <select 
              value={formData.channel}
              onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value as DeliveryChannel }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="email">邮件 (Email)</option>
              <option value="in_app">站内信 (In-App)</option>
            </select>
          </div>
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