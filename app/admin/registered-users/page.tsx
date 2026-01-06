
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import RegisteredUsersClientView from './client-view';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function RegisteredUsersPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // 1. Parse Search Params
  const page = parseInt((searchParams.page as string) || '1');
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const keyword = (searchParams.q as string) || '';
  const userType = (searchParams.type as string) || 'all';
  const regionLang = (searchParams.region as string) || 'all';
  const timeRange = (searchParams.range as string) || 'all';
  const commStatus = (searchParams.comm as string) || 'all'; // 'communicated' | 'not_communicated' | 'all'
  const customStart = (searchParams.start as string) || '';
  const customEnd = (searchParams.end as string) || '';

  // 2. Determine Communication Status (Rule: has at least one demo_request)
  // Fetch distinct user_ids from demo_requests
  let communicatedUserIds: string[] = [];
  const { data: demoRequests } = await supabase
    .from('demo_requests')
    .select('user_id'); // We just need existence

  // Safe mapping and filtering with type assertion
  const demoRequestsData = demoRequests as { user_id: string }[] | null;
  const communicatedUserIdSet = new Set((demoRequestsData || []).map(r => r.user_id).filter(Boolean));
  communicatedUserIds = Array.from(communicatedUserIdSet);

  // 3. Build Main Query against `user_profiles`
  let query = supabase
    .from('user_profiles')
    .select('*', { count: 'exact' });

  // Filter: Keyword
  if (keyword) {
    const pattern = `%${keyword}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company_name.ilike.${pattern}`);
  }

  // Filter: User Type
  if (userType !== 'all') {
    query = query.eq('user_type', userType);
  }

  // Filter: Region/Location
  if (regionLang !== 'all') {
    query = query.or(`country.eq.${regionLang},city.eq.${regionLang},region.eq.${regionLang}`);
  }

  // Filter: Time Range
  const now = new Date();
  if (timeRange === '7d') {
    query = query.gte('created_at', subDays(now, 7).toISOString());
  } else if (timeRange === '30d') {
    query = query.gte('created_at', subDays(now, 30).toISOString());
  } else if (timeRange === 'custom' && customStart && customEnd) {
    query = query
      .gte('created_at', startOfDay(new Date(customStart)).toISOString())
      .lte('created_at', endOfDay(new Date(customEnd)).toISOString());
  }

  // Filter: Communication Status
  if (commStatus === 'communicated') {
    if (communicatedUserIds.length > 0) {
      query = query.in('id', communicatedUserIds);
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // No matches
    }
  } else if (commStatus === 'not_communicated') {
    if (communicatedUserIds.length > 0) {
        // Safe check for empty array to avoid syntax error in supabase query
        const idsString = `(${communicatedUserIds.map(id => `"${id}"`).join(',')})`;
        query = query.not('id', 'in', idsString);
    }
  }

  // 4. Execute Query
  const { data: rawUsers, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  // 5. Post-process: Enrich data
  const users: UserProfile[] = (rawUsers || []).map((u: any) => ({
    ...u,
    has_communicated: communicatedUserIdSet.has(u.id)
  }));

  // 6. Fetch Distinct Countries/Cities for Filter
  // Simple approximation: fetch latest 1000 and extract distinct countries
  const { data: locationData } = await supabase
    .from('user_profiles')
    .select('country, city')
    .order('created_at', { ascending: false })
    .limit(1000);
    
  const locations = new Set<string>();
  (locationData || []).forEach((row: any) => {
      if (row.country) locations.add(row.country);
      if (row.city) locations.add(row.city);
  });
  const uniqueLocations = Array.from(locations).sort();

  if (error) {
    console.error('Supabase Error (user_profiles):', error.message);
  }

  return (
    <RegisteredUsersClientView
      initialUsers={users}
      totalCount={count || 0}
      availableRegions={uniqueLocations}
      searchParams={{
        q: keyword,
        type: userType,
        comm: commStatus,
        region: regionLang,
        range: timeRange,
        start: customStart,
        end: customEnd,
        page,
      }}
      error={error ? `加载失败: ${error.message}` : null}
    />
  );
}