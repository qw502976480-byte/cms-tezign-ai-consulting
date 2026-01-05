import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();
  
  // 1. Get Slots
  const { data: slots, error: slotsError } = await supabase
    .from('homepage_slots')
    .select('*');

  if (slotsError) {
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  // 2. Collect all IDs
  let allIds: string[] = [];
  slots.forEach((slot: any) => {
    if (Array.isArray(slot.content_item_ids)) {
      allIds = [...allIds, ...slot.content_item_ids];
    }
  });

  if (allIds.length === 0) {
    return NextResponse.json({ latest_updates: [], featured_resources: [] });
  }

  // 3. Fetch content (ONLY Published)
  const { data: content, error: contentError } = await supabase
    .from('content_items')
    .select('id, type, title, subtitle, published_at, reading_minutes, slug, cover_image_url')
    .in('id', allIds)
    .eq('status', 'Published');

  if (contentError) {
    return NextResponse.json({ error: contentError.message }, { status: 500 });
  }

  // 4. Map back to slots
  const contentMap = new Map(content.map((c: any) => [c.id, c]));

  const response: Record<string, any[]> = {};

  slots.forEach((slot: any) => {
    if (slot.section_key) {
      // Map IDs to content objects, filter out nulls (if draft/archived)
      const cards = (slot.content_item_ids as string[])
        .map(id => contentMap.get(id))
        .filter(Boolean)
        .map((item: any) => ({
            type: item.type,
            title: item.title,
            subtitle: item.subtitle,
            date: item.published_at,
            readingMinutes: item.reading_minutes,
            slug: item.slug,
            coverImage: item.cover_image_url
        }));
      
      response[slot.section_key] = cards;
    }
  });

  return NextResponse.json(response);
}
