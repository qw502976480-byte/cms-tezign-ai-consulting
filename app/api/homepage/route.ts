import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient();
  
  // 1. Get Active Sections
  const { data: sections, error: sectionsError } = await supabase
    .from('homepage_sections')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  // 2. Collect all Resource IDs to fetch at once
  let allIds: string[] = [];
  sections.forEach((section: any) => {
    if (Array.isArray(section.linked_resources) && section.linked_resources.length > 0) {
      allIds = [...allIds, ...section.linked_resources];
    }
  });

  // 3. Fetch content (ONLY Published)
  let contentMap = new Map();
  if (allIds.length > 0) {
    const { data: content, error: contentError } = await supabase
        .from('content_items')
        .select('id, type, title, subtitle, published_at, reading_minutes, slug, cover_image_url')
        .in('id', allIds)
        .eq('status', 'Published');

    if (!contentError && content) {
        contentMap = new Map(content.map((c: any) => [c.id, c]));
    }
  }

  // 4. Transform response
  const response = sections.map((section: any) => {
    // Basic fields
    const moduleData: any = {
        id: section.id,
        type: section.type,
        title: section.title,
        subtitle: section.subtitle,
        content: section.content,
    };

    // If section has linked resources, resolve them
    if (section.linked_resources && section.linked_resources.length > 0) {
        moduleData.resources = section.linked_resources
            .map((id: string) => contentMap.get(id))
            .filter(Boolean) // Remove nulls (drafts/archived/deleted)
            .map((item: any) => ({
                type: item.type,
                title: item.title,
                subtitle: item.subtitle,
                date: item.published_at,
                readingMinutes: item.reading_minutes,
                slug: item.slug,
                coverImage: item.cover_image_url
            }));
    }

    return moduleData;
  });

  return NextResponse.json(response);
}