import { createClient } from '@/utils/supabase/server';
import { DemoRequest, DemoAppointment } from '@/types';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import Filters from './Filters';
import RequestListClient from './request-list-client';

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

  // 4. Combine data for Client Component
  // We do the initial sort here too, to avoid layout shift on hydration
  const initialItems = filteredRequests.map(req => ({
    request: req,
    appointment: currentAppointmentMap.get(req.id)
  })).sort((a, b) => {
    if (a.request.status !== b.request.status) {
        return a.request.status === 'pending' ? -1 : 1;
    }
    return new Date(b.request.created_at).getTime() - new Date(a.request.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">演示申请管理</h1>
      <Filters searchParams={searchParams} />
      <RequestListClient initialItems={initialItems} />
    </div>
  );
}
