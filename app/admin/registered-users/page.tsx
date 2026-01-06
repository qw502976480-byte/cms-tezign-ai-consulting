import React from 'react';
import { createClient } from '@/utils/supabase/server';
import RegisteredUsersClientView from './client-view';
import { subDays, startOfDay, endOfDay } from 'date-fns';

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
  const marketing = (searchParams.marketing as string) || 'all';
  const locale = (searchParams.locale as string) || 'all';
  const timeRange = (searchParams.range as string) || 'all';
  const customStart = (searchParams.start as string) || '';
  const customEnd = (searchParams.end as string) || '';

  // 2. Build Query
  let query = supabase
    .from('registered_users')
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

  // Filter: Marketing
  if (marketing !== 'all') {
    query = query.eq('marketing_opt_in', marketing === 'true');
  }

  // Filter: Locale
  if (locale !== 'all') {
    query = query.eq('locale', locale);
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

  // 3. Execute Query (Sort & Paginate)
  const { data: users, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  // 4. Fetch Locales for Filter (Distinct) - Simple approach: fetch all locales (lightweight usually)
  // Or use a separate RPC if data is huge. Here we assume distinct on client or separate small query.
  // For robustness, we'll extract distinct locales from a lightweight column query (limited to last 1000 to avoid perf issues)
  const { data: localeData } = await supabase
    .from('registered_users')
    .select('locale')
    .order('created_at', { ascending: false })
    .limit(1000);
    
  const uniqueLocales = Array.from(new Set((localeData || []).map(row => row.locale).filter(Boolean))).sort() as string[];

  // 5. Handle Error / Empty State gracefully
  if (error) {
    console.error('Supabase Error:', error);
  }

  return (
    <RegisteredUsersClientView
      initialUsers={users || []}
      totalCount={count || 0}
      availableLocales={uniqueLocales}
      searchParams={{
        q: keyword,
        type: userType,
        marketing,
        locale,
        range: timeRange,
        start: customStart,
        end: customEnd,
        page,
      }}
      error={error ? `数据加载失败: ${error.message}` : null}
    />
  );
}
