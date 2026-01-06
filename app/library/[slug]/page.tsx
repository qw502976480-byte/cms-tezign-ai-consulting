import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getResource(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) {
    notFound();
  }
  return data;
}

export default async function ResourceDetailPage({ params }: { params: { slug: string } }) {
  const resource = await getResource(params.slug);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 lg:py-16">
        <div className="mb-8">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} />
            Back to Library
          </Link>
        </div>

        <article>
          <header className="mb-8">
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
              <div className="inline-flex items-center gap-1.5 capitalize bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                <Tag size={12} />
                {resource.category.replace(/_/g, ' ')}
              </div>
              {resource.published_at && (
                <div className="inline-flex items-center gap-1.5">
                   <Calendar size={12} />
                   <span>{new Date(resource.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {resource.title}
            </h1>
            {resource.summary && (
              <p className="mt-4 text-lg text-gray-600">
                {resource.summary}
              </p>
            )}
          </header>

          <div className="prose prose-lg max-w-none">
            {/* 
              A proper Markdown renderer (like react-markdown) would be used here
              for a real application. For this version, we display it as pre-formatted text.
            */}
            <pre className="whitespace-pre-wrap font-sans text-base">
                {resource.content || 'No content available.'}
            </pre>
          </div>
        </article>
      </div>
    </div>
  );
}