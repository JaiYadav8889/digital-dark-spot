import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Authentication is optional in Digital Dark Spot.
 *
 * Guest researchers work in a shared demo workspace (sessions with a null
 * owner). Signing in scopes new research to the authenticated user, and RLS
 * makes those sessions private. Sign-up auto-confirms, so the demo never blocks
 * on email delivery.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null)
      setUser(next?.user ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) throw new Error(error.message)
    if (!data.session) {
      throw new Error(
        'Account created, but no session was returned. If email confirmation is enabled on this project, confirm your address first.',
      )
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }, [])

  return {
    session,
    user,
    loading,
    isConfigured: isSupabaseConfigured,
    isAuthenticated: Boolean(user),
    email: user?.email ?? null,
    signIn,
    signUp,
    signOut,
  }
}
