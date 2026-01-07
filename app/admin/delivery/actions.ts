
'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus, DeliveryAudienceRule, Resource, EmailSendingAccount, EmailTemplate, PreflightCheckResult, DeliveryRunStatus, LastRunStatus, UserProfile, DeliveryRun } from '@/types';
import { addMinutes, isAfter, isBefore, parse, subDays, startOfDay, endOfDay, subMinutes } from 'date-fns';
import { Resend } from 'resend';
import { deriveDeliveryTaskState } from './utils';

// --- Preflight Check ---
export async function preflightCheckDeliveryTask(task: Partial<DeliveryTask>): Promise<{ success: boolean; error?: string; data?: PreflightCheckResult & { has_active_run: boolean } }> {
  const now = new Date();
  let hasActiveRun = false;
  
  if (task.id) {
      const supabase = createServiceClient();
      const { data: existingTask } = await supabase.from('delivery_tasks').select('*').eq('id', task.id).single();
      
      if (existingTask) {
          // Guard: Active Run Check (API level - Authority Source: Run Table)
          // We strictly check if there is a run currently in 'running' state.
          const { data: activeRun } = await supabase
            .from('delivery_task_runs')
            .select('id, started_at')
            .eq('task_id', task.id)
            .eq('status', 'running')
            .maybeSingle();
            
          if (activeRun) {
              // Check for stale lock in preflight too
              const startTime = new Date(activeRun.started_at);
              // If it's been running less than 15 mins, consider it valid. Otherwise ignore it (let RunNow handle cleanup).
              if (!isBefore(startTime, subMinutes(now, 15))) {
                  hasActiveRun = true;
                  return { success: false, error: '任务正在执行中 (Active Run Exists)，请等待执行完成。', data: { estimated_recipients: 0, next_run_at: null, has_active_run: true } };
              }
          }

          // 1. One-time task idempotency & Overdue check (API Guard)
          if (task.schedule_rule?.mode === 'one_time') {
                const mergedTask = { ...existingTask, ...task } as DeliveryTask;
                const state = deriveDeliveryTaskState(mergedTask);

                // Guard A: Already executed
                if (existingTask.run_count > 0) {
                    return { success: false, error: '该一次性任务已执行过，无法再次启用。请复制任务。', data: { estimated_recipients: 0, next_run_at: null, has_active_run: false } };
                }

                // Guard B: Overdue (Cannot Enable, must Run Now)
                if (state.status === 'overdue') {
                    return { success: false, error: '任务计划时间已过期，无法启用调度。请使用“立即执行”或修改时间。', data: { estimated_recipients: 0, next_run_at: null, has_active_run: false } };
                }
          }
      }
  }

  // 2. Time validity check (Basic format check)
  if (task.schedule_rule?.mode === 'one_time' && task.schedule_rule.one_time_type === 'scheduled') {
    const { one_time_date, one_time_time } = task.schedule_rule;
    if (!one_time_date || !one_time_time) {
      return { success: false, error: '定时任务必须设置执行日期和时间。' };
    }
    const targetTime = parse(`${one_time_date} ${one_time_time}`, 'yyyy-MM-dd HH:mm', new Date());
    // Allow saving if it's strictly future
    if (!task.id && !isAfter(targetTime, addMinutes(now, 1))) {
      return { success: false, error: '一次性任务的执行时间必须晚于当前时间至少1分钟。' };
    }
  }

  // 3. Channel config check
  if (task.channel === 'email') {
    const emailConfig = task.channel_config?.email;
    if (!emailConfig?.account_id) return { success: false, error: 'Email 任务必须选择发送账户。' };
    if (!emailConfig?.template_id) return { success: false, error: 'Email 任务必须选择邮件模板。' };
    if (!emailConfig?.subject?.trim()) return { success: false, error: 'Email 任务必须填写邮件主题。' };
  } else if (task.channel === 'in_app') {
      return { success: false, error: '站内信渠道暂未开通发送能力，请稍后重试或选择 Email 渠道。' };
  }

  // 4. Audience count check
  if (!task.audience_rule) {
     return { success: false, error: '任务必须配置目标受众规则。'};
  }
  const audienceEstimate = await estimateAudienceCount(task.audience_rule);
  if (audienceEstimate.success === false) {
    return { success: false, error: `受众计算失败: ${audienceEstimate.error}` };
  }
  if (audienceEstimate.count === 0) {
    return { success: false, error: '当前筛选条件命中 0 位用户，请调整筛选条件。' };
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
    nextRunAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); 
  }
  
  return { 
    success: true, 
    data: { 
        estimated_recipients: audienceEstimate.count,
        next_run_at: nextRunAt,
        has_active_run: hasActiveRun
    } 
  };
}


// --- Delivery Tasks ---
export async function upsertDeliveryTask(data: Partial<DeliveryTask>, preflightResult?: PreflightCheckResult) {
  const supabase = createServiceClient();
  
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

  if (preflightResult) {
      payload.next_run_at = preflightResult.next_run_at;
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
    return { success: false, error: result.error.message };
  }

  revalidatePath('/admin/delivery');
  return { success: true, data: result.data };
}

// --- CORE EXECUTION ACTION ---
export async function runDeliveryTaskNow(taskId: string): Promise<{ success: boolean, error?: string, message?: string, code?: string }> {
  const supabase = createServiceClient();
  const started_at = new Date();
  const LOCK_TIMEOUT_MINUTES = 15;

  // 1. Fetch Task
  const { data: task } = await supabase.from('delivery_tasks').select('*').eq('id', taskId).single();
  if (!task) return { success: false, error: 'Task not found.' };

  // Guard 1: One-time task logic
  const state = deriveDeliveryTaskState(task);
  if (!state.canRunNow) {
      return { success: false, error: state.message || '该任务当前不允许立即执行。' };
  }

  // Guard 2: Active Run Check with Stale Lock Release
  const { data: existingRuns } = await supabase
    .from('delivery_task_runs')
    .select('id, started_at')
    .eq('task_id', taskId)
    .eq('status', 'running');
    
  if (existingRuns && existingRuns.length > 0) {
      let isLocked = false;
      const now = new Date();

      for (const run of existingRuns) {
          const runStart = new Date(run.started_at);
          // Check if lock is stale (older than X minutes)
          if (isBefore(runStart, subMinutes(now, LOCK_TIMEOUT_MINUTES))) {
              console.warn(`[Auto-Release] Found stale lock for run ${run.id}. Marking as failed.`);
              // Release the lock
              await supabase.from('delivery_task_runs').update({
                  status: 'failed',
                  finished_at: now.toISOString(),
                  message: 'System: Execution timed out (Stale Lock released).'
              }).eq('id', run.id);
              // Reset task status locally to allow proceed
              await supabase.from('delivery_tasks').update({ last_run_status: 'failed' }).eq('id', taskId);
          } else {
              isLocked = true;
          }
      }

      if (isLocked) {
          return { success: false, error: '任务正在执行中，无法重复触发。', code: 'RUNNING' };
      }
  }

  // --- START EXECUTION TRANSACTION ---
  let runId: string | null = null;

  try {
      // 2. Lock: Initialize Run
      const { data: newRun, error: runError } = await supabase.from('delivery_task_runs').insert({
        task_id: taskId,
        started_at: started_at.toISOString(),
        status: 'running', // <--- ACTIVE LOCK CREATED
        message: 'Initializing...',
        recipient_count: 0,
        success_count: 0,
        failure_count: 0
      }).select('id').single();

      if (runError) throw new Error(`Failed to create run record: ${runError.message}`);
      runId = newRun.id; // CRITICAL: Only proceed if we have a Run ID

      // 3. Update Task Status (Redundancy for UI list)
      await supabase.from('delivery_tasks').update({
          last_run_at: started_at.toISOString(),
          last_run_status: 'running',
          last_run_message: 'Executing now...',
          updated_at: new Date().toISOString()
      }).eq('id', taskId);

      // --- EXECUTION PHASE ---

      // 4. Fetch Audience
      const audienceRes = await getAudience(task.audience_rule);
      if (audienceRes.success === false) {
          throw new Error(`Audience fetch failed: ${audienceRes.error}`);
      }
      
      const recipients = audienceRes.users;
      if (recipients.length === 0) {
          // Skipped
          if (runId) {
              await updateRunStatus(runId, 'skipped', 0, 0, 0, 'No recipients found.');
              // Only update task if run creation was successful (runId exists)
              await updateTaskOnRunCompletion(taskId, 'skipped', 'No recipients found.');
              return { success: true, message: 'Skipped: No recipients found.' };
          } else {
              // Should not happen if insert succeeded, but satisfies TS and safety
              return { success: false, error: 'Run record was not created; cannot update status.' };
          }
      }
      
      // MVP Limit
      if (recipients.length > 50) {
          throw new Error('Exceeded MVP limit of 50 recipients.');
      }

      // 5. Send Emails
      // Update run to show we are sending
      if (runId) {
          await supabase.from('delivery_task_runs').update({ 
              recipient_count: recipients.length, 
              message: `Sending to ${recipients.length} recipients...` 
          }).eq('id', runId);
      }

      const { success_count, failure_count } = await sendEmailsToRecipients(task, recipients);
      
      const status: DeliveryRunStatus = failure_count > 0 ? 'failed' : 'success';
      const message = status === 'success' ? `Successfully sent to ${success_count} recipients.` : `Completed with ${failure_count} failures.`;

      // 6. Finalize Run & Task (Success Path)
      if (runId) {
          await updateRunStatus(runId, status, recipients.length, success_count, failure_count, message);
          await updateTaskOnRunCompletion(taskId, status, message);
      }

      revalidatePath('/admin/delivery');
      revalidatePath(`/admin/delivery/${taskId}`);
      return { success: true, message };

  } catch (error: any) {
      console.error('Execution Error:', error);
      
      const errorMessage = error.message || 'Unknown error occurred';
      
      // 7. Failure Recovery (Release Lock)
      if (runId) {
          // If we created a run, mark it failed
          await updateRunStatus(runId, 'failed', 0, 0, 0, `Crash: ${errorMessage}`);
          // And update the task
          await supabase.from('delivery_tasks').update({ 
              last_run_status: 'failed', 
              last_run_message: `Execution Failed: ${errorMessage}` 
          }).eq('id', taskId);
      } else {
          // If Run creation failed, we do NOT touch the task status/run_count
          // This prevents the task from getting "locked" or incrementing counts phantomly
          console.error('Run creation failed, skipping task status update.');
      }

      return { success: false, error: errorMessage };
  }
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

// --- Task State Management Helpers ---

async function updateRunStatus(runId: string, status: DeliveryRunStatus, recipient_count: number, success_count: number, failure_count: number, message: string) {
    const supabase = createServiceClient();
    await supabase.from('delivery_task_runs').update({
        finished_at: new Date().toISOString(),
        status,
        recipient_count,
        success_count,
        failure_count,
        message,
    }).eq('id', runId);
}

async function updateTaskOnRunCompletion(taskId: string, status: LastRunStatus, message: string) {
    const supabase = createServiceClient();
    const { data: currentTask } = await supabase.from('delivery_tasks').select('run_count, schedule_rule').eq('id', taskId).single();
    
    const updatePayload: Partial<DeliveryTask> = {
        last_run_at: new Date().toISOString(),
        last_run_status: status,
        last_run_message: message,
        run_count: (currentTask?.run_count || 0) + 1,
    };

    const scheduleRule = currentTask?.schedule_rule as any;
    const isOneTime = scheduleRule?.mode === 'one_time';

    // Strict Lifecycle: If one-time task finishes, mark as completed regardless of success/fail
    // (Failures are logged in runs, but the task instance is "done")
    if (isOneTime) {
        updatePayload.status = status === 'success' || status === 'skipped' ? 'completed' : 'failed';
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.next_run_at = null; 
    }
    
    await supabase.from('delivery_tasks').update(updatePayload as any).eq('id', taskId);
}

// New Action: Get Runs for a Task
export async function getTaskRuns(taskId: string): Promise<DeliveryRun[]> {
    const supabase = createServiceClient();
    const { data } = await supabase
        .from('delivery_task_runs')
        .select('*')
        .eq('task_id', taskId)
        .order('started_at', { ascending: false });
    return (data || []) as DeliveryRun[];
}

// --- Audience Calculation ---

export async function previewAudience(rule: DeliveryAudienceRule): Promise<{ success: true, users: UserProfile[] } | { success: false, error: string }> {
    const result = await getAudience(rule, 20); 
    if (!result.success) return result;
    return { success: true, users: result.users as UserProfile[] };
}

async function getAudience(rule: DeliveryAudienceRule | null, limit?: number): Promise<{ success: true, users: any[] } | { success: false, error: string }> {
    if (!rule) return { success: false, error: 'Audience rule is missing.' };
    const supabase = createServiceClient();
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
        } else { 
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
        } else {
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
  // Reset critical lifecycle fields
  const { id, created_at, updated_at, next_run_at, last_run_at, run_count, completed_at, last_run_status, last_run_message, ...rest } = task;
  const payload = {
    ...rest,
    name: `${rest.name} (复制)`,
    status: 'draft',
    run_count: 0, // Reset run count
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
