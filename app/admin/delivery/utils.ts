
import { DeliveryTask, DeliveryScheduleRule, DeliveryTaskStatus, LastRunStatus, DeliveryRun } from '@/types';
import { isBefore, parse, differenceInMinutes } from 'date-fns';

export type DerivedTaskStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed' | 'overdue' | 'running';

// New Unified Result State
export type DerivedResult = 'running' | 'failed' | 'success' | 'not_started';

export interface DerivedTaskState {
  status: DerivedTaskStatus;
  canEnable: boolean;
  canRunNow: boolean;
  message?: string;
}

// Minimal input type required for derivation logic
export interface DeliveryTaskDeriveInput {
  status: DeliveryTaskStatus;
  run_count?: number;
  last_run_status?: LastRunStatus;
  schedule_rule?: DeliveryScheduleRule | null;
  last_run_at?: string | null;
}

/**
 * Determines if a task is effectively "active" (running and not timed out).
 * Uses task fields instead of separate run record.
 */
export function isTaskRunActive(task: DeliveryTaskDeriveInput): boolean {
  if (task.last_run_status !== 'running' || !task.last_run_at) return false;
  
  // Frontend fallback: If running for > 5 minutes, consider it failed/timed-out.
  const startedAt = new Date(task.last_run_at);
  const now = new Date();
  return differenceInMinutes(now, startedAt) < 5;
}

/**
 * Checks if a specific DeliveryRun object is active based on its started_at time.
 */
export function isDeliveryRunRecordActive(run: DeliveryRun): boolean {
  if (run.status !== 'running') return false;
  const startedAt = new Date(run.started_at);
  const now = new Date();
  return differenceInMinutes(now, startedAt) < 5;
}

// Keep alias for backward compatibility if needed, but prefer isTaskRunActive for tasks.
export const isRunActive = isTaskRunActive;

/**
 * Centralized logic to determine the high-level result state of a task
 * based on its own fields. This drives UI permissions and displays.
 */
export function getTaskDerivedResult(task: DeliveryTask): DerivedResult {
  if (!task.last_run_status) return 'not_started';

  if (task.last_run_status === 'running') {
    // Integrate timeout check based on task's last_run_at
    return isTaskRunActive(task) ? 'running' : 'failed';
  }

  if (task.last_run_status === 'success') return 'success';
  
  // 'failed', 'skipped', or other statuses treat as failed for operational purposes
  return 'failed'; 
}

export function deriveDeliveryTaskState(task: DeliveryTaskDeriveInput): DerivedTaskState {
  const isOneTime = task.schedule_rule?.mode === 'one_time';
  const runCount = task.run_count || 0;
  const now = new Date();

  // 0. Active Run Lock (Applies to all types, priority #1)
  if (isTaskRunActive(task)) {
      return {
          status: 'running',
          canEnable: false,
          canRunNow: false,
          message: '任务执行中，请等待完成。'
      };
  }

  // 1. One-time Task Logic
  if (isOneTime) {
    // A. Already Executed (Strict Lock)
    if (runCount > 0) {
      const isFailed = task.last_run_status === 'failed';
      return {
        status: isFailed ? 'failed' : 'completed',
        canEnable: false,
        canRunNow: false, // One-time tasks usually can't be re-run if completed, unless explicitly retried via specific action
        message: '一次性任务已执行。'
      };
    }

    // B. Not yet executed - Check Schedule
    const { one_time_type, one_time_date, one_time_time } = task.schedule_rule || {};
    
    // Immediate type
    if (one_time_type === 'immediate') {
        return {
            status: task.status === 'draft' ? 'draft' : 'active', 
            canEnable: true,
            canRunNow: true
        };
    }

    // Scheduled type
    if (one_time_type === 'scheduled' && one_time_date && one_time_time) {
        const scheduledDate = parse(`${one_time_date} ${one_time_time}`, 'yyyy-MM-dd HH:mm', new Date());
        
        if (isBefore(scheduledDate, now)) {
            return {
                status: 'overdue',
                canEnable: false, 
                canRunNow: true, 
                message: '任务计划时间已过，请立即执行或修改时间。'
            };
        } else {
            const isDbActive = task.status === 'active';
            return {
                status: isDbActive ? 'scheduled' : 'draft',
                canEnable: !isDbActive,
                canRunNow: true
            };
        }
    }
    
    return { status: 'draft', canEnable: true, canRunNow: true };
  }

  // 2. Recurring Task Logic
  return {
    status: task.status === 'active' ? 'active' : (task.status === 'paused' ? 'paused' : 'draft'),
    canEnable: task.status !== 'active',
    canRunNow: true
  };
}
