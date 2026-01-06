import { createClient } from '@/utils/supabase/server';
import { DemoRequest, DemoAppointment } from '@/types';
import { addHours } from 'date-fns';
import Filters from './Filters';
import RequestListClient from './request-list-client';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: 'all' | 'pending' | 'processed';
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
  // We do advanced sorting (Pending first) on the client, but fetching newest first helps with initial render.
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
      .order('created_at', { ascending: false }); 

    if (appError) console.error('Error fetching appointments:', appError.message);
    
    if (appointments) {
       // Logic: Prefer 'scheduled' appointment, otherwise take the latest one
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

  // 3. Apply Advanced Filters (Time Status) in JS
  const timeStatus = searchParams.time_status || 'all';
  const now = new Date();

  const filteredRequests = requests.filter(req => {
    const appointment = currentAppointmentMap.get(req.id);
    // Assuming every request has an appointment as per requirement.
    // If appointment is missing for some reason, we treat it as null date.
    const scheduledTime = appointment ? new Date(appointment.scheduled_at) : null;

    // Filter B: Time Logic
    if (timeStatus !== 'all') {
        if (!scheduledTime) return false; // Exclude if no time and we are filtering by time

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

  // Check for missing phone numbers (Warning banner logic)
  const missingPhoneCount = initialItems.filter(i => !i.request.phone).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
          <h1 className="text-2xl font-bold text-gray-900">演示申请管理</h1>
          {missingPhoneCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                  <AlertTriangle size={12} />
                  <span>提示：有 {missingPhoneCount} 条历史数据暂无手机号</span>
              </div>
          )}
      </div>
      
      <Filters searchParams={searchParams} />
      <RequestListClient initialItems={initialItems} />
    </div>
  );
}
