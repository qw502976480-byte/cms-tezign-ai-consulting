import { createClient } from '@/utils/supabase/server';
import { DemoRequest } from '@/types';
import { format } from 'date-fns';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import Filters from './Filters';
import UpdateRequestStatusButton from './UpdateRequestStatusButton';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: 'pending' | 'processed' | 'all';
  range?: '7d' | '30d' | 'custom';
  start?: string;
  end?: string;
}

export default async function DemoRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();

  const status = searchParams.status || 'all';
  const range = searchParams.range || '30d'; // Default to last 30 days

  // Build Query
  let query = supabase.from('demo_requests').select('*').order('created_at', { ascending: false });

  // Status Filter
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // Date Range Filter
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (range === '7d') {
    startDate = subDays(new Date(), 7);
  } else if (range === '30d') {
    startDate = subDays(new Date(), 30);
  } else if (range === 'custom' && searchParams.start && searchParams.end) {
    try {
        startDate = startOfDay(new Date(searchParams.start));
        endDate = endOfDay(new Date(searchParams.end));
    } catch (e) {
        // Invalid date format, fallback to default
        startDate = subDays(new Date(), 30);
    }
  } else {
    // Default case if range is invalid, fallback to 30d
    startDate = subDays(new Date(), 30);
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }
  
  const { data, error } = await query;
  const requests = (data as DemoRequest[]) || [];

  if (error) {
    console.error('Error fetching demo requests:', error.message);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">演示申请管理</h1>
      <Filters searchParams={searchParams} />
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4">申请时间</th>
              <th className="px-6 py-4">联系人</th>
              <th className="px-6 py-4">公司/职位</th>
              <th className="px-6 py-4">状态</th>
              <th className="px-6 py-4">处理时间</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((req: DemoRequest) => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-500">
                    {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{req.name}</p>
                  <p className="text-gray-500 text-xs">{req.email}</p>
                  {req.phone && <p className="text-gray-500 text-xs mt-1">{req.phone}</p>}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  <p className="font-medium text-gray-800">{req.company || '-'}</p>
                  <p className="text-xs">{req.title || '-'}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      req.status === 'processed' 
                        ? 'bg-green-100 text-green-800 border-green-200' 
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }`}>
                    {req.status === 'processed' ? '已处理' : '待处理'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                    {req.processed_at ? format(new Date(req.processed_at), 'yyyy-MM-dd HH:mm') : '-'}
                </td>
                <td className="px-6 py-4 text-right">
                    <UpdateRequestStatusButton id={req.id} status={req.status} />
                </td>
              </tr>
            ))}
             {requests.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                        在当前筛选条件下没有找到申请。
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}