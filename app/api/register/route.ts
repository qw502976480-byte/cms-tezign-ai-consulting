import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Use Service Client to bypass RLS for public write if needed, 
  // or standard client if tables allow public insert.
  // Using Service Client for safety to ensure we can upsert without exposing RLS too broadly.
  const supabase = createServiceClient();
  
  try {
    const body = await request.json();
    const { name, email, interests, locale, consent_marketing } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('registrations')
      .upsert({
        name,
        email,
        interests: interests || [],
        locale: locale || 'en',
        consent_marketing: consent_marketing || false,
        created_at: new Date().toISOString() // Update timestamp on upsert
      }, { onConflict: 'email' });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
