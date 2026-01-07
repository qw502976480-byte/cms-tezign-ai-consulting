import React from 'react';
import TaskForm from '../task-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { DeliveryTask } from '@/types';

export const dynamic = 'force-dynamic';

export default async function EditDeliveryPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('delivery_tasks')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return <div>Task not found</div>;
  }

  const task = data as DeliveryTask;

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
      
      <TaskForm initialData={task} />
    </div>
  );
}