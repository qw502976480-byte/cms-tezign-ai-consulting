
import { DeliveryTask, DeliveryScheduleRule, DeliveryTaskStatus, LastRunStatus, DeliveryRun } from '@/types';
import { isBefore, parseISO, parse, differenceInMinutes } from 'date-fns';

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
  // Optional legacy fields if needed, but we primarily use schedule_rule now
}

/**
 * Determines if a run is effectively "active" (running and not timed out).
 * Timeout Rule: Status is 'running' AND started_at is within the last 5 minutes.
 */
export function isRunActive(run: { status: string; started_at: string } | null | undefined): boolean {
  if (!run || run.status !== 'running') return false;
  
  // Frontend fallback: If running for > 5 minutes, consider it failed/timed-out.
  const startedAt = new Date(run.started_at);
  const now = new Date();
  // Use absolute difference to be safe, though startedAt should be in past
  return differenceInMinutes(now, startedAt) < 5;
}

/**
 * Centralized logic to determine the high-level result state of a task
 * based on its latest run. This drives UI permissions and displays.
 */
export function getTaskDerivedResult(latestRun?: DeliveryRun | null): DerivedResult {
  if (!latestRun) return 'not_started';

  if (latestRun.status === 'running') {
    // Integrate timeout check: if stale, treat as failed
    return isRunActive(latestRun) ? 'running' : 'failed';
  }

  if (latestRun.status === 'success') return 'success';
  
  // 'failed', 'skipped', or other statuses treat as failed for operational purposes (needs retry)
  return 'failed'; 
}

export function deriveDeliveryTaskState(task: DeliveryTaskDeriveInput): DerivedTaskState {
  const isOneTime = task.schedule_rule?.mode === 'one_time';
  const runCount = task.run_count || 0;
  const now = new Date();

  // 0. Active Run Lock (Applies to all types, priority #1)
  // Note: The caller is responsible for passing 'running' ONLY if isRunActive() is true.
  if (task.last_run_status === 'running') {
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
        canRunNow: false,
        message: '一次性任务已执行，无法再次操作。如需重发请复制任务。'
      };
    }

    // B. Not yet executed - Check Schedule
    const { one_time_type, one_time_date, one_time_time } = task.schedule_rule || {};
    
    // Immediate type (Draft or Pending manual trigger)
    if (one_time_type === 'immediate') {
        // If it's active in DB but hasn't run, it's essentially a draft waiting for trigger
        // OR it's a draft.
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
            // C. Overdue
            return {
                status: 'overdue',
                canEnable: false, // Cannot schedule into the past
                canRunNow: true,  // Must manually trigger to "catch up"
                message: '任务计划时间已过，请立即执行或修改时间。'
            };
        } else {
            // D. Scheduled Future
            const isDbActive = task.status === 'active';
            return {
                status: isDbActive ? 'scheduled' : 'draft',
                canEnable: !isDbActive, // If already active, can't enable again
                canRunNow: true // Allow pre-emptive run
            };
        }
    }
    
    // Fallback for incomplete schedule config
    return { status: 'draft', canEnable: true, canRunNow: true };
  }

  // 2. Recurring Task Logic (Simpler)
  // Recurring tasks are generally always enabling/runnable unless paused explicitly
  return {
    status: task.status === 'active' ? 'active' : (task.status === 'paused' ? 'paused' : 'draft'),
    canEnable: task.status !== 'active',
    canRunNow: true
  };
}
