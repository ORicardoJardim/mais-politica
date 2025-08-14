import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[SUPABASE]', { url: supabaseUrl ? 'ok' : 'faltando', anon: supabaseAnonKey ? 'ok' : 'faltando' })

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
