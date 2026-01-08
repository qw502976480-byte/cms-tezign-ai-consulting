
'use client';

import React, { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ResourceStatus } from '@/types';
import { Edit2, Star, Pin, Trash2, UploadCloud, DownloadCloud, Loader2, Search, ChevronDown, Check, X, Calendar, Filter } from 'lucide-react';
import { bulkPublishResources, bulkUnpublishResources, bulkDeleteResources } from './actions';
import { subDays, isAfter, parseISO } from 'date-fns';

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

// Reusable Filter Dropdown Component
function FilterDropdown({ label, value, options, onChange, icon: Icon }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const clickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', clickOutside);
        return () => document.removeEventListener('mousedown', clickOutside);
    }, []);
    
    const currentLabel = options.find((o: any) => o.value === value)?.label || '全部';
    
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors min-w-[120px] justify-between ${isOpen ? 'border-gray-900 ring-1 ring-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'}`}>
                <div className="flex items-center gap-2 truncate">
                    {Icon && <Icon size={14} className="text-gray-400 shrink-0" />}
                    <span className="text-gray-500 hidden sm:inline">{label}:</span>
                    <span className="font-medium text-gray-900 truncate">{currentLabel}</span>
                </div>
                <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                    {options.map((opt: any) => (
                        <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${value === opt.value ? 'font-medium text-gray-900 bg-gray-50' : 'text-gray-600'}`}>
                            <span className="truncate">{opt.label}</span>
                            {value === opt.value && <Check size={14} className="shrink-0 ml-2" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ResourceList({ initialResources }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Filtering State ---
  const [filters, setFilters] = useState({
    q: '',
    status: 'all',
    homepage: 'all',
    category: 'all',
    date: 'all'
  });

  // Extract unique categories for filter
  const categoryOptions = useMemo(() => {
    const uniqueCats = Array.from(new Set(initialResources.map(r => r.category))).sort();
    return [
      { label: '全部', value: 'all' },
      ...uniqueCats.map(c => ({ label: c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value: c }))
    ];
  }, [initialResources]);

  // Derived Filtered Data
  const filteredResources = useMemo(() => {
    return initialResources.filter(r => {
      // 1. Search (Title)
      if (filters.q && !r.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
      
      // 2. Status
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      
      // 3. Homepage Config
      if (filters.homepage !== 'all') {
        if (filters.homepage === 'featured' && !r.isFeatured) return false;
        if (filters.homepage === 'fixed' && !r.isFixed) return false;
        if (filters.homepage === 'none' && (r.isFeatured || r.isFixed)) return false;
      }

      // 4. Category
      if (filters.category !== 'all' && r.category !== filters.category) return false;

      // 5. Date Range
      if (filters.date !== 'all' && r.published_at) {
        const pubDate = parseISO(r.published_at);
        const now = new Date();
        if (filters.date === '7d' && !isAfter(pubDate, subDays(now, 7))) return false;
        if (filters.date === '30d' && !isAfter(pubDate, subDays(now, 30))) return false;
      } else if (filters.date !== 'all' && !r.published_at) {
        // If filtering by date but resource has no published_at, exclude it
        return false;
      }

      return true;
    });
  }, [initialResources, filters]);

  // --- Handlers ---

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Only select visible/filtered resources
      setSelectedIds(new Set(filteredResources.map(r => r.id)));
    } else {
      setSelectedIds(new Set<string>());
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set<string>(prev);
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
      const ids: string[] = Array.from(selectedIds);
      let result;
      if (action === 'publish') {
        result = await bulkPublishResources(ids);
      } else {
        result = await bulkUnpublishResources(ids);
      }

      if (result.success) {
        // Optimistic update or refresh
        alert(`成功处理 ${result.count} 条资源`);
        setSelectedIds(new Set<string>());
        router.refresh();
      } else {
        alert(`操作失败: ${result.error}`);
      }
    });
  };
  
  const confirmDelete = () => {
     startTransition(async () => {
        const ids: string[] = Array.from(selectedIds);
        const result = await bulkDeleteResources(ids);

        if (result.success) {
          alert(`成功删除 ${result.count} 条资源`);
          setSelectedIds(new Set<string>());
        } else {
          alert(`删除失败: ${result.error}`);
        }
        setShowDeleteConfirm(false);
        router.refresh();
     });
  };

  const clearFilters = () => {
    setFilters({ q: '', status: 'all', homepage: 'all', category: 'all', date: 'all' });
  };

  const isAllSelected = filteredResources.length > 0 && selectedIds.size >= filteredResources.length && filteredResources.every(r => selectedIds.has(r.id));
  const hasActiveFilters = Object.values(filters).some(v => v !== 'all' && v !== '');

  return (
    <div className="space-y-6">
      
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <div className="flex flex-col xl:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="搜索标题..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm"
                    value={filters.q}
                    onChange={(e) => setFilters(p => ({...p, q: e.target.value}))}
                />
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap gap-3 items-center">
                <FilterDropdown 
                    label="状态"
                    value={filters.status}
                    onChange={(v: string) => setFilters(p => ({...p, status: v}))}
                    options={[
                        { label: '全部', value: 'all' },
                        { label: '已发布 (Published)', value: 'published' },
                        { label: '草稿 (Draft)', value: 'draft' },
                        { label: '已归档 (Archived)', value: 'archived' }
                    ]}
                />
                
                <FilterDropdown 
                    label="分类"
                    value={filters.category}
                    onChange={(v: string) => setFilters(p => ({...p, category: v}))}
                    options={categoryOptions}
                />

                <FilterDropdown 
                    label="首页推荐"
                    value={filters.homepage}
                    onChange={(v: string) => setFilters(p => ({...p, homepage: v}))}
                    icon={Star}
                    options={[
                        { label: '全部', value: 'all' },
                        { label: '轮播推荐 (Featured)', value: 'featured' },
                        { label: '固定列表 (Fixed)', value: 'fixed' },
                        { label: '无推荐', value: 'none' }
                    ]}
                />

                <FilterDropdown 
                    label="发布时间"
                    value={filters.date}
                    onChange={(v: string) => setFilters(p => ({...p, date: v}))}
                    icon={Calendar}
                    options={[
                        { label: '全部', value: 'all' },
                        { label: '近 7 天', value: '7d' },
                        { label: '近 30 天', value: '30d' }
                    ]}
                />

                {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 px-2 transition-colors">
                        <X size={14} /> 清空筛选
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Sticky Bulk Action Bar */}
      <div className={`sticky top-0 z-10 bg-gray-50/80 backdrop-blur-sm py-2 transition-opacity duration-300 ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between h-12 px-4 border border-gray-200 bg-white rounded-xl shadow-sm">
          <span className="text-sm font-medium text-gray-700">
            已选择 {selectedIds.size} 条
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => handleAction('publish')} disabled={isPending} className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50">
              <UploadCloud size={14} /> <span className="hidden sm:inline">上架</span>
            </button>
            <button onClick={() => handleAction('unpublish')} disabled={isPending} className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50">
              <DownloadCloud size={14} /> <span className="hidden sm:inline">下架</span>
            </button>
            <button onClick={() => handleAction('delete')} disabled={isPending} className="flex items-center gap-1.5 text-xs sm:text-sm text-red-600 hover:text-red-800 transition-colors disabled:opacity-50">
              <Trash2 size={14} /> <span className="hidden sm:inline">删除</span>
            </button>
            {isPending && <Loader2 className="animate-spin text-gray-400" size={16} />}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">
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
            {filteredResources.map((resource) => (
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
            {filteredResources.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                  {hasActiveFilters ? '没有找到符合条件的资源' : '暂无内容资源'}
              </td></tr>
            )}
          </tbody>
        </table>
        
        {/* Footer Stats */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
            <span>显示 {filteredResources.length} 条资源</span>
            {hasActiveFilters && <span>(总计 {initialResources.length} 条)</span>}
        </div>
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
