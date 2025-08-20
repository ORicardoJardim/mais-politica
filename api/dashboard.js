// /api/dashboard.js
import { createClient } from '@supabase/supabase-js'

function userClient(req) {
  const url  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Missing SUPABASE envs')

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function ok(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).end(JSON.stringify(data ?? {}))
}
function bad(res, msg, code = 400) {
  res.setHeader('Content-Type', 'application/json')
  res.status(code).end(JSON.stringify({ error: msg }))
}
function ymd(d){ return new Date(d).toISOString().slice(0,10) }

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return bad(res, 'Method not allowed', 405)
    const org_id = (req.query.org_id || '').trim()
    if (!org_id) return bad(res, 'org_id is required')

    const supa = userClient(req)

    // --- Eleitores totais
    const votersTotalQ = await supa.from('voters').select('id', { count: 'exact', head: true }).eq('org_id', org_id)
    if (votersTotalQ.error) return bad(res, votersTotalQ.error.message, 400)
    const voters_total = votersTotalQ.count ?? 0

    // --- Aniversariantes hoje
    const today = new Date()
    const mm = String(today.getMonth()+1).padStart(2,'0')
    const dd = String(today.getDate()).padStart(2,'0')
    const mmdd = `${mm}-${dd}`
    const bdaysQ = await supa.from('voters').select('id,birthdate').eq('org_id', org_id).not('birthdate','is',null)
    if (bdaysQ.error) return bad(res, bdaysQ.error.message, 400)
    const birthdays_today = (bdaysQ.data||[]).filter(r=>{
      const d = new Date(r.birthdate); if (isNaN(d)) return false
      return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === mmdd
    }).length

    // --- Demandas totais & que vencem hoje
    let demands_total = 0, demands_due_today = 0
    const demTotalQ = await supa.from('demands').select('id', { count:'exact', head:true }).eq('org_id', org_id)
    if (!demTotalQ.error) demands_total = demTotalQ.count ?? 0
    const tzTodayISO = ymd(new Date())
    const demDueQ = await supa.from('demands').select('id', { count:'exact', head:true })
      .eq('org_id', org_id).eq('due_date', tzTodayISO)
    if (!demDueQ.error) demands_due_today = demDueQ.count ?? 0

    // --- Próximos vencimentos (7 dias)
    const sevenDaysISO = ymd(new Date(Date.now()+7*24*60*60*1000))
    const upcomingQ = await supa.from('demands')
      .select('id,title,due_date,status,assignee')
      .eq('org_id', org_id).gte('due_date', tzTodayISO).lte('due_date', sevenDaysISO)
      .order('due_date', { ascending:true }).limit(20)
    const upcoming_demands = (upcomingQ.data||[]).map(d=>({
      id:d.id, title:d.title||'(Sem título)', due_date:d.due_date, status:d.status||null, assignee:d.assignee||null
    }))

    // --- Série (últimos 6 meses) de eleitores criados
    const now=new Date()
    const startISO=new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-5,1)).toISOString()
    const votersCreatedQ = await supa.from('voters').select('id,created_at').eq('org_id', org_id).gte('created_at', startISO)
    const votersCreated = votersCreatedQ.data||[]
    const buckets=[]; const map={}
    for (let i=5;i>=0;i--){ const d=new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-i,1))
      const label=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; buckets.push(label); map[label]=0 }
    for (const r of votersCreated){ const d=new Date(r.created_at)
      const label=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; if (label in map) map[label]++ }
    const voters_timeseries=buckets.map(l=>({label:l, count:map[l]}))

    // --- Ranking: quem mais cadastrou eleitores (created_by)
    // Nota: se o seu RLS permitir, isso funciona direto; senão podemos mover pro service role depois.
    const rankQ = await supa
      .from('voters')
      .select('created_by, count:id')
      .eq('org_id', org_id)
      .not('created_by','is',null)
      .group('created_by')
      .order('count', { ascending:false })
      .limit(10)
    let ranking = []
    if (!rankQ.error && rankQ.data?.length) {
      const ids = rankQ.data.map(r=>r.created_by)
      const profQ = await supa.from('profiles').select('id,name,email').in('id', ids)
      const idx = (profQ.data||[]).reduce((acc,p)=>{ acc[p.id]={name:p.name||'—', email:p.email||'—'}; return acc },{})
      ranking = rankQ.data.map(r=>({
        user_id: r.created_by,
        name: idx[r.created_by]?.name || '—',
        email: idx[r.created_by]?.email || '—',
        total: r.count || 0,
      }))
    }

    // --- Atividades recentes
    let activities=[]
    try{
      const logsQ = await supa.from('audit_log')
        .select('id,org_id,actor,action,entity,details,created_at')
        .eq('org_id', org_id).order('created_at',{ascending:false}).limit(20)
      if (!logsQ.error && logsQ.data){
        const actorIds = Array.from(new Set(logsQ.data.map(l=>l.actor).filter(Boolean)))
        let names={}
        if (actorIds.length){
          const profQ = await supa.from('profiles').select('id,name,email').in('id', actorIds)
          if (!profQ.error && profQ.data){
            names = profQ.data.reduce((a,p)=>{ a[p.id]={name:p.name||'—',email:p.email||'—'}; return a },{})
          }
        }
        activities = logsQ.data.map(l=>({
          id:l.id, created_at:l.created_at, action:l.action, entity:l.entity,
          actor_name: names[l.actor]?.name || l.actor || '—',
          actor_email: names[l.actor]?.email || '—',
          details:l.details ?? null,
        }))
      }
    } catch {}

    return ok(res, {
      voters_total, birthdays_today, demands_total, demands_due_today,
      upcoming_demands, voters_timeseries, activities, ranking,
    })
  } catch (e) {
    console.error('[api/dashboard] fatal:', e)
    return bad(res, e.message || 'internal error', 500)
  }
}
