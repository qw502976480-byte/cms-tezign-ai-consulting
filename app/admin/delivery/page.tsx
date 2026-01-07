import React from 'react';
import { createClient } from '@/utils/supabase/server';
import TaskClientView from './client-view';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DeliveryTask } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DeliveryListPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const supabase = await createClient();

  // Filter Logic
  let query = supabase
    .from('delivery_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  if (searchParams.type && searchParams.type !== 'all') {
    query = query.eq('type', searchParams.type);
  }

  if (searchParams.channel && searchParams.channel !== 'all') {
    query = query.eq('channel', searchParams.channel);
  }

  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded-lg border border-red-100">
        Error loading delivery tasks: {error.message}
      </div>
    );
  }

  const tasks = data as DeliveryTask[];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">内容分发 (Delivery)</h1>
          <p className="text-sm text-gray-500 mt-1">
            以“分发任务”为中心管理内容触达。
          </p>
        </div>
        <Link 
          href="/admin/delivery/new"
          className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> 新建任务
        </Link>
      </div>

      <TaskClientView initialTasks={tasks} />
    </div>
  );
}