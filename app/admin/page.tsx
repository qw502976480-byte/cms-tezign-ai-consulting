
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
  Layers,
  LayoutDashboard,
  Globe,
  Eye,
  MousePointerClick
} from 'lucide-react';
import { subDays, addHours, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import Link from 'next/link';
import DashboardSummaryFilter from './DashboardSummaryFilter';

export const dynamic = 'force-dynamic';

async function getConsoleData(range: string, customStart?: string, customEnd?: string) {
  const supabase = await createClient();
  const now = new Date();
  const twentyFourHoursLater = addHours(now, 24);

  // --- Calculate Date Range for Filtered Section ---
  let rangeStart = subDays(now, 7);
  let rangeEnd = endOfDay(now);

  if (range === 'custom' && customStart && customEnd) {
      rangeStart = startOfDay(new Date(customStart));
      rangeEnd = endOfDay(new Date(customEnd));
  } else if (range === 'today') {
      rangeStart = startOfDay(now);
  } else if (range === '30d') {
      rangeStart = subDays(now, 30);
  }
  
  const rangeStartIso = rangeStart.toISOString();
  const rangeEndIso = rangeEnd.toISOString();

  // --- Parallel Data Fetching ---
  const [
    // 1. Action: Pending Demo Requests
    pendingRequestsRes,
    
    // 2. Monitoring: Failed Tasks
    failedTasksRes,
    
    // 3. Monitoring: Running Tasks
    runningRunsRes,
    
    // 4. Filtered Stats (Row 2)
    filteredUsersRes,
    filteredDemosRes,
    filteredRunsRes,
    
    // 5. Total Stats (Row 1 - All-time)
    totalUsersRes,
    totalDemosRes,
    totalRunsRes
  ] = await Promise.all([
    // Action
    supabase.from('demo_requests').select('id, created_at, demo_appointments!inner(scheduled_at)').eq('status', 'pending'),
    // Monitoring
    supabase.from('delivery_tasks').select('id').eq('last_run_status', 'failed'),
    supabase.from('delivery_task_runs').select('id').eq('status', 'running'),
    
    // Filtered (Time Range)
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', rangeStartIso).lte('created_at', rangeEndIso),
    supabase.from('demo_requests').select('id', { count: 'exact', head: true }).gte('created_at', rangeStartIso).lte('created_at', rangeEndIso),
    supabase.from('delivery_task_runs').select('id', { count: 'exact', head: true }).eq('status', 'success').gte('finished_at', rangeStartIso).lte('finished_at', rangeEndIso),

    // Total (All-time)
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('demo_requests').select('id', { count: 'exact', head: true }),
    supabase.from('delivery_task_runs').select('id', { count: 'exact', head: true }).eq('status', 'success'),
  ]);

  // --- Process Action Data: Demo Urgency ---
  const pendingRequests = pendingRequestsRes.data || [];
  let overdueCount = 0;
  let soonCount = 0;
  let normalCount = 0;

  pendingRequests.forEach((req: any) => {
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
      normalCount++; // Pending but no appointment scheduled yet (or join failed)
    }
  });

  return {
    action: {
      demos: {
        total: pendingRequests.length,
        overdue: overdueCount,
        soon: soonCount,
        normal: normalCount
      }
    },
    monitoring: {
      running: runningRunsRes.data?.length || 0,
      failed: failedTasksRes.data?.length || 0
    },
    overview: {
      range: range,
      customLabel: range === 'custom' && customStart && customEnd ? `${customStart} ~ ${customEnd}` : null,
      filtered: {
        users: filteredUsersRes.count || 0,
        demos: filteredDemosRes.count || 0,
        deliveries: filteredRunsRes.count || 0,
      },
      total: {
        users: totalUsersRes.count || 0,
        demos: totalDemosRes.count || 0,
        deliveries: totalRunsRes.count || 0,
      }
    }
  };
}

export default async function AdminDashboard({ searchParams }: { searchParams: { summary_range?: string; summary_start?: string; summary_end?: string } }) {
  const range = searchParams.summary_range || '7d';
  const data = await getConsoleData(range, searchParams.summary_start, searchParams.summary_end);

  const hasAction = data.action.demos.total > 0;
  const hasIssues = data.monitoring.failed > 0;

  return (
    <div className="space-y-8 max-w-7xl">
      
      {/* PAGE HEADER */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-6">
        <div className="p-2 bg-gray-900 rounded-lg text-white">
            <LayoutDashboard size={24} />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">行动控制台 (Action Console)</h1>
            <p className="text-sm text-gray-500 mt-0.5">
            先看全量 · 再看区间 · 最后行动
            </p>
        </div>
      </div>

      {/* SECTION 1: DATA OVERVIEW */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-4 bg-gray-900 rounded-full"></div>
                1. 数据总览 (Overview)
            </h2>
        </div>

        <div className="space-y-4">
            {/* Row 1: All-time (Total) */}
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">历史累计 (ALL-TIME)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '注册用户 (累计)', value: data.overview.total.users, icon: Users },
                    { label: '演示申请 (累计)', value: data.overview.total.demos, icon: Calendar },
                    { label: '内容分发 (累计完成)', value: data.overview.total.deliveries, icon: Send },
                    { label: '触达用户 (累计)', value: '—', icon: Layers, isPlaceholder: true },
                    
                    // Website Data Placeholders
                    { label: '官网访问量 (累计)', value: '—', icon: Globe, isPlaceholder: true },
                    { label: '官网内容浏览 (累计)', value: '—', icon: Eye, isPlaceholder: true },
                    { label: '官网转化点击 (累计)', value: '—', icon: MousePointerClick, isPlaceholder: true },
                ].map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between h-28 relative overflow-hidden group hover:border-gray-300 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                <item.icon size={14} />
                                {item.label}
                            </div>
                            {item.isPlaceholder && (
                                <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded border border-gray-300">待接入</span>
                            )}
                        </div>
                        <div className={`text-3xl font-bold ${item.isPlaceholder ? 'text-gray-300' : 'text-gray-900'}`}>
                            {item.value}
                        </div>
                        <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                            <item.icon size={64} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Row 2: Filtered (Range) */}
            <div className="pt-2"></div>
            <div className="bg-white rounded-xl border border-gray-200 p-1">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-indigo-600" />
                        <span className="text-sm font-semibold text-gray-900">区间统计 (Filtered)</span>
                        {data.overview.customLabel && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                {data.overview.customLabel}
                            </span>
                        )}
                    </div>
                    <DashboardSummaryFilter />
                </div>
                
                {/* Changed to grid-cols to handle wrapping gracefully */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 border-collapse">
                    {[
                        { label: '新增注册用户', value: data.overview.filtered.users },
                        { label: '新增演示申请', value: data.overview.filtered.demos },
                        { label: '完成分发次数', value: data.overview.filtered.deliveries },
                        { label: '区间触达用户', value: '—', isPlaceholder: true },
                        
                        // Website Data Placeholders
                        { label: '官网访问量 (区间)', value: '—', isPlaceholder: true },
                        { label: '官网内容浏览 (区间)', value: '—', isPlaceholder: true },
                        { label: '官网转化点击 (区间)', value: '—', isPlaceholder: true },
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-5 flex flex-col items-center justify-center text-center hover:bg-gray-50/80 transition-colors relative">
                            {item.isPlaceholder && (
                                <span className="absolute top-2 right-2 text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100">待接入</span>
                            )}
                            <div className="text-xs text-gray-500 mb-2">{item.label}</div>
                            <div className={`text-2xl font-bold ${item.isPlaceholder ? 'text-gray-300' : 'text-indigo-600'}`}>
                                {item.value}
                            </div>
                        </div>
                    ))}
                    {/* Filler div to make grid even if needed, or let it flow naturally. Grid gap 1px with bg-gray-100 creates borders. */}
                </div>
            </div>
        </div>
      </section>

      {/* OPERATIONAL SECTION: ACTION & MONITORING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECTION 2: ACTION */}
        <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-4 bg-red-500 rounded-full"></div>
                2. 演示申请跟进 (Action)
            </h2>
            
            <div className={`h-full bg-white rounded-xl border p-5 flex flex-col ${hasAction ? 'border-red-200 shadow-sm ring-1 ring-red-50' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            待处理申请
                            {hasAction && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{data.action.demos.total}</span>}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">需要人工介入联系的潜在客户</p>
                    </div>
                    <Link href="/admin/demo-requests?status=pending" className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 hover:underline">
                        查看列表 <ArrowRight size={12} />
                    </Link>
                </div>

                {hasAction ? (
                    <div className="flex-1 flex flex-col gap-3">
                        {data.action.demos.overdue > 0 && (
                            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg text-red-700">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    <span className="text-sm font-medium">已逾期未处理</span>
                                </div>
                                <span className="text-lg font-bold">{data.action.demos.overdue}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg">
                            <span className="text-sm text-gray-600">常规待处理</span>
                            <span className="text-base font-semibold text-gray-900">{data.action.demos.normal + data.action.demos.soon}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 size={20} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400">当前无待处理演示申请</p>
                    </div>
                )}
            </div>
        </section>

        {/* SECTION 3: MONITORING */}
        <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                3. 分发任务监控 (Monitoring)
            </h2>

            <div className="h-full bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-bold text-gray-900">系统运行状态</h3>
                        <p className="text-xs text-gray-500 mt-1">分发引擎实时监控</p>
                    </div>
                    <Link href="/admin/delivery" className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 hover:underline">
                        管理任务 <ArrowRight size={12} />
                    </Link>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4">
                    {/* Running Status */}
                    <div className={`rounded-lg border p-4 flex flex-col justify-between ${data.monitoring.running > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {data.monitoring.running > 0 ? <Loader2 size={16} className="animate-spin text-indigo-600" /> : <Zap size={16} className="text-gray-400" />}
                            <span className={`text-xs font-bold uppercase tracking-wide ${data.monitoring.running > 0 ? 'text-indigo-700' : 'text-gray-500'}`}>Running</span>
                        </div>
                        <div className="flex items-end justify-between">
                            <span className={`text-2xl font-bold ${data.monitoring.running > 0 ? 'text-indigo-900' : 'text-gray-300'}`}>
                                {data.monitoring.running}
                            </span>
                            <span className="text-[10px] text-gray-400 mb-1">个任务</span>
                        </div>
                    </div>

                    {/* Failed Status */}
                    <Link 
                        href={hasIssues ? "/admin/delivery?status=failed" : "#"}
                        className={`rounded-lg border p-4 flex flex-col justify-between transition-all ${hasIssues ? 'bg-red-50 border-red-100 cursor-pointer hover:border-red-200 hover:shadow-sm' : 'bg-white border-gray-100 cursor-default'}`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={16} className={hasIssues ? "text-red-600" : "text-gray-300"} />
                            <span className={`text-xs font-bold uppercase tracking-wide ${hasIssues ? 'text-red-700' : 'text-gray-400'}`}>Failed</span>
                        </div>
                        <div className="flex items-end justify-between">
                            <span className={`text-2xl font-bold ${hasIssues ? 'text-red-700' : 'text-gray-200'}`}>
                                {data.monitoring.failed}
                            </span>
                            {hasIssues && <span className="text-[10px] text-red-400 mb-1">点击查看 &rarr;</span>}
                        </div>
                    </Link>
                </div>
                
                {!hasIssues && data.monitoring.running === 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                        <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                            <CheckCircle2 size={12} /> 系统空闲 / 运行正常
                        </span>
                    </div>
                )}
            </div>
        </section>

      </div>
    </div>
  );
}
