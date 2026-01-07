
import React from 'react';
import TaskForm from '../task-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { DeliveryTask, DeliveryRun } from '@/types';
import { preflightCheckDeliveryTask } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditDeliveryPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  
  const taskPromise = supabase
    .from('delivery_tasks')
    .select('*')
    .eq('id', params.id)
    .single();

  const runsPromise = supabase
    .from('delivery_task_runs')
    .select('*')
    .eq('task_id', params.id)
    .order('started_at', { ascending: false })
    .limit(20);

  const [taskRes, runsRes] = await Promise.all([taskPromise, runsPromise]);

  if (taskRes.error || !taskRes.data) {
    return <div>Task not found</div>;
  }
  
  const task = taskRes.data as DeliveryTask;
  const runs = (runsRes.data || []) as DeliveryRun[];
  
  // A) 强制调用 server action 获取权威的 has_active_run 状态
  const check = await preflightCheckDeliveryTask({ id: params.id });
  // `preflightCheckDeliveryTask` 在任务运行时会返回 `{ success: false, data: { has_active_run: true } }`
  // 我们只关心 `data.has_active_run` 的值
  const hasActiveRun = check.data?.has_active_run ?? false;

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/delivery" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">编辑分发任务</h1>
          <p className="text-sm text-gray-500">{task.name}</p>
        </div>
      </div>
      
      <TaskForm initialData={task} initialRuns={runs} hasActiveRun={hasActiveRun} />
    </div>
  );
}
