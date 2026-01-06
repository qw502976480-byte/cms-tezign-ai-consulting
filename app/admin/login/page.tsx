
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Mail, ShieldCheck } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // 1. Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/admin');
      }
    };
    checkSession();
  }, [supabase.auth, router]);

  // 2. Handle URL errors (e.g. from callback)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setMessage({ type: 'error', text: '登录验证失败，链接可能已过期，请重新发送。' });
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Use current origin for redirect to ensure it works on Vercel/Localhost automatically
    const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    } else {
      setIsSuccess(true);
      setLoading(false);
    }
  };

  const handleResend = () => {
    setIsSuccess(false);
    setMessage(null);
  };

  // Success View
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-green-600" size={24} strokeWidth={2} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">登录链接已发送</h2>
          <p className="text-gray-500 text-sm mb-6">
            请前往 <span className="font-medium text-gray-900">{email}</span> 查收邮件。<br/>
            点击邮件中的 Magic Link 即可直接登录。
          </p>
          
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-6 text-left border border-gray-100">
            <p className="flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span>链接有效期较短，请确保在当前使用的浏览器（Chrome/Safari）中打开邮件链接。</span>
            </p>
          </div>

          <button
            onClick={handleResend}
            className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-4 transition-colors"
          >
            未收到？返回重新发送
          </button>
        </div>
      </div>
    );
  }

  // Login Form View
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <div className="h-10 w-10 bg-gray-900 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck size={20} strokeWidth={2} />
             </div>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Web Platform Admin</h1>
          <p className="text-gray-500 text-sm mt-2">使用邮箱 Magic Link 登录（不需要密码）</p>
        </div>

        {/* Error Alert */}
        {message?.type === 'error' && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={16} />
            <p className="text-sm text-red-600">{message.text}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              工作邮箱
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all placeholder:text-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
              <Mail className="absolute left-3.5 top-2.5 text-gray-400" size={18} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
             {loading ? <Loader2 className="animate-spin" size={18} /> : null}
             {loading ? '发送中...' : '发送登录链接'}
             {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Footer Hint */}
        <p className="text-center text-xs text-gray-400 mt-6">
          安全提示：链接有效期较短，请在同一浏览器打开
        </p>
      </div>
    </div>
  );
}

// Wrap in Suspense to handle useSearchParams safely in Client Component
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
