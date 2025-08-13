
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Users, MapPinned, Receipt, Settings, Upload, Download, Trash2, Edit3, Plus, Search } from "lucide-react";

/*
  Mais Politica — MVP
  - Offline-first com localStorage
  - Entidades: Agenda, Demandas, Contatos, Roteiros, Despesas, Config
  - Exportar/Importar JSON, Reset
  - Listas com filtro/pesquisa, formulários simples e cálculos automáticos

  Como publicar:
  1) Coloque este projeto no GitHub.
  2) Conecte no Vercel e clique em Deploy (sem ajustes).
*/

const LS_KEY = "assessor_mvp_v1";

const emptyData = {
  agenda: [],
  demandas: [],
  contatos: [],
  roteiros: [],
  despesas: [],
  config: { precoCombustivelRef: 6.0, consumoEstradaKmL: 13, consumoCidadeKmL: 9, zonas: ["Zona 1", "Zona 2", "Zona 3"] }
};

function useStore() {
  const [db, setDb] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : emptyData;
    } catch {
      return emptyData;
    }
  });
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }, [db]);
  const reset = () => setDb(emptyData);
  return { db, setDb, reset };
}

function Header({ current, setCurrent }) {
  const tabs = [
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "demandas", label: "Demandas", icon: ClipboardList },
    { id: "contatos", label: "Contatos", icon: Users },
    { id: "roteiros", label: "Roteiros", icon: MapPinned },
    { id: "despesas", label: "Despesas", icon: Receipt },
    { id: "config", label: "Config", icon: Settings }
  ];
  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold">Mais Politica</span>
          <span className="text-xs text-gray-500 border rounded-full px-2 py-0.5">MVP</span>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setCurrent(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition border ${current===t.id?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-700 hover:bg-gray-50"}`}>
              {React.createElement(t.icon, { size: 18 })}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Stat({ title, value, hint }) {
  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function Toolbar({ onExport, onImport, onReset }) {
  const fileRef = React.useRef(null);
  return (
    <div className="flex items-center gap-2">
      <button onClick={onExport} className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"><Download size={16}/>Exportar</button>
      <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"><Upload size={16}/>Importar</button>
      <input type="file" accept="application/json" ref={fileRef} className="hidden" onChange={e=>{
        const file = e.target.files?.[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try { onImport(JSON.parse(reader.result)); } catch { alert("Arquivo inválido"); }
        };
        reader.readAsText(file);
        e.target.value = "";
      }}/>
      <button onClick={onReset} className="ml-auto text-red-600 hover:underline">Reset</button>
    </div>
  );
}

// ---------- AGENDA ----------
function Agenda({ db, setDb }) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ data:"", hora:"", cidade:"", local:"", objetivo:"", roteiroId:"", observacoes:"" });
  const filtered = useMemo(()=> db.agenda.filter(a => {
    const t = (a.cidade+" "+a.local+" "+a.objetivo).toLowerCase();
    return t.includes(q.toLowerCase());
  }),[db.agenda, q]);

  const add = () => {
    if(!form.data || !form.cidade) { alert("Preencha Data e Cidade"); return; }
    setDb({ ...db, agenda: [...db.agenda, { id: crypto.randomUUID(), ...form }] });
    setForm({ data:"", hora:"", cidade:"", local:"", objetivo:"", roteiroId:"", observacoes:"" });
  };
  const remove = (id) => setDb({ ...db, agenda: db.agenda.filter(i=>i.id!==id) });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <input className="input" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/>
        <input className="input" placeholder="Hora (opcional)" value={form.hora} onChange={e=>setForm({...form,hora:e.target.value})}/>
        <input className="input" placeholder="Cidade" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}/>
        <input className="input" placeholder="Local" value={form.local} onChange={e=>setForm({...form,local:e.target.value})}/>
        <input className="input sm:col-span-2" placeholder="Objetivo" value={form.objetivo} onChange={e=>setForm({...form,objetivo:e.target.value})}/>
        <select className="input" value={form.roteiroId} onChange={e=>setForm({...form,roteiroId:e.target.value})}>
          <option value="">Roteiro (opcional)</option>
          {db.roteiros.map(r=> <option key={r.id} value={r.id}>{r.data} • {r.zona}</option>)}
        </select>
        <input className="input" placeholder="Observações" value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/>
        <button onClick={add} className="btn-primary sm:col-span-1"><Plus size={16}/> Adicionar</button>
      </div>

      <div className="flex items-center gap-2"><Search size={16}/><input className="input" placeholder="Buscar por cidade/local/objetivo" value={q} onChange={e=>setQ(e.target.value)}/></div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map(item => (
          <div key={item.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{item.data} {item.hora && `• ${item.hora}`}</div>
                <div className="text-sm text-gray-600">{item.cidade} — {item.local}</div>
              </div>
              <button className="icon-btn" onClick={()=>remove(item.id)}><Trash2 size={16}/></button>
            </div>
            {item.objetivo && <div className="mt-2 text-sm">🎯 {item.objetivo}</div>}
            {item.roteiroId && <div className="mt-1 text-xs text-gray-500">Roteiro: {db.roteiros.find(r=>r.id===item.roteiroId)?.zona || item.roteiroId}</div>}
            {item.observacoes && <div className="mt-2 text-xs text-gray-600">{item.observacoes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- DEMANDAS ----------
function calcPrazo(dataAbertura, slaDias){
  if(!dataAbertura || !slaDias) return "";
  const d = new Date(dataAbertura);
  d.setDate(d.getDate() + Number(slaDias));
  return d.toISOString().slice(0,10);
}

function Demandas({ db, setDb }){
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ protocolo:"", dataAbertura:"", cidadao:"", contato:"", cidade:"", tema:"", orgao:"", slaDias:"7", status:"Aberta", solucao:"", responsavel:"", obs:""});

  const list = useMemo(()=> db.demandas.filter(d => {
    const hay = (d.protocolo+" "+d.cidadao+" "+d.cidade+" "+d.tema+" "+d.status).toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [db.demandas, q]);

  const add = () => {
    if(!form.dataAbertura || !form.cidadao || !form.tema) { alert("Data, Cidadão e Tema são obrigatórios"); return; }
    const prazo = calcPrazo(form.dataAbertura, form.slaDias);
    setDb({ ...db, demandas: [...db.demandas, { id: crypto.randomUUID(), ...form, prazo }] });
    setForm({ protocolo:"", dataAbertura:"", cidadao:"", contato:"", cidade:"", tema:"", orgao:"", slaDias:"7", status:"Aberta", solucao:"", responsavel:"", obs:""});
  };
  const remove = (id) => setDb({ ...db, demandas: db.demandas.filter(i=>i.id!==id) });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        <input className="input" placeholder="Protocolo (opcional)" value={form.protocolo} onChange={e=>setForm({...form,protocolo:e.target.value})}/>
        <input className="input" type="date" value={form.dataAbertura} onChange={e=>setForm({...form,dataAbertura:e.target.value})}/>
        <input className="input" placeholder="Cidadão" value={form.cidadao} onChange={e=>setForm({...form,cidadao:e.target.value})}/>
        <input className="input" placeholder="Contato (tel/Whats)" value={form.contato} onChange={e=>setForm({...form,contato:e.target.value})}/>
        <input className="input" placeholder="Cidade" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}/>
        <input className="input" placeholder="Tema" value={form.tema} onChange={e=>setForm({...form,tema:e.target.value})}/>
        <input className="input" placeholder="Órgão responsável" value={form.orgao} onChange={e=>setForm({...form,orgao:e.target.value})}/>
        <input className="input" type="number" min={1} placeholder="SLA (dias)" value={form.slaDias} onChange={e=>setForm({...form,slaDias:e.target.value})}/>
        <select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
          <option>Aberta</option>
          <option>Em andamento</option>
          <option>Resolvida</option>
          <option>Arquivada</option>
        </select>
        <input className="input sm:col-span-2" placeholder="Responsável" value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}/>
        <input className="input sm:col-span-2" placeholder="Solução / Observações" value={form.solucao} onChange={e=>setForm({...form,solucao:e.target.value})}/>
        <button onClick={add} className="btn-primary"><Plus size={16}/> Adicionar</button>
      </div>

      <div className="flex items-center gap-2"><Search size={16}/><input className="input" placeholder="Buscar por protocolo/cidadão/cidade/tema/status" value={q} onChange={e=>setQ(e.target.value)}/></div>

      <div className="grid md:grid-cols-2 gap-3">
        {list.map(d => {
          const hoje = new Date().toISOString().slice(0,10);
          const late = d.status!=="Resolvida" && d.prazo && d.prazo < hoje;
          return (
            <div key={d.id} className={`card ${late?"border-red-300":d.status==="Resolvida"?"border-green-300":""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{d.tema}</div>
                  <div className="text-sm text-gray-600">{d.cidadao} — {d.cidade}</div>
                </div>
                <button className="icon-btn" onClick={()=>remove(d.id)}><Trash2 size={16}/></button>
              </div>
              <div className="mt-2 text-sm">Status: <span className="font-medium">{d.status}</span></div>
              <div className="text-xs text-gray-500">Abertura: {d.dataAbertura} • SLA: {d.slaDias}d • Prazo: {d.prazo || "—"}</div>
              {d.responsavel && <div className="text-xs text-gray-500">Resp.: {d.responsavel}</div>}
              {d.solucao && <div className="mt-1 text-xs">{d.solucao}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- CONTATOS ----------
function Contatos({ db, setDb }){
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ nome:"", cargo:"", instituicao:"", cidade:"", prioridade:"B", afinidade:3, ultimoContato:"", proximoPasso:"", obs:"" });
  const list = useMemo(()=> db.contatos.filter(c => (c.nome+" "+c.cargo+" "+c.cidade).toLowerCase().includes(q.toLowerCase())), [db.contatos, q]);
  const add = () => {
    if(!form.nome) { alert("Nome é obrigatório"); return; }
    setDb({ ...db, contatos: [...db.contatos, { id: crypto.randomUUID(), ...form }] });
    setForm({ nome:"", cargo:"", instituicao:"", cidade:"", prioridade:"B", afinidade:3, ultimoContato:"", proximoPasso:"", obs:"" });
  };
  const remove = (id) => setDb({ ...db, contatos: db.contatos.filter(i=>i.id!==id) });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        <input className="input" placeholder="Nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/>
        <input className="input" placeholder="Cargo/Função" value={form.cargo} onChange={e=>setForm({...form,cargo:e.target.value})}/>
        <input className="input" placeholder="Instituição" value={form.instituicao} onChange={e=>setForm({...form, instituicao:e.target.value})}/>
        <input className="input" placeholder="Cidade" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}/>
        <select className="input" value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})}>
          <option>A</option><option>B</option><option>C</option>
        </select>
        <input className="input" type="number" min={1} max={5} value={form.afinidade} onChange={e=>setForm({...form,afinidade:e.target.value})} placeholder="Afinidade (1-5)"/>
        <input className="input" type="date" value={form.ultimoContato} onChange={e=>setForm({...form,ultimoContato:e.target.value})} placeholder="Último contato"/>
        <input className="input sm:col-span-2" placeholder="Próximo passo" value={form.proximoPasso} onChange={e=>setForm({...form,proximoPasso:e.target.value})}/>
        <input className="input sm:col-span-2" placeholder="Observações" value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})}/>
        <button onClick={add} className="btn-primary"><Plus size={16}/> Adicionar</button>
      </div>

      <div className="flex items-center gap-2"><Search size={16}/><input className="input" placeholder="Buscar por nome/cargo/cidade" value={q} onChange={e=>setQ(e.target.value)}/></div>

      <div className="grid md:grid-cols-2 gap-3">
        {list.map(c => (
          <div key={c.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{c.nome} <span className="text-xs align-top ml-1 px-2 py-0.5 rounded-full border">P{c.prioridade}</span></div>
                <div className="text-sm text-gray-600">{c.cargo} — {c.cidade}</div>
              </div>
              <button className="icon-btn" onClick={()=>remove(c.id)}><Trash2 size={16}/></button>
            </div>
            <div className="text-xs text-gray-500">Afinidade: {c.afinidade}/5 {c.instituicao?`• ${c.instituicao}`:""}</div>
            {c.proximoPasso && <div className="mt-1 text-sm">➡️ Próximo passo: {c.proximoPasso}</div>}
            {c.obs && <div className="mt-1 text-xs text-gray-600">{c.obs}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- ROTEIROS ----------
function calcCusto(distanciaKm, consumoKmL, preco, pedagios){
  const d = Number(distanciaKm||0), c = Number(consumoKmL||0), p = Number(preco||0), pe = Number(pedagios||0);
  if(d<=0 || c<=0) return 0;
  return (d / c) * p + pe;
}

function Roteiros({ db, setDb }){
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ data:"", zona: db.config.zonas?.[0] || "Zona", cidades:"", distanciaKm:"", consumoKmL: db.config.consumoEstradaKmL, precoCombustivel: db.config.precoCombustivelRef, pedagios:"0", obs:"" });
  const list = useMemo(()=> db.roteiros.filter(r => (r.zona+" "+r.cidades).toLowerCase().includes(q.toLowerCase())), [db.roteiros, q]);

  const add = () => {
    if(!form.data || !form.cidades) { alert("Data e cidades são obrigatórias"); return; }
    const custoTotal = calcCusto(form.distanciaKm, form.consumoKmL, form.precoCombustivel, form.pedagios);
    setDb({ ...db, roteiros: [...db.roteiros, { id: crypto.randomUUID(), ...form, custoTotal }] });
    setForm({ data:"", zona: db.config.zonas?.[0] || "Zona", cidades:"", distanciaKm:"", consumoKmL: db.config.consumoEstradaKmL, precoCombustivel: db.config.precoCombustivelRef, pedagios:"0", obs:"" });
  };
  const remove = (id) => setDb({ ...db, roteiros: db.roteiros.filter(i=>i.id!==id) });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        <input className="input" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/>
        <select className="input" value={form.zona} onChange={e=>setForm({...form,zona:e.target.value})}>
          {db.config.zonas.map(z => <option key={z}>{z}</option>)}
        </select>
        <input className="input sm:col-span-2" placeholder="Sequência de cidades (ex: Guaíba > Camaquã > Pelotas)" value={form.cidades} onChange={e=>setForm({...form,cidades:e.target.value})}/>
        <input className="input" type="number" placeholder="Distância (km)" value={form.distanciaKm} onChange={e=>setForm({...form,distanciaKm:e.target.value})}/>
        <input className="input" type="number" placeholder="Consumo (km/L)" value={form.consumoKmL} onChange={e=>setForm({...form,consumoKmL:e.target.value})}/>
        <input className="input" type="number" placeholder="Preço combustível (R$/L)" value={form.precoCombustivel} onChange={e=>setForm({...form,precoCombustivel:e.target.value})}/>
        <input className="input" type="number" placeholder="Pedágios (R$)" value={form.pedagios} onChange={e=>setForm({...form,pedagios:e.target.value})}/>
        <input className="input sm:col-span-2" placeholder="Observações" value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})}/>
        <button onClick={add} className="btn-primary"><Plus size={16}/> Adicionar</button>
      </div>

      <div className="flex items-center gap-2"><Search size={16}/><input className="input" placeholder="Buscar por zona/cidade" value={q} onChange={e=>setQ(e.target.value)}/></div>

      <div className="grid md:grid-cols-2 gap-3">
        {list.map(r => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{r.data} • {r.zona}</div>
                <div className="text-sm text-gray-600">{r.cidades}</div>
              </div>
              <button className="icon-btn" onClick={()=>remove(r.id)}><Trash2 size={16}/></button>
            </div>
            <div className="mt-2 text-sm">Custo estimado: <span className="font-semibold">R$ {Number(r.custoTotal||0).toFixed(2)}</span></div>
            <div className="text-xs text-gray-500">Dist.: {r.distanciaKm||"—"} km • Consumo: {r.consumoKmL||"—"} km/L • Comb.: R$ {r.precoCombustivel||"—"}/L • Ped.: R$ {r.pedagios||"—"}</div>
            {r.obs && <div className="mt-1 text-xs text-gray-600">{r.obs}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- DESPESAS ----------
function Despesas({ db, setDb }){
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ data:"", tipo:"combustível", valor:"", cidade:"", roteiroId:"", obs:"" });
  const list = useMemo(()=> db.despesas.filter(d => (d.tipo+" "+d.cidade).toLowerCase().includes(q.toLowerCase())), [db.despesas, q]);
  const add = () => {
    if(!form.data || !form.valor) { alert("Data e valor são obrigatórios"); return; }
    setDb({ ...db, despesas: [...db.despesas, { id: crypto.randomUUID(), ...form, valor: Number(form.valor) }] });
    setForm({ data:"", tipo:"combustível", valor:"", cidade:"", roteiroId:"", obs:"" });
  };
  const remove = (id) => setDb({ ...db, despesas: db.despesas.filter(i=>i.id!==id) });
  const total = useMemo(()=> db.despesas.reduce((s,x)=>s+Number(x.valor||0),0), [db.despesas]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        <input className="input" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/>
        <select className="input" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
          <option>combustível</option><option>refeição</option><option>hospedagem</option><option>material</option><option>outros</option>
        </select>
        <input className="input" type="number" step="0.01" placeholder="Valor (R$)" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})}/>
        <input className="input" placeholder="Cidade" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}/>
        <select className="input" value={form.roteiroId} onChange={e=>setForm({...form,roteiroId:e.target.value})}>
          <option value="">Roteiro (opcional)</option>
          {db.roteiros.map(r=> <option key={r.id} value={r.id}>{r.data} • {r.zona}</option>)}
        </select>
        <input className="input sm:col-span-2" placeholder="Observações" value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})}/>
        <button onClick={add} className="btn-primary"><Plus size={16}/> Adicionar</button>
      </div>

      <div className="flex items-center gap-2"><Search size={16}/><input className="input" placeholder="Buscar por tipo/cidade" value={q} onChange={e=>setQ(e.target.value)}/></div>

      <div className="grid md:grid-cols-2 gap-3">
        {list.map(d => (
          <div key={d.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{d.tipo} • R$ {Number(d.valor||0).toFixed(2)}</div>
                <div className="text-sm text-gray-600">{d.data} — {d.cidade || "—"}</div>
              </div>
              <button className="icon-btn" onClick={()=>remove(d.id)}><Trash2 size={16}/></button>
            </div>
            {d.roteiroId && <div className="text-xs text-gray-500">Roteiro: {db.roteiros.find(r=>r.id===d.roteiroId)?.zona || d.roteiroId}</div>}
            {d.obs && <div className="mt-1 text-xs text-gray-600">{d.obs}</div>}
          </div>
        ))}
      </div>

      <div className="text-right text-sm text-gray-700">Total: <span className="font-semibold">R$ {total.toFixed(2)}</span></div>
    </div>
  );
}

// ---------- CONFIG ----------
function Config({ db, setDb }){
  const [form, setForm] = useState({
    precoCombustivelRef: db.config.precoCombustivelRef,
    consumoEstradaKmL: db.config.consumoEstradaKmL,
    consumoCidadeKmL: db.config.consumoCidadeKmL,
    zonas: db.config.zonas.join(", ")
  });

  const save = () => {
    const zonas = form.zonas.split(",").map(z => z.trim()).filter(Boolean);
    setDb({ ...db, config: {
      precoCombustivelRef: Number(form.precoCombustivelRef||0),
      consumoEstradaKmL: Number(form.consumoEstradaKmL||0),
      consumoCidadeKmL: Number(form.consumoCidadeKmL||0),
      zonas
    }});
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        <label className="label">Preço combustível ref. (R$/L)
          <input className="input" type="number" step="0.01" value={form.precoCombustivelRef} onChange={e=>setForm({...form,precoCombustivelRef:e.target.value})}/>
        </label>
        <label className="label">Consumo estrada (km/L)
          <input className="input" type="number" step="0.1" value={form.consumoEstradaKmL} onChange={e=>setForm({...form,consumoEstradaKmL:e.target.value})}/>
        </label>
        <label className="label">Consumo cidade (km/L)
          <input className="input" type="number" step="0.1" value={form.consumoCidadeKmL} onChange={e=>setForm({...form,consumoCidadeKmL:e.target.value})}/>
        </label>
        <label className="label md:col-span-3">Zonas (separadas por vírgula)
          <input className="input" value={form.zonas} onChange={e=>setForm({...form,zonas:e.target.value})}/>
        </label>
      </div>
      <button onClick={save} className="btn-primary"><Edit3 size={16}/> Salvar Configurações</button>
    </div>
  );
}

// ---------- APP ----------
export default function App(){
  const { db, setDb, reset } = useStore();
  const [current, setCurrent] = useState("agenda");

  const onExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `assessor_mvp_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const onImport = (data) => setDb(data);

  const stats = useMemo(() => ({
    agendaHoje: db.agenda.filter(a=>a.data===new Date().toISOString().slice(0,10)).length,
    demandasAtrasadas: db.demandas.filter(d=>d.status!=="Resolvida" && d.prazo && d.prazo < new Date().toISOString().slice(0,10)).length,
    contatosA: db.contatos.filter(c=>c.prioridade==="A").length,
    kmPlanejados: db.roteiros.reduce((s,r)=>s+Number(r.distanciaKm||0),0)
  }),[db]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header current={current} setCurrent={setCurrent}/>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat title="Compromissos hoje" value={stats.agendaHoje} hint="Agenda"/>
          <Stat title="Demandas atrasadas" value={stats.demandasAtrasadas} hint="SLA estourado"/>
          <Stat title="Contatos Prioridade A" value={stats.contatosA} hint="Relações"/>
          <Stat title="Km planejados" value={stats.kmPlanejados} hint="Soma dos roteiros"/>
        </div>

        <Toolbar onExport={onExport} onImport={onImport} onReset={reset}/>

        <section className="space-y-4">
          {current==="agenda" && <Agenda db={db} setDb={setDb}/>}
          {current==="demandas" && <Demandas db={db} setDb={setDb}/>}
          {current==="contatos" && <Contatos db={db} setDb={setDb}/>}
          {current==="roteiros" && <Roteiros db={db} setDb={setDb}/>}
          {current==="despesas" && <Despesas db={db} setDb={setDb}/>}
          {current==="config" && <Config db={db} setDb={setDb}/>}
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 pb-8 text-xs text-gray-500">
        Dica: exporte seu JSON periodicamente e guarde em nuvem. Próximo passo: login e sincronização.
      </footer>
    </div>
  );
}
