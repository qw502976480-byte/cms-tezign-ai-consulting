export type ContentType = 'Case Study' | 'Report' | 'Methodology' | 'Announcement';
export type ContentStatus = 'Draft' | 'Published' | 'Archived';
export type DemoStatus = 'New' | 'Confirmed' | 'Completed' | 'Canceled';

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

export interface HomepageSlot {
  id: string;
  section_key: string;
  content_item_ids: string[];
  updated_at: string;
}
