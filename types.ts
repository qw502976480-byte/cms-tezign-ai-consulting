export type ResourceCategory = 'report' | 'announcement' | 'case_study' | 'methodology';
export type DemoRequestStatus = 'pending' | 'processed';
export type HomepageModuleType = 'hero' | 'gpt_search' | 'latest_news' | 'core_capabilities' | 'product_claim' | 'primary_cta';
export type ResourceStatus = 'draft' | 'published' | 'archived';

export interface Resource {
  id: string;
  title: string;
  slug: string;
  category: ResourceCategory;
  summary: string | null;
  content: string | null;
  status: ResourceStatus;
  published_at: string | null;
  created_at: string;
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
  name: string;
  company: string | null;
  title: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  status: DemoRequestStatus;
  created_at: string;
  processed_at: string | null;
}


// --- Homepage Configuration Types ---

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
  featured_items: string[]; // Array of Resource IDs
  list_items: string[];     // Array of Resource IDs
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