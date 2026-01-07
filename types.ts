
export type ResourceCategory = 'report' | 'announcement' | 'case_study' | 'methodology';
export type DemoRequestStatus = 'pending' | 'processed';
export type DemoRequestOutcome = 'completed' | 'cancelled' | null;
export type HomepageModuleType = 'hero' | 'gpt_search' | 'latest_news' | 'core_capabilities' | 'product_claim' | 'primary_cta';
export type ResourceStatus = 'draft' | 'published' | 'archived';
export type DemoAppointmentStatus = 'scheduled' | 'completed' | 'no_show' | 'canceled';

// Delivery Task Types
export type DeliveryTaskType = 'automated' | 'one_off'; // Legacy, use schedule_rule.mode
export type DeliveryTaskStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';
export type DeliveryChannel = 'email' | 'in_app';
export type DeliveryContentMode = 'rule' | 'manual';
export type DeliveryRunStatus = 'success' | 'failed' | 'skipped' | 'running';
export type ScheduleType = 'one_time' | 'recurring';
export type LastRunStatus = 'success' | 'failed' | 'skipped' | 'running' | null;

export interface EmailSendingAccount {
  id: string;
  name: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  provider: 'resend' | 'smtp';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
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
}

export interface DeliveryContentRule {
  category?: ResourceCategory[];
  time_range?: '7d' | '30d' | '90d' | 'all';
  limit?: number;
  featured_slot?: 'none' | 'carousel' | 'fixed';
}

export interface DeliveryAudienceRule {
  scope: 'all' | 'logged_in' | 'never_logged_in'; 
  user_type: 'all' | 'personal' | 'company';
  marketing_opt_in: 'all' | 'yes' | 'no';
  interest_tags?: string[];
  has_communicated: 'all' | 'yes' | 'no';
  has_demo_request: 'all' | 'yes' | 'no';
  last_login_range: 'all' | '7d' | '30d' | 'custom';
  last_login_start?: string;
  last_login_end?: string;
  country?: string; 
  city?: string;
  company?: string;
  title?: string;
  registered_from?: string;
  registered_to?: string;
  estimated_count?: number;
}

export interface DeliveryScheduleRule {
  mode: 'one_time' | 'recurring';
  one_time_type?: 'immediate' | 'scheduled';
  one_time_date?: string;
  one_time_time?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  time?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
}

export interface PreflightCheckResult {
  estimated_recipients: number;
  next_run_at: string | null;
}

export interface DeliveryTask {
  id: string;
  name: string;
  type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  channel: DeliveryChannel;
  content_mode: DeliveryContentMode;
  content_rule: DeliveryContentRule | null;
  content_ids: string[] | null;
  audience_rule: DeliveryAudienceRule | null;
  schedule_rule: DeliveryScheduleRule | null;
  channel_config: DeliveryChannelConfig | null;
  
  // New State Machine Fields
  schedule_type: ScheduleType | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: LastRunStatus;
  last_run_message: string | null;
  run_count: number;
  completed_at: string | null;
  preflight_result: PreflightCheckResult | null;

  created_at: string;
  updated_at: string;
}

export interface DeliveryRun {
  id: string;
  task_id: string;
  started_at: string;
  finished_at: string | null;
  status: DeliveryRunStatus;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  message: string | null;
  created_at: string;
}

// --- Other types (unchanged for brevity) ---
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

export interface UserProfile {
  id: string;
  created_at: string;
  name: string;
  phone: string | null;
  email: string;
  user_type: 'personal' | 'company';
  company_name: string | null;
  title: string | null;
  country?: string | null;
  city?: string | null; 
  interest_tags: string[];
  has_communicated?: boolean;
  last_login_at?: string | null;
  // This field may not exist in DB, handle gracefully
  marketing_opt_in?: boolean;
  // FIX: Add missing optional properties for UserDetailModal component
  use_case_tags?: string[];
  pain_points?: string | null;
}

// The rest of the types remain unchanged.
// ...
export interface Registration {
  id: string;
  created_at: string;
  name: string;
  email: string;
  locale?: string | null;
  consent_marketing?: boolean;
  interests?: string[];
}
export type RegisteredUser = UserProfile;
export interface DemoRequest {
  id: string;
  user_id: string;
  user_profile?: UserProfile; 
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
