

import React from 'react';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import RegisteredUsersClientView from './client-view';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function RegisteredUsersPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient(); // For auth.users access

  // 1. Parse and Sanitize Search Params
  const page = parseInt(searchParams.page as string || '1');
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const keyword = (searchParams.q as string) || '';
  const userType = (searchParams.type as string) || 'all';
  const country = (searchParams.country as string) || '';
  const city = (searchParams.city as string) || '';
  const reg_from = (searchParams.reg_from as string) || '';
  const reg_to = (searchParams.reg_to as string) || '';
  const login_from = (searchParams.login_from as string) || '';
  const login_to = (searchParams.login_to as string) || '';
  const onlineStatus = (searchParams.online as string) || 'all';
  
  // 2. Pre-filter: Get user IDs based on communication status (from demo_requests)
  const { data: demoRequests } = await supabase.from('demo_requests').select('user_id');
  const communicatedUserIdSet = new Set((demoRequests || []).map(r => r.user_id).filter(Boolean));
  
  // 3. Pre-filter: Get auth user IDs based on last login time
  let loginFilteredAuthIds: string[] | undefined = undefined;
  if (login_from || login_to) {
    let authQuery = serviceSupabase.from('users').select('id');
    if (login_from) authQuery = authQuery.gte('last_sign_in_at', startOfDay(new Date(login_from)).toISOString());
    if (login_to) authQuery = authQuery.lte('last_sign_in_at', endOfDay(new Date(login_to)).toISOString());
    
    const { data: authUsers, error: authErr } = await authQuery;
    if (authErr) console.error("Auth user query failed:", authErr);
    loginFilteredAuthIds = (authUsers || []).map(u => u.id);
  }

  // 4. Build Main Query against `user_profiles`
  // FIX: Removed non-existent 'auth_user_id' from select statement. '*' already includes 'id'.
  let query = supabase.from('user_profiles').select('*', { count: 'exact' });

  if (keyword) {
    const pattern = `%${keyword}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company_name.ilike.${pattern},title.ilike.${pattern}`);
  }
  if (userType !== 'all') query = query.eq('user_type', userType);
  if (country) query = query.ilike('country', `%${country}%`);
  if (city) query = query.ilike('city', `%${city}%`);
  if (reg_from) query = query.gte('created_at', startOfDay(new Date(reg_from)).toISOString());
  if (reg_to) query = query.lte('created_at', endOfDay(new Date(reg_to)).toISOString());

  // Apply pre-filtered login IDs
  if (loginFilteredAuthIds) {
    if (loginFilteredAuthIds.length > 0) {
      // FIX: Use `id` for matching, as it's the foreign key to auth.users.id
      query = query.in('id', loginFilteredAuthIds);
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // No matches
    }
  }

  // Apply communication status filter
  if (onlineStatus === 'yes') {
    const communicatedUserIds = Array.from(communicatedUserIdSet);
    if (communicatedUserIds.length > 0) {
      query = query.in('id', communicatedUserIds);
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // No matches
    }
  } else if (onlineStatus === 'no') {
    const communicatedUserIds = Array.from(communicatedUserIdSet);
    if (communicatedUserIds.length > 0) {
      const idsString = `(${communicatedUserIds.map(id => `"${id}"`).join(',')})`;
      query = query.not('id', 'in', idsString);
    }
  }

  // 5. Execute Query
  const { data: rawUsers, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  // 6. Enrich with `last_login_at` for display
  // FIX: Collect `id` from profiles to fetch matching auth users.
  const authUserIds = (rawUsers || []).map(u => u.id).filter(Boolean);
  const lastLoginMap = new Map<string, string>();
  if (authUserIds.length > 0) {
    const { data: authUsersData } = await serviceSupabase
      .from('users')
      .select('id, last_sign_in_at')
      .in('id', authUserIds);
    if (authUsersData) {
      authUsersData.forEach(u => lastLoginMap.set(u.id, u.last_sign_in_at));
    }
  }
  
  const users: UserProfile[] = (rawUsers || []).map((u: any) => ({
    ...u,
    has_communicated: communicatedUserIdSet.has(u.id),
    // FIX: Use `id` to look up the last login time.
    last_login_at: u.id ? lastLoginMap.get(u.id) : null,
  }));
  
  if (error) {
    console.error('Supabase Error (user_profiles):', error.message);
  }

  return (
    <RegisteredUsersClientView
      initialUsers={users}
      totalCount={count || 0}
      searchParams={{ ...searchParams, page }}
      error={error ? `加载失败: ${error.message}` : null}
    />
  );
}