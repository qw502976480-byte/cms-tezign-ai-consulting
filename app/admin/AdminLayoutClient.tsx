'use client';
// FIX: Import React to use React.ReactNode
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, LayoutTemplate, Users, Calendar, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isLoginPage = pathname === '/admin/login';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  if (isLoginPage) return <>{children}</>;

  const navItems = [
    { label: '概览仪表盘', href: '/admin', icon: LayoutDashboard },
    { label: '资源管理', href: '/admin/resources', icon: FileText },
    { label: '运营位', href: '/admin/homepage', icon: LayoutTemplate },
    { label: '注册用户', href: '/admin/registrations', icon: Users },
    { label: '演示申请', href: '/admin/demo-requests', icon: Calendar },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col">
            <span className="font-bold text-xl text-gray-900 tracking-tight">Web Platform</span>
            <span className="text-sm text-gray-500 font-medium">Tezign AI Consulting</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}