// Server-side only configuration
// These should NOT be prefixed with NEXT_PUBLIC_ in .env (except for the ones that need to be shared like URL/Anon Key)
// But ideally, we have separate SUPABASE_SERVICE_KEY for server actions.

export const serverConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // Service key should ONLY be used in secure server contexts (actions/api routes)
  supabaseServiceKey: process.env.SERVICE_ROLE_KEY, 
  
  // App
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;

// Client-safe configuration
export const clientConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;
