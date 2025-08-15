// src/pages/InvitePage.jsx
import React, { useState } from 'react'
import { useOrg } from '../context/OrgContext'

export default function InvitePage() {
  const { currentOrgId } = useOrg()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('membro')

  const sendInvite = async () => {
    if (!currentOrgId) {
      alert('Selecione um gabinete antes de convidar')
      return
    }

    const res = await fetch('/api/invite-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: currentOrgId, email, role })
    })

    const data = await res.json()
    if (data.error) return alert(data.error)
    alert('Convite enviado!')
    setEmail('')
    setRole('membro')
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Convidar Membro</h1>
      <input
        className="input mb-3 w-full"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email do convidado"
      />
      <select
        className="input mb-3 w-full"
        value={role}
        onChange={e => setRole(e.target.value)}
      >
        <option value="membro">Membro</option>
        <option value="admin">Admin</option>
      </select>
      <button onClick={sendInvite} className="btn-primary w-full">
        Enviar Convite
      </button>
    </div>
  )
}
