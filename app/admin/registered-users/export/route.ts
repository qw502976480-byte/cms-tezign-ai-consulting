
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { UserProfile } from '@/types';
import { startOfDay, endOfDay, format } from 'date-fns';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();
  const { searchParams } = new URL(request.url);

  // 1. Authentication Check
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // 2. Parse and Sanitize Search Params
    const keyword = searchParams.get('q') || '';
    const userType = searchParams.get('type') || 'all';
    const country = searchParams.get('country') || '';
    const city = searchParams.get('city') || '';
    const reg_from = searchParams.get('reg_from') || '';
    const reg_to = searchParams.get('reg_to') || '';
    const login_from = searchParams.get('login_from') || '';
    const login_to = searchParams.get('login_to') || '';
    const onlineStatus = searchParams.get('online') || 'all';

    // 3. Pre-filter Data (similar to the page logic)
    const { data: demoRequests } = await serviceSupabase.from('demo_requests').select('user_id');
    const communicatedUserIdSet = new Set((demoRequests || []).map(r => r.user_id).filter(Boolean));

    let loginFilteredAuthIds: string[] | undefined;
    if (login_from || login_to) {
      let authQuery = serviceSupabase.from('users').select('id');
      if (login_from) authQuery = authQuery.gte('last_sign_in_at', startOfDay(new Date(login_from)).toISOString());
      if (login_to) authQuery = authQuery.lte('last_sign_in_at', endOfDay(new Date(login_to)).toISOString());
      const { data: authUsers } = await authQuery;
      loginFilteredAuthIds = (authUsers || []).map(u => u.id);
    }

    // 4. Build and Execute Main Query
    let query = serviceSupabase.from('user_profiles').select('*');

    if (keyword) {
      const pattern = `%${keyword}%`;
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company_name.ilike.${pattern}`);
    }
    if (userType !== 'all') query = query.eq('user_type', userType);
    if (country) query = query.ilike('country', `%${country}%`);
    if (city) query = query.ilike('city', `%${city}%`);
    if (reg_from) query = query.gte('created_at', startOfDay(new Date(reg_from)).toISOString());
    if (reg_to) query = query.lte('created_at', endOfDay(new Date(reg_to)).toISOString());

    if (loginFilteredAuthIds) {
        query = query.in('id', loginFilteredAuthIds.length > 0 ? loginFilteredAuthIds : ['00000000-0000-0000-0000-000000000000']);
    }

    if (onlineStatus !== 'all') {
        const communicatedUserIds = Array.from(communicatedUserIdSet);
        if (onlineStatus === 'yes') {
            query = query.in('id', communicatedUserIds.length > 0 ? communicatedUserIds : ['00000000-0000-0000-0000-000000000000']);
        } else if (onlineStatus === 'no' && communicatedUserIds.length > 0) {
            query = query.not('id', 'in', `(${communicatedUserIds.join(',')})`);
        }
    }
    
    // Apply limit and order
    const { data: rawUsers, error } = await query
        .order('created_at', { ascending: false })
        .limit(5000); // Safeguard limit

    if (error) throw error;

    // 5. Enrich data with last_login_at
    const authUserIds = (rawUsers || []).map(u => u.id).filter(Boolean);
    const lastLoginMap = new Map<string, string>();
    if (authUserIds.length > 0) {
        const { data: authUsersData } = await serviceSupabase
            .from('users').select('id, last_sign_in_at').in('id', authUserIds);
        if (authUsersData) {
            authUsersData.forEach(u => lastLoginMap.set(u.id, u.last_sign_in_at));
        }
    }

    // 6. Format Data for Excel
    const dataToExport = (rawUsers as UserProfile[] || []).map(user => ({
        '姓名': user.name || '',
        '邮箱': user.email,
        '手机': user.phone || '',
        '用户类型': user.user_type === 'company' ? '企业' : '个人',
        '公司': user.company_name || '',
        '职位': user.title || '',
        '国家': user.country || '',
        '城市': user.city || '',
        '线上沟通': communicatedUserIdSet.has(user.id) ? '已发生' : '未发生',
        '注册时间': format(new Date(user.created_at), 'yyyy-MM-dd HH:mm'),
        '最近登录': lastLoginMap.get(user.id) ? format(new Date(lastLoginMap.get(user.id)!), 'yyyy-MM-dd HH:mm') : '',
    }));

    // 7. Generate Excel File
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Profiles');
    
    // Set column widths for better readability
    worksheet['!cols'] = [
        { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 25 },
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }
    ];

    const buf = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // 8. Create Response
    const filename = `user-profiles_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    return new NextResponse(buf, { headers });

  } catch (err: any) {
    console.error('[EXPORT ERROR]', err);
    return NextResponse.json({ error: 'Failed to export data.', details: err.message }, { status: 500 });
  }
}
