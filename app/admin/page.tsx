import { createClient } from '@/utils/supabase/server';
import { FileText, Users, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = await createClient();
  
  const [
    { count: resourceCount },
    { count: regCount },
    { count: demoCount }
  ] = await Promise.all([
    supabase.from('resources').select('*', { count: 'exact', head: true }),
    supabase.from('registrations').select('*', { count: 'exact', head: true }),
    supabase.from('demo_requests').select('*', { count: 'exact', head: true }).eq('status', 'New'),
  ]);

  return { resourceCount, regCount, demoCount };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">仪表盘 (Dashboard)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Resources</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.resourceCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Registrations</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.regCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">New Demo Requests</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.demoCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}