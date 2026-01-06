'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DemoRequest, DemoAppointment, DemoRequestStatus, DemoRequestOutcome } from '@/types';
import { format } from 'date-fns';
import { PieChart, CheckCircle2, Circle, XCircle, Phone } from 'lucide-react';
import AppointmentCell from './AppointmentCell';
import Countdown from './Countdown';
import RequestActions from './UpdateRequestStatusButton';
import ContactCell from './ContactCell';
import RequestDetailDialog from './RequestDetailDialog';

interface CombinedItem {
  request: DemoRequest;
  appointment: DemoAppointment | undefined;
}

interface Props {
  initialItems: CombinedItem[];
}

export default function RequestListClient({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CombinedItem[]>(initialItems);
  
  // Dialog State
  const [selectedItem, setSelectedItem] = useState<CombinedItem | null>(null);

  // --- Core Logic: Update based on Outcome only ---
  const handleUpdate = async (id: string, newOutcome: DemoRequestOutcome) => {
    // 1. Calculate Expected Status based on Rule
    // outcome set -> status MUST be processed
    const newStatus: DemoRequestStatus = 'processed';

    // 2. Optimistic Update
    const previousItems = [...items];
    setItems(current => current.map(item => {
      if (item.request.id === id) {
        return {
          ...item,
          request: {
            ...item.request,
            status: newStatus,
            outcome: newOutcome,
            // Update timestamp optimistically
            processed_at: new Date().toISOString() 
          }
        };
      }
      return item;
    }));

    try {
      // 3. Call API
      const response = await fetch(`/api/demo-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: newOutcome }), // Only send outcome
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status}:`, errorText);
        throw new Error(`Update failed: ${response.status}`);
      }

      // 4. Background Refresh
      router.refresh();

    } catch (error: any) {
      console.error('Update failed:', error);
      alert(`更新失败: ${error.message}`);
      setItems(previousItems); // Revert
    }
  };

  // --- Sorting: Pending Top, then Processed. Within groups: Created Desc ---
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // 1. Status Priority: Pending (0) < Processed (1)
      const statusWeightA = a.request.status === 'pending' ? 0 : 1;
      const statusWeightB = b.request.status === 'pending' ? 0 : 1;

      if (statusWeightA !== statusWeightB) {
        return statusWeightA - statusWeightB;
      }

      // 2. Date: Newest first
      return new Date(b.request.created_at).getTime() - new Date(a.request.created_at).getTime();
    });
  }, [items]);

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter(i => i.request.status === 'pending').length;
    const processed = items.filter(i => i.request.status === 'processed').length;
    const completed = items.filter(i => i.request.outcome === 'completed').length;
    const cancelled = items.filter(i => i.request.outcome === 'cancelled').length;
    return { total, pending, processed, completed, cancelled };
  }, [items]);

  const getStatusBadge = (status: DemoRequestStatus) => {
    if (status === 'pending') {
        return { text: '待处理', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    }
    return { text: '已处理', className: 'bg-green-100 text-green-800 border-green-200' };
  };

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex flex-col md:flex-row gap-6 bg-white border border-gray-200 px-5 py-4 rounded-xl shadow-sm text-sm">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-semibold text-gray-900">
               <PieChart size={16} />
               当前筛选
           </div>
           <div className="h-4 w-px bg-gray-200"></div>
           <div className="flex items-center gap-2">
                <Circle size={10} className="fill-yellow-400 text-yellow-400" />
                <span className="text-gray-600">待处理</span>
                <span className="font-medium text-gray-900">{stats.pending}</span>
           </div>
           <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-gray-400" />
                <span className="text-gray-600">已处理</span>
                <span className="font-medium text-gray-900">{stats.processed}</span>
           </div>
           <div className="h-4 w-px bg-gray-200"></div>
           <div className="text-gray-500">
                共 {stats.total} 条
           </div>
        </div>
        
        <div className="h-px w-full bg-gray-100 md:hidden"></div>
        <div className="hidden md:block h-auto w-px bg-gray-200"></div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-semibold text-gray-900">
               <Phone size={16} />
               沟通结果
           </div>
           <div className="h-4 w-px bg-gray-200"></div>
           <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-600" />
                <span className="text-gray-600">已完成</span>
                <span className="font-medium text-gray-900">{stats.completed}</span>
           </div>
           <div className="flex items-center gap-2">
                <XCircle size={12} className="text-gray-400" />
                <span className="text-gray-600">已取消</span>
                <span className="font-medium text-gray-900">{stats.cancelled}</span>
           </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 w-[200px]">申请时间/公司</th>
              <th className="px-6 py-4 w-[240px]">联系人</th>
              <th className="px-6 py-4 w-[100px]">状态</th>
              <th className="px-6 py-4 w-[180px]">预约时间</th>
              <th className="px-6 py-4 w-[150px]">倒计时</th>
              <th className="px-6 py-4 text-right">沟通结果</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedItems.map((item) => {
              const { request: req, appointment } = item;
              const statusBadge = getStatusBadge(req.status);
              return (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 text-gray-500 align-top">
                    {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                    <p className="font-medium text-gray-900 mt-1 truncate max-w-[160px]" title={req.company || ''}>{req.company || '-'}</p>
                    <p className="text-xs truncate max-w-[160px]" title={req.title || ''}>{req.title || '-'}</p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <ContactCell request={req} onClick={() => setSelectedItem(item)} />
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}>
                      {statusBadge.text}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <AppointmentCell appointment={appointment} />
                  </td>
                  <td className="px-6 py-4 align-top">
                     <Countdown appointment={appointment} />
                  </td>
                  <td className="px-6 py-4 text-right align-top">
                    <RequestActions 
                      request={req} 
                      onUpdate={handleUpdate} 
                    />
                  </td>
                </tr>
              );
            })}
             {sortedItems.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-16 text-gray-400">
                        暂无符合条件的数据
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      {selectedItem && (
        <RequestDetailDialog 
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            request={selectedItem.request}
            appointment={selectedItem.appointment}
        />
      )}
    </div>
  );
}
