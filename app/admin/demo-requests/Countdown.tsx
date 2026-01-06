'use client';

import { useState, useEffect } from 'react';
import { differenceInSeconds, parseISO } from 'date-fns';
import { DemoAppointment } from '@/types';

interface Props {
  appointment: DemoAppointment | undefined;
}

function formatDuration(totalSeconds: number): { text: string; isOverdue: boolean } {
  const isOverdue = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  
  const days = Math.floor(absSeconds / (3600 * 24));
  const hours = Math.floor((absSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);

  let parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (days === 0 && hours === 0 && minutes > 0) parts.push(`${minutes}分钟`);
  if (parts.length === 0) {
      return { text: isOverdue ? '刚刚逾期' : '即将开始', isOverdue };
  }

  const prefix = isOverdue ? '已逾期' : '还剩';
  return { text: `${prefix} ${parts.join(' ')}`, isOverdue };
}

export default function Countdown({ appointment }: Props) {
  if (!appointment) {
    return <span className="text-gray-400">—</span>;
  }
  
  if (appointment.status !== 'scheduled') {
    switch (appointment.status) {
        case 'completed': return <span className="text-sm text-green-700 font-medium">已完成</span>;
        case 'no_show': return <span className="text-sm text-yellow-700 font-medium">未到场</span>;
        case 'canceled': return <span className="text-sm text-red-700 font-medium">已取消</span>;
        default: return <span className="text-gray-400">—</span>;
    }
  }

  const calculateTime = () => {
    const targetDate = parseISO(appointment.scheduled_at);
    const now = new Date();
    const secondsDiff = differenceInSeconds(targetDate, now);
    return formatDuration(secondsDiff);
  };
  
  const [displayTime, setDisplayTime] = useState(calculateTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayTime(calculateTime());
    }, 60000); 

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.scheduled_at]);

  const textColor = displayTime.isOverdue ? 'text-red-600' : 'text-blue-600';

  return (
    <span className={`text-sm font-medium ${textColor}`}>
      {displayTime.text}
    </span>
  );
}