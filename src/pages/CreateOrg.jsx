// src/pages/CreateOrg.jsx
import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

const OFFICES = [
  { value: 'prefeito',       label: 'Prefeito(a)', scope: 'municipal' },
  { value: 'vice_prefeito',  label: 'Vice-prefeito(a)', scope: 'municipal' },
  { value: 'vereador',       label: 'Vereador(a)', scope: 'municipal' },
  { value: 'dep_estadual',   label: 'Deputado(a) Estadual', scope: 'estadual_federal' },
  { value: 'dep_federal',    label: 'Deputado(a) Federal',  scope: 'estadual_federal' },
  { value: 'senador',        label: 'Senador(a)', scope: 'estadual_federal' },
]

async function api(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let payload
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!r.ok) throw new Error(payload?.error || payload?.raw || 'Erro ao criar gabinete')
  return payload
}

export default function CreateOrg() {
  const navigate = useNavigate()
  const { orgs, setCurrentOrgId, refetch } = useOrg()

  const [form, setForm] = useState({
    name: '',
    office: 'vereador',
    state: '',
    city: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const scope = useMemo(() => {
    const o = OFFICES.find(x => x.value === form.office)
    return o?.scope || 'municipal'
  }, [form.office])

  const isMunicipal = scope === 'municipal'
  const isEstadualFederal = scope === 'estadual_federal'

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        office: form.office,
        state: form.state.trim().toUpperCase(),
        city: form.city.trim(),
      }
      // Regras de UI (batem com o backend):
      // municipal → exige UF e cidade
      // estadual/federal → exige só UF; cidade deve ir vazia
      if (isEstadualFederal) payload.city = ''

      const { org } = await api('/api/org-create', payload)

      // atualiza contexto e navega
      await refetch?.()
      setCurrentOrgId?.(org.id)
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Criar novo gabinete</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome do gabinete</label>
          <input
            className="input w-full"
            placeholder="Ex.: Gabinete Maria Silva"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Cargo</label>
            <select
              className="input w-full"
              value={form.office}
              onChange={e => setForm(f => ({ ...f, office: e.target.value }))}
            >
              {OFFICES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Estado (UF)</label>
            <select
              className="input w-full"
              value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">
              Cidade {isMunicipal ? <span className="text-slate-500">(obrigatória)</span> : <span className="text-slate-400">(não usar)</span>}
            </label>
            <input
              className="input w-full"
              placeholder={isMunicipal ? 'Ex.: Porto Alegre' : 'Não preencher'}
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              disabled={isEstadualFederal}
              required={isMunicipal}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Criar gabinete'}
          </button>
        </div>
      </form>

      {!!orgs?.length && (
        <div className="text-sm text-slate-500">
          Você já participa de <strong>{orgs.length}</strong> gabinete(s). Criar um novo irá te definir como <strong>admin</strong> nele.
        </div>
      )}
    </div>
  )
}
