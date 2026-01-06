'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DemoRequest } from '@/types';
import { Loader2 } from 'lucide-react';

interface Props {
  request: DemoRequest;
}

export default function RequestActions({ request }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (request.status !== 'pending') {
    return <span className="text-gray-500">—</span>;
  }

  const handleUpdate = async (newStatus: 'completed' | 'cancelled') => {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      router.refresh();
    } catch (error) {
      console.error('Failed to update request status:', error);
      alert('An error occurred while updating the status. Please try again.');
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
            onClick={() => handleUpdate('cancelled')}
            title="标记为已取消"
            aria-label="标记为已取消"
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => handleUpdate('completed')}
            title="标记为已完成"
            aria-label="标记为已完成"
            className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 border border-gray-900 rounded-md hover:bg-black transition-colors"
          >
            完成
          </button>
        </>
      )}
    </div>
  );
}
