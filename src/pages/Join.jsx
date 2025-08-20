// src/pages/Join.jsx
import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

export default function Join() {
  const { user } = useAuth()
  const { orgs } = useOrg()
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setMsg(''); setLoading(true)
    try {
      if (!user) throw new Error('Faça login primeiro.')
      if (!code.trim()) throw new Error('Informe o código do gabinete.')

      const { data, error } = await supabase.rpc('request_org_join', {
        p_code: code.trim(),
        p_note: note.trim() || null
      })
      if (error) throw error
      setMsg('Pedido enviado! Aguarde a aprovação de um admin do gabinete.')
      setCode(''); setNote('')
    } catch (e) {
      setErr(e.message || 'Erro ao enviar pedido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-bold">Entrar em um Gabinete</h1>

      {orgs.length > 0 && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 text-amber-800 p-3 text-sm">
          Você já faz parte de pelo menos um gabinete. Esta página é para entrar em um novo gabinete usando um código.
        </div>
      )}

      {err && <div className="rounded-lg border bg-red-50 border-red-200 text-red-700 p-3 text-sm">{err}</div>}
      {msg && <div className="rounded-lg border bg-green-50 border-green-200 text-green-700 p-3 text-sm">{msg}</div>}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Código do gabinete</label>
          <input
            className="input w-full"
            value={code}
            onChange={e=>setCode(e.target.value)}
            placeholder="ex.: A1B2C3D4"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mensagem (opcional)</label>
          <input
            className="input w-full"
            value={note}
            onChange={e=>setNote(e.target.value)}
            placeholder="Ex.: Sou assessor do vereador X"
          />
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </form>

      <div className="text-sm text-slate-600">
        Peça o <strong>código</strong> ao administrador do gabinete. Após enviar, um admin precisa aprovar seu acesso.
      </div>
    </div>
  )
}
