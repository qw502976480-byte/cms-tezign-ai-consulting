import { createClient } from '@/utils/supabase/server';
import { DemoRequest, DemoAppointment } from '@/types';
import { addHours } from 'date-fns';
import Filters from './Filters';
import RequestListClient from './request-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: 'all' | 'pending' | 'processed';
  appointment_type?: 'all' | 'scheduled' | 'none';
  time_status?: 'all' | 'overdue' | 'future' | 'near_24h';
}

export default async function DemoRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();

  // 1. Basic SQL Filter (Status)
  const status = searchParams.status || 'all';
  let query = supabase.from('demo_requests').select('*');

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  
  // Default Sort by Created At Desc (Server side base sort)
  query = query.order('created_at', { ascending: false });

  const { data: initialRequests, error: reqError } = await query;
  if (reqError) console.error('Error fetching demo requests:', reqError.message);

  const requests = (initialRequests as DemoRequest[]) || [];
  const requestIds = requests.map(r => r.id);

  // 2. Fetch Appointments
  let currentAppointmentMap = new Map<string, DemoAppointment>();
  
  if (requestIds.length > 0) {
    const { data: appointments, error: appError } = await supabase
      .from('demo_appointments')
      .select('*')
      .in('demo_request_id', requestIds)
      .order('created_at', { ascending: false }); // Get latest first

    if (appError) console.error('Error fetching appointments:', appError.message);
    
    if (appointments) {
       // Logic: Prefer 'scheduled' appointment, otherwise take the latest one
       // This maps one request to its "Active" or "Most Recent" appointment
       const groupedApps = new Map<string, DemoAppointment[]>();
       (appointments as DemoAppointment[]).forEach(app => {
         const list = groupedApps.get(app.demo_request_id) || [];
         list.push(app);
         groupedApps.set(app.demo_request_id, list);
       });

       groupedApps.forEach((apps, reqId) => {
         const scheduled = apps.find(a => a.status === 'scheduled');
         if (scheduled) {
            currentAppointmentMap.set(reqId, scheduled);
         } else if (apps.length > 0) {
            currentAppointmentMap.set(reqId, apps[0]);
         }
       });
    }
  }

  // 3. Apply Advanced Filters (Appointment Type & Time Status) in JS
  const appointmentType = searchParams.appointment_type || 'all';
  const timeStatus = searchParams.time_status || 'all';
  const now = new Date();

  const filteredRequests = requests.filter(req => {
    const appointment = currentAppointmentMap.get(req.id);
    const hasScheduledApp = appointment?.status === 'scheduled';
    const scheduledTime = hasScheduledApp ? new Date(appointment!.scheduled_at) : null;

    // Filter B: Appointment Existence
    if (appointmentType === 'scheduled') {
        if (!hasScheduledApp) return false;
    } else if (appointmentType === 'none') {
        if (hasScheduledApp) return false;
    }

    // Filter C: Time Logic (Only applies if we are looking at scheduled items)
    // If appointment_type is 'none', time_status is ignored by UI, but we check here too.
    if (appointmentType === 'scheduled' && timeStatus !== 'all' && scheduledTime) {
        if (timeStatus === 'overdue') {
            return scheduledTime < now;
        }
        if (timeStatus === 'future') {
            return scheduledTime >= now;
        }
        if (timeStatus === 'near_24h') {
            const twentyFourHoursLater = addHours(now, 24);
            return scheduledTime >= now && scheduledTime <= twentyFourHoursLater;
        }
    }

    return true;
  });

  // 4. Combine & Initial Client Sort
  const initialItems = filteredRequests.map(req => ({
    request: req,
    appointment: currentAppointmentMap.get(req.id)
  })).sort((a, b) => {
    // Primary: Pending first
    if (a.request.status !== b.request.status) {
        return a.request.status === 'pending' ? -1 : 1;
    }
    // Secondary: Created At Desc
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
