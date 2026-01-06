import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;

  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '20');
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Filters
  const q = searchParams.get('q');
  const userType = searchParams.get('user_type');
  const marketing = searchParams.get('marketing');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const useCase = searchParams.get('use_case');
  const interest = searchParams.get('interest');

  try {
    let query = supabase
      .from('registered_users')
      .select('*', { count: 'exact' });

    // 1. Keyword Search
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company_name.ilike.${pattern}`);
    }

    // 2. Exact Filters
    if (userType && userType !== 'all') {
      query = query.eq('user_type', userType);
    }

    if (marketing && marketing !== 'all') {
      query = query.eq('marketing_opt_in', marketing === 'true');
    }

    // 3. Date Range
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // 4. Array Filters (Contains)
    if (useCase) {
      query = query.contains('use_case_tags', [useCase]);
    }
    if (interest) {
      query = query.contains('interest_tags', [interest]);
    }

    // 5. Pagination & Sort
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const