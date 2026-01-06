import { createServiceClient, createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Service client for DB operations (bypass RLS)
  const serviceSupabase = createServiceClient();
  // Standard client to identify the current user
  const authSupabase = await createClient();

  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // Rule: We only care about outcome. Status is ALWAYS 'processed' when outcome is set.
    const { outcome } = body; 

    // Validate outcome - STRICT check
    if (outcome !== 'completed' && outcome !== 'cancelled') {
       return NextResponse.json({ error: `Invalid outcome. Must be 'completed' or 'cancelled'.` }, { status: 400 });
    }

    // 1. Identify Actor
    const { data: { user } } = await authSupabase.auth.getUser();
    const actor = user?.email || 'admin';

    // 2. Fetch Current State (for logging)
    const { data: prevRequest, error: fetchError } = await serviceSupabase
      .from('demo_requests')
      .select('status, outcome')
      .eq('id', id)
      .single();

    if (fetchError || !prevRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // 3. Prepare Update Payload
    // If outcome is set, status MUST be 'processed'.
    const payload = {
      status: 'processed',
      outcome: outcome,
      processed_at: new Date().toISOString()
    };

    // 4. Perform Update
    const { data: updatedRequest, error: updateError } = await serviceSupabase
      .from('demo_requests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Supabase Update Error:', updateError);
      throw updateError;
    }

    // 5. Insert Log (Audit Trail)
    // Only log if something meaningful changed (or just always log outcome updates as per requirement)
    if (prevRequest.outcome !== outcome || prevRequest.status !== 'processed') {
      const { error: logError } = await serviceSupabase
        .from('demo_request_logs')
        .insert({
          demo_request_id: id,
          action: 'outcome_update',
          prev_outcome: prevRequest.outcome,
          new_outcome: outcome,
          prev_status: prevRequest.status,
          new_status: 'processed',
          actor: actor,
        });

      if (logError) {
        // Non-blocking error, but good to know
        console.error('[API] Failed to insert audit log:', logError);
      }
    }

    return NextResponse.json({ success: true, data: updatedRequest });

  } catch (err: any) {
    console.error('[API] Update Demo Request Status Failed:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal Server Error',
      details: err.details || ''
    }, { status: 500 });
  }
}