'use client';

import { useTransition } from 'react';
import { DemoAppointment, DemoAppointmentStatus } from '@/types';
import { updateAppointmentStatus } from './actions';
import { Loader2, Check, X, Ban } from 'lucide-react';

interface Props {
  appointment: DemoAppointment | undefined;
}

export default function AppointmentActions({ appointment }: Props) {
  const [isPending, startTransition] = useTransition();

  if (!appointment || appointment.status !== 'scheduled') {
    return null;
  }

  const handleUpdate = (newStatus: DemoAppointmentStatus) => {
    startTransition(async () => {
      await updateAppointmentStatus(appointment.id, newStatus);
    });
  };

  return (
    <div className="flex items-center gap-1">
      {isPending ? (
         <div className="p-1.5 text-gray-500">
            <Loader2 className="animate-spin" size={14} />
         </div>
      ) : (
        <>
            <button
                onClick={() => handleUpdate('completed')}
                title="标记已完成"
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
            >
                <Check size={14} />
            </button>
            <button
                onClick={() => handleUpdate('no_show')}
                title="标记未到"
                className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
            >
                <Ban size={14} />
            </button>
            <button
                onClick={() => handleUpdate('canceled')}
                title="取消预约"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
                <X size={14} />
            </button>
        </>
      )}
    </div>
  );
}
