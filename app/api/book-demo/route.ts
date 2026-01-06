import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  
  try {
    const body = await request.json();
    const { name, email, company, title, phone, notes } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name required' }, { status: 400 });
    }

    // 1. Ensure registration exists (UPSERT)
    const { error: regError } = await supabase
      .from('registrations')
      .upsert({ email, name }, { onConflict: 'email' });

    if (regError) throw regError;

    // 2. Create Demo Request with the new schema
    const { error: demoError } = await supabase
      .from('demo_requests')
      .insert({
        name,
        email,
        company,
        title,
        phone,
        notes,
        status: 'pending' // Set initial status to 'pending'
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
        <p>Thanks for requesting a demo. We have received your request and will get back to you shortly.</p>
        <p>Here's a summary of the information you provided:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Company:</strong> ${company || 'Not provided'}</li>
          <li><strong>Title:</strong> ${title || 'Not provided'}</li>
          <li><strong>Phone:</strong> ${phone || 'Not provided'}</li>
        </ul>
        <p><strong>Notes:</strong> ${notes || 'None'}</p>
      `
    });

    // Send Internal Notification
    if (process.env.EMAIL_TO_INTERNAL) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: process.env.EMAIL_TO_INTERNAL,
        subject: `New Demo Request: ${name}`,
        html: `
          <p>A new demo request has been submitted:</p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Company:</strong> ${company || '-'}</li>
            <li><strong>Title:</strong> ${title || '-'}</li>
            <li><strong>Phone:</strong> ${phone || '-'}</li>
            <li><strong>Notes:</strong> ${notes || '-'}</li>
          </ul>
        `
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Book Demo Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}