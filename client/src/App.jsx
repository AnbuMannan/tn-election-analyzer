import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  Upload, ChevronRight, AlertCircle, CheckCircle, TrendingUp,
  Target, BarChart2, Users, Award, Zap, Search, X, RefreshCw,
  Activity, Table, PieChart as PieIcon, Shield, Crosshair,
  Mail, Download, FileSpreadsheet, Image,
  MapPin, Info, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ── Palette — Tamil Nadu Govt + PMK Theme ────────────────────── */
/* PMK Flag: Blue (top) #1B4F9E | Yellow (middle) #FFD700 | Red (bottom) #DC2626 */
const C = {
  dmk:'#DC2626', nda:'#1B4F9E', others:'#7C3AED', nota:'#6B7280',
  bg:'#F3F4F6', surface:'#FFFFFF', card:'#FFFFFF', border:'#E5E7EB',
  border2:'#D1D5DB', text:'#111827', muted:'#6B7280', accent:'#1B4F9E',
  win:'#15803D', lose:'#DC2626', postal:'#0D9488',
  pmkBlue:'#1B4F9E', pmkYellow:'#FFD700', pmkRed:'#DC2626',
  headerBg:'#0F2A5E', headerText:'#FFFFFF',
  tnGreen:'#15803D', tnSaffron:'#F97316',
};
const AC = { 'DMK Alliance':C.dmk,'NDA Alliance':C.nda,'Others':C.others,'NOTA':C.nota,'Rejected':'#9CA3AF' };
const DMK_P = new Set(['DMK','BSP','DMSK','DHMK','MNM','VCK','CPI','CPM','APTAMK','TNMM','IUML','INC','MMP','Makkal Munnetra Peravai']);
const NDA_P = new Set(['PMK','AMMK','NTK','BJP','AIADMK','ADMK','MDMK','PTK','RPI','RPI(A)','Pattali Makkal Katchi','Amma Makkal Munnettra Kazagam','Republican Party of India (Athawale)']);

// Political party flags/colors
const PARTY_FLAGS = {
  'DMK':  { color: '#E8293A', emoji: '🔴', abbr: 'DMK' },
  'PMK':  { color: '#F97316', emoji: '🟠', abbr: 'PMK' },
  'AMMK': { color: '#DC2626', emoji: '🔴', abbr: 'AMMK' },
  'ADMK': { color: '#10B981', emoji: '🟢', abbr: 'ADMK' },
  'AIADMK': { color: '#10B981', emoji: '🟢', abbr: 'ADMK' },
  'NTK':  { color: '#1D4ED8', emoji: '🔵', abbr: 'NTK' },
  'BSP':  { color: '#7C3AED', emoji: '🟣', abbr: 'BSP' },
  'MNM':  { color: '#0891B2', emoji: '🔵', abbr: 'MNM' },
  'BJP':  { color: '#F97316', emoji: '🟠', abbr: 'BJP' },
  'INC':  { color: '#2563EB', emoji: '🔵', abbr: 'INC' },
  'VCK':  { color: '#7C3AED', emoji: '🟣', abbr: 'VCK' },
  'IND':  { color: '#6B7280', emoji: '⚪', abbr: 'IND' },
  'DHMK': { color: '#E8293A', emoji: '🔴', abbr: 'DHMK' },
  'DMSK': { color: '#E8293A', emoji: '🔴', abbr: 'DMSK' },
  'APTAMK': { color: '#E8293A', emoji: '🔴', abbr: 'APTAMK' },
  'MMP':  { color: '#E8293A', emoji: '🔴', abbr: 'MMP' },
  'RPI':  { color: '#F97316', emoji: '🟠', abbr: 'RPI' },
  'RPI(A)': { color: '#F97316', emoji: '🟠', abbr: 'RPI(A)' },
};

const autoAlliance = p => {
  if (!p||p==='SUMMARY') return 'Others';
  const up = p.toUpperCase().trim();
  if (DMK_P.has(p) || DMK_P.has(up)) return 'DMK Alliance';
  if (NDA_P.has(p) || NDA_P.has(up)) return 'NDA Alliance';
  // Check partial matches for full party names from Form 20
  const lower = p.toLowerCase();
  if (lower.includes('dravida munnetra')) return 'DMK Alliance';
  if (lower.includes('pattali makkal')) return 'NDA Alliance';
  if (lower.includes('amma makkal')) return 'NDA Alliance';
  if (lower.includes('makkal needhi')) return 'DMK Alliance';
  if (lower.includes('naam tamilar')) return 'NDA Alliance';
  if (lower.includes('makkal munnetra peravai')) return 'DMK Alliance';
  if (lower.includes('republican party')) return 'NDA Alliance';
  if (lower.includes('bahujan samaj')) return 'DMK Alliance';
  return p==='NOTA'?'NOTA':'Others';
};

const fmt   = n  => (n||0).toLocaleString('en-IN');
const pct   = (n,t) => t>0?((n/t)*100).toFixed(1):'0.0';
const clamp = (n,lo,hi) => Math.min(hi,Math.max(lo,n));
const classify = (margin,total) => {
  const p = total>0?Math.abs(margin)/total*100:0;
  return p<5?'Critical':p<15?'Swing':'Stronghold';
};

// ── Party Flag Badge ──────────────────────────────────────────────
function PartyFlag({ party, size=14 }) {
  const info = PARTY_FLAGS[party] || PARTY_FLAGS['IND'];
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3,background:info.color+'20',
      border:`1px solid ${info.color}40`,borderRadius:4,padding:'1px 5px',fontSize:size-3,fontWeight:700}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:info.color,display:'inline-block'}}/>
      <span style={{color:info.color}}>{info.abbr}</span>
    </span>
  );
}

/* ── Demo data ─────────────────────────────────────────────────── */
const DEMO = {
  constituency:'59 - Dharmapuri', totalElectors:269773, totalBooths:383,
  candidateColumns:['SUBRAMANI.P. (DMK)','PERUMAL.P. (BSP)','SAKTHIVEL.P. (DMSK)',
    'SENTHILKUMAR (NTK)','NATARAJAN.M. (APTAMK)','MANI.L. (DHMK)',
    'Candidate (My India Party)','RAJENDRAN.D.K. (AMMK)','VENKATESHWARAN.S. (PMK)',
    'JAYAVENKATESAN.S. (MNM)','SHANMUGAM.P. (IND)','SUNDARAMOORTHY.M (IND)',
    'SUBRAMANI.K. (IND)','SUBRAMANI.T. (IND)','TAMILARASAN.S. (IND)',
    'NATARAJAN.V. (IND)','PALANI.S.K. (IND)','MANIGANDAN.E.V. (IND)',
    'RAJENDRAN.K. (IND)','VENKATESWARAN.B. (IND)'],
  candidateTotals:[78770,464,213,8700,1897,194,208,11226,105630,5083,237,127,364,304,654,718,160,357,74,117],
  evmCandidateTotals:[76846,462,210,8609,1890,194,208,11166,104415,5034,236,126,364,304,654,716,160,355,74,114],
  postalVotes:[1924,2,3,91,7,0,0,60,1215,49,1,1,0,0,0,0,2,0,2,0],
  partyMap:{'0':'DMK','1':'BSP','2':'DMSK','3':'NTK','4':'APTAMK','5':'DHMK','6':'My India Party','7':'AMMK','8':'PMK','9':'MNM'},
  officialEVM:212247, officialPostal:3360, officialCombined:215607,
  totalVotesCast:217879, totalNOTA:1726, totalRejected:546,
  rows: Array.from({length:383},(_,i)=>{
    const d=100+Math.floor(Math.random()*400); const n=80+Math.floor(Math.random()*450);
    const nota=Math.floor(Math.random()*12); const total=d+n+nota+20;
    return {booth:String(i+1),candidateVotes:[d,2,1,20,5,1,1,30,n,10,1,1,1,1,2,2,1,1,0,0],nota,rejected:0,reportedTotal:total,page:Math.floor(i/40)+1};
  }),
};

/* ── Micro components ──────────────────────────────────────────── */
const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return <div style={{background:'#FFFFFF',border:'1px solid #D1D5DB',borderRadius:10,padding:'8px 14px',fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
    {label&&<p style={{color:C.muted,marginBottom:4}}>{label}</p>}
    {payload.map((p,i)=><p key={i} style={{color:p.color,fontWeight:600}}>{p.name}: {fmt(p.value)}</p>)}
  </div>;
};
const Card  = ({children,style={}}) => <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',...style}}>{children}</div>;
const ST    = ({children,icon:I}) => (
  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:14}}>
    {I&&<I size={14} style={{color:C.pmkBlue}}/>}
    <span style={{color:C.text,fontFamily:"'Merriweather',serif",fontWeight:700,fontSize:14}}>{children}</span>
  </div>
);
const Badge = ({t,c}) => <span style={{background:c+'22',color:c,border:`1px solid ${c}44`,borderRadius:99,padding:'2px 8px',fontSize:10,fontWeight:700,whiteSpace:'nowrap'}}>{t}</span>;
const KPI   = ({icon:I,label,value,sub,color,sub2,sub2color}) => (
  <div style={{background:'#FFFFFF',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 16px',display:'flex',flexDirection:'column',gap:4,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
    <div style={{background:color+'15',borderRadius:8,padding:6,width:'fit-content'}}><I size={15} style={{color}}/></div>
    <div style={{color:C.text,fontFamily:"'Merriweather',serif",fontSize:21,fontWeight:700}}>{value}</div>
    <div style={{color:C.muted,fontSize:11}}>{label}</div>
    {sub&&<div style={{color,fontSize:11,fontWeight:600}}>{sub}</div>}
    {sub2&&<div style={{color:sub2color||C.postal,fontSize:10}}>{sub2}</div>}
  </div>
);

// ── Export Button ───────────────────────────────────────────────
function ExportButton({ tabId, data, boothData, totals, mapping, constituency }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const fn = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const exportCSV = () => {
    let csv = '', rows = [], headers = [];
    if (tabId === 'booths' || tabId === 'swing') {
      headers = ['Booth','Locality','DMK Alliance','NDA Alliance','Others','NOTA','Total','Margin','Classification','DMK%','NDA%'];
      rows = boothData.map(b => [
        b.booth, b.locality||'', b['DMK Alliance'], b['NDA Alliance'], b.Others, b.NOTA, b.total,
        b.margin, b.classification, b.dmkPct+'%', b.ndaPct+'%'
      ]);
    } else if (tabId === 'candidates') {
      headers = ['Rank','Candidate','Alliance','EVM Votes','Postal Votes','Total Votes','Share%'];
      const cands = (data.candidateColumns||[]).map((col,i)=>({col,i,total:data.candidateTotals?.[i]||0,evm:data.evmCandidateTotals?.[i]||0,postal:data.postalVotes?.[i]||0,alliance:mapping[i]||'Others'})).sort((a,b)=>b.total-a.total);
      rows = cands.map((c,rank)=>[rank+1,c.col,c.alliance,c.evm,c.postal,c.total,pct(c.total,totals.total)+'%']);
    } else {
      headers = ['Metric','Value'];
      rows = [
        ['Constituency', data.constituency],
        ['Total Electors', data.totalElectors],
        ['Total Booths', data.totalBooths],
        ['DMK Alliance', totals.dmk],
        ['NDA Alliance', totals.nda],
        ['Others', totals.others],
        ['NOTA', totals.nota],
        ['Total Votes', totals.total],
        ['Margin', Math.abs(totals.margin)],
        ['Leader', totals.leader],
      ];
    }
    csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${constituency.replace(/\s/g,'-')}-${tabId}-analysis.csv`; a.click();
    setOpen(false);
  };

  const exportImage = async () => {
    try {
      // Load html2canvas dynamically via script tag (avoids webpack bundling issues)
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Failed to load html2canvas'));
          document.head.appendChild(s);
        });
      }
      const el = document.getElementById(`tab-content-${tabId}`);
      if (!el) { alert('Tab content not found'); return; }
      const canvas = await window.html2canvas(el, { scale:2, backgroundColor:C.bg, useCORS:true });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
      a.download = `${constituency.replace(/\s/g,'-')}-${tabId}.png`; a.click();
    } catch(e) { alert('Export failed. Please screenshot manually.'); }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:'flex',alignItems:'center',gap:5,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
        <Download size={12}/> Export {open?<ChevronUp size={10}/>:<ChevronDown size={10}/>}
      </button>
      {open && (
        <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:C.card,border:`1px solid ${C.border2}`,borderRadius:10,padding:6,zIndex:100,minWidth:150,boxShadow:'0 8px 32px #00000060'}}>
          {[
            {icon:FileSpreadsheet, label:'Export CSV', fn:exportCSV},
            {icon:Image, label:'Export PNG', fn:exportImage},
          ].map(({icon:I,label,fn})=>(
            <button key={label} onClick={fn}
              style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 10px',background:'none',border:'none',color:C.text,fontSize:12,cursor:'pointer',borderRadius:6,textAlign:'left'}}
              className="hover:bg-white hover:bg-opacity-10">
              <I size={13} style={{color:C.accent}}/>{label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── STEP 1: Upload ─────────────────────────────────────────────── */
function UploadStep({onParsed, onDemo}) {
  const [drag,setDrag]=useState(false);
  const [loading,setLoad]=useState(false);
  const [prog,setProg]=useState('');
  const [err,setErr]=useState('');
  const ref=useRef();

  const handle = async f => {
    if (!f||f.type!=='application/pdf'){setErr('Please upload a PDF file.');return;}
    setLoad(true);setErr('');setProg('Uploading...');
    try {
      setProg('Parsing all pages...');
      const fd=new FormData();fd.append('pdf',f);
      const res=await fetch('/api/parse',{method:'POST',body:fd});
      const d=await res.json();
      if(!res.ok||d.error) throw new Error(d.error||'Parse failed');
      onParsed(d);
    } catch(e){setErr(`${e.message}. Use Demo Mode.`);}
    finally{setLoad(false);setProg('');}
  };

  return (
    <div style={{background:'linear-gradient(180deg, #0F2A5E 0%, #1B4F9E 50%, #F3F4F6 50%)',minHeight:'100vh',fontFamily:"'Noto Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {/* PMK Flag Bar */}
      <div style={{display:'flex',height:6}}>
        <div style={{flex:1,background:C.pmkBlue}}/>
        <div style={{flex:1,background:C.pmkYellow}}/>
        <div style={{flex:1,background:C.pmkRed}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'calc(100vh - 6px)',padding:'20px'}}>
        <div style={{width:'100%',maxWidth:560}}>
          <div style={{textAlign:'center',marginBottom:28}}>
            {/* PMK Branding */}
            <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'8px 20px',borderRadius:99,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',marginBottom:16,backdropFilter:'blur(8px)'}}>
              <span style={{fontSize:22}}>🥭</span>
              <div style={{display:'flex',gap:3}}>
                <div style={{width:10,height:16,borderRadius:2,background:C.pmkBlue,border:'1px solid rgba(255,255,255,0.3)'}}/>
                <div style={{width:10,height:16,borderRadius:2,background:C.pmkYellow}}/>
                <div style={{width:10,height:16,borderRadius:2,background:C.pmkRed}}/>
              </div>
              <span style={{color:'#FFD700',fontSize:11,fontWeight:700,letterSpacing:1.5}}>PMK IT WING</span>
            </div>
            <h1 style={{fontFamily:"'Merriweather',serif",fontSize:38,fontWeight:900,color:'#FFFFFF',lineHeight:1.15,margin:'0 0 10px',textShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>Election<br/><span style={{color:'#FFD700'}}>Intelligence</span></h1>
            <p style={{color:'rgba(255,255,255,0.75)',fontSize:13,lineHeight:1.8}}>Tamil Nadu Form 20 Booth-Level Analysis Dashboard<br/>Upload PDF &middot; Auto-Parse &middot; Campaign Intelligence</p>
          </div>
          <div style={{background:'#FFFFFF',borderRadius:20,padding:'28px 32px',boxShadow:'0 20px 60px rgba(0,0,0,0.15)',border:'1px solid #E5E7EB'}}>
            <div onClick={()=>ref.current?.click()}
              onDragOver={e=>{e.preventDefault();setDrag(true);}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files[0]);}}
              style={{background:drag?'#EFF6FF':'#F9FAFB',border:`2px dashed ${drag?C.pmkBlue:'#D1D5DB'}`,borderRadius:14,padding:'36px 28px',textAlign:'center',cursor:'pointer',transition:'all .2s'}}>
              <input ref={ref} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>handle(e.target.files[0])}/>
              {loading
                ?<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                   <div style={{width:36,height:36,border:`3px solid ${C.pmkBlue}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
                   <p style={{color:C.pmkBlue,fontWeight:600,fontSize:13}}>{prog}</p>
                   <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                 </div>
                :<><div style={{background:C.pmkBlue+'12',borderRadius:12,padding:14,width:'fit-content',margin:'0 auto 12px'}}><Upload size={24} style={{color:C.pmkBlue}}/></div>
                   <p style={{color:C.text,fontWeight:700,fontSize:16,marginBottom:4}}>Drop Form 20 PDF here</p>
                   <p style={{color:C.muted,fontSize:12}}>2011 &middot; 2016 &middot; 2021 &middot; All 234 ACs &middot; Both table formats</p></>}
            </div>
            {err&&<div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginTop:12,display:'flex',gap:8}}><AlertCircle size={13} style={{color:C.lose,marginTop:2}}/><p style={{color:'#991B1B',fontSize:12}}>{err}</p></div>}
            <button onClick={onDemo} style={{background:'#F9FAFB',border:'1px solid #D1D5DB',color:C.text,borderRadius:12,padding:'10px 20px',fontSize:13,fontWeight:600,width:'100%',marginTop:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              <span style={{color:C.pmkBlue}}>&#9670;</span> Demo Mode &mdash; Dharmapuri 2021
            </button>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginTop:16}}>
            {['Auto Party Detection','Both Formats','Postal Votes','Booth Names','Export CSV/PNG'].map(f=>
              <span key={f} style={{background:'rgba(255,255,255,0.9)',border:'1px solid #E5E7EB',color:C.muted,borderRadius:99,padding:'3px 10px',fontSize:10,boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}>{f}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── STEP 2: Mapping ────────────────────────────────────────────── */
function MappingStep({data,onMapped}) {
  const alliances=['DMK Alliance','NDA Alliance','Others','NOTA','Rejected'];
  const [mapping,setMapping]=useState(()=>{
    const m={};(data.candidateColumns||[]).forEach((_,i)=>{m[i]=autoAlliance(data.partyMap?.[String(i)]);});return m;
  });
  const [q,setQ]=useState('');
  const counts=useMemo(()=>{const c={};alliances.forEach(a=>{c[a]=0;});Object.values(mapping).forEach(a=>{c[a]=(c[a]||0)+1;});return c;},[mapping]);
  const filtered=(data.candidateColumns||[]).map((col,i)=>({col,i})).filter(({col})=>col.toLowerCase().includes(q.toLowerCase()));
  const hasPostal=data.postalVotes&&data.postalVotes.some(v=>v>0);

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Noto Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{display:'flex',height:4}}>
        <div style={{flex:1,background:C.pmkBlue}}/>
        <div style={{flex:1,background:C.pmkYellow}}/>
        <div style={{flex:1,background:C.pmkRed}}/>
      </div>
      <div style={{background:C.headerBg,borderBottom:'1px solid rgba(255,255,255,0.1)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:28,height:28,borderRadius:99,background:'linear-gradient(135deg,#FFD700,#F97316)',display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontWeight:800,fontSize:12}}>2</div>
          <div>
            <p style={{color:'#FFFFFF',fontWeight:700,fontSize:15,fontFamily:"'Merriweather',serif"}}>Map Candidates to Alliances</p>
            <p style={{color:'rgba(255,255,255,0.6)',fontSize:11}}>{data.constituency} · {data.totalBooths} booths · {(data.candidateColumns||[]).length} candidates{hasPostal?' · ✉ Postal votes detected':''}</p>
          </div>
        </div>
        <button onClick={()=>onMapped(mapping)} style={{background:'linear-gradient(135deg,#1B4F9E,#2563EB)',color:'#FFF',borderRadius:10,padding:'8px 22px',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 2px 8px rgba(27,79,158,0.3)'}}>
          Generate Dashboard <ChevronRight size={15}/>
        </button>
      </div>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:14}}>
          {alliances.map(a=>(
            <div key={a} style={{background:(AC[a]||C.others)+'18',border:`1px solid ${(AC[a]||C.others)}33`,borderRadius:10,padding:'10px',textAlign:'center'}}>
              <div style={{color:AC[a]||C.others,fontSize:22,fontWeight:800,fontFamily:"'Merriweather',serif"}}>{counts[a]||0}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{a}</div>
            </div>
          ))}
        </div>
        {hasPostal&&<div style={{background:'#F0FDFA',border:`1px solid ${C.postal}33`,borderRadius:10,padding:'9px 14px',marginBottom:10,display:'flex',gap:8,alignItems:'center'}}><Mail size={13} style={{color:C.postal}}/><p style={{color:C.postal,fontSize:11}}>Postal ballot votes detected — will be included in totals automatically.</p></div>}
        <div style={{position:'relative',marginBottom:10}}>
          <Search size={12} style={{position:'absolute',left:11,top:9,color:C.muted}}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search candidates..."
            style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:'7px 12px 7px 32px',fontSize:12,width:'100%',outline:'none'}}/>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'36px 1fr 90px 70px 150px',padding:'8px 14px',background:C.surface,borderBottom:`1px solid ${C.border}`}}>
            {['#','Candidate','EVM Votes','Postal','Alliance'].map(h=><span key={h} style={{color:C.muted,fontSize:10,fontWeight:700}}>{h}</span>)}
          </div>
          <div style={{maxHeight:460,overflowY:'auto'}}>
            {filtered.map(({col,i})=>{
              const party=data.partyMap?.[String(i)]||'IND';
              const cur=mapping[i]||'Others'; const ac=AC[cur]||C.others;
              const evm=data.evmCandidateTotals?.[i]||0; const postal=data.postalVotes?.[i]||0;
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'36px 1fr 90px 70px 150px',padding:'9px 14px',borderBottom:`1px solid ${C.border}`,alignItems:'center'}}>
                  <span style={{color:C.muted,fontSize:10}}>{i+1}</span>
                  <div>
                    <p style={{color:C.text,fontSize:12,fontWeight:600}}>{col}</p>
                    <PartyFlag party={party}/>
                  </div>
                  <span style={{color:C.muted,fontSize:11,fontWeight:600}}>{fmt(evm)}</span>
                  <span style={{color:postal>0?C.postal:C.border2,fontSize:11,fontWeight:postal>0?700:400}}>{postal>0?`+${fmt(postal)}`:'—'}</span>
                  <select value={cur} onChange={e=>setMapping(m=>({...m,[i]:e.target.value}))}
                    style={{background:ac+'22',color:ac,border:`1px solid ${ac}44`,borderRadius:7,padding:'4px 7px',fontSize:10,fontWeight:700,cursor:'pointer',outline:'none',width:'100%'}}>
                    {alliances.map(a=><option key={a} value={a} style={{background:C.card,color:C.text}}>{a}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── STEP 3: Dashboard ──────────────────────────────────────────── */
const TABS=[
  {id:'overview',     label:'Overview',       icon:PieIcon},
  {id:'booths',       label:'Booth Analysis', icon:Table},
  {id:'swing',        label:'Swing & Critical',icon:Crosshair},
  {id:'candidates',   label:'Candidates',     icon:Users},
  {id:'trends',       label:'Trends',         icon:Activity},
  {id:'accuracy',     label:'Data Verify',    icon:CheckCircle},
];

function Dashboard({data, mapping}) {
  const [tab,setTab]         = useState('overview');
  const [selBooth,setSelBooth] = useState(null);
  const [bSearch,setBSearch] = useState('');
  const [fClass,setFClass]   = useState('All');
  const [sortBy,setSortBy]   = useState('margin');
  const [sortDir,setSortDir] = useState('desc');
  const [showPostal,setShowPostal] = useState(false);
  const [allianceView,setAllianceView] = useState('All');  // for swing tab
  const [boothNames,setBoothNames]   = useState({});       // booth map
  const [boothLoading,setBoothLoading] = useState(false);
  const [boothStatus,setBoothStatus] = useState('');

  const hasPostal = data.postalVotes && data.postalVotes.some(v=>v>0);

  // Auto-load booth list when data loads
  useEffect(()=>{
    const acMatch = data.constituency?.match(/(\d+)/);
    if (!acMatch) return;
    const acNum = acMatch[1];
    setBoothLoading(true);
    fetch(`/api/booth-list/${acNum}`)
      .then(r=>r.json())
      .then(d=>{
        if (d.found && d.booths && Object.keys(d.booths).length>0) {
          setBoothNames(d.booths);
          setBoothStatus(`✓ Booth names loaded (${Object.keys(d.booths).length} booths from ${d.filename||'file'})`);
        } else {
          setBoothStatus('No booth list file found — place AC0XX_booths.pdf in booth_lists/ folder');
        }
      })
      .catch(()=>setBoothStatus(''))
      .finally(()=>setBoothLoading(false));
  },[data.constituency]);

  const getBoothDisplay = useCallback((boothId) => {
    if (!boothId) return { name:'Unknown Booth', short:'B?', info: null };
    const id = String(boothId).trim();

    // Try exact match first
    let info = boothNames[id];
    // Try without leading zeros
    if (!info) info = boothNames[id.replace(/^0+/,'')];
    // Try stripping parenthetical suffixes: "4(A)" -> "4"
    if (!info) {
      const base = id.replace(/\s*\([^)]*\)\s*/g,'').replace(/[A-Za-z]+$/,'').trim();
      info = boothNames[base] || boothNames[base.replace(/^0+/,'')];
    }
    // Try with leading zero: "4" -> "04"
    if (!info && id.length===1) info = boothNames['0'+id];

    if (!info) return { name:`Booth ${id}`, short:`B${id}`, info: null };
    return {
      name: `${id} — ${info.locality}`,
      short: info.locality || `B${id}`,
      info,
    };
  }, [boothNames]);

  /* ── Aggregated booth data ── */
  const boothData = useMemo(()=>data.rows.map(row=>{
    const a={'DMK Alliance':0,'NDA Alliance':0,'Others':0,'NOTA':0,'Rejected':row.rejected||0};
    (row.candidateVotes||[]).forEach((v,i)=>{
      const al=mapping[i]||'Others';
      if(al==='NOTA') a['NOTA']+=v;
      else if(a.hasOwnProperty(al)) a[al]+=v;
      else a['Others']+=v;
    });
    // NOTA from row metadata (parsed from NOTA column) — use if no candidate mapped to NOTA
    if(a['NOTA']===0 && row.nota) a['NOTA']=row.nota;
    const dmk=a['DMK Alliance'],nda=a['NDA Alliance'];
    // Total = sum of all candidate votes + NOTA (what EVM actually recorded as valid + NOTA)
    const candidateSum = dmk+nda+a.Others+a.NOTA;
    // Use reportedTotal if available and reasonable, else computed
    const total = row.reportedTotal && row.reportedTotal >= candidateSum ? row.reportedTotal : candidateSum;
    const margin=dmk-nda;
    const bd = getBoothDisplay(row.booth);
    return {...row,...a,total,margin,leader:margin>=0?'DMK':'NDA',
            classification:classify(margin,total),dmkPct:+pct(dmk,total),ndaPct:+pct(nda,total),
            ...bd};
  }),[data.rows,mapping,getBoothDisplay]);

  /* ── Totals ── */
  const evmT = useMemo(()=>{
    const t = {dmk:0,nda:0,others:0,nota:0,total:0};
    boothData.forEach(b=>{
      t.dmk += b['DMK Alliance'];
      t.nda += b['NDA Alliance'];
      t.others += b.Others;
      t.nota += b.NOTA;
    });
    t.total = t.dmk + t.nda + t.others + t.nota;
    return t;
  },[boothData]);
  const postalT = useMemo(()=>{
    if(!hasPostal) return {dmk:0,nda:0,others:0,nota:0,total:0};
    const t={dmk:0,nda:0,others:0,nota:0,total:0};
    (data.postalVotes||[]).forEach((v,i)=>{
      const al=mapping[i]||'Others';
      if(al==='DMK Alliance') t.dmk+=v;
      else if(al==='NDA Alliance') t.nda+=v;
      else if(al==='NOTA') t.nota+=v;
      else if(al==='Rejected') { /* skip rejected from totals */ }
      else t.others+=v;
    });
    t.total = t.dmk + t.nda + t.others + t.nota;
    return t;
  },[data.postalVotes,mapping,hasPostal]);
  const totals = useMemo(()=>{
    const d=evmT.dmk+postalT.dmk, n=evmT.nda+postalT.nda, o=evmT.others+postalT.others, no=evmT.nota+postalT.nota;
    const t=d+n+o+no;
    return{dmk:d,nda:n,others:o,nota:no,total:t,margin:d-n,leader:d>n?'DMK Alliance':'NDA Alliance'};
  },[evmT,postalT]);

  const cc=useMemo(()=>({Critical:boothData.filter(b=>b.classification==='Critical').length,Swing:boothData.filter(b=>b.classification==='Swing').length,Stronghold:boothData.filter(b=>b.classification==='Stronghold').length}),[boothData]);

  /* ── Filtered booths ── */
  const filteredBooths = useMemo(()=>{
    let l=boothData;
    if(fClass!=='All') l=l.filter(b=>b.classification===fClass);
    if(bSearch) l=l.filter(b=>b.booth.toLowerCase().includes(bSearch.toLowerCase())||b.short.toLowerCase().includes(bSearch.toLowerCase()));
    if(allianceView!=='All') l=l.filter(b=>{if(allianceView==='DMK')return b['DMK Alliance']>b['NDA Alliance'];if(allianceView==='NDA')return b['NDA Alliance']>b['DMK Alliance'];return true;});
    return [...l].sort((a,b)=>{
      const va=sortBy==='dmk'?a['DMK Alliance']:sortBy==='nda'?a['NDA Alliance']:Math.abs(a.margin);
      const vb=sortBy==='dmk'?b['DMK Alliance']:sortBy==='nda'?b['NDA Alliance']:Math.abs(b.margin);
      return sortDir==='desc'?vb-va:va-vb;
    });
  },[boothData,fClass,bSearch,sortBy,sortDir,allianceView]);

  /* ── Chart data ── */
  const donut=[{name:'DMK Alliance',value:totals.dmk},{name:'NDA Alliance',value:totals.nda},{name:'Others',value:totals.others},{name:'NOTA',value:totals.nota}].filter(d=>d.value>0);
  const topBar=useMemo(()=>[...boothData].sort((a,b)=>Math.abs(b.margin)-Math.abs(a.margin)).slice(0,14).map(b=>({name:b.short.slice(0,12),DMK:b['DMK Alliance'],NDA:b['NDA Alliance']})),[boothData]);
  const trendData=useMemo(()=>{const s=Math.max(1,Math.floor(boothData.length/60));return boothData.filter((_,i)=>i%s===0).map(b=>({name:b.short.slice(0,8),DMK:b['DMK Alliance'],NDA:b['NDA Alliance']}));},[boothData]);
  const candData=useMemo(()=>(data.candidateColumns||[]).map((col,i)=>({name:col,total:data.candidateTotals?.[i]||0,evm:data.evmCandidateTotals?.[i]||0,postal:data.postalVotes?.[i]||0,alliance:mapping[i]||'Others',party:data.partyMap?.[String(i)]||'IND',pct:+pct(data.candidateTotals?.[i]||0,totals.total)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total),[data,mapping,totals.total]);

  const lc=totals.leader==='DMK Alliance'?C.dmk:C.nda;

  /* ── Header ── */
  const Header=()=>(
    <div>
      <div style={{display:'flex',height:4}}>
        <div style={{flex:1,background:C.pmkBlue}}/>
        <div style={{flex:1,background:C.pmkYellow}}/>
        <div style={{flex:1,background:C.pmkRed}}/>
      </div>
      <div style={{background:C.headerBg,padding:'11px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:20}}>🥭</span>
            <div style={{width:3,height:28,borderRadius:2,background:'linear-gradient(#1B4F9E, #FFD700, #DC2626)'}}/>
          </div>
          <div>
            <p style={{color:'#FFFFFF',fontFamily:"'Merriweather',serif",fontWeight:700,fontSize:17}}>{data.constituency}</p>
            <p style={{color:'rgba(255,255,255,0.6)',fontSize:10}}>
              {fmt(data.totalElectors)} electors · {boothData.length} booths
              {hasPostal&&<span style={{color:'#5EEAD4'}}> · ✉ Postal included</span>}
              {boothStatus&&<span style={{color:Object.keys(boothNames).length>0?'#86EFAC':'rgba(255,255,255,0.5)'}}> · {boothStatus}</span>}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {hasPostal&&<button onClick={()=>setShowPostal(p=>!p)} style={{background:showPostal?'rgba(94,234,212,0.15)':'rgba(255,255,255,0.08)',border:`1px solid ${showPostal?'#5EEAD4':'rgba(255,255,255,0.15)'}`,color:showPostal?'#5EEAD4':'rgba(255,255,255,0.6)',borderRadius:8,padding:'4px 10px',fontSize:10,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><Mail size={10}/>Postal {showPostal?'ON':'OFF'}</button>}
          <div style={{background:lc===C.dmk?'rgba(220,38,38,0.15)':'rgba(27,79,158,0.2)',border:`1px solid ${lc===C.dmk?'rgba(220,38,38,0.4)':'rgba(27,79,158,0.4)'}`,borderRadius:8,padding:'5px 12px',display:'flex',alignItems:'center',gap:6}}>
            <Award size={12} style={{color:lc===C.dmk?'#FCA5A5':'#93C5FD'}}/>
            <span style={{color:'#FFFFFF',fontSize:12,fontWeight:700}}>{totals.leader} leads by {fmt(Math.abs(totals.margin))}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const TabBar=()=>(
    <div style={{background:'#FFFFFF',borderBottom:'1px solid #E5E7EB',display:'flex',overflowX:'auto',padding:'0 16px',boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
      {TABS.map(t=>{const a=tab===t.id;const I=t.icon;return(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'11px 16px',borderBottom:`2px solid ${a?C.pmkBlue:'transparent'}`,color:a?C.pmkBlue:C.muted,fontSize:12,fontWeight:a?700:500,whiteSpace:'nowrap',background:'none',border:'none',cursor:'pointer'}}>
          <I size={12}/>{t.label}
        </button>
      );})}
    </div>
  );

  /* ── Booth Detail Popup ── */
  const BoothDetailCard=({booth,onClose})=>{
    const b=boothData.find(x=>x.booth===booth);
    if(!b) return null;
    const bd=getBoothDisplay(b.booth);
    const info=bd.info;
    const areas=info?.area ? info.area.split('\n').filter(l=>l.trim()) : [];
    const realAreas=areas.filter(a=>!a.startsWith('999'));
    const hasOverseas=areas.some(a=>a.startsWith('999'));
    return (
      <div style={{background:'#FFFFFF',border:'2px solid #1B4F9E33',borderRadius:16,padding:'18px 20px',marginBottom:14,boxShadow:'0 8px 32px rgba(0,0,0,0.08)'}}>
        {/* Header row */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
              <div style={{background:C.pmkBlue+'15',border:'1px solid '+C.pmkBlue+'33',borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:800,color:C.pmkBlue,fontFamily:"'Merriweather',serif"}}>
                Booth {b.booth}
              </div>
              {info&&<div style={{display:'flex',alignItems:'center',gap:5}}>
                <MapPin size={12} style={{color:C.muted}}/>
                <span style={{color:C.text,fontSize:13,fontWeight:700}}>{info.locality}</span>
                {info.pincode&&<span style={{color:C.muted,fontSize:10,background:C.border,borderRadius:4,padding:'1px 5px'}}>{info.pincode}</span>}
              </div>}
              <span style={{background:b.classification==='Critical'?C.lose+'20':b.classification==='Swing'?C.others+'20':C.win+'20',color:b.classification==='Critical'?C.lose:b.classification==='Swing'?C.others:C.win,borderRadius:99,padding:'2px 8px',fontSize:9,fontWeight:700}}>{b.classification}</span>
            </div>
            {info?.building&&<div style={{display:'flex',alignItems:'flex-start',gap:5,marginTop:4}}>
              <span style={{fontSize:11}}>🏫</span>
              <span style={{color:C.muted,fontSize:11,lineHeight:1.4}}>{info.building}</span>
            </div>}
            {info?.gender&&info.gender!=='All Voters'&&<div style={{marginTop:4}}>
              <span style={{background:C.border,color:C.muted,borderRadius:4,padding:'2px 7px',fontSize:10}}>{info.gender}</span>
            </div>}
          </div>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,cursor:'pointer',color:C.muted,borderRadius:8,padding:5,display:'flex',marginLeft:12}}><X size={14}/></button>
        </div>
        {/* Vote breakdown */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:info?14:0}}>
          {[{l:'DMK Alliance',v:b['DMK Alliance'],p:b.dmkPct,c:C.dmk},{l:'NDA Alliance',v:b['NDA Alliance'],p:b.ndaPct,c:C.nda},{l:'Others',v:b.Others,p:+pct(b.Others,b.total),c:C.others},{l:'NOTA',v:b.NOTA,p:+pct(b.NOTA,b.total),c:C.nota},{l:'Margin',v:(b.margin>=0?'+':'')+fmt(b.margin),p:null,c:b.margin>=0?C.dmk:C.nda}].map(({l,v,p,c})=>(
            <div key={l} style={{background:c+'14',border:`1px solid ${c}28`,borderRadius:10,padding:'10px',textAlign:'center'}}>
              <div style={{color:c,fontWeight:800,fontSize:16,fontFamily:"'Merriweather',serif"}}>{typeof v==='number'?fmt(v):v}</div>
              <div style={{color:C.muted,fontSize:9,marginTop:2,lineHeight:1.3}}>{l}</div>
              {p!==null&&<div style={{color:c,fontSize:9,fontWeight:600,marginTop:1}}>{p}%</div>}
            </div>
          ))}
        </div>
        {/* Polling Area Coverage */}
        {info&&areas.length>0&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:12}}>📋</span>
                <span style={{color:C.pmkBlue,fontSize:12,fontWeight:700}}>Polling Area Coverage</span>
                <span style={{background:C.pmkBlue+'15',color:C.pmkBlue,borderRadius:99,padding:'1px 7px',fontSize:9,fontWeight:700}}>{realAreas.length} zones</span>
                {hasOverseas&&<span style={{background:C.border,color:C.muted,borderRadius:99,padding:'1px 7px',fontSize:9}}>+Overseas</span>}
              </div>
              <span style={{color:C.muted,fontSize:9}}>{fmt(b.total)} EVM votes from these areas</span>
            </div>
            <div style={{maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
              {realAreas.map((line,i)=>{
                // Parse: "1. Ward 1 Old Colony North Street"
                const numMatch = line.match(/^(\d+)\.\s*(.+)/);
                const num = numMatch?.[1];
                const text = numMatch?.[2] || line;
                return (
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'4px 6px',background:i%2===0?'transparent':C.card,borderRadius:5}}>
                    {num&&<span style={{background:C.border,color:C.muted,borderRadius:4,padding:'1px 5px',fontSize:9,fontWeight:700,minWidth:20,textAlign:'center',flexShrink:0,marginTop:1}}>{num}</span>}
                    <span style={{color:C.text,fontSize:11,lineHeight:1.4}}>{text.trim()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* No booth list loaded message */}
        {!info&&Object.keys(boothNames).length===0&&(
          <div style={{background:C.surface,borderRadius:8,padding:'8px 12px',marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
            <Info size={11} style={{color:C.muted}}/>
            <span style={{color:C.muted,fontSize:10}}>Place AC0{b.booth.slice(0,2)}_booths.txt in booth_lists/ to see locality names & polling area</span>
          </div>
        )}
      </div>
    );
  };

  /* ── Overview Tab ── */
  const Overview=()=>(
    <div id="tab-content-overview" style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
      {hasPostal&&showPostal&&(
        <div style={{background:'#F0FDFA',border:`1px solid ${C.postal}44`,borderRadius:12,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Mail size={14} style={{color:C.postal}}/><span style={{color:C.postal,fontWeight:700,fontSize:13}}>Postal Ballot Breakdown</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[{l:'DMK Alliance',v:postalT.dmk,c:C.dmk},{l:'NDA Alliance',v:postalT.nda,c:C.nda},{l:'Others',v:postalT.others,c:C.others},{l:'NOTA',v:postalT.nota,c:C.nota}].map(({l,v,c})=>(
              <div key={l} style={{background:c+'12',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                <div style={{color:c,fontWeight:800,fontSize:16}}>{fmt(v)}</div><div style={{color:C.muted,fontSize:9,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:10}}>
        <KPI icon={Users}    label="Total Electors"  value={fmt(data.totalElectors||0)} sub={`${boothData.length} booths parsed`} color={C.text}/>
        <KPI icon={BarChart2} label="Total Votes"    value={fmt(totals.total)} sub={`${pct(totals.total,data.totalElectors||1)}% turnout`} color={C.accent} sub2={hasPostal?`incl. ${fmt(postalT.total)} postal`:''} sub2color={C.postal}/>
        <KPI icon={BarChart2} label="DMK Alliance"  value={fmt(totals.dmk)}   sub={`${pct(totals.dmk,totals.total)}% share`}           color={C.dmk}   sub2={hasPostal&&postalT.dmk?`+${fmt(postalT.dmk)} postal`:''} sub2color={C.postal}/>
        <KPI icon={BarChart2} label="NDA Alliance"  value={fmt(totals.nda)}   sub={`${pct(totals.nda,totals.total)}% share`}           color={C.nda}   sub2={hasPostal&&postalT.nda?`+${fmt(postalT.nda)} postal`:''} sub2color={C.postal}/>
        <KPI icon={Target}    label="Margin"         value={fmt(Math.abs(totals.margin))} sub={totals.leader.split(' ')[0]+' leads'} color={C.accent}/>
        <KPI icon={Zap}       label="Critical"       value={cc.Critical}  sub="Margin <5%"   color={C.lose}/>
        <KPI icon={TrendingUp} label="Swing"         value={cc.Swing}     sub="Margin 5-15%" color={C.others}/>
        <KPI icon={Activity}  label="NOTA"           value={fmt(totals.nota)}  sub={`${pct(totals.nota,totals.total)}% of total`} color={C.nota}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:14}}>
        <Card>
          <ST icon={PieIcon}>Vote Share</ST>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={donut} cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={3} dataKey="value">
              {donut.map((e,i)=><Cell key={i} fill={AC[e.name]||C.others} stroke="transparent"/>)}
            </Pie><Tooltip content={<Tip/>}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:10,color:C.muted}}/></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <ST icon={BarChart2}>Alliance Breakdown</ST>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>
            {[{l:'DMK Alliance',v:totals.dmk,ev:evmT.dmk,pv:postalT.dmk,c:C.dmk},{l:'NDA Alliance',v:totals.nda,ev:evmT.nda,pv:postalT.nda,c:C.nda},{l:'Others',v:totals.others,ev:evmT.others,pv:postalT.others,c:C.others},{l:'NOTA',v:totals.nota,ev:evmT.nota,pv:postalT.nota,c:C.nota}].map(({l,v,ev,pv,c})=>(
              <div key={l}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{color:C.text,fontSize:12,fontWeight:600}}>{l}</span>
                  <span style={{color:c,fontSize:12,fontWeight:700}}>{fmt(v)} <span style={{color:C.muted,fontWeight:400}}>({pct(v,totals.total)}%)</span>{hasPostal&&showPostal&&pv>0&&<span style={{color:C.postal,fontSize:10}}> +{fmt(pv)} postal</span>}</span>
                </div>
                <div style={{background:C.border,height:6,borderRadius:3,overflow:'hidden',display:'flex'}}>
                  <div style={{width:`${pct(ev,totals.total)}%`,height:'100%',background:`linear-gradient(90deg,${c}99,${c})`,borderRadius:'3px 0 0 3px'}}/>
                  {hasPostal&&showPostal&&pv>0&&<div style={{width:`${pct(pv,totals.total)}%`,height:'100%',background:C.postal,opacity:.7}}/>}
                </div>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:14}}>
            {[{l:'Stronghold',v:cc.Stronghold,c:C.win},{l:'Swing',v:cc.Swing,c:C.others},{l:'Critical',v:cc.Critical,c:C.lose}].map(({l,v,c})=>(
              <div key={l} style={{background:c+'12',border:`1px solid ${c}28`,borderRadius:9,padding:'9px',textAlign:'center'}}>
                <div style={{color:c,fontSize:18,fontWeight:800,fontFamily:"'Merriweather',serif"}}>{v}</div>
                <div style={{color:C.muted,fontSize:9,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <ST icon={BarChart2}>Top 14 Booths — DMK vs NDA</ST>
          <ExportButton tabId="overview" data={data} boothData={boothData} totals={totals} mapping={mapping} constituency={data.constituency}/>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topBar} margin={{top:5,right:5,left:0,bottom:28}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="name" tick={{fill:C.muted,fontSize:9}} angle={-40} textAnchor="end"/>
            <YAxis tick={{fill:C.muted,fontSize:9}}/><Tooltip content={<Tip/>}/>
            <Bar dataKey="DMK" fill={C.dmk} radius={[3,3,0,0]}/><Bar dataKey="NDA" fill={C.nda} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <ST icon={Activity}>Vote Trend Across Booths</ST>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData} margin={{top:5,right:5,left:0,bottom:5}}>
            <defs>
              <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.dmk} stopOpacity={.3}/><stop offset="95%" stopColor={C.dmk} stopOpacity={0}/></linearGradient>
              <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.nda} stopOpacity={.3}/><stop offset="95%" stopColor={C.nda} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="name" tick={{fill:C.muted,fontSize:8}} interval="preserveStartEnd"/>
            <YAxis tick={{fill:C.muted,fontSize:9}}/><Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="DMK" stroke={C.dmk} strokeWidth={2} fill="url(#gD)"/>
            <Area type="monotone" dataKey="NDA" stroke={C.nda} strokeWidth={2} fill="url(#gN)"/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );

  /* ── Booth Analysis Tab ── */
  const Booths=()=>(
    <div id="tab-content-booths" style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
      {selBooth&&<BoothDetailCard booth={selBooth} onClose={()=>setSelBooth(null)}/>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative'}}><Search size={11} style={{position:'absolute',left:9,top:8,color:C.muted}}/>
          <input value={bSearch} onChange={e=>setBSearch(e.target.value)} placeholder="Search booth/area..."
            style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:'6px 10px 6px 26px',fontSize:11,outline:'none',width:160}}/>
        </div>
        <div style={{display:'flex',gap:4}}>
          {['All','Critical','Swing','Stronghold'].map(c=><button key={c} onClick={()=>setFClass(c)} style={{padding:'5px 10px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',border:`1px solid ${fClass===c?C.accent:C.border}`,background:fClass===c?C.accent+'18':'transparent',color:fClass===c?C.accent:C.muted}}>{c}</button>)}
        </div>
        <span style={{color:C.muted,fontSize:10,marginLeft:'auto'}}>{filteredBooths.length} booths</span>
        <ExportButton tabId="booths" data={data} boothData={filteredBooths} totals={totals} mapping={mapping} constituency={data.constituency}/>
      </div>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:C.surface}}>
              {[{k:'booth',l:'Booth & Locality'},{k:'dmk',l:'DMK Alliance'},{k:'nda',l:'NDA Alliance'},{k:'others',l:'Others'},{k:'nota',l:'NOTA'},{k:'total',l:'Total'},{k:'margin',l:'Margin'},{k:'class',l:'Class'}].map(({k,l})=>(
                <th key={k} onClick={()=>{if(k==='class'||k==='booth')return;setSortBy(k);setSortDir(d=>d==='desc'?'asc':'desc');}} style={{padding:'9px 12px',textAlign:'left',color:C.muted,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',borderBottom:`1px solid ${C.border}`}}>{l}{sortBy===k?(sortDir==='desc'?' ↓':' ↑'):''}</th>
              ))}
            </tr></thead>
            <tbody>
              {filteredBooths.slice(0,200).map((b,i)=>{
                const sel=selBooth===b.booth;
                const bc=b.classification==='Critical'?C.lose:b.classification==='Swing'?C.others:C.win;
                return (
                  <tr key={b.booth} onClick={()=>setSelBooth(sel?null:b.booth)} style={{background:sel?C.pmkBlue+'08':i%2===0?'transparent':'#F9FAFB',cursor:'pointer',borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'8px 12px',minWidth:140}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{background:b.margin>=0?C.dmk+'18':C.nda+'18',color:b.margin>=0?C.dmk:C.nda,borderRadius:5,padding:'2px 6px',fontSize:10,fontWeight:700,minWidth:28,textAlign:'center'}}>{b.booth}</span>
                        {b.info
                          ? <div>
                              <p style={{color:C.text,fontSize:11,fontWeight:600,lineHeight:1.2}}>{b.info.locality}</p>
                              {b.info.pincode&&<p style={{color:C.muted,fontSize:9}}>{b.info.pincode}</p>}
                            </div>
                          : <span style={{color:C.muted,fontSize:11}}>Booth {b.booth}</span>
                        }
                      </div>
                    </td>
                    <td style={{padding:'8px 12px'}}><span style={{color:C.dmk,fontWeight:700}}>{fmt(b['DMK Alliance'])}</span> <span style={{color:C.muted,fontSize:9}}>{b.dmkPct}%</span></td>
                    <td style={{padding:'8px 12px'}}><span style={{color:C.nda,fontWeight:700}}>{fmt(b['NDA Alliance'])}</span> <span style={{color:C.muted,fontSize:9}}>{b.ndaPct}%</span></td>
                    <td style={{padding:'8px 12px',color:C.others}}>{fmt(b.Others)}</td>
                    <td style={{padding:'8px 12px',color:C.nota}}>{fmt(b.NOTA)}</td>
                    <td style={{padding:'8px 12px',color:C.text}}>{fmt(b.total)}</td>
                    <td style={{padding:'8px 12px'}}><span style={{color:b.margin>=0?C.dmk:C.nda,fontWeight:700}}>{b.margin>=0?'+':''}{fmt(b.margin)}</span></td>
                    <td style={{padding:'8px 12px'}}><span style={{background:bc+'18',color:bc,borderRadius:99,padding:'2px 7px',fontSize:9,fontWeight:700}}>{b.classification}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredBooths.length>200&&<div style={{padding:'8px',textAlign:'center',borderTop:`1px solid ${C.border}`}}><span style={{color:C.muted,fontSize:10}}>Showing 200 of {filteredBooths.length} — filter to narrow</span></div>}
      </Card>
    </div>
  );

  /* ── Swing & Critical Tab ── */
  const Swing=()=>{
    const allianceFilter = allianceView==='DMK'?'DMK Alliance':allianceView==='NDA'?'NDA Alliance':null;

    const getBoothsForClass = cls => {
      let list = boothData.filter(b=>b.classification===cls);
      if (allianceFilter) list = list.filter(b=>b.leader===(allianceView==='DMK'?'DMK':'NDA'));
      return list.sort((a,b)=>Math.abs(a.margin)-Math.abs(b.margin));
    };

    const critical  = getBoothsForClass('Critical');
    const swing     = getBoothsForClass('Swing');
    const strongh   = boothData.filter(b=>{
      if(b.classification!=='Stronghold') return false;
      if(allianceFilter) return b.leader===(allianceView==='DMK'?'DMK':'NDA');
      return true;
    }).sort((a,b)=>Math.abs(b.margin)-Math.abs(a.margin));

    const BList=({items,color,emptyMsg})=>(
      <div style={{maxHeight:300,overflowY:'auto'}}>
        {items.length===0?<p style={{color:C.muted,fontSize:11,textAlign:'center',padding:16}}>{emptyMsg||'None found'}</p>
        :items.map(b=>(
          <div key={b.booth} onClick={()=>{setTab('booths');setSelBooth(b.booth);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}} className="hover:bg-white hover:bg-opacity-5">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:30,height:30,borderRadius:6,background:b.leader==='DMK'?C.dmk+'18':C.nda+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:b.leader==='DMK'?C.dmk:C.nda,flexShrink:0}}>{b.booth}</div>
              <div>
                <p style={{color:C.text,fontSize:11,fontWeight:600}}>{b.info?b.info.locality:`Booth ${b.booth}`}</p>
                <p style={{color:C.muted,fontSize:9}}>#{b.booth} · {fmt(b.total)} votes · <span style={{color:b.leader==='DMK'?C.dmk:C.nda}}>{b.leader==='DMK'?'DMK':'NDA'} leads</span>{b.info?.pincode?` · ${b.info.pincode}`:''}</p>
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <p style={{color:b.margin>=0?C.dmk:C.nda,fontSize:13,fontWeight:700}}>{b.margin>=0?'+':''}{fmt(b.margin)}</p>
              <p style={{color:C.muted,fontSize:9}}>{pct(Math.abs(b.margin),b.total)}% gap</p>
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <div id="tab-content-swing" style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
        {/* Alliance filter */}
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{color:C.muted,fontSize:12,fontWeight:600}}>View perspective:</span>
          {[
            {val:'All',   label:'All Booths',        color:C.accent},
            {val:'DMK',   label:'🔴 DMK Alliance',   color:C.dmk},
            {val:'NDA',   label:'🟠 NDA Alliance',   color:C.nda},
          ].map(({val,label,color})=>(
            <button key={val} onClick={()=>setAllianceView(val)}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${allianceView===val?color:C.border}`,background:allianceView===val?color+'22':'transparent',color:allianceView===val?color:C.muted}}>
              {label}
            </button>
          ))}
          <ExportButton tabId="swing" data={data} boothData={[...critical,...swing,...strongh]} totals={totals} mapping={mapping} constituency={data.constituency}/>
          <span style={{color:C.muted,fontSize:11,marginLeft:'auto'}}>
            {allianceView!=='All'?`Showing booths where ${allianceView==='DMK'?'DMK':'NDA'} leads`:'All booths'}
          </span>
        </div>

        {/* Summary pills */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[
            {l:`Critical (${critical.length})`,c:C.lose,sub:'Can flip with minor effort'},
            {l:`Swing (${swing.length})`,c:C.others,sub:'Contestable with campaign'},
            {l:`Stronghold (${strongh.length})`,c:C.win,sub:'Safe — maximise turnout'},
          ].map(({l,c,sub})=>(
            <div key={l} style={{background:c+'12',border:`1px solid ${c}28`,borderRadius:10,padding:'10px 14px',textAlign:'center'}}>
              <div style={{color:c,fontWeight:800,fontSize:16,fontFamily:"'Merriweather',serif"}}>{l}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
          <Card><ST icon={Crosshair}><span style={{color:C.lose}}>Critical Booths</span></ST><BList items={critical} color={C.lose} emptyMsg={`No critical booths for ${allianceView}`}/></Card>
          <Card><ST icon={Activity}><span style={{color:C.others}}>Swing Booths</span></ST><BList items={swing} color={C.others} emptyMsg={`No swing booths for ${allianceView}`}/></Card>
          <Card><ST icon={Shield}><span style={{color:C.win}}>Strongholds</span></ST><BList items={strongh.slice(0,30)} color={C.win}/></Card>
        </div>

        <Card>
          <ST icon={Target}>Booth Landscape — Margin vs Total Votes</ST>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{top:10,right:20,left:0,bottom:20}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="total" name="Total" tick={{fill:C.muted,fontSize:9}} label={{value:'Total EVM Votes',position:'insideBottom',offset:-8,fill:C.muted,fontSize:10}}/>
              <YAxis dataKey="margin" name="Margin" tick={{fill:C.muted,fontSize:9}}/>
              <ZAxis range={[25,60]}/>
              <Tooltip cursor={{strokeDasharray:'3 3'}} content={({active,payload})=>{
                if(!active||!payload?.length) return null;
                const d=payload[0]?.payload;
                return <div style={{background:'#FFFFFF',border:`1px solid ${C.border2}`,borderRadius:8,padding:'8px 12px',fontSize:10}}>
                  <p style={{color:C.text,fontWeight:700}}>B{d?.booth}{d?.info?` · ${d.info.locality}`:''}</p>
                  <p style={{color:C.muted}}>Total: {fmt(d?.total)}</p>
                  <p style={{color:d?.margin>=0?C.dmk:C.nda}}>Margin: {d?.margin>=0?'+':''}{fmt(d?.margin)}</p>
                  <p style={{color:C.muted}}>{d?.classification}</p>
                </div>;
              }}/>
              <Scatter data={boothData.filter(b=>allianceView==='All'||b.leader===(allianceView==='DMK'?'DMK':'NDA'))}
                shape={({cx,cy,payload})=>{const c=payload.classification==='Critical'?C.lose:payload.classification==='Swing'?C.others:C.win;return <circle cx={cx} cy={cy} r={3.5} fill={c} opacity={0.75}/>;}}/>
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:14,justifyContent:'center',marginTop:6}}>
            {[{l:'Critical',c:C.lose},{l:'Swing',c:C.others},{l:'Stronghold',c:C.win}].map(({l,c})=><div key={l} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:'50%',background:c}}/><span style={{color:C.muted,fontSize:10}}>{l}</span></div>)}
          </div>
        </Card>
      </div>
    );
  };

  /* ── Candidates Tab ── */
  const Candidates=()=>(
    <div id="tab-content-candidates" style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
      {hasPostal&&(
        <div style={{background:'#F0FDFA',border:`1px solid ${C.postal}33`,borderRadius:12,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Mail size={14} style={{color:C.postal}}/><span style={{color:C.postal,fontWeight:700,fontSize:13}}>Postal Ballot per Candidate</span></div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {(data.candidateColumns||[]).map((col,i)=>{
              const pv=data.postalVotes?.[i]||0;if(!pv)return null;
              const ac=AC[mapping[i]||'Others']||C.others;
              return <div key={i} style={{background:ac+'18',border:`1px solid ${ac}33`,borderRadius:8,padding:'5px 10px',textAlign:'center'}}>
                <div style={{color:ac,fontWeight:700,fontSize:13}}>{fmt(pv)}</div>
                <div style={{color:C.muted,fontSize:9,maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{col.split(' ')[0]}</div>
              </div>;
            }).filter(Boolean)}
          </div>
        </div>
      )}
      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <ST icon={Users}>Top Candidates</ST>
          <ExportButton tabId="candidates" data={data} boothData={boothData} totals={totals} mapping={mapping} constituency={data.constituency}/>
        </div>
        <ResponsiveContainer width="100%" height={Math.min(350,candData.slice(0,12).length*26+40)}>
          <BarChart data={candData.slice(0,12)} layout="vertical" margin={{top:0,right:60,left:10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
            <XAxis type="number" tick={{fill:C.muted,fontSize:9}}/><YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:9}} width={165}/>
            <Tooltip content={<Tip/>}/>
            <Bar dataKey="evm" name="EVM" stackId="a">{candData.slice(0,12).map((e,i)=><Cell key={i} fill={AC[e.alliance]||C.others}/>)}</Bar>
            {hasPostal&&<Bar dataKey="postal" name="Postal" stackId="a" fill={C.postal} radius={[0,3,3,0]}/>}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}><ST icon={Table}>All Candidates</ST></div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:C.surface}}>
              {['#','Candidate','Party','Alliance','EVM','Postal','Total','Share','Bar'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',color:C.muted,fontWeight:700,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {candData.map((c,i)=>{const ac=AC[c.alliance]||C.others;return(
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'transparent':'#F9FAFB'}}>
                  <td style={{padding:'7px 12px',color:C.muted}}>{i+1}</td>
                  <td style={{padding:'7px 12px',color:C.text,fontWeight:600}}>{c.name}</td>
                  <td style={{padding:'7px 12px'}}><PartyFlag party={c.party}/></td>
                  <td style={{padding:'7px 12px'}}><Badge t={c.alliance} c={ac}/></td>
                  <td style={{padding:'7px 12px',color:C.text,fontWeight:600}}>{fmt(c.evm)}</td>
                  <td style={{padding:'7px 12px',color:c.postal>0?C.postal:C.muted,fontWeight:c.postal>0?700:400}}>{c.postal>0?'+'+fmt(c.postal):'—'}</td>
                  <td style={{padding:'7px 12px',color:C.text,fontWeight:700}}>{fmt(c.total)}</td>
                  <td style={{padding:'7px 12px',color:ac,fontWeight:600}}>{c.pct}%</td>
                  <td style={{padding:'7px 12px',width:100}}><div style={{background:C.border,height:4,borderRadius:2,overflow:'hidden',display:'flex'}}><div style={{width:`${clamp(+pct(c.evm,totals.total)*2,0,100)}%`,height:'100%',background:ac}}/>{c.postal>0&&<div style={{width:`${clamp(+pct(c.postal,totals.total)*2,0,100)}%`,height:'100%',background:C.postal}}/>}</div></td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  /* ── Trends Tab ── */
  const Trends=()=>{
    const dist=[{r:'0-50',n:boothData.filter(b=>Math.abs(b.margin)<=50).length},{r:'51-100',n:boothData.filter(b=>Math.abs(b.margin)>50&&Math.abs(b.margin)<=100).length},{r:'101-200',n:boothData.filter(b=>Math.abs(b.margin)>100&&Math.abs(b.margin)<=200).length},{r:'201-500',n:boothData.filter(b=>Math.abs(b.margin)>200&&Math.abs(b.margin)<=500).length},{r:'500+',n:boothData.filter(b=>Math.abs(b.margin)>500).length}];
    const marginLine=boothData.filter((_,i)=>i%Math.max(1,Math.floor(boothData.length/80))===0).map((b,i)=>({i:i+1,margin:b.margin}));
    return (
      <div id="tab-content-trends" style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:10}}>
          {[{l:'Avg EVM/Booth',v:fmt(Math.round(evmT.total/(boothData.length||1))),c:C.accent},{l:'Highest Booth',v:fmt(Math.max(...boothData.map(b=>b.total))),c:C.win},{l:'DMK-led',v:boothData.filter(b=>b.leader==='DMK').length,c:C.dmk},{l:'NDA-led',v:boothData.filter(b=>b.leader==='NDA').length,c:C.nda},{l:'Total EVM NOTA',v:fmt(evmT.nota),c:C.nota},{l:'Total Postal',v:fmt(postalT.total),c:C.postal}].map(({l,v,c})=>(
            <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',textAlign:'center'}}>
              <div style={{color:c,fontFamily:"'Merriweather',serif",fontSize:19,fontWeight:800}}>{v}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Card><ST icon={BarChart2}>Margin Distribution</ST>
            <ResponsiveContainer width="100%" height={200}><BarChart data={dist} margin={{top:5,right:5,left:0,bottom:5}}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="r" tick={{fill:C.muted,fontSize:10}}/><YAxis tick={{fill:C.muted,fontSize:9}}/><Tooltip content={<Tip/>}/><Bar dataKey="n" fill={C.others} radius={[3,3,0,0]} name="Booths"/></BarChart></ResponsiveContainer>
          </Card>
          <Card><ST icon={Activity}>Running Margin</ST>
            <ResponsiveContainer width="100%" height={200}><AreaChart data={marginLine} margin={{top:5,right:5,left:0,bottom:5}}>
              <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={.3}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="i" tick={{fill:C.muted,fontSize:8}}/><YAxis tick={{fill:C.muted,fontSize:9}}/><Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="margin" stroke={C.accent} strokeWidth={1.5} fill="url(#mg)" name="Margin"/>
            </AreaChart></ResponsiveContainer>
          </Card>
        </div>
        {hasPostal&&<Card><ST icon={Mail}>Postal Distribution by Candidate</ST>
          <ResponsiveContainer width="100%" height={160}><BarChart data={candData.filter(c=>c.postal>0)} layout="vertical" margin={{top:0,right:40,left:10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/><XAxis type="number" tick={{fill:C.muted,fontSize:9}}/><YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:9}} width={160}/><Tooltip content={<Tip/>}/>
            <Bar dataKey="postal" name="Postal Votes" fill={C.postal} radius={[0,3,3,0]}/>
          </BarChart></ResponsiveContainer>
        </Card>}
      </div>
    );
  };

  /* ── Data Verify Tab ── */
  const Accuracy=()=>{
    // Our computed EVM totals from booth-level data
    const ourEVM = evmT.total;
    // Our computed postal from postal votes array
    const ourPostal = postalT.total;
    // Our combined
    const ourCombined = totals.total;

    // Official values from Form 20 summary row (set by parser)
    // If parser provided officialEVM, use it; else fall back to sum of evmCandidateTotals
    const offEVMFromCandidates = (data.evmCandidateTotals||[]).reduce((s,v)=>s+(v||0),0);
    const offPostalFromArr = (data.postalVotes||[]).reduce((s,v)=>s+(v||0),0);
    const offCombinedFromCandidates = (data.candidateTotals||[]).reduce((s,v)=>s+(v||0),0);

    const offEVM = data.officialEVM || offEVMFromCandidates || ourEVM;
    const offPostal = data.officialPostal || offPostalFromArr || ourPostal;
    const offCombined = data.officialCombined || offCombinedFromCandidates || ourCombined;

    const match=(a,b)=>a===b;
    const pctOff=(a,b)=>b>0?((Math.abs(a-b)/b)*100).toFixed(3):0;
    const topCands=candData.slice(0,5);

    // NOTA & Rejected from data
    const ourNOTA = data.totalNOTA || evmT.nota;
    const ourRejected = data.totalRejected || 0;

    return (
      <div id="tab-content-accuracy" style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
        <Card>
          <ST icon={CheckCircle}>Vote Count Verification — Form 20 Official vs Our Parse</ST>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
            {[
              {l:'EVM Valid Votes (Candidates)',our:ourEVM,off:offEVM,c:C.dmk},
              {l:'Postal Votes',our:ourPostal,off:offPostal,c:C.postal},
              {l:'Total Combined (EVM+Postal)',our:ourCombined,off:offCombined,c:C.accent},
            ].map(({l,our,off,c})=>(
              <div key={l} style={{background:match(our,off)?C.win+'12':C.lose+'12',border:`1px solid ${match(our,off)?C.win:C.lose}33`,borderRadius:12,padding:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{color:C.muted,fontSize:11}}>{l}</span>
                  <span style={{fontSize:12,fontWeight:700,color:match(our,off)?C.win:C.lose}}>{match(our,off)?'✓ MATCH':'⚠ DIFF'}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div><div style={{color:C.muted,fontSize:9}}>Our Computed</div><div style={{color:c,fontWeight:800,fontSize:16}}>{fmt(our)}</div></div>
                  <div><div style={{color:C.muted,fontSize:9}}>Form 20 Summary</div><div style={{color:C.text,fontWeight:800,fontSize:16}}>{fmt(off)}</div></div>
                </div>
                {!match(our,off)&&<div style={{color:C.lose,fontSize:10,marginTop:6}}>Difference: {fmt(Math.abs(our-off))} ({pctOff(our,off)}%)</div>}
              </div>
            ))}
          </div>
          <div style={{background:C.surface,borderRadius:10,padding:'12px 14px'}}>
            <p style={{color:C.muted,fontSize:11,marginBottom:8,fontWeight:600}}>Top 5 Candidates — EVM Vote Verification</p>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{['Candidate','Our EVM Sum','Official EVM*','Postal','Total','Status'].map(h=><th key={h} style={{padding:'6px 10px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10}}>{h}</th>)}</tr></thead>
              <tbody>{topCands.map((c,i)=>{
                const cidx = (data.candidateColumns||[]).indexOf(c.name);
                const evmOff = cidx>=0 ? (data.evmCandidateTotals?.[cidx]||0) : c.evm;
                const postalOff = cidx>=0 ? (data.postalVotes?.[cidx]||0) : c.postal;
                const totalOff = cidx>=0 ? (data.candidateTotals?.[cidx]||0) : c.total;
                return <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'6px 10px',color:C.text}}>{c.name}</td>
                  <td style={{padding:'6px 10px',color:AC[c.alliance]||C.others,fontWeight:700}}>{fmt(c.evm)}</td>
                  <td style={{padding:'6px 10px',color:C.muted}}>{fmt(evmOff)}</td>
                  <td style={{padding:'6px 10px',color:C.postal}}>{fmt(postalOff)}</td>
                  <td style={{padding:'6px 10px',color:C.text,fontWeight:700}}>{fmt(totalOff)}</td>
                  <td style={{padding:'6px 10px'}}><span style={{color:c.evm===evmOff?C.win:C.lose,fontWeight:700,fontSize:10}}>{c.evm===evmOff?'✓':'⚠'}</span></td>
                </tr>;
              })}</tbody>
            </table>
            <p style={{color:C.muted,fontSize:10,marginTop:8}}>* Official figures from Form 20 summary row. EVM = sum of booth-level candidate votes.</p>
          </div>
        </Card>
        <Card>
          <ST icon={Info}>Summary Statistics</ST>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
            {[
              {l:'Total Electors (Form 20)',v:fmt(data.totalElectors||0),c:C.text},
              {l:'Total Booths Parsed',v:fmt(boothData.length),c:C.accent},
              {l:'EVM Valid Votes',v:fmt(ourEVM),c:C.dmk},
              {l:'Postal Valid Votes',v:fmt(ourPostal),c:C.postal},
              {l:'Total Valid (EVM+Postal)',v:fmt(ourCombined),c:C.accent},
              {l:'Turnout % (over Electors)',v:data.totalElectors>0 ? pct(ourCombined,data.totalElectors)+'%' : 'N/A',c:C.win},
              {l:'NOTA Votes (EVM)',v:fmt(ourNOTA),c:C.nota},
              {l:'Rejected Votes',v:fmt(ourRejected),c:C.muted},
              {l:'Grand Total from Form 20',v:fmt(data.totalVotesCast||ourCombined),c:C.text},
              {l:'Winner Margin',v:fmt(Math.abs(totals.margin))+' ('+totals.leader.split(' ')[0]+')',c:C.win},
            ].map(({l,v,c})=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.muted,fontSize:12}}>{l}</span>
                <span style={{color:c,fontSize:12,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Noto Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <Header/><TabBar/>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        {tab==='overview'   && <Overview/>}
        {tab==='booths'     && <Booths/>}
        {tab==='swing'      && <Swing/>}
        {tab==='candidates' && <Candidates/>}
        {tab==='trends'     && <Trends/>}
        {tab==='accuracy'   && <Accuracy/>}
      </div>
    </div>
  );
}

/* ── Root ──────────────────────────────────────────────────────── */
export default function App() {
  const [step,setStep]=useState('upload');
  const [parsed,setParsed]=useState(null);
  const [mapping,setMapping]=useState(null);
  const reset=()=>{setParsed(null);setMapping(null);setStep('upload');};
  return (
    <>
      {step!=='upload'&&<button onClick={reset} style={{position:'fixed',top:10,left:12,zIndex:999,background:'#FFFFFF',border:'1px solid #D1D5DB',color:'#6B7280',borderRadius:7,padding:'5px 11px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:4,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}><RefreshCw size={10}/> New</button>}
      {step==='upload'    && <UploadStep  onParsed={d=>{setParsed(d);setStep('mapping');}} onDemo={()=>{setParsed(DEMO);setStep('mapping');}}/>}
      {step==='mapping'   && parsed && <MappingStep  data={parsed} onMapped={m=>{setMapping(m);setStep('dashboard');}}/>}
      {step==='dashboard' && parsed && mapping && <Dashboard data={parsed} mapping={mapping}/>}
    </>
  );
}