'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DemoAppointmentStatus } from '@/types';

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