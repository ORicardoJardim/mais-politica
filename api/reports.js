// api/reports.js
import { userClient } from './_utils.js'

// Util: parse YYYY-MM-DD (fallback: hoje)
function parseDate(s) {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3], 0, 0, 0))
  return isNaN(d.getTime()) ? null : d
}
const iso = d => d.toISOString().slice(0,10)

export default async function handler(req, res) {
  try {
    const supa = userClient(req)
    const url = new URL(req.url, 'http://x')
    const action = url.searchParams.get('action') || 'overview'

    if (req.method !== 'GET' || action !== 'overview') {
      return res.status(405).json({ error: 'Method/action inválidos' })
    }

    const org_id = url.searchParams.get('org_id')
    if (!org_id) return res.status(400).json({ error: 'org_id é obrigatório' })

    // período: default últimos 30 dias
    const toD = parseDate(url.searchParams.get('to')) || new Date()
    const fromD = parseDate(url.searchParams.get('from')) || new Date(Date.now() - 29*24*3600*1000)
    const from = iso(fromD)
    const to   = iso(toD)

    // ====== Cards (totais/contagens simples) ======
    // Voters total (org)
    const vtTotal = await supa
      .from('voters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)

    // Voters criados no período
    const vtPeriod = await supa
      .from('voters')
      .select('id, created_at', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .gte('created_at', from).lte('created_at', `${to}T23:59:59.999Z`)

    // Demandas no período
    const dmPeriodRows = await supa
      .from('demandas')
      .select('id, status, prazo, created_at')
      .eq('org_id', org_id)
      .gte('created_at', from).lte('created_at', `${to}T23:59:59.999Z`)

    if (vtTotal.error)  return res.status(400).json({ error: vtTotal.error.message })
    if (vtPeriod.error) return res.status(400).json({ error: vtPeriod.error.message })
    if (dmPeriodRows.error) return res.status(400).json({ error: dmPeriodRows.error.message })

    const demandas = dmPeriodRows.data || []
    const demandas_total_periodo = demandas.length
    const demandas_abertas = demandas.filter(d => (d.status || '').toLowerCase() !== 'resolvida').length
    const demandas_resolvidas = demandas.filter(d => (d.status || '').toLowerCase() === 'resolvida').length
    const hoje = iso(new Date())
    const demandas_sla_vencido = demandas.filter(d =>
      (d.status || '').toLowerCase() !== 'resolvida' &&
      d.prazo && d.prazo < hoje
    ).length

    // ====== Voters por cidade (período) ======
    const votersCityRows = await supa
      .from('voters')
      .select('id, city, created_at')
      .eq('org_id', org_id)
      .gte('created_at', from).lte('created_at', `${to}T23:59:59.999Z`)

    if (votersCityRows.error) return res.status(400).json({ error: votersCityRows.error.message })
    const mapCity = new Map()
    for (const v of (votersCityRows.data || [])) {
      const c = (v.city || '—').trim() || '—'
      mapCity.set(c, (mapCity.get(c) || 0) + 1)
    }
    const votersByCity = [...mapCity.entries()]
      .sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([city, count]) => ({ city, count }))

    // ====== Voters por tag (tudo; filtrado por org) ======
    // pega tags do gabinete e conta quantos vínculos existem para cada
    const tagsRes = await supa.from('tags').select('id, name, color').eq('org_id', org_id)
    if (tagsRes.error) return res.status(400).json({ error: tagsRes.error.message })
    const tagIds = (tagsRes.data || []).map(t => t.id)
    let votersByTag = []
    if (tagIds.length) {
      const vtRows = await supa.from('voter_tags').select('tag_id').in('tag_id', tagIds)
      if (vtRows.error) return res.status(400).json({ error: vtRows.error.message })
      const mapTag = new Map()
      for (const r of (vtRows.data || [])) {
        mapTag.set(r.tag_id, (mapTag.get(r.tag_id) || 0) + 1)
      }
      const tagsMap = new Map((tagsRes.data || []).map(t => [t.id, t]))
      votersByTag = [...mapTag.entries()]
        .map(([tag_id, count]) => ({ tag_id, name: tagsMap.get(tag_id)?.name || 'Tag', color: tagsMap.get(tag_id)?.color || '#64748b', count }))
        .sort((a,b) => b.count - a.count)
        .slice(0,10)
    }

    // ====== Demandas por status (período) ======
    const mapStatus = new Map()
    for (const d of demandas) {
      const s = (d.status || '—').trim() || '—'
      mapStatus.set(s, (mapStatus.get(s) || 0) + 1)
    }
    const demandasByStatus = [...mapStatus.entries()]
      .sort((a,b) => b[1]-a[1])
      .map(([status, count]) => ({ status, count }))

    // ====== Tendência simples (período) ======
    const votersPeriodRows = await supa
      .from('voters')
      .select('id, created_at')
      .eq('org_id', org_id)
      .gte('created_at', from).lte('created_at', `${to}T23:59:59.999Z`)

    if (votersPeriodRows.error) return res.status(400).json({ error: votersPeriodRows.error.message })

    function bucketPerDay(rows) {
      const m = new Map()
      for (const r of rows) {
        const day = (r.created_at || '').slice(0,10)
        if (!day) continue
        m.set(day, (m.get(day) || 0) + 1)
      }
      return [...m.entries()].sort((a,b)=> a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }))
    }
    const trend = {
      votersPerDay: bucketPerDay(votersPeriodRows.data || []),
      demandasPerDay: bucketPerDay(demandas)
    }

    return res.status(200).json({
      period: { from, to },
      cards: {
        voters_total: vtTotal.count ?? 0,
        voters_period: vtPeriod.count ?? 0,
        demandas_total_periodo,
        demandas_abertas,
        demandas_resolvidas,
        demandas_sla_vencido
      },
      votersByCity,
      votersByTag,
      demandasByStatus,
      trend
    })
  } catch (e) {
    console.error('reports error:', e)
    return res.status(500).json({ error: e.message || 'Erro interno' })
  }
}
