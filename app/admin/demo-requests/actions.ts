'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DemoAppointmentStatus, DemoRequestStatus } from '@/types';

export async function updateAppointmentStatus(appointmentId: string, newStatus: DemoAppointmentStatus) {
  if (!appointmentId) {
    return { success: false, error: 'Appointment ID is required.' };
  }
  
  const supabase = createServiceClient();
  
  try {
    const { error } = await supabase
      .from('demo_appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId);

    if (error) throw error;

    revalidatePath('/admin/demo-requests');
    return { success: true };

  } catch (error: any) {
    console.error('Update Appointment Status Error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateDemoRequestStatus(requestId: string, newStatus: 'completed' | 'cancelled') {
  if (!requestId) {
    return { success: false, error: 'Request ID is required.' };
  }
  
  const supabase = createServiceClient();
  
  try {
    const payload: { status: DemoRequestStatus; processed_at?: string | null } = { status: newStatus };
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      payload.processed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('demo_requests')
      .update(payload)
      .eq('id', requestId);

    if (error) throw error;

    revalidatePath('/admin/demo-requests');
    return { success: true };

  } catch (error: any) {
    console.error('Update Demo Request Status Error:', error);
    return { success: false, error: error.message };
  }
}
