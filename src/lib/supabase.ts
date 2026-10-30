import { createClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 *
 * Only the publishable client key is used here. Every table is protected by
 * Row Level Security, so this key can only reach rows the current user (or the
 * shared demo workspace) is allowed to see. The service-role key and the Gemini
 * API key exist only inside Edge Function secrets.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && publishableKey)

if (!isSupabaseConfigured) {
  // Loud but non-fatal: the app renders a configuration screen instead of
  // silently failing every query.
  console.error(
    '[Digital Dark Spot] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and restart the dev server.',
  )
}

export const supabase = createClient(url ?? 'http://localhost:54321', publishableKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const SUPABASE_URL = url ?? ''
