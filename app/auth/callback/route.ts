
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Default to /admin if no next param is provided
  const next = searchParams.get('next') ?? '/admin'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Successful login, redirect to the dashboard
      // Using NextResponse.redirect ensures the Set-Cookie headers from cookieStore are passed along
      return NextResponse.redirect(`${origin}${next}`)
    } else {
        console.error('Auth Callback Error:', error.message)
    }
  }

  // If code is missing or exchange failed, redirect back to login with error
  return NextResponse.redirect(`${origin}/admin/login?error=auth-code-error`)
}
