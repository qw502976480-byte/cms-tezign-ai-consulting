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
    const { status, outcome } = body;

    console.log(`[API] Updating Request ${id}: status=${status}, outcome=${outcome}`);

    // Validate status against valid DB values (Strict)
    if (!status || !['pending', 'processed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided. Must be pending or processed.' }, { status: 400 });
    }

    // Validate outcome if provided
    if (outcome && !['completed', 'cancelled'].includes(outcome)) {
       return NextResponse.json({ error: `Invalid outcome provided: ${outcome}` }, { status: 400 });
    }

    // Prepare payload
    const payload: { status: DemoRequestStatus; outcome?: DemoRequestOutcome; processed_at?: string } = {
      status: status as DemoRequestStatus,
      // Only set processed_at if status is processed
      processed_at: status === 'processed' ? new Date().toISOString() : undefined,
    };

    // Explicitly add outcome if it exists in the request body
    // This allows clearing outcome if we passed null, or setting it
    if (outcome !== undefined) {
        payload.outcome = outcome as DemoRequestOutcome;
    }

    const { error } = await supabase
      .from('demo_requests')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('[API] Supabase Update Error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[API] Update Demo Request Status Failed:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal Server Error',
      details: err.details || ''
    }, { status: 500 });
  }
}
