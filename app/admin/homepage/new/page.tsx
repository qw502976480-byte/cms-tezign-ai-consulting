import SectionEditor from '../section-editor';

export const dynamic = 'force-dynamic';

export default function NewSectionPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">新建首页模块</h1>
      </div>
      <SectionEditor />
    </div>
  );
}