import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { name, email, requested_times, timezone, notes } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name required' }, { status: 400 });
    }

    // 1. Ensure registration exists (UPSERT)
    const { data: regData, error: regError } = await supabase
      .from('registrations')
      .upsert({ email, name }, { onConflict: 'email' })
      .select('id')
      .single();

    if (regError) throw regError;

    // 2. Create Demo Request
    const { error: demoError } = await supabase
      .from('demo_requests')
      .insert({
        registration_id: regData.id,
        name,
        email,
        timezone,
        requested_times: requested_times || [],
        notes,
        status: 'New'
      });

    if (demoError) throw demoError;

    // 3. Send Email (Fire and forget, or await)
    // Send to User
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'We received your demo request',
      html: `
        <h1>Hi ${name},</h1>
        <p>Thanks for requesting a demo. We have received your request.</p>
        <p><strong>Timezone:</strong> ${timezone}</p>
        <p><strong>Requested Times:</strong></p>
        <ul>${(requested_times || []).map((t: string) => `<li>${t}</li>`).join('')}</ul>
        <p><strong>Notes:</strong> ${notes || 'None'}</p>
        <p>We will get back to you shortly.</p>
      `
    });

    // Send Internal Notification
    if (process.env.EMAIL_TO_INTERNAL) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: process.env.EMAIL_TO_INTERNAL,
        subject: `New Demo Request: ${name}`,
        html: `
          <p><strong>User:</strong> ${name} (${email})</p>
          <p><strong>Timezone:</strong> ${timezone}</p>
          <p><strong>Notes:</strong> ${notes}</p>
        `
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Book Demo Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
