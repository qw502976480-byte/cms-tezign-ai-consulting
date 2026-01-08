
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardSummaryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get('summary_range') || '7d';

  const ranges = [
    { value: 'today', label: '今日' },
    { value: '7d', label: '近 7 天' },
    { value: '30d', label: '近 30 天' },
  ];

  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('summary_range', val);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex bg-gray-100 p-1 rounded-lg">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => handleSelect(r.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            currentRange === r.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
