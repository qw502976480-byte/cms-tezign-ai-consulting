
'use client';
// FIX: Import React to use React.ReactNode
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, LayoutTemplate, Users, Calendar, LogOut, Send } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  if (isLoginPage) return <>{children}</>;

  // New sidebar navigation structure with unified naming
  const overviewItem = { label: '概览 (Dashboard)', href: '/admin', icon: LayoutDashboard };
  
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
        { label: '内容分发', href: '#', icon: Send, comingSoon: true },
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={`fixed h-full z-10 hidden md:flex flex-col bg-white border-r border-gray-200/75 transition-all duration-200 ease-out ${isSidebarExpanded ? 'w-64' : 'w-20'}`}
      >
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center h-16 overflow-hidden`}>
            <div className={`flex flex-col ml-0 overflow-hidden`}>
                <span className="font-bold text-lg text-gray-900 tracking-tight whitespace-nowrap">Web Platform</span>
                <span className={`text-sm text-gray-500 font-medium whitespace-nowrap transition-all duration-150 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Tezign AI Consulting</span>
            </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {/* Render Overview item */}
          {(() => {
            const Icon = overviewItem.icon;
            const isActive = pathname === overviewItem.href;
            return (
              <Link
                href={overviewItem.href}
                className={`flex items-center h-10 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'} ${isSidebarExpanded ? 'px-3' : 'justify-center'}`}
              >
                <Icon size={20} />
                <span className={`ml-3 whitespace-nowrap transition-all duration-150 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                  {overviewItem.label}
                </span>
              </Link>
            );
          })()}

          {/* Render item groups */}
          {navGroups.map((group) => (
            <div key={group.title} className="pt-4 mt-4 border-t border-gray-100">
              <span className={`px-3 mb-2 block text-xs font-semibold text-gray-500 transition-opacity ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                {isSidebarExpanded ? group.title : ''}
              </span>
              <div className="space-y-1">
                {group.items.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

                  if (item.comingSoon) {
                    return (
                      <div
                        key={`${item.label}-${index}`}
                        className={`flex items-center gap-3 h-10 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed ${isSidebarExpanded ? 'px-3' : 'justify-center'}`}
                        title={item.label}
                      >
                        <Icon size={20} />
                        <div className={`flex-1 flex justify-between items-center overflow-hidden transition-all duration-150 ${isSidebarExpanded ? 'opacity-100 w-auto ml-3' : 'opacity-0 w-0'}`}>
                            <span className="whitespace-nowrap">{item.label}</span>
                            <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Soon
                            </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center h-10 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'} ${isSidebarExpanded ? 'px-3' : 'justify-center'}`}
                    >
                      <Icon size={20} />
                      <span className={`ml-3 whitespace-nowrap transition-all duration-150 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 w-full h-10 py-2 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:bg-gray-50 hover:text-gray-900 ${isSidebarExpanded ? 'px-3' : 'justify-center'}`}
          >
            <LogOut size={20} />
            <span className={`whitespace-nowrap transition-all duration-150 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
              退出登录
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 p-8 overflow-auto transition-all duration-200 ease-out ${isSidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
