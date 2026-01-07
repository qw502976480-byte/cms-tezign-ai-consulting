
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ResourceStatus } from '@/types';
import { Edit2, Star, Pin, Trash2, UploadCloud, DownloadCloud, Loader2 } from 'lucide-react';
import { bulkPublishResources, bulkUnpublishResources, bulkDeleteResources } from './actions';

interface ResourceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  status: ResourceStatus;
  published_at: string | null;
  created_at: string;
  isFeatured: boolean;
  isFixed: boolean;
}

interface Props {
  initialResources: ResourceRow[];
}

export default function ResourceList({ initialResources }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(initialResources.map(r => r.id)));
    } else {
      // FIX: Ensure the new Set is explicitly typed to avoid type widening to Set<any>.
      setSelectedIds(new Set<string>());
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleAction = (action: 'publish' | 'unpublish' | 'delete') => {
    if (selectedIds.size === 0) return;
    
    if (action === 'delete') {
      setShowDeleteConfirm(true);
      return;
    }

    startTransition(async () => {
      const ids = Array.from(selectedIds);
      let result;
      if (action === 'publish') {
        result = await bulkPublishResources(ids);
      } else {
        result = await bulkUnpublishResources(ids);
      }

      if (result.success) {
        // Simple feedback, a toast library would be better in a real app
        alert(`成功处理 ${result.count} 条资源`);
        setSelectedIds(new Set());
        router.refresh();
      } else {
        alert(`操作失败: ${result.error}`);
      }
    });
  };
  
  const confirmDelete = () => {
     startTransition(async () => {
        const ids = Array.from(selectedIds);
        const result = await bulkDeleteResources(ids);

        if (result.success) {
          alert(`成功删除 ${result.count} 条资源`);
          setSelectedIds(new Set());
        } else {
          alert(`删除失败: ${result.error}`);
        }
        setShowDeleteConfirm(false);
        router.refresh();
     });
  };

  const isAllSelected = selectedIds.size > 0 && selectedIds.size === initialResources.length;

  return (
    <div className="space-y-4">
      {/* Sticky Bulk Action Bar */}
      <div className={`sticky top-0 z-10 bg-gray-50/80 backdrop-blur-sm py-3 transition-opacity duration-300 ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between h-10 px-4 border border-gray-200 bg-white rounded-xl shadow-sm">
          <span className="text-sm font-medium text-gray-700">
            已选择 {selectedIds.size} 条
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => handleAction('publish')} disabled={isPending} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50">
              <UploadCloud size={14} /> 上架
            </button>
            <button onClick={() => handleAction('unpublish')} disabled={isPending} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50">
              <DownloadCloud size={14} /> 下架
            </button>
            <button onClick={() => handleAction('delete')} disabled={isPending} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 transition-colors disabled:opacity-50">
              <Trash2 size={14} /> 删除
            </button>
            {isPending && <Loader2 className="animate-spin text-gray-400" size={16} />}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 font-medium border-b border-gray-200 bg-gray-50/50">
            <tr>
              <th className="px-4 py-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
              </th>
              <th className="px-6 py-4 font-medium text-left w-1/4">标题</th>
              <th className="px-6 py-4 font-medium text-left">状态</th>
              <th className="px-6 py-4 font-medium text-left">首页推荐</th>
              <th className="px-6 py-4 font-medium text-left">发布日期</th>
              <th className="px-6 py-4 font-medium text-left">分类</th>
              <th className="px-6 py-4 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialResources.map((resource) => (
              <tr key={resource.id} className={`transition-colors ${selectedIds.has(resource.id) ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(resource.id)}
                    onChange={() => handleSelectOne(resource.id)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">
                  <div className="truncate max-w-xs" title={resource.title}>{resource.title}</div>
                </td>
                <td className="px-6 py-4">
                  {resource.status === 'published' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 border border-green-100 whitespace-nowrap">Published</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200 uppercase whitespace-nowrap">{resource.status || 'Draft'}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5 items-start">
                    {resource.isFeatured && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap"><Star size={10} fill="currentColor" /> Featured</span>}
                    {resource.isFixed && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap"><Pin size={10} /> Fixed List</span>}
                    {!resource.isFeatured && !resource.isFixed && <span className="text-gray-300 text-xs">-</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs tabular-nums">{resource.published_at ? new Date(resource.published_at).toLocaleDateString() : '-'}</td>
                <td className="px-6 py-4">
                  <span className="capitalize text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100 whitespace-nowrap text-xs">{resource.category?.replace(/_/g, ' ') || 'Uncategorized'}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/admin/resources/${resource.id}/edit`} className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-900 rounded-lg transition-colors"><Edit2 size={16} strokeWidth={1.5} /></Link>
                </td>
              </tr>
            ))}
            {initialResources.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-500">暂无内容资源</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
            <p className="mt-2 text-sm text-gray-500">
              确定要删除选中的 {selectedIds.size} 条资源吗？此操作不可撤销。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={confirmDelete} disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {isPending ? <Loader2 className="animate-spin" size={16} /> : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
