import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)
export const useOrg = () => useContext(OrgContext)

export default function OrgProvider({ children }) {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState([])          // [{org_id, name, role}]
  const [currentOrgId, setCurrentOrgId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        if (!user) {
          setOrgs([]); setCurrentOrgId(null)
          return
        }
        const { data, error } = await supabase
          .from('memberships')
          .select('org_id, role, orgs(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (error) { setOrgs([]); return }
        const rows = (data || []).map(r => ({
          org_id: r.org_id,
          name: r.orgs?.name || 'Gabinete',
          role: r.role
        }))
        if (!mounted) return
        setOrgs(rows)

        const last = localStorage.getItem('currentOrgId')
        const exists = rows.some(o => o.org_id === last)
        setCurrentOrgId(exists ? last : (rows[0]?.org_id || null))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    if (currentOrgId) localStorage.setItem('currentOrgId', currentOrgId)
  }, [currentOrgId])

  const value = useMemo(() => ({
    loading,
    orgs,
    currentOrgId,
    currentOrg: orgs.find(o => o.org_id === currentOrgId) || null,
    setCurrentOrgId,
  }), [loading, orgs, currentOrgId])

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
