// Gen-brugelige UI-primitives. Ingen view-specifikke afhængigheder.
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SPROG } from "../i18n.js";
import { sx, today, addDays, daysBetween } from "../utils/index.js";
import { C, STATUS } from "../data/constants.js";

// ── StatusBadge — bruges OVERALT i stedet for manuelle farve+tekst kombinationer ──
export function StatusBadge({ status, label, sm, style }) {
  const s = STATUS[status] || STATUS.info;
  const lbl = label ?? s.label;
  return (
    <span style={sx({
      background: s.bg, color: s.color,
      padding: sm ? "1px 7px" : "3px 9px",
      borderRadius: 20, fontSize: sm ? 10 : 11, fontWeight: 700,
      whiteSpace: "nowrap", display: "inline-flex", alignItems: "center",
      gap: 3, lineHeight: "18px", letterSpacing: "0.01em",
    }, style)}>
      <span style={{ fontSize: sm ? 9 : 10 }}>{s.ikon}</span>
      {lbl}
    </span>
  );
}

// ── ProgressRing — lille cirkel-progress til patientkort ──
export function ProgressRing({ pct, size = 28, stroke = 3, color }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const col = color || (pct === 100 ? C.grn : pct > 60 ? C.acc : pct > 30 ? C.amb : C.red);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.brd} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct/100)}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset .4s ease" }}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        style={{ fill: col, fontSize: size < 30 ? 7 : 9, fontWeight: 700, fontFamily: "inherit" }}>
        {pct}%
      </text>
    </svg>
  );
}

export function Pill({ color = C.acc, bg = C.accM, children, sm }) {
  return <span style={{background:bg,color,padding:sm?"1px 7px":"2px 9px",borderRadius:20,fontSize:sm?10:11,fontWeight:700,whiteSpace:"nowrap",display:"inline-block",lineHeight:"18px"}}>{children}</span>;
}

export function Btn({ onClick, disabled, children, v = "ghost", small, full, title }) {
  const vs = {
    primary: {background:C.acc,color:"#ffffff",border:"none",fontWeight:800},
    ghost:   {background:"transparent",color:C.txtD,border:`1px solid ${C.brd}`},
    danger:  {background:C.redM,color:C.red,border:`1px solid ${C.red}55`},
    accent:  {background:C.accM,color:C.acc,border:`1px solid ${C.acc}44`},
    subtle:  {background:C.s3,color:C.txtD,border:`1px solid ${C.brd}`},
    outline: {background:"transparent",color:C.acc,border:`1px solid ${C.acc}`,fontWeight:600},
  };
  return (
    <button disabled={disabled} onClick={onClick} title={title}
      style={sx(vs[v]||vs.ghost,{borderRadius:8,padding:small?"4px 11px":"7px 15px",cursor:disabled?"not-allowed":"pointer",fontSize:small?12:13,fontFamily:"inherit",opacity:disabled?0.45:1,display:"inline-flex",alignItems:"center",gap:5,transition:"opacity .15s, filter .15s",width:full?"100%":"auto",justifyContent:"center"})}
      className={disabled?"":"pm-btn-hover"}>
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder, style, type = "text", min, max }) {
  return <input type={type} value={value||""} min={min} max={max}
    onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={sx({background:C.s1,border:`1px solid ${C.brd}`,borderRadius:8,padding:"7px 11px",color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"},style)}/>;
}

export function Sel({ value, onChange, options, style }) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)}
      style={sx({background:C.s1,border:`1px solid ${C.brd}`,borderRadius:8,padding:"7px 10px",color:C.txtD,fontSize:13,fontFamily:"inherit",cursor:"pointer",outline:"none"},style)}>
      {options.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  );
}

export function Modal({ title, onClose, children, w = 520 }) {
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}}
      style={{position:"fixed",inset:0,background:"rgba(15,25,35,0.45)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}}>
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:14,width:w,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(15,25,35,0.15)"}}>
        <div style={{padding:"15px 20px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.s2,zIndex:1}}>
          <span style={{color:C.txt,fontWeight:700,fontSize:15}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.txtD,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 4px"}}>X</button>
        </div>
        <div style={{padding:20,flex:1,overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
}

export function FRow({ label, children, hint }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{color:C.txtD,fontSize:12,marginBottom:5,fontWeight:600}}>{label}</div>
      {children}
      {hint&&<div style={{color:C.txtM,fontSize:11,marginTop:4}}>{hint}</div>}
    </div>
  );
}

// Sprogvælger med flag-ikoner. Bruger i18n.changeLanguage som persisterer til localStorage.
export function LanguageSwitcher({ inline = false }) {
  const { i18n: i18nInst, t } = useTranslation();
  const aktiv = i18nInst.language || "da";
  return (
    <div style={{display:"inline-flex",gap:4,background:inline?"transparent":C.s2,
      border:inline?"none":`1px solid ${C.brd}`,borderRadius:8,padding:inline?0:3}}>
      {SPROG.map(s=>{
        const er = aktiv.startsWith(s.kode);
        return (
          <button key={s.kode} onClick={()=>i18nInst.changeLanguage(s.kode)}
            title={t("lang.switchTo",{lang:s.navn})}
            aria-label={t("lang.switchTo",{lang:s.navn})}
            style={{background:er?C.accM:"transparent",border:er?`1px solid ${C.acc}`:"1px solid transparent",
              borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontSize:13,
              color:er?C.acc:C.txtM,fontWeight:er?700:400,display:"inline-flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:15,lineHeight:1}}>{s.flag}</span>
            <span style={{fontSize:11,letterSpacing:".05em"}}>{s.kode.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toast({ msg, type = "success", onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t)},[]);
  const col = type==="error"?C.red:type==="warn"?C.amb:C.grn;
  return (
    <div style={{position:"fixed",bottom:28,right:28,background:C.s3,border:`1px solid ${col}55`,borderLeft:`4px solid ${col}`,borderRadius:10,padding:"12px 18px",color:C.txt,fontSize:13,zIndex:9999,boxShadow:"0 8px 32px rgba(15,25,35,0.12)",maxWidth:380,animation:"slideUp .3s ease"}}>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}`}</style>
      {msg}
    </div>
  );
}

// ── KpiDrillModal — drill-through fra dashboard-KPI til listevisning ──
export function KpiDrillModal({ title, patienter, filter, onClose }) {
  const rows = patienter.flatMap(p=>{
    const res = filter(p);
    return res.opgaver.map(o=>({patNavn:p.navn,patCpr:p.cpr,...o}));
  });
  return (
    <Modal title={title} onClose={onClose} w={680}>
      {rows.length===0
        ? <div style={{color:C.txtM,padding:12}}>Ingen poster</div>
        : <div style={{maxHeight:420,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:C.s3}}>
                {["Patient","CPR","Opgave","Status","Dato","Medarb."].map(h=>(
                  <th key={h} style={{color:C.txtM,fontSize:11,textAlign:"left",padding:"8px 10px",borderBottom:`1px solid ${C.brd}`,fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C.brd}`,background:i%2===0?"transparent":C.s1}}>
                  <td style={{padding:"7px 10px",color:C.txt,fontSize:12}}>{r.patNavn}</td>
                  <td style={{padding:"7px 10px",color:C.txtM,fontSize:11}}>{r.patCpr}</td>
                  <td style={{padding:"7px 10px",color:C.txtD,fontSize:11,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.opgave||r.navn}</td>
                  <td style={{padding:"7px 10px"}}>
                    <Pill color={r.status==="planlagt"?C.grn:r.status==="ikke-planlagt"?C.red:C.amb}
                          bg={r.status==="planlagt"?C.grnM:r.status==="ikke-planlagt"?C.redM:C.ambM} sm>
                      {r.status==="planlagt"?"OK Planlagt":r.status==="ikke-planlagt"?"X Fejl":" Afventer"}
                    </Pill>
                  </td>
                  <td style={{padding:"7px 10px",color:C.txtD,fontSize:11}}>{r.dato||"-"}</td>
                  <td style={{padding:"7px 10px",color:C.pur,fontSize:11}}>{r.medarbejder||"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </Modal>
  );
}

export function PatientDrillModal({ title, patienter, filterPat, onClose }) {
  const rows = patienter.filter(filterPat);
  return (
    <Modal title={title} onClose={onClose} w={540}>
      {rows.length===0
        ? <div style={{color:C.txtM,padding:12}}>Ingen patienter</div>
        : <div style={{maxHeight:420,overflowY:"auto"}}>
          {rows.map(p=>{
            const done = p.opgaver.filter(o=>o.status==="planlagt").length;
            const tot = p.opgaver.length;
            const pct = tot>0?Math.round(done/tot*100):0;
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.brd}`}}>
                <div style={{width:36,fontSize:11,color:C.txtM,fontVariantNumeric:"tabular-nums"}}>{done}/{tot}</div>
                <span style={{flex:1,color:C.txt,fontSize:13}}>{p.navn}</span>
                <span style={{color:C.txtM,fontSize:11}}>{p.cpr}</span>
                <div style={{width:80,background:C.brd,borderRadius:3,height:5}}>
                  <div style={{background:pct===100?C.grn:C.acc,width:`${pct}%`,height:"100%",borderRadius:3}}/>
                </div>
              </div>
            );
          })}
        </div>
      }
    </Modal>
  );
}

// Afdelings-scope vælger
export function ScopeModal({ alleAfdelinger, afdScope, toggleAktiv, toggleRes, onClose }) {
  return (
    <Modal title="Afdelingsscope - pavirker hele appen" onClose={onClose} w={520}>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{color:C.txtD,fontSize:12,marginBottom:4}}>
          Vælg hvilke afdelinger og ressourcer der skal indga i planlægning, dashboard og alle visninger.
        </div>
        {alleAfdelinger.map(af=>{
          const sc = afdScope[af.id];
          const aktiv = sc?.aktiv;
          return (
            <div key={af.id} style={{
              border:"1.5px solid "+(aktiv?C.acc:C.brd),
              borderRadius:10,background:aktiv?C.accM:C.s2,
              padding:"12px 14px",transition:"all .15s",
              opacity:aktiv?1:0.55}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:"0 0 auto",minWidth:170}}
                  onClick={()=>toggleAktiv(af.id)}>
                  <span style={{width:18,height:18,borderRadius:4,flexShrink:0,
                    border:"1.5px solid "+(aktiv?C.acc:C.brd2),
                    background:aktiv?C.acc:"#fff",
                    display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                    {aktiv&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}></span>}
                  </span>
                  <span style={{fontSize:13,fontWeight:700,color:aktiv?C.acc:C.txtD}}>{af.navn}</span>
                  {af.id==="current"&&(
                    <span style={{fontSize:9,background:C.acc,color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}}>STD</span>
                  )}
                </div>
                {aktiv&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginLeft:"auto"}}>
                    {[["med","Medarbejdere"],["lok","Lokaler"],["pat","Patienter"]].map(([res,label])=>(
                      <div key={res} onClick={()=>toggleRes(af.id,res)}
                        style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                          padding:"6px 11px",borderRadius:6,
                          border:"1px solid "+(sc[res]?C.acc:C.brd),
                          background:sc[res]?"#fff":C.s3,
                          transition:"all .12s",userSelect:"none"}}>
                        <span style={{width:14,height:14,borderRadius:3,flexShrink:0,
                          border:"1.5px solid "+(sc[res]?C.acc:C.brd2),
                          background:sc[res]?C.acc:"transparent",
                          display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                          {sc[res]&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>OK</span>}
                        </span>
                        <span style={{fontSize:12,color:sc[res]?C.acc:C.txtM,fontWeight:sc[res]?600:400}}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {aktiv&&!sc.med&&!sc.lok&&!sc.pat&&(
                <div style={{marginTop:8,color:C.amb,fontSize:11}}>! Vælg mindst en ressource</div>
              )}
            </div>
          );
        })}
        <div style={{color:C.txtM,fontSize:11,paddingTop:8,borderTop:"1px solid "+C.brd}}>
          Ressourcer deles pa tvaers - f.eks. lokaler fra en afdeling kan bruges til patienter fra en anden.
        </div>
      </div>
    </Modal>
  );
}

// ── Kapacitet helpers ──────────────────────────────────────────────
// Beregn maks timer baseret på grænseType og periode
export function beregnMaxTimer(kap, fraDato, tilDato) {
  const dage = Math.max(1, daysBetween(fraDato, tilDato) + 1);
  const uger = dage / 7;
  switch (kap.grænseType) {
    case "dag":     return kap.grænseTimer * dage;
    case "uge":     return kap.grænseTimer * uger;
    case "mdr":     return kap.grænseTimer * (dage/30.44);
    case "kvartal": return kap.grænseTimer * (dage/91.25);
    case "halvaar": return kap.grænseTimer * (dage/182.5);
    case "år":      return kap.grænseTimer * (dage/365);
    case "ialt": {
      if (!kap.ialtFra || !kap.ialtTil) return kap.grænseTimer;
      const overlapFra = fraDato > kap.ialtFra ? fraDato : kap.ialtFra;
      const overlapTil = tilDato < kap.ialtTil ? tilDato : kap.ialtTil;
      if (overlapFra > overlapTil) return 0;
      const overlapDage = daysBetween(overlapFra, overlapTil) + 1;
      const totalDage = daysBetween(kap.ialtFra, kap.ialtTil) + 1;
      return kap.grænseTimer * (overlapDage / totalDage);
    }
    default: return kap.grænseTimer * uger;
  }
}

// Beregn rullende gns-timer pr. uge over seneste N uger
export function beregnRullendeGns(opgaver, tilDato, periodeUger) {
  const fraRullende = addDays(tilDato, -(periodeUger*7 - 1));
  const opgsIPeriode = opgaver.filter(o=>o.status==="planlagt" && o.dato && o.dato>=fraRullende && o.dato<=tilDato);
  const totalMin = opgsIPeriode.reduce((a,o)=>a+o.minutter, 0);
  return totalMin/60 / Math.max(1, periodeUger);
}

// Samlet kapacitetsstatus for en medarbejder
export function beregnKapStatus(med, patienter, fraDato, tilDato) {
  const kap = med.kapacitet || {grænseType:"uge", grænseTimer:med.timer||23, rullendePeriodeUger:4, rullendeMaxTimer:Math.round((med.timer||23)*0.85)};
  const opgs = patienter.flatMap(p=>p.opgaver.filter(o=>o.medarbejder===med.navn && o.status==="planlagt" && o.dato && o.dato>=fraDato && o.dato<=tilDato));
  const h = opgs.reduce((a,o)=>a+o.minutter/60, 0);
  const maxH = beregnMaxTimer(kap, fraDato, tilDato);
  const pct = maxH>0 ? Math.round(h/maxH*100) : 0;
  const alleOpgs = patienter.flatMap(p=>p.opgaver.filter(o=>o.medarbejder===med.navn && o.status==="planlagt"));
  const rulGns = beregnRullendeGns(alleOpgs, tilDato, kap.rullendePeriodeUger||4);
  const rulMax = kap.rullendeMaxTimer || Math.round((med.timer||23)*0.85);
  const rulPct = rulMax>0 ? Math.round(rulGns/rulMax*100) : 0;
  const advarsel = pct>=97 || rulPct>=97;
  return { h, maxH, pct, rulGns, rulMax, rulPct, advarsel, kap };
}

// Periode-vælger (fra/til + kvik-preset-knapper)
export function PeriodeVaelger({ fraDato, setFraDato, tilDato, setTilDato }) {
  const iDag = today();
  return (
    <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 18px",
      display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:4}}>
      <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Måleperiode</span>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Fra</span>
          <input type="date" value={fraDato} onChange={e=>setFraDato(e.target.value)}
            style={{background:C.s1,border:`1px solid ${C.brd}`,borderRadius:7,padding:"6px 10px",
              color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer"}}/>
        </div>
        <span style={{color:C.txtD,fontSize:12}}>-</span>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Til</span>
          <input type="date" value={tilDato} onChange={e=>setTilDato(e.target.value)}
            style={{background:C.s1,border:`1px solid ${C.brd}`,borderRadius:7,padding:"6px 10px",
              color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {[
          ["I dag",      iDag,              iDag],
          ["1 uge",      iDag,              addDays(iDag, 7)],
          ["4 uger",     iDag,              addDays(iDag, 28)],
          ["3 mdr",      iDag,              addDays(iDag, 90)],
          ["Hele året", `${iDag.slice(0,4)}-01-01`, `${iDag.slice(0,4)}-12-31`],
          ["Seneste 28", addDays(iDag, -28), iDag],
        ].map(([label, fra, til])=>{
          const act = fraDato===fra && tilDato===til;
          return (
            <button key={label} onClick={()=>{setFraDato(fra);setTilDato(til);}}
              style={{background:act?C.accM:"transparent",color:act?C.acc:C.txtM,
                border:`1px solid ${act?C.acc:C.brd}`,borderRadius:6,
                padding:"5px 11px",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                fontWeight:act?700:400}}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Header til en view: titel + undertitel + højre-side actions
export function ViewHeader({ titel, undertitel, actions }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20,paddingBottom:16,borderBottom:"2px solid "+C.brd}}>
      <div>
        <h1 style={{color:C.txt,fontWeight:800,fontSize:22,margin:0,letterSpacing:"-0.02em"}}>{titel}</h1>
        {undertitel&&<div style={{color:C.txtM,fontSize:13,marginTop:3}}>{undertitel}</div>}
      </div>
      {actions&&<div style={{display:"flex",gap:8,alignItems:"center"}}>{actions}</div>}
    </div>
  );
}

// Fejlfanger — viser pæn fejlbesked i stedet for "sort skærm"
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch(e, info) {}
  render() {
    if (this.state.err) return (
      <div style={{padding:40,fontFamily:"sans-serif",color:"#003d8a"}}>
        <h2>Fejl i PlanMed</h2>
        <pre style={{marginTop:16,fontSize:12,whiteSpace:"pre-wrap"}}>{String(this.state.err)}</pre>
        <button onClick={()=>this.setState({err:null})} style={{marginTop:16,padding:"8px 16px",cursor:"pointer"}}>
          Prøv igen
        </button>
      </div>
    );
    return this.props.children;
  }
}

// Blød/hård-toggle — bruges i kapacitetsregler (bløde = advarsel, hårde = afvis)
export function StrenghedToggle({ value, onChange }) {
  return (
    <div style={{display:"flex",gap:4,marginTop:4}}>
      {["bloed","haard"].map(v=>(
        <button key={v} onClick={()=>onChange(v)}
          style={{background:value===v?(v==="bloed"?C.ambM:C.redM):"transparent",
            color:value===v?(v==="bloed"?C.amb:C.red):C.txtM,
            border:`1px solid ${value===v?(v==="bloed"?C.amb:C.red):C.brd}`,
            borderRadius:6,padding:"2px 10px",cursor:"pointer",
            fontSize:11,fontFamily:"inherit",fontWeight:value===v?700:400}}>
          {v==="bloed"?"Blød (advar)":"Hård (afvis)"}
        </button>
      ))}
    </div>
  );
}

