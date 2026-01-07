import React from 'react';
import TaskForm from '../task-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NewDeliveryPage() {
  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/delivery" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">新建分发任务</h1>
          <p className="text-sm text-gray-500">配置受众、内容和执行计划</p>
        </div>
      </div>
      
      <TaskForm />
    </div>
  );
}