
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, LayoutTemplate, Users, Calendar, LogOut, Send, Menu, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  if (isLoginPage) return <>{children}</>;

  // Navigation Items Config
  const overviewItem = { 
    label: '概览 (Dashboard)', 
    href: '/admin', 
    icon: LayoutDashboard 
  };
  
  const navGroups = [
    {
      title: '官网结构',
      items: [
        { label: '首页配置 (Homepage)', href: '/admin/homepage', icon: LayoutTemplate },
      ]
    },
    {
      title: '官网内容',
      items: [
        { label: '内容资源 (Resources)', href: '/admin/resources', icon: FileText },
        { label: '内容分发 (Delivery)', href: '/admin/delivery', icon: Send },
      ]
    },
    {
      title: '官网用户',
      items: [
        { label: '注册用户 (User Profiles)', href: '/admin/registered-users', icon: Users },
      ]
    },
    {
      title: '官网沟通',
      items: [
        { label: '演示申请 (Demo Requests)', href: '/admin/demo-requests', icon: Calendar },
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed Width, Responsive Visibility */}
      <aside className={`
        w-[280px] bg-white border-r border-gray-200 fixed h-full z-50 flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        {/* Header - Split into two lines */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100/50 flex-shrink-0">
           <div className="flex flex-col justify-center">
             <span className="font-semibold text-sm text-gray-900 tracking-tight leading-snug">Web Platform</span>
             <span className="text-[11px] text-gray-500 font-normal mt-0.5 leading-snug">Tezign AI Consulting</span>
           </div>
           {/* Close button only on mobile */}
           <button 
             onClick={() => setIsSidebarOpen(false)}
             className="md:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-lg"
           >
             <X size={20} />
           </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {/* Overview Item */}
          {(() => {
            const Icon = overviewItem.icon;
            const isActive = pathname === overviewItem.href;
            return (
              <Link
                href={overviewItem.href}
                className={`flex items-center gap-3 px-4 h-11 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={20} strokeWidth={1.5} className={isActive ? "text-gray-900" : "text-gray-500"} />
                <span className="truncate">{overviewItem.label}</span>
              </Link>
            );
          })()}

          {/* Groups */}
          {navGroups.map((group, groupIdx) => (
            <div key={group.title} className="pt-5 mt-1">
              <div className="px-4 mb-2">
                 <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  {group.title}
                 </span>
              </div>
              
              <div className="space-y-0.5">
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  // Exact match for root, startsWith for sub-routes (except root)
                  const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

                  // @ts-ignore - comingSoon is optional
                  if (item.comingSoon) {
                    return (
                      <div
                        key={`${item.label}-${itemIdx}`}
                        className="flex items-center gap-3 px-4 h-11 rounded-full text-sm text-gray-400 cursor-not-allowed select-none"
                      >
                        <Icon size={20} strokeWidth={1.5} className="text-gray-300" />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto text-[10px] bg-gray-50 text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded">
                          SOON
                        </span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 h-11 rounded-full text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon size={20} strokeWidth={1.5} className={isActive ? "text-gray-900" : "text-gray-500"} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 h-11 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut size={20} strokeWidth={1.5} />
            <span>退出登录 (Sign Out)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-[280px] min-w-0 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center px-4 sticky top-0 z-30">
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
           >
             <Menu size={24} />
           </button>
           <span className="ml-3 font-semibold text-gray-900">管理后台</span>
        </div>

        <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-12">
           {children}
        </div>
      </main>
    </div>
  );
}
