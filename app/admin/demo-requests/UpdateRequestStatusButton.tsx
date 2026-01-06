'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DemoRequest, DemoRequestStatus } from '@/types';
import { Loader2 } from 'lucide-react';

interface Props {
  request: DemoRequest;
}

export default function RequestActions({ request }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // If status is not pending, we usually hide buttons. 
  // However, since we might want to revert 'processed' to 'pending' via Cancel, 
  // we could theoretically show Cancel here. 
  // But based on current requirements, we focus on the pending state.
  if (request.status !== 'pending') {
    return <span className="text-gray-500">—</span>;
  }

  const handleUpdate = async (newStatus: DemoRequestStatus) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/demo-requests/${request.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        let errorMessage = 'Failed to update status';
        try {
          const json = JSON.parse(errorText);
          if (json.error) errorMessage = json.error;
        } catch (e) {
          // If not JSON, use the text
          if (errorText) errorMessage = errorText;
        }
        
        throw new Error(errorMessage);
      }

      router.refresh();
    } catch (error: any) {
      console.error('Failed to update request status:', error);
      alert(`An error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {loading ? (
        <div className="flex justify-center items-center h-[30px] w-[116px]">
          <Loader2 className="animate-spin text-gray-500" size={16} />
        </div>
      ) : (
        <>
          <button
            onClick={() => handleUpdate('pending')}
            title="标记为未处理 (Cancel)"
            aria-label="标记为未处理"
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => handleUpdate('processed')}
            title="标记为已处理 (Complete)"
            aria-label="标记为已处理"
            className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-900 rounded-md hover:bg-black transition-colors"
          >
            完成
          </button>
        </>
      )}
    </div>
  );
}
