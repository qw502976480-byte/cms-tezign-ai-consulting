'use server';

import { createServiceClient, createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus, DeliveryAudienceRule, Resource, EmailSendingAccount, EmailTemplate } from '@/types';
import { addDays, nextDay, set, startOfDay, isAfter, isBefore, addWeeks, addMonths, parse } from 'date-fns';

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

  // If activating, we might need to recalculate next_run_at. 
  // For MVP, we simply update status. Real implementation would re-run the schedule logic used in upsert.
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
    const supabase = createServiceClient();
    
    // 1. Get user IDs who have communicated (if needed)
    let communicatedIds: string[] = [];
    if (rule.scope !== 'all') {
        const { data } = await supabase.from('demo_requests').select('user_id');
        communicatedIds = Array.from(new Set((data || []).map(r => r.user_id)));
    }

    let query = supabase.from('user_profiles').select('id', { count: 'exact', head: true });

    // Scope Filter
    if (rule.scope === 'communicated') {
        if (communicatedIds.length > 0) query = query.in('id', communicatedIds);
        else query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // No match
    } else if (rule.scope === 'not_communicated') {
        if (communicatedIds.length > 0) {
             const idsString = `(${communicatedIds.map(id => `"${id}"`).join(',')})`;
             query = query.not('id', 'in', idsString);
        }
    }

    // Type Filter
    if (rule.user_type && rule.user_type !== 'all') {
        query = query.eq('user_type', rule.user_type);
    }

    // Location Filter (Simple ILIKE)
    if (rule.country) {
        query = query.ilike('country', `%${rule.country}%`);
    }
    if (rule.city) {
        query = query.ilike('city', `%${rule.city}%`);
    }

    const { count, error } = await query;
    
    if (error) return { success: false, error: error.message };
    return { success: true, count: count || 0 };
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