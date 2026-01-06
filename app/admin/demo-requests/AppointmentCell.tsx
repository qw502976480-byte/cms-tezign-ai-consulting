'use client';

import React, { useState, useTransition } from 'react';
import { DemoRequest, DemoAppointment } from '@/types';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  request: DemoRequest;
  appointment: DemoAppointment | undefined;
}

const TIME_SLOTS = [
  "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"
];

export default function AppointmentCell({ request, appointment }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const initialSlot = appointment ? format(parseISO(appointment.scheduled_at), 'HH:mm') : '';
  const [selectedSlot, setSelectedSlot] = useState<string>(TIME_SLOTS.includes(initialSlot) ? initialSlot : '');
  
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
        alert("Please select a time slot.");
        return;
    }
    setIsLoading(true);

    try {
      const response = await fetch(`/api/demo-requests/${request.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slot: selectedSlot }),
      });

      if (response.status === 409) {
        const data = await response.json();
        alert(data.error || "This time slot is already full.");
      } else if (!response.ok) {
        throw new Error('Failed to schedule appointment.');
      } else {
        handleCloseModal();
        router.refresh();
      }
    } catch (error: any) {
      alert(`An error occurred: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isCompleted = appointment?.status === 'completed';
  const appointmentDate = format(parseISO(request.created_at), 'yyyy-MM-dd');

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
              {appointment ? '改期预约' : '安排预约'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">预约日期 (固定)</label>
                <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                  {appointmentDate}
                </div>
              </div>
              <div>
                <label htmlFor="slot-select" className="block text-sm font-medium text-gray-700 mb-1">选择时段</label>
                <select
                  id="slot-select"
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                >
                  <option value="" disabled>--请选择--</option>
                  {TIME_SLOTS.map(slot => (
                    <option key={slot} value={slot}>{`${slot} - ${slot.split(':')[0]}:59`}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-black disabled:opacity-50 flex items-center justify-center"
                  style={{ minWidth: '90px' }}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}