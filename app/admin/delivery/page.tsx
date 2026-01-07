
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import TaskClientView from './client-view';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DeliveryTask, EmailSendingAccount, EmailTemplate, DeliveryRun } from '@/types';
import { subMinutes, isBefore } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function DeliveryListPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const supabase = await createClient();
  const now = new Date();

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

  // Fetch Tasks, Configs, and Runs concurrently
  // Note: Fetching all runs might be heavy in production, but suitable for this MVP scope.
  const [tasksRes, accountsRes, templatesRes, runsRes] = await Promise.all([
      query,
      supabase.from('email_sending_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('email_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('delivery_task_runs').select('id, task_id, status, started_at, success_count, recipient_count, message').order('started_at', { ascending: false })
  ]);

  if (tasksRes.error) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded-lg border border-red-100">
        Error loading delivery tasks: {tasksRes.error.message}
      </div>
    );
  }

  const tasks = tasksRes.data as DeliveryTask[];
  const accounts = (accountsRes.data || []) as EmailSendingAccount[];
  const templates = (templatesRes.data || []) as EmailTemplate[];
  const allRuns = (runsRes.data || []) as DeliveryRun[];

  // Process latest run and active runs
  const latestRunMap: Record<string, DeliveryRun> = {};
  const runningTaskIds = new Set<string>();

  allRuns.forEach(run => {
    // Collect active runs (authority) with stale check
    if (run.status === 'running' && !isBefore(new Date(run.started_at), subMinutes(now, 15))) {
        runningTaskIds.add(run.task_id);
    }
    // Since runs are ordered by started_at desc, the first one encountered for a task_id is the latest
    if (!latestRunMap[run.task_id]) {
        latestRunMap[run.task_id] = run;
    }
  });

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

      <TaskClientView 
        initialTasks={tasks} 
        emailAccounts={accounts} 
        emailTemplates={templates} 
        latestRunMap={latestRunMap}
        runningTaskIds={Array.from(runningTaskIds)}
      />
    </div>
  );
}
