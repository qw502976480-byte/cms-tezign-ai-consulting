// FIX: Import React to use React.ReactNode
import React from 'react';
import AdminLayoutClient from './AdminLayoutClient';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient children={children} />;
}