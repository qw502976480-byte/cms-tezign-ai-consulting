import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // Rule: We only care about outcome. Status is ALWAYS 'processed' when outcome is set.
    const { outcome } = body; 

    console.log(`[API] Updating Request ${id}: outcome=${outcome}`);

    // Validate outcome - STRICT check
    if (outcome !== 'completed' && outcome !== 'cancelled') {
       return NextResponse.json({ error: `Invalid outcome. Must be 'completed' or 'cancelled'.` }, { status: 400 });
    }

    // --- Core Logic: Forced Linkage ---
    // If outcome is set, status MUST be 'processed'.
    const payload = {
      status: 'processed',
      outcome: outcome,
      processed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('demo_requests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API] Supabase Update Error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error('[API] Update Demo Request Status Failed:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal Server Error',
      details: err.details || ''
    }, { status: 500 });
  }
}
