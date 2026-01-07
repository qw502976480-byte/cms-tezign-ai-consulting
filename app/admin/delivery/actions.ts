'use server';

import { createServiceClient, createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus, DeliveryAudienceRule, Resource, EmailSendingAccount, EmailTemplate } from '@/types';
import { addDays, nextDay, set, startOfDay, isAfter, isBefore, addWeeks, addMonths, parse, subDays } from 'date-fns';

// --- Delivery Tasks ---

export async function upsertDeliveryTask(data: Partial<DeliveryTask>) {
  const supabase = createServiceClient();
  
  // Calculate next_run_at based on schedule rule
  let nextRun = null;
  const now = new Date();

  // Logic to determine next_run_at
  if (data.status === 'active' && data.schedule_rule) {
    const rule = data.schedule_rule;

    if (rule.mode === 'one_time') {
        if (rule.one_time_type === 'immediate') {
            nextRun = now.toISOString();
        } else if (rule.one_time_type === 'scheduled' && rule.one_time_date && rule.one_time_time) {
            // Combine date and time
            try {
                const target = parse(`${rule.one_time_date} ${rule.one_time_time}`, 'yyyy-MM-dd HH:mm', new Date());
                // Only schedule if it's in the future (or allow it to run immediately if just passed, logic handled by runner)
                nextRun = target.toISOString();
            } catch (e) {
                console.error("Date parsing error", e);
            }
        }
    } else if (rule.mode === 'recurring' && rule.time) {
        // Simple Recurring Logic (Daily/Weekly/Monthly)
        const [hours, minutes] = rule.time.split(':').map(Number);
        let baseDate = now;
        
        // If start_date is in the future, start calculation from there
        if (rule.start_date) {
            const startDate = startOfDay(new Date(rule.start_date));
            if (isAfter(startDate, now)) {
                baseDate = startDate;
            }
        }

        // Set the target time on the base date
        let proposed = set(baseDate, { hours, minutes, seconds: 0, milliseconds: 0 });
        
        // If proposed time is in the past relative to "now" (and we are starting from today), move to next interval
        if (isBefore(proposed, now)) {
             if (rule.frequency === 'daily') {
                 proposed = addDays(proposed, 1);
             } else if (rule.frequency === 'weekly') {
                 proposed = addWeeks(proposed, 1);
             } else if (rule.frequency === 'monthly') {
                 proposed = addMonths(proposed, 1);
             }
        }
        
        // Check end_date constraint
        if (rule.end_date) {
            const endDate = set(new Date(rule.end_date), { hours: 23, minutes: 59, seconds: 59 });
            if (isAfter(proposed, endDate)) {
                nextRun = null; // Expired
            } else {
                nextRun = proposed.toISOString();
            }
        } else {
            nextRun = proposed.toISOString();
        }
    }
  }

  const payload = {
    ...data,
    next_run_at: nextRun,
    updated_at: new Date().toISOString(),
  };

  if (!payload.created_at) {
      payload.created_at = new Date().toISOString();
  }

  let result;
  if (data.id) {
    result = await supabase.from('delivery_tasks').update(payload).eq('id', data.id).select().single();
  } else {
    result = await supabase.from('delivery_tasks').insert(payload).select().single();
  }

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  revalidatePath('/admin/delivery');
  return { success: true, data: result.data };
}

export async function updateTaskStatus(id: string, status: DeliveryTaskStatus) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('delivery_tasks')
    .update({ 
        status, 
        updated_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/delivery');
  revalidatePath(`/admin/delivery/${id}`);
  return { success: true };
}

export async function deleteTask(id: string) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('delivery_tasks')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/delivery');
  return { success: true };
}

export async function duplicateTask(task: DeliveryTask) {
  const supabase = createServiceClient();

  const { id, created_at, updated_at, next_run_at, last_run_at, ...rest } = task;

  const payload = {
    ...rest,
    name: `${rest.name} (复制)`,
    status: 'draft', // reset status
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_run_at: null,
    last_run_at: null
  };

  const { error } = await supabase
    .from('delivery_tasks')
    .insert(payload);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/delivery');
  return { success: true };
}

// --- Helpers ---

export async function estimateAudienceCount(rule: DeliveryAudienceRule) {
    const supabase = createServiceClient(); // Use service client to query cross-table including auth.users
    
    // 1. Base Query on User Profiles
    let query = supabase.from('user_profiles').select('id, email, user_type, country, city');

    // Filter: User Type
    if (rule.user_type && rule.user_type !== 'all') {
        query = query.eq('user_type', rule.user_type);
    }

    // Filter: Geography (Partial match)
    if (rule.country) {
        // Support comma separated
        const countries = rule.country.split(/,|，/).map(s => s.trim()).filter(Boolean);
        if (countries.length > 0) {
             const orQuery = countries.map(c => `country.ilike.%${c}%`).join(',');
             query = query.or(orQuery);
        }
    }
    if (rule.city) {
        const cities = rule.city.split(/,|，/).map(s => s.trim()).filter(Boolean);
        if (cities.length > 0) {
             const orQuery = cities.map(c => `city.ilike.%${c}%`).join(',');
             query = query.or(orQuery);
        }
    }

    // Execute Base Query
    const { data: profiles, error } = await query;
    if (error) return { success: false, error: error.message };
    
    // Perform In-Memory Intersection for other complex filters (MVP Approach)
    // This avoids complex SQL joins which might be restricted or require views.
    let validProfiles = profiles || [];

    // Filter: Marketing Opt-in (Requires joining 'registrations')
    if (rule.marketing_opt_in && rule.marketing_opt_in !== 'all') {
        const { data: registrations } = await supabase.from('registrations').select('email, consent_marketing');
        const regMap = new Map(registrations?.map(r => [r.email, r.consent_marketing]));
        
        validProfiles = validProfiles.filter(p => {
            const consent = regMap.get(p.email) ?? false; // Default to false if not found
            return rule.marketing_opt_in === 'yes' ? consent : !consent;
        });
    }

    // Filter: Communication Status (Requires checking 'demo_requests')
    if ((rule.has_communicated && rule.has_communicated !== 'all') || 
        (rule.has_demo_request && rule.has_demo_request !== 'all')) {
        
        const { data: demos } = await supabase.from('demo_requests').select('user_id');
        const demoUserIds = new Set(demos?.map(d => d.user_id));
        
        // Logic: has_communicated AND has_demo_request (intersection)
        if (rule.has_communicated !== 'all') {
            validProfiles = validProfiles.filter(p => rule.has_communicated === 'yes' ? demoUserIds.has(p.id) : !demoUserIds.has(p.id));
        }
        if (rule.has_demo_request !== 'all') {
             validProfiles = validProfiles.filter(p => rule.has_demo_request === 'yes' ? demoUserIds.has(p.id) : !demoUserIds.has(p.id));
        }
    }

    // Filter: Login Scope & Last Login Time (Requires checking 'auth.users')
    const needsLoginCheck = rule.scope !== 'all' || (rule.last_login_range && rule.last_login_range !== 'all');
    
    if (needsLoginCheck) {
        let authQuery = supabase.from('users').select('id, last_sign_in_at');
        
        // Time range filter optimization
        if (rule.last_login_range !== 'all' && rule.last_login_range) {
            let start: Date | null = null;
            let end: Date | null = null;
            const now = new Date();

            if (rule.last_login_range === '7d') start = subDays(now, 7);
            else if (rule.last_login_range === '30d') start = subDays(now, 30);
            else if (rule.last_login_range === 'custom') {
                if (rule.last_login_start) start = new Date(rule.last_login_start);
                if (rule.last_login_end) end = new Date(rule.last_login_end);
            }

            if (start) authQuery = authQuery.gte('last_sign_in_at', start.toISOString());
            if (end) authQuery = authQuery.lte('last_sign_in_at', end.toISOString());
        }

        const { data: authUsers } = await authQuery;
        const loggedInUserMap = new Map(authUsers?.map(u => [u.id, u.last_sign_in_at]));

        // Apply Scope Filter
        if (rule.scope === 'logged_in') {
            validProfiles = validProfiles.filter(p => loggedInUserMap.has(p.id));
        } else if (rule.scope === 'never_logged_in') {
            validProfiles = validProfiles.filter(p => !loggedInUserMap.has(p.id));
        }

        // Apply Time Filter (Refine if scope was 'all' but time range was set)
        if (rule.last_login_range !== 'all') {
             // If authQuery already filtered by time, just checking existence in map is enough
             validProfiles = validProfiles.filter(p => loggedInUserMap.has(p.id));
        }
    }

    return { success: true, count: validProfiles.length };
}

export async function searchResources(keyword: string) {
    const supabase = createServiceClient();
    let query = supabase.from('resources').select('id, title, category, status, published_at').limit(20);
    
    if (keyword) {
        query = query.ilike('title', `%${keyword}%`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) return [];
    return data as Partial<Resource>[];
}

export async function getResourcesByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    const supabase = createServiceClient();
    const { data } = await supabase.from('resources').select('id, title, category').in('id', ids);
    return data || [];
}

// --- Email Config Actions ---

export async function getEmailAccounts() {
    const supabase = createServiceClient();
    const { data } = await supabase.from('email_sending_accounts').select('*').order('created_at', { ascending: false });
    return (data || []) as EmailSendingAccount[];
}

export async function upsertEmailAccount(data: Partial<EmailSendingAccount>) {
    const supabase = createServiceClient();
    const payload = { ...data, updated_at: new Date().toISOString() };
    if (!payload.id) {
         // @ts-ignore
         delete payload.id; 
    }
    const { error } = await supabase.from('email_sending_accounts').upsert(payload);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/delivery');
    return { success: true };
}

export async function getEmailTemplates() {
    const supabase = createServiceClient();
    const { data } = await supabase.from('email_templates').select('*').order('created_at', { ascending: false });
    return (data || []) as EmailTemplate[];
}

export async function upsertEmailTemplate(data: Partial<EmailTemplate>) {
    const supabase = createServiceClient();
    const payload = { ...data, updated_at: new Date().toISOString() };
    if (!payload.id) {
         // @ts-ignore
         delete payload.id;
    }
    const { error } = await supabase.from('email_templates').upsert(payload);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/delivery');
    return { success: true };
}