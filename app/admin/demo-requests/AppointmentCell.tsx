'use client';

import React from 'react';
import { DemoAppointment } from '@/types';
import { format, parseISO } from 'date-fns';

interface Props {
  appointment: DemoAppointment | undefined;
}

const statusMap: Record<string, { text: string; className: string }> = {
    completed: { text: '已完成', className: 'text-green-700' },
    no_show: { text: '未到场', className: 'text-yellow-700' },
    canceled: { text: '已取消', className: 'text-red-700' },
};


export default function AppointmentCell({ appointment }: Props) {
  if (!appointment) {
    return <span className="text-gray-400">未安排</span>;
  }

  const statusInfo = statusMap[appointment.status];

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="font-medium text-gray-800">
        {format(parseISO(appointment.scheduled_at), 'yyyy-MM-dd HH:mm')}
      </span>
      {statusInfo && (
        <span className={`text-xs font-bold ${statusInfo.className}`}>
            {statusInfo.text}
        </span>
      )}
    </div>
  );
}