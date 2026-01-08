
'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus, DeliveryAudienceRule, Resource, EmailSendingAccount, EmailTemplate, PreflightCheckResult, DeliveryRunStatus, LastRunStatus, UserProfile, DeliveryRun, DeliveryContentRule } from '@/types';
import { addMinutes, isAfter, isBefore, parse, subDays, startOfDay, endOfDay, subMinutes, differenceInMinutes } from 'date-fns';
import { Resend } from 'resend';
import { deriveDeliveryTaskState } from './utils';

// --- System Recovery (Restored: Cleans up stuck runs from runs table) ---
export async function recoverStaleRuns() {
  const supabase = createServiceClient();
  const now = new Date();

  // 1. Find all currently running tasks from the RUNS table
  const { data: activeRuns, error } = await supabase
    .from('delivery_task_runs')
    .select('id, started_at, task_id')
    .eq('status', 'running');

  if (error) {
      console.error('[Recovery] Failed to fetch active runs:', error);
      return;
  }
  if (!activeRuns || activeRuns.length === 0) return;

  const updates = [];

  for (const run of activeRuns) {
    const startTime = new Date(run.started_at);
    
    // Timeout threshold: 15 minutes for any task
    if (differenceInMinutes(now, startTime) > 15) {
        console.warn(`[Recovery] Run ${run.id} timed out (> 15m). Cleaning up.`);

        // 1. Mark Run as Failed
        updates.push(
            supabase.from('delivery_task_runs').update({
                status: 'failed',
                finished_at: now.toISOString(),
                message: `System: Execution timed out (> 15m). Stale Lock released.`
            }).eq('id', run.id)
        );

        // 2. Mark Task as Failed (Unlock UI)
        updates.push(
            supabase.from('delivery_tasks').update({
                last_run_status: 'failed',
                last_run_message: `System: Execution timed out (> 15m).`
            }).eq('id', run.task_id)
        );
    }
  }

  if (updates.length > 0) {
      await Promise.all(updates);
      revalidatePath('/admin/delivery'); 
  }
}

// --- Preflight Check ---
export async function preflightCheckDeliveryTask(task: Partial<DeliveryTask>): Promise<{ success: boolean; error?: string; data?: PreflightCheckResult & { has_active_run: boolean } }> {
  const now = new Date();
  let hasActiveRun = false;
  
  if (task.id) {
      const supabase = createServiceClient();
      
      // Check for Active Run in Runs Table (Authority)
      const { data: activeRun } = await supabase
        .from('delivery_task_runs')
        .select('id, started_at')
        .eq('task_id', task.id)
        .eq('status', 'running')
        .maybeSingle();
        
      if (activeRun) {
          const startTime = new Date(activeRun.started_at);
          // If running < 15 mins, consider it valid.
          if (differenceInMinutes(now, startTime) < 15) {
              hasActiveRun = true;
              return { success: false, error: '任务正在执行中 (Active Run Exists)，请等待执行完成。', data: { estimated_recipients: 0, next_run_at: null, has_active_run: true } };
          }
      }

      // Check Task Constraints
      const { data: existingTask } = await supabase.from('delivery_tasks').select('*').eq('id', task.id).single();
      if (existingTask) {
          if (task.schedule_rule?.mode === 'one_time') {
                const mergedTask = { ...existingTask, ...task } as DeliveryTask;
                const state = deriveDeliveryTaskState(mergedTask);

                if (existingTask.run_count > 0 && existingTask.last_run_status === 'success') {
                    return { success: false, error: '该一次性任务已成功执行，无法再次启用。请复制任务。', data: { estimated_recipients: 0, next_run_at: null, has_active_run: false } };
                }

                if (state.status === 'overdue') {
                    return { success: false, error: '任务计划时间已过期，无法启用调度。请使用“立即执行”或修改时间。', data: { estimated_recipients: 0, next_run_at: null, has_active_run: false } };
                }
          }
      }
  }

  // 2. Time validity check
  if (task.schedule_rule?.mode === 'one_time' && task.schedule_rule.one_time_type === 'scheduled') {
    const { one_time_date, one_time_time } = task.schedule_rule;
    if (!one_time_date || !one_time_time) {
      return { success: false, error: '定时任务必须设置执行日期和时间。' };
    }
    const targetTime = parse(`${one_time_date} ${one_time_time}`, 'yyyy-MM-dd HH:mm', new Date());
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
  
  // 1. Fetch Task
  const { data: task } = await supabase.from('delivery_tasks').select('*').eq('id', taskId).single();
  if (!task) return { success: false, error: 'Task not found.' };

  // Guard: Active Run Check in Runs Table
  const { data: existingRuns } = await supabase
    .from('delivery_task_runs')
    .select('id, started_at')
    .eq('task_id', taskId)
    .eq('status', 'running');
    
  if (existingRuns && existingRuns.length > 0) {
      // Simple timeout check inside execution attempt to auto-recover if recoverStaleRuns hasn't run yet
      const activeRun = existingRuns[0];
      if (differenceInMinutes(started_at, new Date(activeRun.started_at)) < 2) {
          return { success: false, error: '任务正在执行中，无法重复触发。', code: 'RUNNING' };
      }
      // If > 2 mins, we proceed (assuming user clicked Force Run or previous run died), 
      // effectively ignoring the old lock. Real cleanup happens in recoverStaleRuns.
  }

  let runId: string | null = null;

  try {
      // 2. Lock: Initialize Run Record
      const { data: newRun, error: runError } = await supabase.from('delivery_task_runs').insert({
        task_id: taskId,
        started_at: started_at.toISOString(),
        status: 'running',
        message: 'Initializing...',
        recipient_count: 0,
        success_count: 0,
        failure_count: 0
      }).select('id').single();

      if (runError) throw runError;
      runId = newRun.id;

      // 3. Update Task Status (Sync for List UI)
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
          }
          await updateTaskOnRunCompletion(taskId, 'skipped', 'No recipients found.');
          return { success: true, message: 'Skipped: No recipients found.' };
      }
      
      // MVP Limit
      if (recipients.length > 50) {
          throw new Error('Exceeded MVP limit of 50 recipients.');
      }

      // 5. Send Emails
      if (runId) {
        await supabase.from('delivery_task_runs').update({ 
            recipient_count: recipients.length, 
            message: `Sending to ${recipients.length} recipients...` 
        }).eq('id', runId);
      }

      const { success_count, failure_count } = await sendEmailsToRecipients(task, recipients);
      
      const status: DeliveryRunStatus = failure_count > 0 ? 'failed' : 'success';
      const message = status === 'success' ? `Successfully sent to ${success_count} recipients.` : `Completed with ${failure_count} failures.`;

      // 6. Finalize Run & Task
      if (runId) {
        await updateRunStatus(runId, status, recipients.length, success_count, failure_count, message);
      }
      await updateTaskOnRunCompletion(taskId, status, message);

      revalidatePath('/admin/delivery');
      revalidatePath(`/admin/delivery/${taskId}`);
      return { success: true, message };

  } catch (error: any) {
      console.error('Execution Error:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      
      // 7. Failure Recovery
      if (runId) {
          await updateRunStatus(runId, 'failed', 0, 0, 0, `Crash: ${errorMessage}`);
          await supabase.from('delivery_tasks').update({ 
              last_run_status: 'failed', 
              last_run_message: `Execution Failed: ${errorMessage}` 
          }).eq('id', taskId);
      }

      return { success: false, error: errorMessage };
  }
}

// --- Email Sending Logic ---
async function sendEmailsToRecipients(task: DeliveryTask, recipients: UserProfile[]) {
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

    const { data: template } = await createServiceClient().from('email_templates').select('*').eq('id', emailConfig.template_id).single();
    const baseHtml = template?.html_content || '<html><body><p>Hi {{name}},</p>{{items}}</body></html>';

    let success_count = 0;
    
    const promises = recipients.map(async (user) => {
        let itemsHtml = '';
        
        if (task.content_mode === 'rule' && task.content_rule) {
            const matchedResources = await matchResourcesByUser(user, task.content_rule);
            if (matchedResources.length === 0) {
                if (task.content_rule.fallback === 'skip_user') return false; 
                return false;
            }
            itemsHtml = `<ul style="padding-left: 20px;">
                ${matchedResources.map(r => `
                    <li style="margin-bottom: 10px;">
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/library/${r.slug || '#'}" style="color: #2563eb; text-decoration: none; font-weight: bold;">
                            ${r.title}
                        </a>
                        ${r.summary ? `<div style="font-size: 13px; color: #666; margin-top: 4px;">${r.summary}</div>` : ''}
                    </li>
                `).join('')}
            </ul>`;
        } else {
            if (task.content_ids && task.content_ids.length > 0) {
                 const resources = await getResourcesByIds(task.content_ids);
                 itemsHtml = `<ul style="padding-left: 20px;">${resources.map(r => `<li>${r.title}</li>`).join('')}</ul>`;
            } else {
                 itemsHtml = '<p>No specific resources selected.</p>';
            }
        }

        const userHtml = baseHtml
            .replace(/{{name}}/g, user.name || 'User')
            .replace(/{{items}}/g, itemsHtml)
            .replace(/{{header}}/g, emailConfig.header_note || '')
            .replace(/{{footer}}/g, emailConfig.footer_note || '');

        const { error } = await resend.emails.send({
            from: `${account.from_name} <${account.from_email}>`,
            to: user.email,
            subject: emailConfig.subject.replace('{{name}}', user.name || ''),
            html: userHtml,
            reply_to: account.reply_to || undefined,
        });

        if (error) {
            console.error(`Failed to send to ${user.email}:`, error.message);
            return false;
        }
        success_count++;
        return true;
    });

    await Promise.all(promises);
    return { success_count, failure_count: recipients.length - success_count };
}

// --- Dynamic Matching Logic ---
async function matchResourcesByUser(user: UserProfile, rule: DeliveryContentRule) {
    const supabase = createServiceClient();
    const now = new Date();
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 3650 };
    const days = daysMap[rule.time_range || '30d'] || 30;
    const cutoffDate = subDays(now, days).toISOString();

    let query = supabase
        .from('resources')
        .select('id, title, slug, summary, created_at, interests')
        .eq('status', 'published')
        .gte('created_at', cutoffDate)
        .order('created_at', { ascending: false })
        .limit(rule.limit || 3);

    if (user.interest_tags && user.interest_tags.length > 0) {
        if (rule.match_mode === 'all') {
             query = query.contains('interests', user.interest_tags); 
        } else {
             query = query.overlaps('interests', user.interest_tags);
        }
    } else {
        return [];
    }

    const { data: matched } = await query;
    
    if (!matched || matched.length === 0) {
        if (rule.fallback === 'latest_global') {
             const { data: globalLatest } = await supabase
                .from('resources')
                .select('id, title, slug, summary')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(rule.limit || 3);
             return globalLatest || [];
        }
        return [];
    }
    return matched;
}

// --- Helper: Update Run Status ---
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

// --- Helper: Update Task Status ---
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

    if (isOneTime) {
        updatePayload.status = status === 'success' || status === 'skipped' ? 'completed' : 'failed';
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.next_run_at = null; 
    }
    
    await supabase.from('delivery_tasks').update(updatePayload as any).eq('id', taskId);
}

// Restore Real Implementation: Get Runs for a Task
export async function getTaskRuns(taskId: string): Promise<DeliveryRun[]> {
    const supabase = createServiceClient();
    const { data } = await supabase
        .from('delivery_task_runs')
        .select('*')
        .eq('task_id', taskId)
        .order('started_at', { ascending: false });
    return (data || []) as DeliveryRun[];
}

// --- Audience Calculation (Unchanged) ---
export async function previewAudience(rule: DeliveryAudienceRule): Promise<{ success: true, users: UserProfile[] } | { success: false, error: string }> {
    const result = await getAudience(rule, 20); 
    if (!result.success) return result;
    return { success: true, users: result.users as UserProfile[] };
}

async function getAudience(rule: DeliveryAudienceRule | null, limit?: number): Promise<{ success: true, users: any[] } | { success: false, error: string }> {
    if (!rule) return { success: false, error: 'Audience rule is missing.' };
    const supabase = createServiceClient();
    let query = supabase.from('user_profiles').select('id, name, email, user_type, created_at, interest_tags');
    
    if (rule.user_type && rule.user_type !== 'all') query = query.eq('user_type', rule.user_type);
    if (rule.marketing_opt_in === 'yes') query = query.is('marketing_opt_in', true);
    if (rule.marketing_opt_in === 'no') query = query.is('marketing_opt_in', false);

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
    
    if (rule.interest_tags && rule.interest_tags.length > 0) query = query.overlaps('interest_tags', rule.interest_tags);
    if (rule.country) query = query.ilike('country', `%${rule.country}%`);
    if (rule.city) query = query.ilike('city', `%${rule.city}%`);
    if (rule.registered_from) query = query.gte('created_at', startOfDay(new Date(rule.registered_from)).toISOString());
    if (rule.registered_to) query = query.lte('created_at', endOfDay(new Date(rule.registered_to)).toISOString());
    if (rule.last_login_start) query = query.gte('last_login_at', startOfDay(new Date(rule.last_login_start)).toISOString());
    if (rule.last_login_end) query = query.lte('last_login_at', endOfDay(new Date(rule.last_login_end)).toISOString());

    if (limit) query = query.limit(limit);

    const { data: users, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, users: users || [] };
}

export async function estimateAudienceCount(rule: DeliveryAudienceRule): Promise<{ success: true; count: number } | { success: false; error: string }> {
    const supabase = createServiceClient();
    let query = supabase.from('user_profiles').select('id', { count: 'exact', head: true });

    if (rule.user_type && rule.user_type !== 'all') query = query.eq('user_type', rule.user_type);
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
    
    if (rule.interest_tags && rule.interest_tags.length > 0) query = query.overlaps('interest_tags', rule.interest_tags);
    if (rule.country) query = query.ilike('country', `%${rule.country}%`);
    if (rule.city) query = query.ilike('city', `%${rule.city}%`);
    if (rule.registered_from) query = query.gte('created_at', startOfDay(new Date(rule.registered_from)).toISOString());
    if (rule.registered_to) query = query.lte('created_at', endOfDay(new Date(rule.registered_to)).toISOString());
    if (rule.last_login_start) query = query.gte('last_login_at', startOfDay(new Date(rule.last_login_start)).toISOString());
    if (rule.last_login_end) query = query.lte('last_login_at', endOfDay(new Date(rule.last_login_end)).toISOString());

    const { count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, count: count || 0 };
}

// --- Other existing actions (Unchanged) ---
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
  const { id, created_at, updated_at, next_run_at, last_run_at, run_count, completed_at, last_run_status, last_run_message, ...rest } = task;
  const payload = {
    ...rest,
    name: `${rest.name} (复制)`,
    status: 'draft',
    run_count: 0,
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
