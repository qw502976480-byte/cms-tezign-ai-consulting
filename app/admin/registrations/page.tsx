import { createClient } from '@/utils/supabase/server';

export default async function RegistrationsPage() {
  const supabase = createClient();
  const { data: regs } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Locale</th>
              <th className="px-6 py-4">Consent</th>
              <th className="px-6 py-4">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {regs?.map((reg: any) => (
              <tr key={reg.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{reg.name}</td>
                <td className="px-6 py-4 text-gray-500">{reg.email}</td>
                <td className="px-6 py-4 text-gray-500">{reg.locale}</td>
                <td className="px-6 py-4 text-gray-500">{reg.consent_marketing ? 'Yes' : 'No'}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(reg.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
