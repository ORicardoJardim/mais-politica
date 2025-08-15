// src/pages/AcceptInvite.jsx
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function accept() {
      setLoading(true)
      setError('')
      try {
        const r = await fetch('/api/invite?action=accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Falha ao aceitar convite')
        setSuccess(true)
        setTimeout(() => navigate('/'), 2000)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    accept()
  }, [token, navigate])

  return (
    <div className="max-w-lg mx-auto px-4 py-10 text-center">
      {loading && <p>Processando convite…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-green-600">Convite aceito! Redirecionando…</p>}
    </div>
  )
}
