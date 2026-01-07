
'use client';

import React, { useState, useMemo } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: URLSearchParams;
  currentPage: number;
  pageSize: number;
}

type Scope = 'filtered' | 'page' | 'top';
type FileFormat = 'xlsx' | 'csv' | 'json';

const ALL_FIELDS = [
  { key: 'name', label: '姓名' },
  { key: 'email', label: '邮箱', required: true },
  { key: 'phone', label: '手机', required: true },
  { key: 'user_type', label: '用户类型' },
  { key: 'company_name', label: '公司' },
  { key: 'title', label: '职位' },
  { key: 'country', label: '国家' },
  { key: 'city', label: '城市' },
  { key: 'online_comm', label: '线上沟通' },
  { key: 'created_at', label: '注册时间' },
  { key: 'last_login_at', label: '最近登录' },
];

export default function ExportModal({ isOpen, onClose, currentFilters, currentPage, pageSize }: ExportModalProps) {
  const [scope, setScope] = useState<Scope>('filtered');
  const [topN, setTopN] = useState(500);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(ALL_FIELDS.map(f => f.key))
  );
  const [fileFormat, setFileFormat] = useState<FileFormat>('xlsx');
  
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (key: string, checked: boolean) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    
    const params = new URLSearchParams(currentFilters.toString());
    params.set('scope', scope);
    params.set('fields', Array.from(selectedFields).join(','));
    params.set('format', fileFormat);

    if (scope === 'page') {
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));
    } else if (scope === 'top') {
      params.set('top', String(Math.min(Math.max(1, topN), 5000)));
    }
    params.delete('page'); // clean up page from filters if not scope=page

    try {
      const res = await fetch(`/admin/registered-users/export?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || '导出失败，请重试。');
      }

      const blob = await res.blob();
      
      let filename = `user-profiles_${format(new Date(), 'yyyy-MM-dd')}.${fileFormat}`;
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
          const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
          const matches = filenameRegex.exec(disposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      onClose();

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsExporting(false);
    }
  };
  
  const isExportDisabled = useMemo(() => {
    if (isExporting) return true;
    if (scope === 'top' && (topN < 1 || topN > 5000)) return true;
    return false;
  }, [isExporting, scope, topN]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900">导出用户数据</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm text-red-700">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}
            
            {/* Scope */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">导出范围</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${scope === 'filtered' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="scope" value="filtered" checked={scope === 'filtered'} onChange={() => setScope('filtered')} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">当前筛选结果</span>
                    </label>
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${scope === 'page' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="scope" value="page" checked={scope === 'page'} onChange={() => setScope('page')} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">仅当前页</span>
                    </label>
                    <label className={`flex items-center p-3 border rounded-lg transition-colors ${scope === 'top' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="scope" value="top" checked={scope === 'top'} onChange={() => setScope('top')} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">前</span>
                        <input type="number" value={topN} onChange={(e) => setTopN(parseInt(e.target.value) || 0)} className="w-16 mx-2 text-center border-b-2 border-gray-300 focus:border-gray-900 outline-none" />
                        <span className="text-sm font-medium text-gray-700">条</span>
                    </label>
                </div>
            </div>

            {/* Fields */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">选择字段</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg bg-gray-50/50">
                    {ALL_FIELDS.map(field => (
                        <label key={field.key} className={`flex items-center text-sm font-medium ${field.required ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'}`}>
                           <input 
                                type="checkbox"
                                checked={selectedFields.has(field.key)}
                                disabled={field.required}
                                onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                           />
                           <span className="ml-2">{field.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Format */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">文件格式</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${fileFormat === 'xlsx' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="format" value="xlsx" checked={fileFormat === 'xlsx'} onChange={() => setFileFormat('xlsx')} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">Excel (.xlsx)</span>
                    </label>
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${fileFormat === 'csv' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="format" value="csv" checked={fileFormat === 'csv'} onChange={() => setFileFormat('csv')} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">CSV (.csv)</span>
                    </label>
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${fileFormat === 'json' ? 'bg-gray-50 border-gray-900' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="format" value="json" checked={fileFormat === 'json'} onChange={() => setFileFormat('json')} className="h-4 w-4 text-gray-900 focus:ring-gray-900" />
                        <span className="ml-3 text-sm font-medium text-gray-700">JSON (.json)</span>
                    </label>
                </div>
            </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-3">
            {isExporting && <span className="text-sm text-gray-500 mr-4">正在生成文件...</span>}
            <button onClick={onClose} disabled={isExporting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                取消
            </button>
            <button onClick={handleStartExport} disabled={isExportDisabled} className="px-6 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-black disabled:opacity-50 flex items-center gap-2">
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                开始导出
            </button>
        </div>
      </div>
    </div>
  );
}
