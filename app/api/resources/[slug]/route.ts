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
    .from('resources')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}