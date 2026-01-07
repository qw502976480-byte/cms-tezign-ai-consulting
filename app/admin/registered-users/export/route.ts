
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { UserProfile } from '@/types';
import { startOfDay, endOfDay, format } from 'date-fns';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// Field configuration mapping frontend keys to backend data
const FIELD_CONFIG: { [key: string]: { header: string; getValue: (user: any, context: any) => any } } = {
  name: { header: '姓名', getValue: (u) => u.name || '' },
  email: { header: '邮箱', getValue: (u) => u.email },
  phone: { header: '手机', getValue: (u) => u.phone || '' },
  user_type: { header: '用户类型', getValue: (u) => u.user_type === 'company' ? '企业' : '个人' },
  company_name: { header: '公司', getValue: (u) => u.company_name || '' },
  title: { header: '职位', getValue: (u) => u.title || '' },
  country: { header: '国家', getValue: (u) => u.country || '' },
  city: { header: '城市', getValue: (u) => u.city || '' },
  online_comm: { header: '线上沟通', getValue: (u, ctx) => ctx.communicatedUserIdSet.has(u.id) ? '已发生' : '未发生' },
  created_at: { header: '注册时间', getValue: (u) => format(new Date(u.created_at), 'yyyy-MM-dd HH:mm') },
  last_login_at: { header: '最近登录', getValue: (u, ctx) => ctx.lastLoginMap.get(u.id) ? format(new Date(ctx.lastLoginMap.get(u.id)!), 'yyyy-MM-dd HH:mm') : '' },
};

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
    // Filter params
    const keyword = searchParams.get('q') || '';
    const userType = searchParams.get('type') || 'all';
    const country = searchParams.get('country') || '';
    const city = searchParams.get('city') || '';
    const reg_from = searchParams.get('reg_from') || '';
    const reg_to = searchParams.get('reg_to') || '';
    const onlineStatus = searchParams.get('online') || 'all';
    
    // Export control params
    const scope = searchParams.get('scope') || 'filtered';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const topN = parseInt(searchParams.get('top') || '500');
    const rawFields = searchParams.get('fields') || '';
    
    // 3. Prepare requested fields
    const requestedFields = rawFields ? rawFields.split(',') : Object.keys(FIELD_CONFIG);
    const exportFields = Array.from(new Set(['email', 'phone', ...requestedFields]));

    // 4. Pre-filter Data (similar to the page logic)
    const { data: demoRequests } = await serviceSupabase.from('demo_requests').select('user_id');
    const communicatedUserIdSet = new Set((demoRequests || []).map(r => r.user_id).filter(Boolean));

    // 5. Build and Execute Main Query
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
    
    if (onlineStatus !== 'all') {
        const communicatedUserIds = Array.from(communicatedUserIdSet);
        if (onlineStatus === 'yes') {
            query = query.in('id', communicatedUserIds.length > 0 ? communicatedUserIds : ['00000000-0000-0000-0000-000000000000']);
        } else if (onlineStatus === 'no' && communicatedUserIds.length > 0) {
            query = query.not('id', 'in', `(${communicatedUserIds.map(id => `"${id}"`).join(',')})`);
        }
    }
    
    // 6. Apply Scope
    const MAX_EXPORT_LIMIT = 5000;
    if (scope === 'page') {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    } else if (scope === 'top') {
      const limit = Math.min(Math.max(1, topN), MAX_EXPORT_LIMIT);
      query = query.limit(limit);
    } else { // 'filtered' or default
      query = query.limit(MAX_EXPORT_LIMIT);
    }
    
    const { data: rawUsers, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    // 7. Enrich data with last_login_at
    const authUserIds = (rawUsers || []).map(u => u.id).filter(Boolean);
    const lastLoginMap = new Map<string, string>();
    if (authUserIds.length > 0) {
        const { data: authUsersData } = await serviceSupabase.from('users').select('id, last_sign_in_at').in('id', authUserIds);
        if (authUsersData) {
            authUsersData.forEach(u => lastLoginMap.set(u.id, u.last_sign_in_at));
        }
    }
    
    // 8. Format Data for Excel based on selected fields
    const context = { communicatedUserIdSet, lastLoginMap };
    const dataToExport = (rawUsers as UserProfile[] || []).map(user => {
      const row: { [key: string]: any } = {};
      for (const key of exportFields) {
        if (FIELD_CONFIG[key]) {
          row[FIELD_CONFIG[key].header] = FIELD_CONFIG[key].getValue(user, context);
        }
      }
      return row;
    });

    // 9. Generate Excel File
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Profiles');
    
    // Set column widths for better readability
    worksheet['!cols'] = exportFields.map(key => {
        const header = FIELD_CONFIG[key]?.header || '';
        const widths: { [key: string]: number } = { email: 30, company_name: 25, name: 20, phone: 15, created_at: 18, last_login_at: 18 };
        return { wch: widths[key] || header.length + 5 };
    });

    const buf = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // 10. Create Response
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
