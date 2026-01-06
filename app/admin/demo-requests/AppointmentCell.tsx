'use client';

import React, { useState, useTransition } from 'react';
import { DemoRequest, DemoAppointment } from '@/types';
import { format, parseISO } from 'date-fns';
import { upsertAppointment } from './actions';
import { Loader2 } from 'lucide-react';

interface Props {
  request: DemoRequest;
  appointment: DemoAppointment | undefined;
}

export default function AppointmentCell({ request, appointment }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (appointment?.scheduled_at) {
      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const d = parseISO(appointment.scheduled_at);
      return format(d, "yyyy-MM-dd'T'HH:mm");
    }
    return '';
  });
  const [isPending, startTransition] = useTransition();

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
        alert("Please select a date and time.");
        return;
    }
    startTransition(async () => {
      await upsertAppointment(request.id, scheduledAt);
      handleCloseModal();
    });
  };

  const isCompleted = appointment?.status === 'completed';

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        {appointment ? (
          <>
            <span className="font-medium text-gray-800">
              {format(parseISO(appointment.scheduled_at), 'yyyy-MM-dd HH:mm')}
            </span>
            {isCompleted && <span className="text-xs text-green-700 font-bold">已完成</span>}
          </>
        ) : (
          <span className="text-gray-400">未安排</span>
        )}
        {!isCompleted && (
          <button 
            onClick={handleOpenModal}
            className="text-xs text-gray-600 font-medium hover:text-black hover:underline"
          >
            {appointment ? '改期' : '安排'}
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">
              {appointment ? '改期预约' : '安排预约'} for {request.name}
            </h3>
            <form onSubmit={handleSubmit}>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                required
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-black disabled:opacity-50 flex items-center justify-center"
                  style={{ minWidth: '90px' }}
                >
                  {isPending ? <Loader2 className="animate-spin" size={16} /> : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}