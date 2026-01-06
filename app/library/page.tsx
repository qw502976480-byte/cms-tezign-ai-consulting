import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Resource } from '@/types';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: resources, error } = await supabase
    .from('resources')
    .select('id, title, slug, category, summary, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-lg border border-red-200 text-red-600">
          <p>Error loading library resources: {error.message}</p>
        </div>
      </div>
    );
  }

  const typedResources = resources as Partial<Resource>[] | null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Resource Library</h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Discover our latest insights, reports, and case studies.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {typedResources?.map((item) => (
            <Link 
              key={item.id} 
              href={`/library/${item.slug}`}
              className="block group h-full"
            >
              <div className="bg-white h-full rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize border border-gray-200">
                    {item.category?.replace(/_/g, ' ') || 'Uncategorized'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Recently'}
                  </span>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                  {item.title}
                </h3>
                
                <p className="text-base text-gray-500 line-clamp-3 flex-grow">
                  {item.summary || 'No summary available.'}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-sm font-medium text-gray-900 group-hover:underline">
                  Read more &rarr;
                </div>
              </div>
            </Link>
          ))}

          {(!resources || resources.length === 0) && (
            <div className="col-span-full text-center py-16">
              <p className="text-gray-500 text-lg">No published resources found yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}