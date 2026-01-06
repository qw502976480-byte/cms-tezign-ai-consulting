import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_SLOTS = ["10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const demoRequestId = params.id;

  try {
    const body = await request.json();
    const { slot } = body;

    // --- Validation ---
    if (!slot || !ALLOWED_SLOTS.includes(slot)) {
      return NextResponse.json({ error: 'Invalid time slot provided.' }, { status: 400 });
    }

    // --- Get Request Date ---
    const { data: demoRequest, error: fetchError } = await supabase
      .from('demo_requests')
      .select('created_at')
      .eq('id', demoRequestId)
      .single();

    if (fetchError || !demoRequest) {
      return NextResponse.json({ error: 'Demo request not found.' }, { status: 404 });
    }

    // --- Calculate Target scheduled_at in Asia/Shanghai Timezone ---
    // This safely gets the date part in the target timezone, avoiding UTC conversion issues.
    const requestDate = new Date(demoRequest.created_at);
    const datePart = requestDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); // Format: YYYY-MM-DD
    const scheduledAtISO = new Date(`${datePart}T${slot}:00.000+08:00`).toISOString();

    // --- Capacity Check ---
    const { count, error: countError } = await supabase
      .from('demo_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('scheduled_at', scheduledAtISO)
      .eq('status', 'scheduled');

    if (countError) throw countError;

    if (count !== null && count >= 3) {
      return NextResponse.json({ error: '该时段已满，请选择其他时段' }, { status: 409 });
    }

    // --- Upsert Logic ---
    const { data: existingAppointment, error: findError } = await supabase
      .from('demo_appointments')
      .select('id')
      .eq('demo_request_id', demoRequestId)
      .eq('status', 'scheduled')
      .maybeSingle();

    if (findError) throw findError;

    if (existingAppointment) {
      // Update existing 'scheduled' appointment
      const { error: updateError } = await supabase
        .from('demo_appointments')
        .update({ scheduled_at: scheduledAtISO })
        .eq('id', existingAppointment.id);
      if (updateError) throw updateError;
    } else {
      // Insert new 'scheduled' appointment
      const { error: insertError } = await supabase
        .from('demo_appointments')
        .insert({
          demo_request_id: demoRequestId,
          scheduled_at: scheduledAtISO,
          status: 'scheduled',
        });
      if (insertError) throw insertError;
    }
    
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Schedule API Error:', err);
    return NextResponse.json({ error: err.message || 'An internal server error occurred.' }, { status: 500 });
  }
}