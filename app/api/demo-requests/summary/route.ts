import { createServiceClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const searchParams = request.nextUrl.searchParams;
  
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'StartDate and EndDate are required' }, { status: 400 });
  }

  try {
    // Fetch minimal data needed for counting within the time range
    // We use the Service Client to ensure we see all data regardless of RLS (for admin stats)
    const { data, error } = await supabase
      .from('demo_requests')
      .select('status, outcome')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const rows = data || [];

    // Calculate stats in memory (efficient for typical CMS dataset sizes)
    const stats = {
      total: rows.length,
      pending: 0,
      processed: 0,
      completed: 0,
      cancelled: 0
    };

    rows.forEach(row => {
      if (row.status === 'pending') stats.pending++;
      if (row.status === 'processed') stats.processed++;
      
      if (row.outcome === 'completed') stats.completed++;
      if (row.outcome === 'cancelled') stats.cancelled++;
    });

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error('[API] Stats Summary Failed:', err);
    return NextResponse.json({ 
      error: err.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
