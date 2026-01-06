import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import LatestNewsModule from '@/app/components/homepage/latest-news';
import { Resource } from '@/types';

async function getLatestNewsData(): Promise<{ carouselItems: Resource[], fixedItems: Resource[] }> {
  const supabase = await createClient();
  try {
    // 1. Get homepage modules configuration for carousel and fixed list
    const { data: modules, error: modulesError } = await supabase
      .from('homepage_modules')
      .select('type, content_item_ids')
      .in('type', ['latest_updates_carousel', 'latest_updates_fixed']);

    if (modulesError) throw modulesError;

    // 2. Extract resource IDs, defaulting to empty arrays and respecting limits
    const carouselModule = modules.find(m => m.type === 'latest_updates_carousel');
    const fixedModule = modules.find(m => m.type === 'latest_updates_fixed');

    const carouselIds = carouselModule?.content_item_ids?.slice(0, 5) || [];
    const fixedIds = fixedModule?.content_item_ids?.slice(0, 3) || [];
    
    // Combine IDs and remove duplicates for a single efficient fetch
    const allIds = [...carouselIds, ...fixedIds].filter((id, i, arr) => arr.indexOf(id) === i);

    if (allIds.length === 0) {
      return { carouselItems: [], fixedItems: [] };
    }

    // 3. Fetch all required resources that are published
    const { data: resources, error: resourcesError } = await supabase
      .from('resources')
      .select('id, title, slug, category, summary, published_at')
      .in('id', allIds)
      .eq('status', 'published');

    if (resourcesError) throw resourcesError;
    if (!resources) return { carouselItems: [], fixedItems: [] };

    // 4. Map resources and re-order them to match the exact order from the CMS config
    const resourceMap = new Map(resources.map(r => [r.id, r as Resource]));
    
    const orderedCarouselItems = (carouselIds as string[])
      .map((id: string) => resourceMap.get(id))
      .filter((x): x is Resource => Boolean(x));

    const orderedFixedItems = (fixedIds as string[])
      .map((id: string) => resourceMap.get(id))
      .filter((x): x is Resource => Boolean(x));

    return { carouselItems: orderedCarouselItems, fixedItems: orderedFixedItems };

  } catch (error) {
    console.error("Failed to fetch latest news data for homepage:", error);
    // Gracefully degrade by returning empty arrays, preventing the page from crashing
    return { carouselItems: [], fixedItems: [] };
  }
}

export default async function Home() {
  const { carouselItems, fixedItems } = await getLatestNewsData();

  return (
    <div className="bg-white">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <a href="#" className="-m-1.5 p-1.5">
              <span className="text-xl font-bold">Tezign AI</span>
            </a>
          </div>
          <div className="hidden lg:flex lg:gap-x-12">
             <a href="/library" className="text-sm font-semibold leading-6 text-gray-900">Library</a>
          </div>
          <div className="flex flex-1 justify-end">
            <Link href="/admin" className="text-sm font-semibold leading-6 text-gray-900">
              Admin <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </nav>
      </header>
      <main>
        {/* Placeholder for Hero Section */}
        <div className="relative isolate px-6 pt-14 lg:px-8 h-screen flex items-center justify-center -mt-20">
           <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">AI-Native Consulting</h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">This is the public-facing website.</p>
           </div>
        </div>

        {/* Latest News Section */}
        <div className="bg-gray-50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:max-w-none">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">最新动态</h2>
              <p className="mt-2 text-lg leading-8 text-gray-600">
                探索我们的最新洞察、报告与研究
              </p>
              <LatestNewsModule carouselItems={carouselItems} fixedItems={fixedItems} />
            </div>
          </div>
        </div>

        {/* Other sections can be added here */}
      </main>
    </div>
  );
}