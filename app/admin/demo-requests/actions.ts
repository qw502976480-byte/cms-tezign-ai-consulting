
'use server';

import { createServiceClient, createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DemoAppointmentStatus, DemoRequestOutcome } from '@/types';

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


export async function updateRequestOutcome(requestId: string, outcome: DemoRequestOutcome) {
  if (!requestId || (outcome !== 'completed' && outcome !== 'cancelled')) {
    return { success: false, error: 'Invalid input provided.' };
  }

  const serviceSupabase = createServiceClient();
  const authSupabase = await createClient();

  try {
    // 1. Identify Actor
    const { data: { user } } = await authSupabase.auth.getUser();
    const actor = user?.email || 'admin';

    // 2. Fetch Current State (for logging)
    const { data: prevRequest, error: fetchError } = await serviceSupabase
      .from('demo_requests')
      .select('status, outcome')
      .eq('id', requestId)
      .single();

    if (fetchError) throw new Error(`Request not found: ${fetchError.message}`);

    // 3. Perform Update: Outcome change always sets status to 'processed'
    const { error: updateError } = await serviceSupabase
      .from('demo_requests')
      .update({
        status: 'processed',
        outcome: outcome,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    // 4. Insert Log if state changed
    if (prevRequest.outcome !== outcome || prevRequest.status !== 'processed') {
      const { error: logError } = await serviceSupabase
        .from('demo_request_logs')
        .insert({
          demo_request_id: requestId,
          action: 'outcome_update',
          prev_outcome: prevRequest.outcome,
          new_outcome: outcome,
          prev_status: prevRequest.status,
          new_status: 'processed',
          actor: actor,
        });
      if (logError) console.error('Failed to insert audit log:', logError.message);
    }
    
    revalidatePath('/admin/demo-requests');
    return { success: true };

  } catch (error: any)
 {
    console.error('Update Request Outcome Error:', error);
    return { success: false, error: error.message };
  }
}
