// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carrega sessão atual e observa mudanças de auth
  useEffect(() => {
    let mounted = true

    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
    }
    boot()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Carrega o profile do usuário logado
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null)
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!error) setProfile(data || null)
      else setProfile(null)
    }
    fetchProfile()
  }, [user])

  // ---- API de auth exposta para o app ----
  // Aceita tanto signIn(email, password) quanto signIn({ email, password })
  const signIn = (emailOrObj, password) => {
    const creds = typeof emailOrObj === 'object'
      ? emailOrObj                       // { email, password }
      : { email: emailOrObj, password }  // email, password
    return supabase.auth.signInWithPassword(creds)
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
