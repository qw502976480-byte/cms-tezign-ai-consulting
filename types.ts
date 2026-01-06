
export type ResourceCategory = 'report' | 'announcement' | 'case_study' | 'methodology';
export type DemoRequestStatus = 'pending' | 'processed';
export type DemoRequestOutcome = 'completed' | 'cancelled' | null;
export type HomepageModuleType = 'hero' | 'gpt_search' | 'latest_news' | 'core_capabilities' | 'product_claim' | 'primary_cta';
export type ResourceStatus = 'draft' | 'published' | 'archived';
export type DemoAppointmentStatus = 'scheduled' | 'completed' | 'no_show' | 'canceled';

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

// Deprecated: Old Registration type, kept for legacy if needed, but RegisteredUser is preferred
export interface Registration {
  id: string;
  name: string;
  email: string;
  interests: string[];
  locale: string;
  consent_marketing: boolean;
  created_at: string;
}

/**
 * MAPPING NOTE FOR USER WEBSITE:
 * - When a user registers on the official website, map fields as follows:
 * - website.form.username -> name
 * - website.form.mobile -> phone
 * - website.form.email -> email
 * - website.form.type -> user_type ('personal' | 'company')
 * - website.form.company -> company_name
 * - website.form.job_title -> title
 * - website.form.usage_scenario -> use_case_tags (Array)
 * - website.form.interests -> interest_tags (Array)
 * - website.form.pain_points -> pain_points
 * - website.marketing_checkbox -> marketing_opt_in
 */
export interface RegisteredUser {
  id: string;
  created_at: string;
  auth_user_id: string | null;
  name: string;
  phone: string;
  email: string;
  user_type: 'personal' | 'company';
  company_name: string | null;
  title: string | null;
  
  // Location info
  country?: string | null;
  region?: string | null;
  city?: string | null;
  language?: string | null;
  locale?: string | null; // Keep for backward compatibility

  use_case_tags: string[];
  interest_tags: string[];
  pain_points: string | null;
  
  marketing_opt_in: boolean;
  
  // Enriched field (not in DB, computed on server)
  communication_status?: 'communicated' | 'not_communicated';
}

export interface RegisteredUserResponse {
  data: RegisteredUser[];
  total: number;
  page: number;
  page_size: number;
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
  outcome?: DemoRequestOutcome; // New field for operation result
  created_at: string;
  processed_at: string | null;
}

export interface DemoAppointment {
  id: string;
  demo_request_id: string;
  scheduled_at: string;
  status: DemoAppointmentStatus;
  created_at: string;
}

export interface DemoRequestLog {
  id: string;
  demo_request_id: string;
  action: string;
  prev_outcome: string | null;
  new_outcome: string | null;
  prev_status: string | null;
  new_status: string | null;
  actor: string | null;
  created_at: string;
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
