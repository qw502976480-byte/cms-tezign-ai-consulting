import ContentEditor from '@/components/ContentEditor';

export const dynamic = 'force-dynamic';

export default function NewContentPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">新建内容</h1>
      </div>
      <ContentEditor />
    </div>
  );
}