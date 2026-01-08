
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
  Loader2
} from 'lucide-react';
import { subDays, addHours, isBefore, isAfter, parseISO } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getConsoleData() {
  const supabase = await createClient();
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7).toISOString();
  const twentyFourHoursLater = addHours(now, 24);

  // --- Parallel Data Fetching ---
  const [
    pendingRequestsRes,
    failedTasksRes,
    runningRunsRes,
    recentStatsRes
  ] = await Promise.all([
    // 1. A-1: Pending Demo Requests (Need appointments to calc urgency)
    supabase
      .from('demo_requests')
      .select('id, created_at, demo_appointments!inner(scheduled_at)')
      .eq('status', 'pending'),

    // 2. A-2: Failed Tasks (System Alerts)
    supabase
      .from('delivery_tasks')
      .select('id, name, last_run_message')
      .eq('last_run_status', 'failed'),

    // 3. B-1: Running Tasks
    supabase
      .from('delivery_task_runs')
      .select('id, task_id')
      .eq('status', 'running'),

    // 4. C: Recent Summary (7 days)
    Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('demo_requests').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('delivery_task_runs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('finished_at', sevenDaysAgo)
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
      // Pending but no appointment scheduled yet
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
        failedTasks: failedTasksRes.data || []
      }
    },
    systemStatus: {
      runningTasksCount: runningRunsRes.data?.length || 0,
    },
    recentSummary: {
      newUsers: recentStatsRes[0].count || 0,
      newDemos: recentStatsRes[1].count || 0,
      successfulRuns: recentStatsRes[2].count || 0
    }
  };
}

export default async function AdminDashboard() {
  const data = await getConsoleData();
  const hasSystemAlerts = data.actionRequired.systemAlerts.failedTasks.length > 0;

  return (
    <div className="space-y-10 max-w-5xl">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">行动控制台 (Action Console)</h1>
        <p className="text-sm text-gray-500 mt-1">
          仅显示当前需要关注的事项与系统运行状态。
        </p>
      </div>

      {/* SECTION A: ACTION REQUIRED */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          A. 需要立刻处理 (Action Required)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* A-1: Demo Requests Action Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Clock className="text-gray-900" size={20} />
                <span className="font-semibold text-gray-900">演示申请跟进</span>
              </div>
              <Link href="/admin/demo-requests?status=pending" className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">
                处理全部 <ArrowRight size={12} />
              </Link>
            </div>
            
            <div className="p-6 flex-1 flex flex-col justify-center">
              {data.actionRequired.demos.total === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-green-100" />
                  <p className="text-sm">当前没有待处理的申请</p>
                </div>
              ) : (
                <div className="space-y-4">
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

                  <div className="flex items-center justify-between px-3 pt-1">
                    <span className="text-sm text-gray-500">常规待处理</span>
                    <span className="text-sm font-medium text-gray-900">{data.actionRequired.demos.normal}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* A-2: System Alerts (Conditional) */}
          {hasSystemAlerts ? (
            <div className="bg-red-600 rounded-xl border border-red-700 shadow-sm overflow-hidden text-white flex flex-col">
              <div className="p-5 flex items-center gap-2 border-b border-red-500/30">
                <AlertTriangle className="text-white" size={20} />
                <span className="font-semibold">系统异常警报</span>
              </div>
              <div className="p-6 flex-1">
                <div className="mb-4">
                  <span className="text-4xl font-bold">{data.actionRequired.systemAlerts.failedTasks.length}</span>
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
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 border-dashed flex flex-col items-center justify-center text-gray-400 p-6 min-h-[200px]">
              <CheckCircle2 size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">系统运行正常</p>
              <p className="text-xs opacity-60">暂无异常警报</p>
            </div>
          )}

        </div>
      </section>

      {/* SECTION B: SYSTEM STATUS */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          B. 系统运行状态 (System Status)
        </h2>

        <div className="bg-white rounded-xl border border-gray-200 p-1">
          <Link href="/admin/delivery" className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${data.systemStatus.runningTasksCount > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                {data.systemStatus.runningTasksCount > 0 ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <Activity size={24} />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">分发任务引擎</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.systemStatus.runningTasksCount > 0 
                    ? `当前有 ${data.systemStatus.runningTasksCount} 个任务正在执行中...` 
                    : '当前空闲，无正在执行的任务'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data.systemStatus.runningTasksCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Running
                </span>
              )}
              <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors" />
            </div>
          </Link>
        </div>
      </section>

      {/* SECTION C: RECENT SUMMARY */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          C. 近 7 天摘要 (Summary)
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <Link href="/admin/registered-users?reg_from=7d" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors block">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Users size={14} />
              <span>新注册用户</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{data.recentSummary.newUsers}</p>
          </Link>

          <Link href="/admin/demo-requests?reg_from=7d" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors block">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Calendar size={14} />
              <span>新增演示申请</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{data.recentSummary.newDemos}</p>
          </Link>

          <Link href="/admin/delivery" className="bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors block">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Send size={14} />
              <span>完成分发批次</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{data.recentSummary.successfulRuns}</p>
          </Link>
        </div>
      </section>

    </div>
  );
}
