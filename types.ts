export type ResourceCategory = 'report' | 'announcement' | 'case_study' | 'methodology';
export type DemoRequestStatus = 'pending' | 'processed';
export type DemoRequestOutcome = 'completed' | 'cancelled' | null;
export type HomepageModuleType = 'hero' | 'gpt_search' | 'latest_news' | 'core_capabilities' | 'product_claim' | 'primary_cta';
export type ResourceStatus = 'draft' | 'published' | 'archived';
export type DemoAppointmentStatus = 'scheduled' | 'completed' | 'no_show' | 'canceled';

// Delivery Task Types
export type DeliveryTaskType = 'automated' | 'one_off'; // Kept for DB compatibility, but UI logic maps to ScheduleRule
export type DeliveryTaskStatus = 'draft' | 'active' | 'paused' | 'completed';
export type DeliveryChannel = 'email' | 'in_app';
export type DeliveryContentMode = 'rule' | 'manual';

export interface EmailSendingAccount {
  id: string;
  name: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  provider: 'resend' | 'smtp';
  is_active: boolean;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailChannelConfig {
  account_id: string;
  template_id: string;
  subject: string;
  header_note?: string;
  footer_note?: string;
}

export interface DeliveryChannelConfig {
  email?: EmailChannelConfig;
  // future expansion: in_app?: InAppConfig
}

export interface DeliveryContentRule {
  category?: ResourceCategory[]; // categories to include
  time_range?: '7d' | '30d' | '90d' | 'all';
  limit?: number; // How many items to pick
  featured_slot?: 'none' | 'carousel' | 'fixed'; // If promoting to homepage
}

export interface DeliveryAudienceRule {
  // 1. Basic Scope
  scope: 'all' | 'logged_in' | 'never_logged_in'; 
  user_type: 'all' | 'personal' | 'company';

  // 2. Compliance
  marketing_opt_in: 'all' | 'yes' | 'no';

  // 3. Behavior
  has_communicated: 'all' | 'yes' | 'no'; // Has demo request record
  has_demo_request: 'all' | 'yes' | 'no'; // Synonym for above in this context, but kept for future granularity (e.g. status=completed)
  last_login_range: 'all' | '7d' | '30d' | 'custom';
  last_login_start?: string;
  last_login_end?: string;

  // 4. Geo
  country?: string; // Comma separated for fuzzy match
  city?: string;

  estimated_count?: number; // Snapshot of estimate when saved
}

export interface DeliveryScheduleRule {
  mode: 'one_time' | 'recurring';
  
  // One-time specific
  one_time_type?: 'immediate' | 'scheduled';
  one_time_date?: string; // YYYY-MM-DD
  one_time_time?: string; // HH:MM

  // Recurring specific
  frequency?: 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD (optional)
  
  timezone?: string; // "Asia/Shanghai"
}

export interface DeliveryTask {
  id: string;
  name: string;
  type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  channel: DeliveryChannel;
  
  // Structured Config
  content_mode: DeliveryContentMode;
  content_rule: DeliveryContentRule | null;
  content_ids: string[] | null; // For manual mode
  
  audience_rule: DeliveryAudienceRule | null;
  schedule_rule: DeliveryScheduleRule | null;
  channel_config: DeliveryChannelConfig | null;
  
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
  name: string;
  email: string;
  locale?: string | null;
  consent_marketing?: boolean;
  interests?: string[];
}

// Renamed from RegisteredUser to UserProfile to match DB table 'user_profiles'
export interface UserProfile {
  id: string;
  created_at: string;
  name: string;
  phone: string | null;
  email: string;
  user_type: 'personal' | 'company';
  company_name: string | null;
  title: string | null;
  
  // Location info
  country?: string | null;
  region?: string | null;
  city?: string | null;
  language?: string | null;
  locale?: string | null; 

  use_case_tags: string[];
  interest_tags: string[];
  pain_points: string | null;
  
  // Computed/Enriched fields
  has_communicated?: boolean; // Derived from existence of demo_requests
  last_login_at?: string | null; // From auth.users.last_sign_in_at
}

// Alias for backward compatibility if needed, but we try to use UserProfile
export type RegisteredUser = UserProfile;

export interface DemoRequest {
  id: string;
  user_id: string; // Foreign Key to user_profiles
  // Joined data (optional because it depends on the query)
  user_profile?: UserProfile; 
  
  // Snapshot fields (legacy or fallback)
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;

  notes: string | null;
  status: DemoRequestStatus;
  outcome?: DemoRequestOutcome;
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

// --- Homepage Configuration Types (Unchanged) ---
export interface HomepageHeroConfig { title: string; subtitle: string; cta_text: string; }
export interface HomepageGptSearchConfig { placeholder_text: string; example_prompts: string[]; }
export interface HomepageLatestNewsConfig { featured_items: string[]; list_items: string[]; }
export interface CapabilityItem { image: string; title: string; description: string; }
export interface HomepageCoreCapabilitiesConfig { section_title: string; capability_items: CapabilityItem[]; }
export interface HomepageProductClaimConfig { title: string; content: string; image: string; }
export interface HomepagePrimaryCtaConfig { title: string; description: string | null; cta_text: string; }
export interface HomepageConfig {
  id: string;
  type: HomepageModuleType;
  config: HomepageHeroConfig | HomepageGptSearchConfig | HomepageLatestNewsConfig | HomepageCoreCapabilitiesConfig | HomepageProductClaimConfig | HomepagePrimaryCtaConfig;
  is_active: boolean;
  updated_at: string;
}