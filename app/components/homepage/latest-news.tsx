import Link from 'next/link';
import { Resource } from '@/types';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
// FIX: Import React to use React.FC for correct component typing.
import React from 'react';

interface LatestNewsProps {
  carouselItems: Resource[];
  fixedItems: Resource[];
}

// FIX: Define a dedicated props interface for the ResourceCard component.
// This resolves a TypeScript error where the special 'key' prop was not allowed
// when using a restrictive inline object type for props.
interface ResourceCardProps {
  resource: Resource;
  large?: boolean;
}

// FIX: The function is now typed as a React.FC (Functional Component).
// This tells TypeScript that it's a React component, which correctly handles
// special props like 'key' and prevents assignment errors when used in a list.
const ResourceCard: React.FC<ResourceCardProps> = ({ resource, large = false }) => {
  return (
    <Link href={`/library/${resource.slug}`} className="group block">
      <article className="h-full flex flex-col bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow duration-300">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="capitalize bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-medium">
              {resource.category.replace(/_/g, ' ')}
            </span>
            {resource.published_at && (
              <time dateTime={resource.published_at} className="text-gray-400">
                {format(new Date(resource.published_at), 'MMM d, yyyy')}
              </time>
            )}
          </div>
          <h3 className={`font-semibold text-gray-900 group-hover:text-gray-600 transition-colors ${large ? 'text-xl' : 'text-lg'}`}>
            {resource.title}
          </h3>
          {large && resource.summary && (
            <p className="mt-2 text-sm text-gray-500 line-clamp-2">
              {resource.summary}
            </p>
          )}
        </div>
        <div className="mt-4 text-sm font-semibold text-gray-900 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Read More <ArrowRight size={14} />
        </div>
      </article>
    </Link>
  );
}

export default function LatestNewsModule({ carouselItems, fixedItems }: LatestNewsProps) {
  const mainCarouselItem = carouselItems.length > 0 ? carouselItems[0] : null;
  const subCarouselItems = carouselItems.length > 1 ? carouselItems.slice(1, 3) : []; // Show next two

  return (
    <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-12">
      {/* Left Side: Carousel Section */}
      <div className="lg:col-span-2">
        {carouselItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mainCarouselItem && (
              <div className="md:col-span-2">
                 <ResourceCard resource={mainCarouselItem} large={true} />
              </div>
            )}
            {subCarouselItems.map(item => (
              <ResourceCard key={item.id} resource={item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100 rounded-2xl border border-gray-200 text-gray-400">
            暂无推荐内容
          </div>
        )}
      </div>

      {/* Right Side: Fixed List Section */}
      <div>
        {fixedItems.length > 0 ? (
          <div className="space-y-4">
            {fixedItems.map(item => (
              <Link key={item.id} href={`/library/${item.slug}`} className="group block">
                <div className="border-b border-gray-100 pb-3 hover:border-gray-300 transition-colors">
                  <h4 className="font-medium text-gray-800 group-hover:text-black">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {item.category.replace(/_/g, ' ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100 rounded-2xl border border-gray-200 text-gray-400 p-6">
            暂无内容
          </div>
        )}
      </div>
    </div>
  );
}
