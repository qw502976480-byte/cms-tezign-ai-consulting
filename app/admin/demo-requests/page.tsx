import { createClient } from '@/utils/supabase/server';
import { DemoRequest, DemoAppointment, DemoRequestStatus } from '@/types';
import { format } from 'date-fns';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import Filters from './Filters';
import RequestActions from './UpdateRequestStatusButton';
import AppointmentCell from './AppointmentCell';
import Countdown from './Countdown';
import { PieChart, CheckCircle2, Circle, XCircle, Phone } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: 'pending' | 'processed' | 'all';
  range?: '7d' | '30d' | 'custom';
  start?: string;
  end?: string;
  appointment_status?: 'all' | 'none' | 'scheduled' | 'overdue' | 'completed';
}

export default async function DemoRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();

  // 1. Initial query for demo_requests based on primary filters
  const status = searchParams.status || 'all';
  const range = searchParams.range || '30d';

  let query = supabase.from('demo_requests').select('*');

  // We filter by status in SQL if specific, otherwise we get all to sort manually
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  if (range === '7d') startDate = subDays(new Date(), 7);
  else if (range === '30d') startDate = subDays(new Date(), 30);
  else if (range === 'custom' && searchParams.start && searchParams.end) {
    try {
      startDate = startOfDay(new Date(searchParams.start));
      endDate = endOfDay(new Date(searchParams.end));
    } catch (e) {
      startDate = subDays(new Date(), 30);
    }
  } else {
    startDate = subDays(new Date(), 30);
  }

  if (startDate) query = query.gte('created_at', startDate.toISOString());
  if (endDate) query = query.lte('created_at', endDate.toISOString());
  
  const { data: initialRequests, error: reqError } = await query;

  if (reqError) console.error('Error fetching demo requests:', reqError.message);

  const requests = (initialRequests as DemoRequest[]) || [];
  const requestIds = requests.map(r => r.id);

  // 2. Fetch associated appointments for the filtered requests
  let currentAppointmentMap = new Map<string, DemoAppointment>();
  if (requestIds.length > 0) {
    const { data: appointments, error: appError } = await supabase
      .from('demo_appointments')
      .select('*')
      .in('demo_request_id', requestIds)
      .order('created_at', { ascending: false });

    if (appError) console.error('Error fetching appointments:', appError.message);
    
    if (appointments) {
      const appointmentsByRequestId = new Map<string, DemoAppointment[]>();
      (appointments as DemoAppointment[]).forEach(app => {
        const list = appointmentsByRequestId.get(app.demo_request_id) || [];
        list.push(app);
        appointmentsByRequestId.set(app.demo_request_id, list);
      });

      for (const [requestId, apps] of Array.from(appointmentsByRequestId.entries())) {
        const scheduledApp = apps.find((a: DemoAppointment) => a.status === 'scheduled');
        if (scheduledApp) {
          currentAppointmentMap.set(requestId, scheduledApp);
        } else {
          // Find the most recent non-scheduled appointment
          const latestTerminalApp = apps.find((a: DemoAppointment) => ['completed', 'canceled', 'no_show'].includes(a.status));
          if (latestTerminalApp) {
            currentAppointmentMap.set(requestId, latestTerminalApp);
          }
        }
      }
    }
  }

  // 3. Apply secondary appointment filter in code
  const appointmentStatus = searchParams.appointment_status || 'all';
  const now = new Date();

  let filteredRequests = requests.filter(req => {
    const appointment = currentAppointmentMap.get(req.id);
    switch (appointmentStatus) {
      case 'none':
        return !appointment;
      case 'scheduled':
        return appointment?.status === 'scheduled' && new Date(appointment.scheduled_at) > now;
      case 'overdue':
        return appointment?.status === 'scheduled' && new Date(appointment.scheduled_at) <= now;
      case 'completed':
        return appointment?.status === 'completed';
      case 'all':
      default:
        return true;
    }
  });

  // 4. Strict Sorting Rule: Pending first, then Processed, then Created At Desc
  filteredRequests.sort((a, b) => {
    // Priority 1: Status "pending" comes before "processed"
    if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
    }
    // Priority 2: Created At Descending (Newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // 5. Statistics Calculation
  const totalCount = filteredRequests.length;
  // Status Stats
  const pendingCount = filteredRequests.filter(r => r.status === 'pending').length;
  const processedCount = filteredRequests.filter(r => r.status === 'processed').length;
  // Outcome Stats
  const outcomeCompleted = filteredRequests.filter(r => r.outcome === 'completed').length;
  const outcomeCancelled = filteredRequests.filter(r => r.outcome === 'cancelled').length;

  const getStatusBadge = (status: DemoRequestStatus) => {
    switch (status) {
      case 'pending':
        return { text: '待处理', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'processed':
        return { text: '已处理', className: 'bg-green-100 text-green-800 border-green-200' };
      default:
        return { text: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">演示申请管理</h1>
      <Filters searchParams={searchParams} />
      
      {/* Enhanced Stats Bar */}
      <div className="flex flex-col md:flex-row gap-6 bg-white border border-gray-200 px-5 py-4 rounded-xl shadow-sm text-sm">
        {/* Group 1: Status Stats */}
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-semibold text-gray-900">
               <PieChart size={16} />
               当前结果
           </div>
           <div className="h-4 w-px bg-gray-200"></div>
           <div className="flex items-center gap-2">
                <Circle size={10} className="fill-yellow-400 text-yellow-400" />
                <span className="text-gray-600">待处理</span>
                <span className="font-medium text-gray-900">{pendingCount} 条</span>
           </div>
           <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-gray-400" />
                <span className="text-gray-600">已处理</span>
                <span className="font-medium text-gray-900">{processedCount} 条</span>
           </div>
           <div className="h-4 w-px bg-gray-200"></div>
           <div className="text-gray-500">
                共 {totalCount} 条
           </div>
        </div>
        
        {/* Divider for Mobile */}
        <div className="h-px w-full bg-gray-100 md:hidden"></div>
        <div className="hidden md:block h-auto w-px bg-gray-200"></div>

        {/* Group 2: Outcome Stats */}
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-semibold text-gray-900">
               <Phone size={16} />
               线上沟通
           </div>
           <div className="h-4 w-px bg-gray-200"></div>
           <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-600" />
                <span className="text-gray-600">已完成</span>
                <span className="font-medium text-gray-900">{outcomeCompleted} 次</span>
           </div>
           <div className="flex items-center gap-2">
                <XCircle size={12} className="text-gray-400" />
                <span className="text-gray-600">已取消</span>
                <span className="font-medium text-gray-900">{outcomeCancelled} 次</span>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4">申请时间</th>
              <th className="px-6 py-4">联系人</th>
              <th className="px-6 py-4">状态 (Admin)</th>
              <th className="px-6 py-4">预约时间</th>
              <th className="px-6 py-4">倒计时/逾期</th>
              <th className="px-6 py-4 text-right">沟通操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRequests.map((req: DemoRequest) => {
              const appointment = currentAppointmentMap.get(req.id);
              const statusBadge = getStatusBadge(req.status);
              return (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">
                    {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                    <p className="font-medium text-gray-800 mt-1">{req.company || '-'}</p>
                    <p className="text-xs">{req.title || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{req.name}</p>
                    <p className="text-gray-500 text-xs">{req.email}</p>
                    {req.phone && <p className="text-gray-500 text-xs mt-1">{req.phone}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}>
                      {statusBadge.text}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <AppointmentCell appointment={appointment} />
                  </td>
                  <td className="px-6 py-4">
                     <Countdown appointment={appointment} />
                  </td>
                  <td className="px-6 py-4">
                    <RequestActions request={req} />
                  </td>
                </tr>
              );
            })}
             {filteredRequests.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                        在当前筛选条件下没有找到申请。
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
