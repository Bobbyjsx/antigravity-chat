import { createBrowserClient } from '@supabase/ssr'
import { clientConfig } from '@/config/environment';

export function createClient() {
  return createBrowserClient(
    clientConfig.supabaseUrl,
    clientConfig.supabaseAnonKey
  )
}
