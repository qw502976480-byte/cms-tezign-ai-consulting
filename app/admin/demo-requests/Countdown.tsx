'use client';

import { useState, useEffect } from 'react';
import { differenceInSeconds, parseISO } from 'date-fns';

interface Props {
  scheduledAt: string;
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

export default function Countdown({ scheduledAt }: Props) {
  const calculateTime = () => {
    const targetDate = parseISO(scheduledAt);
    const now = new Date();
    const secondsDiff = differenceInSeconds(targetDate, now);
    return formatDuration(secondsDiff);
  };
  
  const [displayTime, setDisplayTime] = useState(calculateTime);

  useEffect(() => {
    // Update every minute
    const timer = setInterval(() => {
      setDisplayTime(calculateTime());
    }, 60000); 

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledAt]);

  const textColor = displayTime.isOverdue ? 'text-red-600' : 'text-blue-600';

  return (
    <span className={`text-sm font-medium ${textColor}`}>
      {displayTime.text}
    </span>
  );
}