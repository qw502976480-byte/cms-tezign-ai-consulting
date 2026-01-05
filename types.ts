export type ContentType = 'Case Study' | 'Report' | 'Methodology' | 'Announcement';
export type ContentStatus = 'Draft' | 'Published' | 'Archived';
export type DemoStatus = 'New' | 'Confirmed' | 'Completed' | 'Canceled';
export type HomepageSectionType = 'hero' | 'featured_resources' | 'value_points' | 'cta';

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  subtitle: string;
  slug: string;
  cover_image_url: string | null;
  published_at: string;
  reading_minutes: number;
  status: ContentStatus;
  language: string;
  interests: string[];
  body_blocks: any[]; // JSONB
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: string;
  name: string;
  email: string;
  interests: string[];
  locale: string;
  consent_marketing: boolean;
  created_at: string;
}

export interface DemoRequest {
  id: string;
  registration_id: string | null;
  name: string;
  email: string;
  timezone: string;
  requested_times: string[];
  notes: string;
  status: DemoStatus;
  created_at: string;
}

// Deprecated: HomepageSlot
export interface HomepageSlot {
  id: string;
  section_key: string;
  content_item_ids: string[];
  updated_at: string;
}

export interface HomepageSection {
  id: string;
  title: string;
  subtitle: string | null;
  type: HomepageSectionType;
  content: string | null;
  linked_resources: string[]; // Content IDs
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
