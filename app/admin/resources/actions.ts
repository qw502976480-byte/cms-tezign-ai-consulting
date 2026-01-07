
'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Handles the cascading cleanup of resource IDs from homepage modules.
 * When a resource is deleted, this ensures it's removed from any homepage promotions.
 * @param supabase - The Supabase service client instance.
 * @param resourceIds - An array of resource IDs to remove.
 */
async function cleanupHomepageModules(supabase: ReturnType<typeof createServiceClient>, resourceIds: string[]) {
  const { data: modules, error: fetchError } = await supabase
    .from('homepage_modules')
    .select('type, content_item_ids')
    .in('type', ['latest_updates_carousel', 'latest_updates_fixed']);

  if (fetchError) {
    console.error('Failed to fetch homepage modules for cleanup:', fetchError);
    // Do not throw, allow deletion to proceed. Log the error.
    return;
  }
  
  if (!modules) return;

  const idsToDelete = new Set(resourceIds);
  const updates = [];

  for (const mod of modules) {
    const initialCount = mod.content_item_ids?.length || 0;
    const cleanedIds = (mod.content_item_ids || []).filter(id => !idsToDelete.has(id));
    
    // Only update if there's a change
    if (cleanedIds.length < initialCount) {
      updates.push(
        supabase
          .from('homepage_modules')
          .update({ content_item_ids: cleanedIds })
          .eq('type', mod.type)
      );
    }
  }

  if (updates.length > 0) {
    const results = await Promise.all(updates);
    results.forEach(result => {
      if (result.error) {
        console.error('Failed to update homepage module during cleanup:', result.error);
      }
    });
  }
}

/**
 * Publishes a batch of resources by their IDs.
 */
export async function bulkPublishResources(ids: string[]) {
  if (!ids || ids.length === 0) return { success: false, error: 'No IDs provided' };
  
  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from('resources')
    .update({ 
      status: 'published',
      published_at: new Date().toISOString()
    })
    .in('id', ids);

  if (error) return { success: false, error: error.message };
  
  revalidatePath('/admin/resources');
  return { success: true, count };
}

/**
 * Unpublishes a batch of resources by their IDs (sets status to 'draft').
 */
export async function bulkUnpublishResources(ids: string[]) {
  if (!ids || ids.length === 0) return { success: false, error: 'No IDs provided' };

  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from('resources')
    .update({ status: 'draft' })
    .in('id', ids);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/resources');
  return { success: true, count };
}

/**
 * Deletes a batch of resources by their IDs, including cleanup.
 */
export async function bulkDeleteResources(ids: string[]) {
  if (!ids || ids.length === 0) return { success: false, error: 'No IDs provided' };
  
  const supabase = createServiceClient();
  
  // 1. Clean up homepage modules first
  await cleanupHomepageModules(supabase, ids);

  // 2. Delete the resources
  const { error, count } = await supabase
    .from('resources')
    .delete()
    .in('id', ids);

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/resources');
  revalidatePath('/admin/homepage'); // Revalidate homepage as well due to cleanup
  return { success: true, count };
}

/**
 * Deletes a single resource by its ID, including cleanup.
 */
export async function deleteResource(id: string) {
    if (!id) return { success: false, error: 'No ID provided' };

    const supabase = createServiceClient();
    
    // 1. Clean up homepage modules first
    await cleanupHomepageModules(supabase, [id]);

    // 2. Delete the resource
    const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/resources');
    revalidatePath('/admin/homepage');
    return { success: true };
}
