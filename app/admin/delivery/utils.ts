
import { DeliveryTask } from '@/types';
import { isBefore, parseISO, parse } from 'date-fns';

export type DerivedTaskStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed' | 'overdue';

export interface DerivedTaskState {
  status: DerivedTaskStatus;
  canEnable: boolean;
  canRunNow: boolean;
  message?: string;
}

export function deriveDeliveryTaskState(task: DeliveryTask): DerivedTaskState {
  const isOneTime = task.schedule_rule?.mode === 'one_time';
  const runCount = task.run_count || 0;
  const now = new Date();

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
