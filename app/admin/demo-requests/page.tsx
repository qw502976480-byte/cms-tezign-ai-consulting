import { createClient } from '@/utils/supabase/server';
import { DemoRequest, DemoAppointment, DemoRequestStatus } from '@/types';
import { format } from 'date-fns';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import Filters from './Filters';
import RequestActions from './UpdateRequestStatusButton';
import AppointmentCell from './AppointmentCell';
import Countdown from './Countdown';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: 'pending' | 'completed' | 'cancelled' | 'all';
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

  let query = supabase.from('demo_requests').select('*').order('created_at', { ascending: false });

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

  const filteredRequests = requests.filter(req => {
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

  const getStatusBadge = (status: DemoRequestStatus) => {
    switch (status) {
      case 'pending':
        return { text: '待处理', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'completed':
        return { text: '已完成', className: 'bg-green-100 text-green-800 border-green-200' };
      case 'cancelled':
        return { text: '已取消', className: 'bg-gray-100 text-gray-600 border-gray-200' };
      default:
        return { text: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">演示申请管理</h1>
      <Filters searchParams={searchParams} />
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4">申请时间</th>
              <th className="px-6 py-4">联系人</th>
              <th className="px-6 py-4">状态</th>
              <th className="px-6 py-4">预约时间</th>
              <th className="px-6 py-4">倒计时/逾期</th>
              <th className="px-6 py-4 text-right">操作</th>
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