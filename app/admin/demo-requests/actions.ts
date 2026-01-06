'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DemoAppointment } from '@/types';

export async function upsertAppointment(demoRequestId: string, scheduledAt: string) {
  const supabase = createServiceClient();
  
  try {
    // Find if there's an existing 'scheduled' appointment for this request
    const { data: existing, error: findError } = await supabase
      .from('demo_appointments')
      .select('id')
      .eq('demo_request_id', demoRequestId)
      .eq('status', 'scheduled')
      .maybeSingle();

    if (findError) throw findError;

    const newScheduledAtISO = new Date(scheduledAt).toISOString();

    if (existing) {
      // Update existing scheduled appointment
      const { error: updateError } = await supabase
        .from('demo_appointments')
        .update({ scheduled_at: newScheduledAtISO })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      // Insert a new scheduled appointment
      const { error: insertError } = await supabase
        .from('demo_appointments')
        .insert({
          demo_request_id: demoRequestId,
          scheduled_at: newScheduledAtISO,
          status: 'scheduled',
        });
      
      if (insertError) throw insertError;
    }

    revalidatePath('/admin/demo-requests');
    return { success: true };

  } catch (error: any) {
    console.error('Upsert Appointment Error:', error);
    return { success: false, error: error.message };
  }
}