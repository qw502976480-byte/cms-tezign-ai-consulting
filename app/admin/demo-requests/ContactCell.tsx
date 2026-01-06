'use client';

import React, { useState } from 'react';
import { DemoRequest } from '@/types';
import { Copy, Check, User } from 'lucide-react';

interface Props {
  request: DemoRequest;
  onClick: () => void;
}

export default function ContactCell({ request, onClick }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string | null, fieldName: string) => {
    e.stopPropagation(); // Prevent opening modal
    if (!text) return;

    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="group/cell">
      {/* Name - Clickable trigger for modal */}
      <button 
        onClick={onClick}
        className="text-left font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1.5 mb-1.5"
      >
        <User size={14} className="text-gray-400" />
        {request.name}
      </button>

      {/* Email */}
      <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 h-5">
        <span className="truncate max-w-[140px]" title={request.email}>{request.email}</span>
        <button 
          onClick={(e) => handleCopy(e, request.email, 'email')}
          className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900"
          title="复制邮箱"
        >
          {copiedField === 'email' ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        </button>
      </div>

      {/* Phone */}
      <div className="flex items-center gap-2 text-xs text-gray-500 h-5">
        <span className={request.phone ? "text-gray-500" : "text-gray-300"}>
           {request.phone || '—'}
        </span>
        {request.phone && (
          <button 
            onClick={(e) => handleCopy(e, request.phone, 'phone')}
            className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900"
            title="复制手机号"
          >
            {copiedField === 'phone' ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}
