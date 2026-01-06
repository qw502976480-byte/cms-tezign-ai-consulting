
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
  
  // JOIN user_profiles to get the single source of truth for contact info
  let query = supabase
    .from('demo_requests')
    .select('*, user_profiles(*)');

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  
  query = query.order('created_at', { ascending: false });

  const { data: initialRequests, error: reqError } = await query;
  
  if (reqError) {
    console.error('Error fetching demo requests:', reqError.message);
  }

  // Cast safely, assuming user_profiles comes back as an object or null
  const requests = (initialRequests as any[])?.map(item => ({
    ...item,
    // Ensure user_profile is correctly structured if the join returns an array (Supabase sometimes does this for 1:M, though user_id should be 1:1 here)
    user_profile: Array.isArray(item.user_profiles) ? item.user_profiles[0] : item.user_profiles
  })) as DemoRequest[] || [];

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
    const scheduledTime = appointment ? new Date(appointment.scheduled_at) : null;

    if (timeStatus !== 'all') {
        if (!scheduledTime) return false;
        if (timeStatus === 'overdue') return scheduledTime < now;
        if (timeStatus === 'future') return scheduledTime >= now;
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
    if (a.request.status !== b.request.status) {
        return a.request.status === 'pending' ? -1 : 1;
    }
    return new Date(b.request.created_at).getTime() - new Date(a.request.created_at).getTime();
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">演示申请 (Demo Requests)</h1>
      </div>
      
      {reqError && (
         <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            Error loading requests: {reqError.message}
         </div>
      )}

      <Filters searchParams={searchParams} />
      <RequestListClient initialItems={initialItems} />
    </div>
  );
}
