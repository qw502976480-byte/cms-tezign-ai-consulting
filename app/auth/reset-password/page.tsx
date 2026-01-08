
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const initializeSession = async () => {
      // 1. Check existing session (e.g. via cookie from middleware exchange if link pointed to callback)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionVerified(true);
        return;
      }

      // 2. Check for PKCE code
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
           setError(error.message);
        }
        setSessionVerified(true);
        return;
      }

      // 3. Check for Implicit Grant (Hash)
      // Note: In Next.js App Router, hash is not server-side accessible, so we check window
      if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const type = hashParams.get('type');
          
          if (accessToken && type === 'recovery') {
              const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: hashParams.get('refresh_token') || '',
              });
              if (error) setError(error.message);
          } else if (!accessToken) {
             setError("链接无效或不完整");
          }
          setSessionVerified(true);
          return;
      }
      
      // No credentials found
      setError("重置链接无效或已过期");
      setSessionVerified(true);
    };

    initializeSession();
  }, [supabase.auth, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("两次输入的密码不一致");
      return;
    }
    if (password.length < 6) {
        alert("密码长度不能少于6位");
        return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password: password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      // Logout to force re-login with new password
      await supabase.auth.signOut();
      
      // Redirect after delay
      setTimeout(() => {
          router.push('/admin/login?type=password');
      }, 3000);
    }
  };

  if (!sessionVerified) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
     );
  }

  if (error) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
             <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-6 md:p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-red-600" size={24} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">链接验证失败</h2>
                <p className="text-gray-500 text-sm mb-6">{error}</p>
                <button 
                    onClick={() => router.push('/admin/login')} 
                    className="text-sm font-medium text-gray-900 hover:text-black underline underline-offset-4"
                >
                    返回登录页
                </button>
             </div>
        </div>
     );
  }

  if (success) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
             <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-6 md:p-8 text-center shadow-sm animate-in zoom-in-95">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-green-600" size={24} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">密码重置成功</h2>
                <p className="text-gray-500 text-sm mb-6">
                    您的密码已更新。正在跳转至登录页...
                </p>
                <div className="flex justify-center">
                    <Loader2 className="animate-spin text-gray-400" size={20} />
                </div>
             </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
         <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <KeyRound className="text-gray-900" size={24} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">设置新密码</h1>
            <p className="text-sm text-gray-500 mt-2">请确保使用足够复杂的密码以保护账号安全。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
                <div className="relative">
                    <input 
                        type={showPassword ? 'text' : 'password'}
                        required 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all pr-10"
                        placeholder="最少 6 位字符"
                        minLength={6}
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">确认新密码</label>
                 <div className="relative">
                    <input 
                        type={showPassword ? 'text' : 'password'}
                        required 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all pr-10"
                        placeholder="再次输入以确认"
                        minLength={6}
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-70"
            >
                {loading && <Loader2 className="animate-spin" size={18} />}
                确认修改
            </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}>
            <ResetPasswordContent />
        </Suspense>
    )
}
