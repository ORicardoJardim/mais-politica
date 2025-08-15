// src/pages/SuperAdminOrgs.jsx
import React, { useEffect, useState } from 'react'

export default function SuperAdminOrgs() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchOrgs() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/super-admin-orgs')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao carregar gabinetes')
      setList(j.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function removeOrg(org_id) {
    if (!confirm('Excluir este gabinete? Isso removerá todos os dados relacionados.')) return
    try {
      const r = await fetch('/api/super-admin-orgs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id })
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao excluir gabinete')
      fetchOrgs()
    } catch (e) {
      alert(e.message)
    }
  }

  useEffect(() => { fetchOrgs() }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Todos os Gabinetes</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        'Carregando…'
      ) : (
        <table className="table w-full border">
          <thead>
            <tr className="text-left bg-slate-100">
              <th>Nome</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(o => (
              <tr key={o.org_id}>
                <td>{o.name}</td>
                <td className="text-xs text-slate-500">{o.org_id}</td>
                <td>
                  <button className="btn-danger" onClick={() => removeOrg(o.org_id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan="3" className="text-slate-500">Nenhum gabinete.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
