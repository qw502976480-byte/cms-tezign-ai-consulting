'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function DemoRequestsPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const { data } = await supabase.from('demo_requests').select('*').order('created_at', { ascending: false });
    setRequests(data || []);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('demo_requests').update({ status }).eq('id', id);
    loadRequests();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">演示申请管理</h1>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4">联系人</th>
              <th className="px-6 py-4">时区</th>
              <th className="px-6 py-4">备注</th>
              <th className="px-6 py-4">状态</th>
              <th className="px-6 py-4">申请时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{req.name}</p>
                  <p className="text-gray-500 text-xs">{req.email}</p>
                </td>
                <td className="px-6 py-4 text-gray-500">{req.timezone}</td>
                <td className="px-6 py-4 text-gray-500 truncate max-w-xs">{req.notes}</td>
                <td className="px-6 py-4">
                  <select 
                    value={req.status} 
                    onChange={(e) => updateStatus(req.id, e.target.value)}
                    className={`border-none bg-transparent font-medium focus:ring-0 ${
                      req.status === 'New' ? 'text-blue-600' :
                      req.status === 'Confirmed' ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    <option value="New">新申请 (New)</option>
                    <option value="Confirmed">已确认 (Confirmed)</option>
                    <option value="Completed">已完成 (Completed)</option>
                    <option value="Canceled">已取消 (Canceled)</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}