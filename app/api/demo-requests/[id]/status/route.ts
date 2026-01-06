import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { DemoRequestStatus, DemoRequestOutcome } from '@/types';

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
    // Rule: We only care about outcome. Status is derived.
    const { outcome } = body; 

    console.log(`[API] Updating Request ${id}: outcome=${outcome}`);

    // Validate outcome
    if (outcome !== null && outcome !== undefined && !['completed', 'cancelled'].includes(outcome)) {
       return NextResponse.json({ error: `Invalid outcome provided: ${outcome}` }, { status: 400 });
    }

    // --- Core Logic: Derive Status from Outcome ---
    // If outcome is 'completed' or 'cancelled' -> Status MUST be 'processed'
    // If outcome is null (cleared) -> Status MUST be 'pending'
    
    let derivedStatus: DemoRequestStatus = 'pending';
    let processedAt: string | null = null;
    let finalOutcome: DemoRequestOutcome = null;

    if (outcome === 'completed' || outcome === 'cancelled') {
        derivedStatus = 'processed';
        processedAt = new Date().toISOString();
        finalOutcome = outcome;
    } else {
        // Resetting to pending
        derivedStatus = 'pending';
        processedAt = null;
        finalOutcome = null;
    }

    const payload = {
      status: derivedStatus,
      outcome: finalOutcome,
      processed_at: processedAt
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
