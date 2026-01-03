import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverConfig } from '@/config/environment';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
      serverConfig.supabaseUrl,
    serverConfig.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
