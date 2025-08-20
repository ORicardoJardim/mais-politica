// src/context/OrgContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)
export const useOrg = () => useContext(OrgContext)

export default function OrgProvider({ children }) {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [currentOrgId, setCurrentOrgId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        if (!user) {
          if (!mounted) return
          setOrgs([]); setCurrentOrgId(null)
          return
        }

        // 1) memberships (SEM join embutido)
        const m = await supabase
          .from('memberships')
          .select('org_id, role, orgs(name, join_code)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (m.error) {
          console.error('[OrgContext] memberships error:', m.error)
          if (mounted) { setOrgs([]); setCurrentOrgId(null) }
          return
        }

        const memberships = m.data || []
        const orgIds = [...new Set(memberships.map(x => x.org_id).filter(Boolean))]

        // 2) orgs pelos IDs coletados
        let orgRows = []
        if (orgIds.length) {
          const o = await supabase
            .from('orgs')
            .select('id, name')
            .in('id', orgIds)

          if (o.error) {
            console.error('[OrgContext] orgs error:', o.error)
          } else {
            orgRows = o.data || []
          }
        }

        const rows = memberships.map(r => ({
          org_id: r.org_id,
          role: r.role,
          name: r.orgs?.name || 'Gabinete',
          join_code: r.orgs?.join_code || null,
        }))

        if (!mounted) return
        setOrgs(rows)

        // Seleção do org atual: mantém o último se ainda existir; senão pega o primeiro
        const last = localStorage.getItem('currentOrgId')
        const exists = rows.some(o => o.org_id === last)
        setCurrentOrgId(exists ? last : (rows[0]?.org_id || null))
      } catch (e) {
        console.error('[OrgContext] load fatal:', e)
        if (mounted) {
          setOrgs([])
          setCurrentOrgId(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    if (currentOrgId) {
      try { localStorage.setItem('currentOrgId', currentOrgId) } catch {}
    } else {
      try { localStorage.removeItem('currentOrgId') } catch {}
    }
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
