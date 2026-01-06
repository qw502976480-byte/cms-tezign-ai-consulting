
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DemoRequest, DemoAppointment, DemoRequestStatus, DemoRequestOutcome, UserProfile } from '@/types';
import { format } from 'date-fns';
import AppointmentCell from './AppointmentCell';
import Countdown from './Countdown';
import RequestActions from './UpdateRequestStatusButton';
import ContactCell from './ContactCell';
import RequestDetailDialog from './RequestDetailDialog';
import StatsOverview from './StatsOverview';
// Import User Detail Modal from registered-users
import UserDetailModal from '../registered-users/UserDetailModal';
import { Clock, CheckCircle2, CircleDashed } from 'lucide-react';

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
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState<CombinedItem | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);

  const handleUpdate = async (id: string, newOutcome: DemoRequestOutcome) => {
    const newStatus: DemoRequestStatus = 'processed';
    const previousItems = [...items];
    
    // Optimistic UI
    setItems(current => current.map(item => {
      if (item.request.id === id) {
        return {
          ...item,
          request: {
            ...item.request,
            status: newStatus,
            outcome: newOutcome,
            processed_at: new Date().toISOString() 
          }
        };
      }
      return item;
    }));

    try {
      const response = await fetch(`/api/demo-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: newOutcome }),
      });

      if (!response.ok) throw new Error(`Update failed: ${response.status}`);
      router.refresh();

    } catch (error: any) {
      console.error('Update failed:', error);
      alert(`更新失败: ${error.message}`);
      setItems(previousItems); 
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const statusWeightA = a.request.status === 'pending' ? 0 : 1;
      const statusWeightB = b.request.status === 'pending' ? 0 : 1;
      if (statusWeightA !== statusWeightB) return statusWeightA - statusWeightB;
      return new Date(b.request.created_at).getTime() - new Date(a.request.created_at).getTime();
    });
  }, [items]);

  const getStatusBadge = (status: DemoRequestStatus) => {
    if (status === 'pending') {
        return { 
          text: '待处理', 
          icon: CircleDashed,
          className: 'bg-amber-50 text-amber-700 border-amber-200' 
        };
    }
    return { 
      text: '已处理', 
      icon: CheckCircle2,
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200' 
    };
  };

  return (
    <div className="space-y-6">
      <StatsOverview />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4 w-[200px]">申请时间/公司</th>
              <th className="px-6 py-4 w-[240px]">联系人 (UserProfile)</th>
              <th className="px-6 py-4 w-[120px]">状态</th>
              <th className="px-6 py-4 w-[180px]">预约时间</th>
              <th className="px-6 py-4 w-[150px]">倒计时</th>
              <th className="px-6 py-4 text-right">沟通结果</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedItems.map((item) => {
              const { request: req, appointment } = item;
              const statusBadge = getStatusBadge(req.status);
              
              // Fallback to legacy snapshot fields if user_profile is missing
              const displayProfile = req.user_profile || {
                 id: req.user_id,
                 name: req.name,
                 email: req.email,
                 phone: req.phone,
                 company_name: req.company,
                 title: req.title,
                 created_at: req.created_at,
                 user_type: 'personal', // Default
                 use_case_tags: [],
                 interest_tags: [],
                 pain_points: null,
              } as UserProfile;

              return (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 text-gray-500 align-top">
                    {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                    <p className="font-medium text-gray-900 mt-1 truncate max-w-[160px]" title={displayProfile.company_name || ''}>
                        {displayProfile.company_name || '-'}
                    </p>
                    <p className="text-xs truncate max-w-[160px]" title={displayProfile.title || ''}>
                        {displayProfile.title || '-'}
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <ContactCell 
                        user={displayProfile} 
                        onClick={() => setSelectedUserProfile(displayProfile)} 
                    />
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${statusBadge.className}`}>
                      <statusBadge.icon size={12} className="shrink-0" />
                      <span>{statusBadge.text}</span>
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

      {/* Legacy Request Detail Dialog (Logs etc) */}
      {selectedRequestForDetail && (
        <RequestDetailDialog 
            isOpen={!!selectedRequestForDetail}
            onClose={() => setSelectedRequestForDetail(null)}
            request={selectedRequestForDetail.request}
            appointment={selectedRequestForDetail.appointment}
        />
      )}

      {/* User Profile Modal */}
      <UserDetailModal 
         user={selectedUserProfile}
         isOpen={!!selectedUserProfile}
         onClose={() => setSelectedUserProfile(null)}
         onNoteSaved={() => router.refresh()}
      />
    </div>
  );
}