

import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { Users, PhoneForwarded, Clock, AreaChart, Calendar, UserCheck, Mail, User } from 'lucide-react';
import { subDays, format } from 'date-fns';
import Link from 'next/link';
import UpcomingAppointmentCountdown from './UpcomingAppointmentCountdown';
import { UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

interface UpcomingAppointment {
  scheduled_at: string;
  demo_requests: {
    id: string;
    name: string;
    email: string;
    user_id: string;
    user_profiles: UserProfile | null;
  }
}

async function getDashboardData() {
  const supabase = await createClient();
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7).toISOString();

  // 1. KPI Queries
  const [
    totalUsersResult,
    communicatedUsersResult,
    pendingDemosResult,
    recentDemosResult
  ] = await Promise.all([
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('demo_requests').select('user_id'),
    supabase.from('demo_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('demo_requests').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
  ]);

  const communicatedUsersCount = communicatedUsersResult.data 
    ? new Set(communicatedUsersResult.data.map(r => r.user_id)).size 
    : 0;
  
  const kpis = {
    totalUsers: totalUsersResult.count ?? 0,
    communicatedUsers: communicatedUsersCount,
    pendingDemos: pendingDemosResult.count ?? 0,
    recentDemos: recentDemosResult.count ?? 0,
  };

  // 2. Upcoming Appointments List Query
  const { data: upcomingAppointments, error: appointmentsError } = await supabase
    .from('demo_appointments')
    .select('scheduled_at, demo_requests!inner(id, name, email, user_id, user_profiles(*))')
    .eq('demo_requests.status', 'pending')
    .gt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  if (appointmentsError) {
    console.error("Error fetching upcoming appointments:", appointmentsError);
  }

  // Cast because Supabase returns a generic object for joined tables
  const typedAppointments = (upcomingAppointments as any[] || []) as UpcomingAppointment[];

  return { kpis, upcomingAppointments: typedAppointments };
}


function KpiCard({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 tracking-tight">{value}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <div className="p-2.5 bg-gray-50 text-gray-600 rounded-lg border border-gray-100">
          <Icon size={20} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const { kpis, upcomingAppointments } = await getDashboardData();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">概览 (Dashboard)</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard title="注册用户" value={kpis.totalUsers} icon={Users} description="累计注册用户" />
        <KpiCard title="已发生线上沟通" value={kpis.communicatedUsers} icon={UserCheck} description="有演示申请的用户" />
        <KpiCard title="待处理演示" value={kpis.pendingDemos} icon={PhoneForwarded} description="需要跟进" />
        <KpiCard title="近 7 天演示申请" value={kpis.recentDemos} icon={AreaChart} description="最近 7 天" />
      </div>

      {/* Upcoming Appointments List */}
      <div className="pt-2">
        <h2 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" strokeWidth={2} />
          即将到期的演示申请
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {upcomingAppointments.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {upcomingAppointments.map(({ scheduled_at, demo_requests }) => {
                 const contact = demo_requests.user_profiles || { name: demo_requests.name, email: demo_requests.email };
                 return (
                  <li key={demo_requests.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Clock size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm flex items-center gap-2">
                            {contact.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            {contact.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-medium text-gray-900 text-sm tabular-nums">
                         {format(new Date(scheduled_at), 'yyyy-MM-dd HH:mm')}
                       </p>
                       <UpcomingAppointmentCountdown scheduledAt={scheduled_at} />
                    </div>
                  </li>
                 );
              })}
            </ul>
          ) : (
            <div className="p-12 text-center text-sm text-gray-500">
              <p>没有即将开始的演示申请</p>
            </div>
          )}
          {upcomingAppointments.length > 0 && (
             <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-right">
                <Link href="/admin/demo-requests" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                    查看全部 &rarr;
                </Link>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
