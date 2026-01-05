export type ContentType = 'Case Study' | 'Report' | 'Methodology' | 'Announcement';
export type ContentStatus = 'Draft' | 'Published' | 'Archived';
export type DemoStatus = 'New' | 'Confirmed' | 'Completed' | 'Canceled';
export type HomepageModuleType = 'hero' | 'gpt_search' | 'latest_news' | 'core_capabilities' | 'product_claim' | 'primary_cta';

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

// --- New Homepage Configuration Types ---

export interface HomepageHeroConfig {
  title: string;
  subtitle: string;
  cta_text: string;
}

export interface HomepageGptSearchConfig {
  placeholder_text: string;
  example_prompts: string[];
}

export interface HomepageLatestNewsConfig {
  featured_items: string[]; // Array of content IDs
  list_items: string[];     // Array of content IDs
}

export interface CapabilityItem {
  image: string;
  title: string;
  description: string;
}

export interface HomepageCoreCapabilitiesConfig {
  section_title: string;
  capability_items: CapabilityItem[]; // Array of 3 items
}

export interface HomepageProductClaimConfig {
  title: string;
  content: string; // Rich text / HTML
  image: string;
}

export interface HomepagePrimaryCtaConfig {
  title: string;
  description: string | null;
  cta_text: string;
}

// The main config object stored in Supabase
export interface HomepageConfig {
  id: string;
  type: HomepageModuleType;
  config: 
    | HomepageHeroConfig
    | HomepageGptSearchConfig
    | HomepageLatestNewsConfig
    | HomepageCoreCapabilitiesConfig
    | HomepageProductClaimConfig
    | HomepagePrimaryCtaConfig;
  is_active: boolean;
  updated_at: string;
}
