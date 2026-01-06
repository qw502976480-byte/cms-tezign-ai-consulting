import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { DemoRequestStatus } from '@/types';

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
    const { status } = body;

    if (!status || !['completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
    }

    const payload: { status: DemoRequestStatus; processed_at?: string } = {
      status: status as DemoRequestStatus,
      processed_at: new Date().toISOString(),
    };

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
