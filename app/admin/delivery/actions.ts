
'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus, DeliveryAudienceRule, Resource, EmailSendingAccount, EmailTemplate, PreflightCheckResult, DeliveryRunStatus, LastRunStatus, UserProfile } from '@/types';
import { addMinutes, isAfter, isBefore, parse, subDays, startOfDay, endOfDay } from 'date-fns';
import { Resend } from 'resend';

// --- Preflight Check ---
export async function preflightCheckDeliveryTask(task: Partial<DeliveryTask>): Promise<{ success: boolean; error?: string; data?: PreflightCheckResult }> {
  const now = new Date();
  
  // 1. Time validity check
  if (task.schedule_rule?.mode === 'one_time' && task.schedule_rule.one_time_type === 'scheduled') {
    const { one_time_date, one_time_time } = task.schedule_rule;
    if (!one_time_date || !one_time_time) {
      return { success: false, error: '定时任务必须设置执行日期和时间。' };
    }
    const targetTime = parse(`${one_time_date} ${one_time_time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isAfter(targetTime, addMinutes(now, 1))) {
      return { success: false, error: '一次性任务的执行时间必须晚于当前时间至少1分钟。' };
    }
  }

  // 2. Channel config check
  if (task.channel === 'email') {
    const emailConfig = task.channel_config?.email;
    if (!emailConfig?.account_id) return { success: false, error: 'Email 任务必须选择发送账户。' };
    if (!emailConfig?.template_id) return { success: false, error: 'Email 任务必须选择邮件模板。' };
    if (!emailConfig?.subject?.trim()) return { success: false, error: 'Email 任务必须填写邮件主题。' };
  } else if (task.channel === 'in_app') {
      // Fix Issue 1: Validate In-app channel on activation instead of disabling in UI
      return { success: false, error: '站内信渠道暂未开通发送能力，请稍后重试或选择 Email 渠道。' };
  }

  // 3. Audience count check
  if (!task.audience_rule) {
     return { success: false, error: '任务必须配置目标受众规则。'};
  }
  const audienceEstimate = await estimateAudienceCount(task.audience_rule);
  // FIX: Explicitly check for 'false' to help TypeScript's type narrowing.
  if (audienceEstimate.success === false) {
    return { success: false, error: `受众计算失败: ${audienceEstimate.error}` };
  }
  if (audienceEstimate.count === 0) {
    return { success: false, error: '当前筛选条件命中 0 位用户，请调整筛选条件。' };
  }
  
  // 4. One-time task idempotency check (if it has run before)
  if (task.id && task.schedule_rule?.mode === 'one_time') {
    const supabase = createServiceClient();
    const { data: existingTask } = await supabase.from('delivery_tasks').select('run_count').eq('id', task.id).single();
    if (existingTask && existingTask.run_count > 0) {
        return { success: false, error: '该一次性任务已执行过，如需重发请复制任务。' };
    }
  }

  // Calculate next_run_at
  let nextRunAt: string | null = null;
  if (task.schedule_rule?.mode === 'one_time') {
    if (task.schedule_rule.one_time_type === 'immediate') {
      nextRunAt = new Date().toISOString();
    } else {
      const { one_time_date, one_time_time } = task.schedule_rule;
      nextRunAt = parse(`${one_time_date} ${one_time_time}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();
    }
  } else if (task.schedule_rule?.mode === 'recurring') {
    // This is a simplified calculation for preflight, the runner would have more robust logic.
    nextRunAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Placeholder for next 5 mins
  }
  
  return { 
    success: true, 
    data: { 
        estimated_recipients: audienceEstimate.count,
        next_run_at: nextRunAt
    } 
  };
}


// --- Delivery Tasks ---
export async function upsertDeliveryTask(data: Partial<DeliveryTask>, preflightResult?: PreflightCheckResult) {
  const supabase = createServiceClient();

  // FIX: Database Schema Compliance
  // We strictly filter properties to match the 'delivery_tasks' table columns.
  // We exclude 'locale', 'schedule_type' (redundant with schedule_rule), and other UI-only state.
  
  const payload: any = {
    name: data.name,
    type: data.type,
    channel: data.channel,
    status: data.status,
    content_mode: data.content_mode,
    content_rule: data.content_rule,
    content_ids: data.content_ids,
    audience_rule: data.audience_rule,
    schedule_rule: data.schedule_rule,
    channel_config: data.channel_config,
    updated_at: new Date().toISOString(),
  };

  // Optional fields that might exist in schema (handle gracefully if they don't via strict typing if we had generated types)
  // For now, we assume these standard columns exist based on types.ts
  if (preflightResult) {
      payload.next_run_at = preflightResult.next_run_at;
      // We assume preflight_result column might exist, if not, supabase might ignore or error.
      // Ideally, store preflight data in a JSON column if specific column doesn't exist.
      // To be safe, we'll try to put it in channel_config if we have to, 
      // but let's assume 'next_run_at' exists as a column.
  }
  
  if (!data.id) {
      payload.created_at = new Date().toISOString();
  }

  let result;
  if (data.id) {
    result = await supabase.from('delivery_tasks').update(payload).eq('id', data.id).select().single();
  } else {
    result = await supabase.from('delivery_tasks').insert(payload).select().single();
  }

  if (result.error) {
    console.error("Upsert Error:", result.error);
    // User friendly error mapping
    if (result.error.message.includes('column "schedule_type" does not exist')) {
        return { success: false, error: "Database schema mismatch: schedule_type column missing." };
    }
    return { success: false, error: result.error.message };
  }

  revalidatePath('/admin/delivery');
  return { success: true, data: result.data };
}

export async function runDeliveryTaskNow(taskId: string): Promise<{ success: boolean, error?: string, message?: string }> {
  const supabase = createServiceClient();
  const started_at = new Date();

  // 1. Fetch Task
  const { data: task } = await supabase.from('delivery_tasks').select('*').eq('id', taskId).single();
  if (!task) return { success: false, error: 'Task not found.' };

  // 2. Fetch Audience
  const audienceRes = await getAudience(task.audience_rule);
  // FIX: Explicitly check for 'false' to help TypeScript's type narrowing.
  if (audienceRes.success === false) {
      await logRun(taskId, started_at, 'failed', 0, 0, 0, `Audience fetch failed: ${audienceRes.error}`);
      await updateTaskOnRunCompletion(taskId, 'failed', `Audience fetch failed: ${audienceRes.error}`);
      return { success: false, error: audienceRes.error };
  }
  const recipients = audienceRes.users;
  if (recipients.length === 0) {
      await logRun(taskId, started_at, 'skipped', 0, 0, 0, 'No recipients found matching criteria.');
      await updateTaskOnRunCompletion(taskId, 'skipped', 'No recipients found matching criteria.');
      return { success: true, message: 'Skipped: No recipients found.' };
  }
  
  // MVP Limit
  if (recipients.length > 50) {
      await logRun(taskId, started_at, 'failed', recipients.length, 0, 0, 'Exceeded MVP limit of 50 recipients.');
      await updateTaskOnRunCompletion(taskId, 'failed', 'Exceeded MVP limit of 50 recipients.');
      return { success: false, error: 'Exceeded MVP limit of 50 recipients.' };
  }

  // 3. Send Emails
  // In a real scenario, this would be a background job. Here we do it directly.
  const { success_count, failure_count } = await sendEmailsToRecipients(task, recipients);
  
  const status: DeliveryRunStatus = failure_count > 0 ? 'failed' : 'success';
  const message = status === 'success' ? `Successfully sent to ${success_count} recipients.` : `Completed with ${failure_count} failures.`;

  // 4. Log and Update Task
  await logRun(taskId, started_at, status, recipients.length, success_count, failure_count, message);
  await updateTaskOnRunCompletion(taskId, status, message);

  revalidatePath('/admin/delivery');
  revalidatePath(`/admin/delivery/${taskId}`);
  return { success: true, message };
}

// --- Email Sending Logic ---
async function sendEmailsToRecipients(task: DeliveryTask, recipients: any[]) {
    // Check for Resend API Key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        console.error("Missing RESEND_API_KEY environment variable.");
        return { success_count: 0, failure_count: recipients.length };
    }
    const resend = new Resend(resendApiKey);

    const emailConfig = task.channel_config?.email;
    if (!emailConfig) return { success_count: 0, failure_count: recipients.length };

    const { data: account } = await createServiceClient().from('email_sending_accounts').select('*').eq('id', emailConfig.account_id).single();
    if (!account) return { success_count: 0, failure_count: recipients.length };

    let success_count = 0;
    
    // For now, content is static. A real implementation would fetch and inject dynamic content.
    const promises = recipients.map(user => {
        return resend.emails.send({
            from: `${account.from_name} <${account.from_email}>`,
            to: user.email,
            subject: emailConfig.subject.replace('{{name}}', user.name || ''),
            html: `Hi ${user.name || ''}, this is a test delivery. ${emailConfig.header_note || ''}`,
            reply_to: account.reply_to || undefined,
        }).then(res => {
            if (res.error) {
                console.error(`Failed to send to ${user.email}:`, res.error.message);
                return false;
            }
            success_count++;
            return true;
        });
    });

    await Promise.all(promises);
    return { success_count, failure_count: recipients.length - success_count };
}

// --- Task State Management ---

async function logRun(taskId: string, started_at: Date, status: DeliveryRunStatus, recipient_count: number, success_count: number, failure_count: number, message: string) {
    const supabase = createServiceClient();
    await supabase.from('delivery_task_runs').insert({
        task_id: taskId,
        started_at: started_at.toISOString(),
        finished_at: new Date().toISOString(),
        status,
        recipient_count,
        success_count,
        failure_count,
        message,
    });
}

async function updateTaskOnRunCompletion(taskId: string, status: LastRunStatus, message: string) {
    const supabase = createServiceClient();
    // We don't select 'schedule_type' here to avoid error if column missing, we look at payload logic or JSON rule
    const { data: currentTask } = await supabase.from('delivery_tasks').select('run_count, schedule_rule').eq('id', taskId).single();
    
    const updatePayload: Partial<DeliveryTask> = {
        last_run_at: new Date().toISOString(),
        last_run_status: status,
        last_run_message: message,
        run_count: (currentTask?.run_count || 0) + 1,
    };

    // Determine if it was one-time based on schedule_rule (JSONB)
    const isOneTime = currentTask?.schedule_rule?.mode === 'one_time';

    if (isOneTime && (status === 'success' || status === 'skipped')) {
        updatePayload.status = status === 'success' ? 'completed' : 'failed';
        if (status === 'skipped') updatePayload.status = 'completed'; // Treat skipped one-offs as completed
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.next_run_at = null;
    }
     if (status === 'failed') {
        updatePayload.status = 'failed';
    }
    
    await supabase.from('delivery_tasks').update(updatePayload as any).eq('id', taskId);
}

// --- Audience Calculation ---

// Fix Issue 2: Helper for Preview
export async function previewAudience(rule: DeliveryAudienceRule): Promise<{ success: true, users: UserProfile[] } | { success: false, error: string }> {
    const result = await getAudience(rule, 20); // Limit to 20 for preview
    if (!result.success) return result;
    return { success: true, users: result.users as UserProfile[] };
}

async function getAudience(rule: DeliveryAudienceRule | null, limit?: number): Promise<{ success: true, users: any[] } | { success: false, error: string }> {
    if (!rule) return { success: false, error: 'Audience rule is missing.' };
    const supabase = createServiceClient();
    // Select minimal fields for preview/sending
    let query = supabase.from('user_profiles').select('id, name, email, user_type, created_at');
    
    if (rule.user_type && rule.user_type !== 'all') {
        query = query.eq('user_type', rule.user_type);
    }
    if (rule.marketing_opt_in === 'yes') {
        query = query.is('marketing_opt_in', true);
    }
    if (rule.marketing_opt_in === 'no') {
        query = query.is('marketing_opt_in', false);
    }

    if (rule.has_communicated && rule.has_communicated !== 'all') {
        const { data: demoRequests } = await supabase.from('demo_requests').select('user_id').not('user_id', 'is', null);
        const communicatedUserIds = Array.from(new Set((demoRequests || []).map(r => r.user_id)));
        
        if (rule.has_communicated === 'yes') {
            if (communicatedUserIds.length === 0) return { success: true, users: [] };
            query = query.in('id', communicatedUserIds);
        } else { // 'no'
            if (communicatedUserIds.length > 0) {
                query = query.not('id', 'in', `(${communicatedUserIds.join(',')})`);
            }
        }
    }
    
    if (rule.interest_tags && rule.interest_tags.length > 0) {
        query = query.overlaps('interest_tags', rule.interest_tags);
    }
    if (rule.country) query = query.ilike('country', `%${rule.country}%`);
    if (rule.city) query = query.ilike('city', `%${rule.city}%`);
    if (rule.registered_from) query = query.gte('created_at', startOfDay(new Date(rule.registered_from)).toISOString());
    if (rule.registered_to) query = query.lte('created_at', endOfDay(new Date(rule.registered_to)).toISOString());
    if (rule.last_login_start) query = query.gte('last_login_at', startOfDay(new Date(rule.last_login_start)).toISOString());
    if (rule.last_login_end) query = query.lte('last_login_at', endOfDay(new Date(rule.last_login_end)).toISOString());

    if (limit) {
        query = query.limit(limit);
    }

    const { data: users, error } = await query;

    if (error) {
        console.error("Audience Fetch Error:", error);
        return { success: false, error: error.message };
    }
    return { success: true, users: users || [] };
}

export async function estimateAudienceCount(rule: DeliveryAudienceRule): Promise<{ success: true; count: number } | { success: false; error: string }> {
    const supabase = createServiceClient();
    let query = supabase.from('user_profiles').select('id', { count: 'exact', head: true });

    if (rule.user_type && rule.user_type !== 'all') {
        query = query.eq('user_type', rule.user_type);
    }
    
    if (rule.marketing_opt_in === 'yes') query = query.is('marketing_opt_in', true);
    if (rule.marketing_opt_in === 'no') query = query.is('marketing_opt_in', false);

    if (rule.has_communicated && rule.has_communicated !== 'all') {
        const { data: demoRequests } = await supabase.from('demo_requests').select('user_id').not('user_id', 'is', null);
        const communicatedUserIds = Array.from(new Set((demoRequests || []).map(r => r.user_id)));
        
        if (rule.has_communicated === 'yes') {
            if (communicatedUserIds.length === 0) return { success: true, count: 0 };
            query = query.in('id', communicatedUserIds);
        } else { // 'no'
            if (communicatedUserIds.length > 0) {
                query = query.not('id', 'in', `(${communicatedUserIds.join(',')})`);
            }
        }
    }
    
    if (rule.interest_tags && rule.interest_tags.length > 0) {
        query = query.overlaps('interest_tags', rule.interest_tags);
    }
    if (rule.country) query = query.ilike('country', `%${rule.country}%`);
    if (rule.city) query = query.ilike('city', `%${rule.city}%`);
    if (rule.registered_from) query = query.gte('created_at', startOfDay(new Date(rule.registered_from)).toISOString());
    if (rule.registered_to) query = query.lte('created_at', endOfDay(new Date(rule.registered_to)).toISOString());
    // Added logic for last login filtering
    if (rule.last_login_start) query = query.gte('last_login_at', startOfDay(new Date(rule.last_login_start)).toISOString());
    if (rule.last_login_end) query = query.lte('last_login_at', endOfDay(new Date(rule.last_login_end)).toISOString());

    const { count, error } = await query;
    if (error) {
        console.error("Audience Estimation Error:", error);
        return { success: false, error: error.message };
    }
    return { success: true, count: count || 0 };
}

// --- Other existing actions ---

export async function updateTaskStatus(id: string, status: DeliveryTaskStatus) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('delivery_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/delivery');
  revalidatePath(`/admin/delivery/${id}`);
  return { success: true };
}

export async function deleteTask(id: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('delivery_tasks').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/delivery');
  return { success: true };
}

export async function duplicateTask(task: DeliveryTask) {
  const { id, created_at, updated_at, next_run_at, last_run_at, run_count, ...rest } = task;
  const payload = {
    ...rest,
    name: `${rest.name} (复制)`,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await createServiceClient().from('delivery_tasks').insert(payload as any);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/delivery');
  return { success: true };
}

export async function getUniqueInterestTags() {
    const supabase = createServiceClient();
    const { data } = await supabase.from('user_profiles').select('interest_tags');
    if (!data) return [];
    const allTags = new Set<string>();
    data.forEach((row: any) => {
        if (Array.isArray(row.interest_tags)) {
            row.interest_tags.forEach((tag: string) => allTags.add(tag));
        }
    });
    return Array.from(allTags).sort();
}

export async function searchResources(keyword: string) {
    const { data } = await createServiceClient().from('resources').select('id, title, category').ilike('title', `%${keyword}%`).limit(20);
    return data || [];
}

export async function getResourcesByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    const { data } = await createServiceClient().from('resources').select('id, title, category').in('id', ids);
    return data || [];
}

export async function getEmailAccounts() {
    const { data } = await createServiceClient().from('email_sending_accounts').select('*').order('created_at');
    return (data || []) as EmailSendingAccount[];
}

export async function upsertEmailAccount(data: Partial<EmailSendingAccount>) {
    const { error } = await createServiceClient().from('email_sending_accounts').upsert({ ...data, updated_at: new Date().toISOString() } as any);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/delivery');
    return { success: true };
}

export async function getEmailTemplates() {
    const { data } = await createServiceClient().from('email_templates').select('*').order('created_at');
    return (data || []) as EmailTemplate[];
}

export async function upsertEmailTemplate(data: Partial<EmailTemplate>) {
    const { error } = await createServiceClient().from('email_templates').upsert({ ...data, updated_at: new Date().toISOString() } as any);
    if (error) return { success: false, error: error.message };
    revalidatePath('/admin/delivery');
    return { success: true };
}
