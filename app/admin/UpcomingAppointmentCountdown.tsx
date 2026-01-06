
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Props {
  scheduledAt: string;
}

export default function UpcomingAppointmentCountdown({ scheduledAt }: Props) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const calculateCountdown = () => {
      const targetDate = parseISO(scheduledAt);
      const distance = formatDistanceToNow(targetDate, { addSuffix: true, locale: zhCN });
      setCountdown(distance);
    };

    calculateCountdown();
    // Update every 30 seconds to keep it relatively fresh
    const interval = setInterval(calculateCountdown, 30000); 

    return () => clearInterval(interval);
  }, [scheduledAt]);

  return (
    <p className="text-xs text-indigo-600 font-medium mt-1">
      {countdown}
    </p>
  );
}
