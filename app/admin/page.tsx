
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
  Zap,
  BarChart3,
  Layers
} from 'lucide-react';
import { subDays, addHours, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import Link from 'next/link';
import DashboardSummaryFilter from './DashboardSummaryFilter';

export const dynamic = 'force-dynamic';

async function getConsoleData(range: string) {
  const supabase = await createClient();
  const now = new Date();
  const twentyFourHoursLater = addHours(now, 24);

  // Calculate Date Range for Filtered Section
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
    // Filtered Stats
    newUsersRes,
    newDemosRes,
    newRunsRes,
    // All-time Stats
    totalUsersRes,
    totalDemosRes,
    totalRunsRes
  ] = await Promise.all([
    // 1. A-1: Pending Demo Requests (Only fetch what is needed for Action)
    supabase
      .from('demo_requests')
      .select('id, created_at, demo_appointments!inner(scheduled_at)')
      .eq('status', 'pending'),

    // 2. B-2: Failed Tasks (System Alerts)
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
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', rangeStartIso).lte('created_at', rangeEndIso),
    supabase.from('demo_requests').select('id', { count: 'exact', head: true }).gte('created_at', rangeStartIso).lte('created_at', rangeEndIso),
    supabase.from('delivery_task_runs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('finished_at', rangeStartIso).lte('finished_at', rangeEndIso),

    // 5. Total Stats (All-time)
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('demo_requests').select('id', { count: 'exact', head: true }),
    supabase.from('delivery_task_runs').select('id', { count: 'exact', head: true }).eq('status', 'success'),
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
    overview: {
      range: range,
      // Filtered
      filtered: {
        users: newUsersRes.count || 0,
        demos: newDemosRes.count || 0,
        deliveries: newRunsRes.count || 0,
        reached: null // Placeholder
      },
      // Total
      total: {
        users: totalUsersRes.count || 0,
        demos: totalDemosRes.count || 0,
        deliveries: totalRunsRes.count || 0,
        reached: null // Placeholder
      }
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
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">概览 (Dashboard)</h1>
        <p className="text-sm text-gray-500 mt-1">
          行动优先 · 状态次之 · 数据最后
        </p>
      </div>

      {/* SECTION 1: OVERVIEW (Split Structure) */}
      <section className="space-y-6">
        
        {/* 1.1 All-time Total (Static) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-gray-900"></div>
            数据总览 · 历史累计 (All-time)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Users size={12} /> 注册用户 (累计)</div>
              <div className="text-2xl font-semibold text-gray-900">{data.overview.total.users}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Calendar size={12} /> 演示申请 (累计)</div>
              <div className="text-2xl font-semibold text-gray-900">{data.overview.total.demos}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Send size={12} /> 内容分发 (累计)</div>
              <div className="text-2xl font-semibold text-gray-900">{data.overview.total.deliveries}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 relative overflow-hidden">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><Layers size={12} /> 触达用户 (累计)</div>
              <div className="text-2xl font-semibold text-gray-300">—</div>
              <span className="absolute top-3 right-3 text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded border border-gray-200">待接入</span>
            </div>
          </div>
        </div>

        {/* 1.2 Filtered Range */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-300"></div>
              区间统计 (Filtered)
            </h2>
            <DashboardSummaryFilter />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1">新增注册</div>
              <div className="text-xl font-medium text-gray-700">{data.overview.filtered.users}</div>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1">新增申请</div>
              <div className="text-xl font-medium text-gray-700">{data.overview.filtered.demos}</div>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="text-xs text-gray-500 mb-1">完成分发</div>
              <div className="text-xl font-medium text-gray-700">{data.overview.filtered.deliveries}</div>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors relative">
              <div className="text-xs text-gray-500 mb-1">区间触达</div>
              <div className="text-xl font-medium text-gray-300">—</div>
            </div>
          </div>
        </div>

      </section>

      <hr className="border-gray-100" />

      {/* SECTION 2: SPLIT VIEW (Action & Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* LEFT COLUMN: A. ACTION REQUIRED */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            演示申请跟进 (Action)
          </h2>

          <div className="space-y-4">
            
            {/* A-1: Demo Requests Action Card */}
            <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${data.actionRequired.demos.total === 0 ? 'bg-white border-gray-200' : 'bg-white border-amber-200 ring-1 ring-amber-100'}`}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Clock className="text-gray-900" size={20} />
                  <span className="font-semibold text-gray-900">待处理申请</span>
                </div>
                {data.actionRequired.demos.total > 0 && (
                  <Link href="/admin/demo-requests?status=pending" className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                    处理全部 <ArrowRight size={12} />
                  </Link>
                )}
              </div>
              
              <div className="p-6 flex-1 flex flex-col justify-center">
                {data.actionRequired.demos.total === 0 ? (
                  // Empty State: Simple Message
                  <div className="text-center py-4">
                    <p className="text-sm font-medium text-gray-400 flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} /> 当前没有待处理的演示申请
                    </p>
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

                    <div className="flex items-center justify-between px-3 pt-2">
                      <span className="text-sm text-gray-500">常规待处理</span>
                      <span className="text-sm font-medium text-gray-900">{data.actionRequired.demos.total}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: B. SYSTEM STATUS */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            分发任务监控 (Monitoring)
          </h2>

          <div className="bg-white rounded-xl border border-gray-200 p-1">
            <div className="flex flex-col p-4 gap-4">
              
              {/* Running Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${data.systemStatus.runningTasksCount > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                    {data.systemStatus.runningTasksCount > 0 ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">运行中任务 (Running)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">自动/手动触发的 Email 任务</p>
                  </div>
                </div>
                <div className="text-right">
                   {data.systemStatus.runningTasksCount > 0 ? (
                      <span className="text-lg font-bold text-indigo-600">{data.systemStatus.runningTasksCount}</span>
                   ) : (
                      <span className="text-sm text-gray-400">0</span>
                   )}
                </div>
              </div>

              <div className="h-px bg-gray-50 w-full"></div>

              {/* Failed Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${hasSystemAlerts ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">异常任务 (Failed)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">最近一次执行失败的任务</p>
                  </div>
                </div>
                <div className="text-right">
                   {hasSystemAlerts ? (
                      <Link href="/admin/delivery?status=failed" className="text-lg font-bold text-red-600 hover:underline">
                        {data.actionRequired.systemAlerts.failedTasksCount}
                      </Link>
                   ) : (
                      <span className="text-sm text-gray-400">0</span>
                   )}
                </div>
              </div>

              {/* Empty State / Status Text */}
              {!hasSystemAlerts && data.systemStatus.runningTasksCount === 0 && (
                 <div className="mt-2 pt-3 border-t border-dashed border-gray-100 text-center">
                    <span className="text-xs text-gray-400">当前无运行中的分发任务</span>
                 </div>
              )}

            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
