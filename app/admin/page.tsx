
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { 
  AlertTriangle, 
  Clock, 
  Activity, 
  CheckCircle2, 
  ArrowRight, 
  Calendar,
  Users,
  Send,
  AlertCircle,
  Loader2,
  Zap
} from 'lucide-react';
import { subDays, addHours, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import Link from 'next/link';
import DashboardSummaryFilter from './DashboardSummaryFilter';

export const dynamic = 'force-dynamic';

async function getConsoleData(range: string) {
  const supabase = await createClient();
  const now = new Date();
  const twentyFourHoursLater = addHours(now, 24);

  // Calculate Date Range for Section C
  let rangeStart = subDays(now, 7);
  if (range === 'today') rangeStart = now;
  if (range === '30d') rangeStart = subDays(now, 30);
  
  const rangeStartIso = startOfDay(rangeStart).toISOString();
  const rangeEndIso = endOfDay(now).toISOString();

  // --- Parallel Data Fetching ---
  const [
    pendingRequestsRes,
    failedTasksRes,
    runningRunsRes,
    recentStatsRes
  ] = await Promise.all([
    // 1. A-1: Pending Demo Requests (Only fetch what is needed for Action)
    supabase
      .from('demo_requests')
      .select('id, created_at, demo_appointments!inner(scheduled_at)')
      .eq('status', 'pending'),

    // 2. A-2: Failed Tasks (System Alerts)
    supabase
      .from('delivery_tasks')
      .select('id')
      .eq('last_run_status', 'failed'),

    // 3. B-1: Running Tasks (System Status)
    supabase
      .from('delivery_task_runs')
      .select('id')
      .eq('status', 'running'),

    // 4. C: Summary Data (Dynamic Range)
    Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', rangeStartIso).lte('created_at', rangeEndIso),
      supabase.from('demo_requests').select('id', { count: 'exact', head: true }).gte('created_at', rangeStartIso).lte('created_at', rangeEndIso),
      supabase.from('delivery_task_runs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('finished_at', rangeStartIso).lte('finished_at', rangeEndIso)
    ])
  ]);

  // --- Process A-1: Demo Urgency ---
  const pendingRequests = pendingRequestsRes.data || [];
  let overdueCount = 0;
  let soonCount = 0; // Within 24h
  let normalCount = 0;

  pendingRequests.forEach((req: any) => {
    // demo_appointments is an array due to 1:M relation, but we typically care about the latest active one
    const appt = Array.isArray(req.demo_appointments) ? req.demo_appointments[0] : req.demo_appointments;
    
    if (appt && appt.scheduled_at) {
      const scheduledTime = parseISO(appt.scheduled_at);
      if (isBefore(scheduledTime, now)) {
        overdueCount++;
      } else if (isBefore(scheduledTime, twentyFourHoursLater)) {
        soonCount++;
      } else {
        normalCount++;
      }
    } else {
      normalCount++;
    }
  });

  return {
    actionRequired: {
      demos: {
        total: pendingRequests.length,
        overdue: overdueCount,
        soon: soonCount,
        normal: normalCount
      },
      systemAlerts: {
        failedTasksCount: failedTasksRes.data?.length || 0
      }
    },
    systemStatus: {
      runningTasksCount: runningRunsRes.data?.length || 0,
    },
    recentSummary: {
      range: range,
      newUsers: recentStatsRes[0].count || 0,
      newDemos: recentStatsRes[1].count || 0,
      successfulRuns: recentStatsRes[2].count || 0
    }
  };
}

export default async function AdminDashboard({ searchParams }: { searchParams: { summary_range?: string } }) {
  const range = searchParams.summary_range || '7d';
  const data = await getConsoleData(range);
  const hasSystemAlerts = data.actionRequired.systemAlerts.failedTasksCount > 0;

  return (
    <div className="space-y-8 max-w-7xl">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">行动控制台 (Action Console)</h1>
        <p className="text-sm text-gray-500 mt-1">
          行动优先 · 状态次之 · 数据最后
        </p>
      </div>

      {/* SECTION 1: OVERVIEW (Formerly C, now Top) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-900"></div>
                数据总览 (Overview)
            </h2>
            <DashboardSummaryFilter />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/registered-users" className="bg-white p-5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors block group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users size={14} />
                    <span>新注册用户</span>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{data.recentSummary.newUsers}</p>
          </Link>

          <Link href="/admin/demo-requests" className="bg-white p-5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors block group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={14} />
                    <span>新增演示申请</span>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{data.recentSummary.newDemos}</p>
          </Link>

          <Link href="/admin/delivery" className="bg-white p-5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors block group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Send size={14} />
                    <span>完成分发批次</span>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{data.recentSummary.successfulRuns}</p>
          </Link>
        </div>
      </section>

      {/* SECTION 2: SPLIT VIEW (Action & Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* LEFT COLUMN: A. ACTION REQUIRED */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            A. 需要立刻处理 (Action Required)
          </h2>

          <div className="space-y-4">
            
            {/* A-1: Demo Requests Action Card */}
            <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${data.actionRequired.demos.total === 0 ? 'bg-white border-gray-200' : 'bg-white border-amber-200 ring-1 ring-amber-100'}`}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Clock className="text-gray-900" size={20} />
                  <span className="font-semibold text-gray-900">演示申请跟进</span>
                </div>
                {data.actionRequired.demos.total > 0 && (
                  <Link href="/admin/demo-requests?status=pending" className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                    处理全部 <ArrowRight size={12} />
                  </Link>
                )}
              </div>
              
              <div className="p-6 flex-1 flex flex-col justify-center">
                {data.actionRequired.demos.total === 0 ? (
                  // Empty State: Success Message
                  <div className="text-center py-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-3">
                      <CheckCircle2 size={24} className="text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">当前没有需要处理的演示申请</p>
                    <p className="text-xs text-gray-400 mt-1">Good job! 所有申请均已处理完毕。</p>
                  </div>
                ) : (
                  // Action Required State
                  <div className="space-y-3">
                    {data.actionRequired.demos.overdue > 0 && (
                      <Link href="/admin/demo-requests?status=pending&time_status=overdue" className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg group hover:border-red-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="text-red-600" size={18} />
                          <span className="text-sm font-medium text-red-900">已逾期未处理</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-red-700">{data.actionRequired.demos.overdue}</span>
                          <ArrowRight size={14} className="text-red-300 group-hover:text-red-500 transition-colors" />
                        </div>
                      </Link>
                    )}

                    {data.actionRequired.demos.soon > 0 && (
                      <Link href="/admin/demo-requests?status=pending&time_status=near_24h" className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg group hover:border-amber-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <Clock className="text-amber-600" size={18} />
                          <span className="text-sm font-medium text-amber-900">即将到期 (24h内)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-amber-700">{data.actionRequired.demos.soon}</span>
                          <ArrowRight size={14} className="text-amber-300 group-hover:text-amber-500 transition-colors" />
                        </div>
                      </Link>
                    )}

                    <div className="flex items-center justify-between px-3 pt-2">
                      <span className="text-sm text-gray-500">常规待处理</span>
                      <span className="text-sm font-medium text-gray-900">{data.actionRequired.demos.normal}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* A-2: System Alerts (Strict Conditional Rendering) */}
            {hasSystemAlerts && (
              <div className="bg-red-600 rounded-xl border border-red-700 shadow-sm overflow-hidden text-white flex flex-col animate-in fade-in slide-in-from-bottom-2">
                <div className="p-5 flex items-center gap-2 border-b border-red-500/30">
                  <AlertTriangle className="text-white" size={20} />
                  <span className="font-semibold">系统异常警报</span>
                </div>
                <div className="p-6 flex-1">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{data.actionRequired.systemAlerts.failedTasksCount}</span>
                    <span className="text-red-100 ml-2 text-sm">个任务执行失败</span>
                  </div>
                  <p className="text-red-100 text-xs mb-6 leading-relaxed opacity-90">
                    自动化分发任务出现异常。这可能是由于配置错误或网络问题导致的。请立即检查。
                  </p>
                  <Link 
                    href="/admin/delivery?status=failed"
                    className="inline-flex items-center justify-center w-full bg-white text-red-600 px-4 py-3 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
                  >
                    去修复异常
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: B. SYSTEM STATUS */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            B. 系统运行状态 (System Status)
          </h2>

          <div className="bg-white rounded-xl border border-gray-200 p-1">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${data.systemStatus.runningTasksCount > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                  {data.systemStatus.runningTasksCount > 0 ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <Activity size={24} />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      分发任务引擎
                      {data.systemStatus.runningTasksCount === 0 && (
                          <span className="text-[10px] font-normal text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={10} /> 运行正常
                          </span>
                      )}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {data.systemStatus.runningTasksCount > 0 
                      ? `当前有 ${data.systemStatus.runningTasksCount} 个任务正在执行中...` 
                      : '当前空闲 (Idle)'}
                  </p>
                </div>
              </div>
              {/* Read-only status indicator, no actions */}
              <div className="flex items-center gap-3 pr-2">
                {data.systemStatus.runningTasksCount > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Zap size={12} className="mr-1 fill-indigo-700" /> Processing
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
                    Standing By
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
