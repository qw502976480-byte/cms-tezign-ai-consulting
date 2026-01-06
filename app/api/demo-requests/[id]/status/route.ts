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

    // Validate status against valid DB values
    if (!status || !['pending', 'processed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided. Must be pending or processed.' }, { status: 400 });
    }

    // Validate outcome if provided
    if (outcome && !['completed', 'cancelled'].includes(outcome)) {
       return NextResponse.json({ error: 'Invalid outcome provided.' }, { status: 400 });
    }

    const payload: { status: DemoRequestStatus; outcome?: DemoRequestOutcome; processed_at?: string } = {
      status: status as DemoRequestStatus,
      // Only set processed_at if status is processed
      processed_at: status === 'processed' ? new Date().toISOString() : undefined,
    };

    // Add outcome to payload if it exists in the request
    if (outcome) {
        payload.outcome = outcome as DemoRequestOutcome;
    }

    const { error } = await supabase
      .from('demo_requests')
      .update(payload)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Update Demo Request Status API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
