import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  
  const type = searchParams.get('type');
  const q = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('content_items')
    .select('type, title, subtitle, published_at, reading_minutes, slug, cover_image_url')
    .eq('status', 'Published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq('type', type);
  }

  if (q) {
    query = query.ilike('title', `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to match contract keys
  const transformed = data.map((item: any) => ({
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    date: item.published_at,
    readingMinutes: item.reading_minutes,
    slug: item.slug,
    coverImage: item.cover_image_url
  }));

  return NextResponse.json(transformed);
}