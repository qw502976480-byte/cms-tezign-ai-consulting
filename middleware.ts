import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = [
  "/auth/callback",
  "/reset-password",
  "/login",
  "/",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ 放行 Supabase 回调 & 重置密码页面（不做任何重定向）
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // ⬇️ 下面保持你原来的鉴权逻辑不变
  // return ... (你原本的代码)
  return NextResponse.next();
}

export const config = {
  // 让 middleware 作用于除了静态资源以外的所有路由
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user && request.nextUrl.pathname !== '/admin/login') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Redirect logged in user away from login
  if (request.nextUrl.pathname === '/admin/login' && user) {
      return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
}
