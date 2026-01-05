import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  
  const category = searchParams.get('category');
  const q = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  // FIX: Filter by status='published' and use published_at for sorting
  let query = supabase
    .from('resources')
    .select('id, title, slug, category, summary, content, status, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsLast: true })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  if (q) {
    query = query.ilike('title', `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}