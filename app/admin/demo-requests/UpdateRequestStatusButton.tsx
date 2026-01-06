'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';
import { DemoRequestStatus } from '@/types';

interface Props {
  id: string;
  status: DemoRequestStatus;
}

export default function UpdateRequestStatusButton({ id, status }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const isPending = status === 'pending';
    const newStatus: DemoRequestStatus = isPending ? 'processed' : 'pending';
    const newProcessedAt = isPending ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('demo_requests')
      .update({ status: newStatus, processed_at: newProcessedAt })
      .eq('id', id);
    
    if (error) {
      alert(`Error updating status: ${error.message}`);
    } else {
      router.refresh();
    }
    
    setLoading(false);
  };

  const isPending = status === 'pending';
  const buttonText = isPending ? '标记已处理' : '回退为待处理';
  const buttonClass = isPending 
    ? "bg-gray-900 text-white hover:bg-black"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center justify-center text-xs font-medium px-3 py-1.5 rounded-md transition disabled:opacity-50 ${buttonClass}`}
      style={{ minWidth: '90px' }}
    >
      {loading ? <Loader2 className="animate-spin" size={14} /> : buttonText}
    </button>
  );
}