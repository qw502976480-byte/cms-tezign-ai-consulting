import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = await createClient();
  const slug = params.slug;

  const { data, error } = await supabase
    .from('content_items')
    .select('type, title, subtitle, published_at, reading_minutes, slug, cover_image_url, body_blocks')
    .eq('slug', slug)
    .eq('status', 'Published')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Not found or not published' }, { status: 404 });
  }

  const transformed = {
    type: data.type,
    title: data.title,
    subtitle: data.subtitle,
    date: data.published_at,
    readingMinutes: data.reading_minutes,
    slug: data.slug,
    coverImage: data.cover_image_url,
    bodyBlocks: data.body_blocks
  };

  return NextResponse.json(transformed);
}