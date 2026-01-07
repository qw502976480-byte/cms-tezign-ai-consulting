'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { DeliveryTask, DeliveryTaskStatus } from '@/types';

export async function createDeliveryTask(data: Partial<DeliveryTask>) {
  const supabase = createServiceClient();
  
  const payload = {
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Calculate dummy next_run_at based on schedule for MVP display
    next_run_at: data.schedule_rule?.run_immediately 
        ? new Date().toISOString() 
        : (data.schedule_rule?.date ? new Date(data.schedule_rule.date).toISOString() : null)
  };

  const { data: newTask, error } = await supabase
    .from('delivery_tasks')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/delivery');
  return { success: true, data: newTask };
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