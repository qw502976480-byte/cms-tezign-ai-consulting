import React from 'react';
import { createClient } from '@/utils/supabase/server';
import RegisteredUsersClientView from './client-view';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { RegisteredUser } from '@/types';

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
  const regionLang = (searchParams.region as string) || 'all'; // Renamed to region for clarity
  const timeRange = (searchParams.range as string) || 'all';
  const commStatus = (searchParams.comm as string) || 'all'; // Communication Status: 'communicated' | 'not_communicated' | 'all'
  const customStart = (searchParams.start as string) || '';
  const customEnd = (searchParams.end as string) || '';

  // 2. Pre-process "Online Communication" Filter
  // Since we can't do complex Joins easily, we fetch emails that have communicated first.
  let communicatedEmails: string[] = [];
  const shouldFilterByComm = commStatus !== 'all';

  // We always need to know who communicated to show the badge, but we only strictly filter query if param is set.
  // Optimization: Fetch all 'communicated' emails (outcome = completed/cancelled)
  // In a massive DB this should be paginated or indexed, but for Admin CMS it's fine.
  const { data: demoRequests } = await supabase
    .from('demo_requests')
    .select('email')
    .in('outcome', ['completed', 'cancelled']); // Key logic: outcome is completed or cancelled

  const communicatedEmailSet = new Set((demoRequests || []).map(r => r.email).filter(Boolean));
  communicatedEmails = Array.from(communicatedEmailSet) as string[];

  // 3. Build Main Query
  let query = supabase
    .from('registered_users')
    .select('id, name, email, phone, created_at, user_type, company_name, title, use_case_tags, interest_tags, pain_points, country, region, city, language, locale', { count: 'exact' });

  // Filter: Keyword
  if (keyword) {
    const pattern = `%${keyword}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }

  // Filter: User Type
  if (userType !== 'all') {
    query = query.eq('user_type', userType);
  }

  // Filter: Region/Language (Matches any of the location fields)
  if (regionLang !== 'all') {
    // Simple exact match logic based on what availableLocales returns (usually 'zh-CN', 'en-US' etc from locale field)
    // OR we can make it search country/region/language
    query = query.or(`locale.eq.${regionLang},language.eq.${regionLang},country.eq.${regionLang}`);
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

  // Filter: Communication Status (The complex one)
  if (commStatus === 'communicated') {
    if (communicatedEmails.length > 0) {
      query = query.in('email', communicatedEmails);
    } else {
      // User wants communicated, but no one has communicated. Return empty.
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible ID
    }
  } else if (commStatus === 'not_communicated') {
    if (communicatedEmails.length > 0) {
      // Note: Supabase JS .not('email', 'in', array) works for smaller arrays. 
      // If array is huge, this might break URL length limits. 
      // Fallback: Fetch page then filter in memory? No, that breaks pagination.
      // Assuming manageable size for CMS.
      query = query.not('email', 'in', `(${communicatedEmails.map(e => `"${e}"`).join(',')})`);
    }
  }

  // 4. Execute Query (Sort & Paginate)
  const { data: rawUsers, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  // 5. Post-process: Enrich data with communication status
  const users: RegisteredUser[] = (rawUsers || []).map((u: any) => ({
    ...u,
    // Add computed field
    communication_status: communicatedEmailSet.has(u.email) ? 'communicated' : 'not_communicated'
  }));

  // 6. Fetch Distinct Regions/Locales for Filter
  // Try to get unique values from locale column
  const { data: localeData } = await supabase
    .from('registered_users')
    .select('locale')
    .order('created_at', { ascending: false })
    .limit(1000); // Sample last 1000 users for filter options
    
  const uniqueLocales = Array.from(new Set((localeData || []).map((row: any) => row.locale).filter(Boolean))).sort() as string[];

  // Handle errors gracefully (e.g. table doesn't exist yet)
  if (error) {
    console.error('Supabase Error:', error.message);
  }

  return (
    <RegisteredUsersClientView
      initialUsers={users}
      totalCount={count || 0}
      availableRegions={uniqueLocales}
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
      error={error ? `数据加载失败 (可能是数据库字段未同步): ${error.message}` : null}
    />
  );
}
