
'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { Copy, Check, User } from 'lucide-react';

interface Props {
  user: UserProfile;
  onClick: () => void;
}

export default function ContactCell({ user, onClick }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string | null, fieldName: string) => {
    e.stopPropagation(); 
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
        {user.name}
      </button>

      {/* Email */}
      <div className="flex items-center gap-2 mb-1 text-xs text-gray-500 h-5">
        <span className="truncate max-w-[140px]" title={user.email}>{user.email}</span>
        <button 
          onClick={(e) => handleCopy(e, user.email, 'email')}
          className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900"
          title="复制邮箱"
        >
          {copiedField === 'email' ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        </button>
      </div>

      {/* Phone */}
      <div className="flex items-center gap-2 text-xs text-gray-500 h-5">
        <span className={user.phone ? "text-gray-500" : "text-gray-300"}>
           {user.phone || '—'}
        </span>
        {user.phone && (
          <button 
            onClick={(e) => handleCopy(e, user.phone, 'phone')}
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
