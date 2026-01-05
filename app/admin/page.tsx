import { createClient } from '@/utils/supabase/server';
import { FileText, Users, Calendar } from 'lucide-react';

async function getStats() {
  const supabase = createClient();
  
  const [
    { count: publishedCount },
    { count: draftCount },
    { count: regCount },
    { count: demoCount }
  ] = await Promise.all([
    supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'Published'),
    supabase.from('content_items').select('*', { count: 'exact', head: true }).eq('status', 'Draft'),
    supabase.from('registrations').select('*', { count: 'exact', head: true }),
    supabase.from('demo_requests').select('*', { count: 'exact', head: true }).eq('status', 'New'),
  ]);

  return { publishedCount, draftCount, regCount, demoCount };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Content</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.publishedCount}</p>
              <p className="text-xs text-gray-400">{stats.draftCount} drafts</p>
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
      
      <div className="mt-12 bg-gray-100 p-8 rounded-xl text-center">
        <h3 className="text-lg font-medium text-gray-700">Analytics & AI Insights</h3>
        <p className="text-gray-500 text-sm mt-2">Coming next phase</p>
      </div>
    </div>
  );
}
