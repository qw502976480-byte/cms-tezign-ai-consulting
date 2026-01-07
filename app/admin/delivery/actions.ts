'use server';

import { createServiceClient, createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus, DeliveryAudienceRule, Resource } from '@/types';
import { addDays, nextDay, set, startOfDay } from 'date-fns';

export async function upsertDeliveryTask(data: Partial<DeliveryTask>) {
  const supabase = createServiceClient();
  
  // Calculate next_run_at based on schedule rule
  let nextRun = null;
  if (data.status === 'active' && data.schedule_rule) {
    if (data.schedule_rule.type === 'immediate') {
      nextRun = new Date().toISOString();
    } else if (data.schedule_rule.type === 'scheduled' && data.schedule_rule.time) {
      // Simple next run calculation logic for MVP
      const [hours, minutes] = data.schedule_rule.time.split(':').map(Number);
      const now = new Date();
      let proposed = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });
      
      if (proposed <= now) {
         proposed = addDays(proposed, 1);
      }
      nextRun = proposed.toISOString();
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
            // "not in" needs raw filter or specific string logic in Supabase JS
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