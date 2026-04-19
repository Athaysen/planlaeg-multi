import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n, { SPROG } from "./i18n.js";

// Data og utilities flyttet til /src/data + /src/utils i april 2026-refaktoreringen.
import {
  sx, uid, toMin, fromMin, fmtDate, parseLocalDate, addDays, isWeekend, nextWD,
  DAG_NAV, getDag, daysBetween, today,
  VALUTAER, valutaInfo, valutaSymbol, formatBeloeb,
} from "./utils/index.js";
import {
  C, TITLE_C, PAT_STATUS, STATUS, sC, sB, sL,
  ALLE_LOK, DEFAULT_LOK_TIDER, STANDARD_AABNINGSTIDER, LOK_TIDER,
  DEFAULT_TITLER, LK, PK, PD, ALLE_K, ensureKompetencer,
  BASE_MED, INIT_PATIENTER_RAW, FORLOB, INIT_CERTIFIKATER,
  NAV_ITEMS, KAP_TYPER, FORLOB_GALLERI, buildPatient,
} from "./data/constants.js";
import {
  StatusBadge, ProgressRing, Pill, Btn, Input, Sel, Modal, FRow,
  LanguageSwitcher, Toast, KpiDrillModal, PatientDrillModal, ScopeModal,
  PeriodeVaelger, ViewHeader, ErrorBoundary,
  beregnMaxTimer, beregnRullendeGns, beregnKapStatus,
} from "./components/primitives.jsx";
import { runPlanner, analyserRessourcer } from "./planner/runPlanner.js";
import PlanMedTester from "./tests/PlanMedTester.jsx";
import AuthFlow from "./auth/AuthFlow.jsx";
import EjerSetupDialog from "./auth/EjerSetupDialog.jsx";
import SelskabSetupWizard from "./auth/SelskabSetupWizard.jsx";
import AdminView from "./admin/AdminView.jsx";
import Dashboard from "./views/Dashboard.jsx";
import KalenderView from "./views/KalenderView.jsx";
import PlanLogView from "./views/PlanLogView.jsx";
import EjerView from "./views/EjerView.jsx";
import IndstillingerView from "./views/IndstillingerView.jsx";


function PatientDetaljeModal({pat,medarbejdere=[],patienter,forlob=FORLOB,onClose,onEdit,onDelete,onTildelForlob,onAddOpg,onEditOpg,setPatienter,updateOpg,deleteOpg,toggleLås,resetOpg,onMarkerLøst=null,lokMeta={},setAnmodninger=null,showToast=()=>{},lokaler=[]}){
  const [tab,setTab]=useState("overblik");
  const [nyAdr,setNyAdr]=useState({navn:"",vej:"",husnr:"",postnr:"",by:""});
  const [kpiDrill,setKpiDrill]=useState(null); // "planlagt"|"afventer"|"fejl"|"alt"
  const [editStam,setEditStam]=useState(false);
  const p=patienter.find(x=>x.id===pat.id)||pat;

  const done=p.opgaver.filter(o=>o.status==="planlagt").length;
  const afv=p.opgaver.filter(o=>o.status==="afventer").length;
  const fejl=p.opgaver.filter(o=>o.status==="ikke-planlagt").length;
  const tot=p.opgaver.length;
  const pct=tot>0?Math.round(done/tot*100):0;

  const foraeldreList=(p.foraeldre&&p.foraeldre.length>0)?p.foraeldre
    :(p.foraeldreNavn||p.foraeldreCpr)?[{navn:p.foraeldreNavn,cpr:p.foraeldreCpr,tlf:p.foraeldreTlf,id:p.foraeldreId,eboks:p.foraeldreEboks,vej:p.foraeldreVej,postnr:p.foraeldrePostnr,by:p.foraeldreBy,myndighedshaver:p.myndighedshaver}]:[];

  const addAdresse=()=>{
    if(!nyAdr.navn.trim()&&!nyAdr.vej.trim()&&!nyAdr.by.trim()) return;
    const ny={id:`adr_${Date.now()}`,navn:nyAdr.navn||"Adresse "+((p.adresser||[]).length+1),vej:nyAdr.vej,husnr:nyAdr.husnr,postnr:nyAdr.postnr,by:nyAdr.by};
    setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,adresser:[...(x.adresser||[]),ny]}:x));
    setNyAdr({navn:"",vej:"",husnr:"",postnr:"",by:""});
  };
  // Opret "adresse mangler" anmodning i godkendelseskøen
  const sendAdrMangler=(opg)=>{
    if(!setAnmodninger) return;
    const anmId=`adr_${Date.now()}`;
    const lokNavn=opg.lokale||"Ukendt lokale";
    const ansvarligMed=medarbejdere.find(m=>m.id===p.ansvarligMed)||medarbejdere[0]||{};
    setAnmodninger(prev=>[...prev,{
      id:anmId,
      type:"adresse-mangler",
      status:"afventer",
      tidspunkt:new Date().toISOString().slice(0,10),
      patientNavn:p.navn,
      patientId:p.id,
      patientCpr:p.cpr,
      opgaveId:opg.id,
      opgaveTitel:opg.titel||opg.navn||"",
      lokale:lokNavn,
      medNavn:opg.medarbejder||"",
      medEmail:"",
      ansvarligNavn:ansvarligMed.navn||"",
      ansvarligEmail:ansvarligMed.mail||ansvarligMed.email||"",
      kommentar:"",
      log:[{tid:new Date().toISOString().slice(0,10),tekst:`Automatisk oprettet: Manglende adresse for ${lokNavn} på opgave "${opg.titel||opg.navn||""}" (${p.navn})`}],
      mailLog:[{tid:new Date().toISOString().slice(0,10),tekst:`[SIMULERET MAIL] Til: ${opg.medarbejder||"medarbejder"} — Manglende adresse for ${lokNavn} på patient ${p.navn}. Opret eller vælg adresse i systemet.`}],
    }]);
    showToast(`Sendt til godkendelse: Manglende adresse for ${lokNavn}`, "warn");
  };

  const delAdresse=(aid)=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,adresser:(x.adresser||[]).filter(a=>a.id!==aid)}:x));

  const TABS=[
    {id:"overblik",label:"Overblik"},
    {id:"indsatser",label:`Opgaver${tot>0?" ("+tot+")":""}`},
    {id:"foraeld",label:"Forældre / Værge"},
    {id:"adresser",label:`Adresser${(p.adresser||[]).length>0?" ("+(p.adresser||[]).length+")":""}`},
  ];

  const TabBtn=({id,label})=>(
    <button onClick={()=>setTab(id)} style={{
      padding:"10px 18px",border:"none",cursor:"pointer",fontFamily:"inherit",background:"transparent",
      fontSize:13,fontWeight:tab===id?700:400,color:tab===id?C.acc:C.txtM,
      borderBottom:"2px solid "+(tab===id?C.acc:"transparent"),marginBottom:-1,transition:"color .15s"
    }}>{label}</button>
  );

  const SekLabel=({text})=>(
    <div style={{color:C.txtM,fontSize:10,fontWeight:700,letterSpacing:"0.08em",marginBottom:8,marginTop:4}}>{text}</div>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.s1,borderRadius:16,width:"100%",maxWidth:780,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.25)",overflow:"hidden"}}>

        {/*  HEADER  */}
        <div style={{padding:"20px 24px 0",borderBottom:"1px solid "+C.brd,flexShrink:0,background:C.s1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{color:C.txt,fontWeight:900,fontSize:22}}>{p.navn}</div>
                {p.haste&&<span style={{background:C.red+"22",color:C.red,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:700}}>! HASTE</span>}
                <button onClick={()=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,haste:!x.haste}:x))}
                  style={{background:"transparent",color:C.txtM,border:"1px solid "+C.brd,borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
                  {p.haste?"Fjern haste":"Markér haste"}
                </button>
                {(()=>{
                  const st=PAT_STATUS[p.status]||PAT_STATUS.aktiv;
                  return <span style={{background:st.bg,color:st.col,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:700,border:`1px solid ${st.col}33`}}>{st.label}</span>;
                })()}
              </div>
              <div style={{color:C.txtM,fontSize:12,marginTop:5,display:"flex",gap:14,flexWrap:"wrap"}}>
                <span>CPR: <b style={{color:C.txt}}>{p.cpr}</b></span>
                {p.patientNr&&<span>Pat.nr: <b style={{color:C.txt}}>{p.patientNr}</b></span>}
                <span>Henvist: <b style={{color:C.txt}}>{p.henvDato}</b></span>
                {p.forlobNr?<span style={{color:C.pur,fontWeight:700}}>{p.forlobLabel}</span>:<span style={{color:C.amb,fontWeight:600}}>Intet forløb</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:12,alignItems:"center"}}>
              <Btn v="primary" small onClick={onTildelForlob}>{p.forlobNr?"~ Forløb":"+ Forløb"}</Btn>
              <Btn v="subtle" small onClick={onAddOpg}>+ Opgave</Btn>
              <Btn v="outline" small onClick={onEdit}>Rediger</Btn>
              <div style={{position:"relative"}}>
                {(()=>{
                  const [xm,setXm]=React.useState(false);
                  React.useEffect(()=>{
                    if(!xm) return;
                    const c2=()=>setXm(false);
                    window.addEventListener("click",c2);
                    return()=>window.removeEventListener("click",c2);
                  },[xm]);
                  return(<>
                    <Btn v="outline" small onClick={e=>{e.stopPropagation();setXm(m=>!m);}}>Eksport v</Btn>
                    {xm&&(
                      <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",background:C.s1,border:`1px solid ${C.brd}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",zIndex:500,minWidth:220,overflow:"hidden"}}
                        onClick={e=>e.stopPropagation()}>
                        <div style={{padding:"7px 14px 5px",color:C.txtM,fontSize:10,fontWeight:700,letterSpacing:"0.06em",borderBottom:`1px solid ${C.brd}`}}>EXCEL</div>
                        <button onClick={()=>{eksporterOpgaveplanExcel(p);setXm(false);}}
                          style={{display:"block",width:"100%",textAlign:"left",padding:"9px 14px",background:"none",border:"none",color:C.txt,fontFamily:"inherit",fontSize:12,cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.s2}
                          onMouseLeave={e=>e.currentTarget.style.background="none"}>
                          Opgaveplan (.xlsx)
                        </button>
                        <div style={{padding:"7px 14px 5px",color:C.txtM,fontSize:10,fontWeight:700,letterSpacing:"0.06em",borderBottom:`1px solid ${C.brd}`,borderTop:`1px solid ${C.brd}`}}>PDF / HTML (print)</div>
                        <button onClick={()=>{eksporterOpgaveplanPDF(p);setXm(false);}}
                          style={{display:"block",width:"100%",textAlign:"left",padding:"9px 14px",background:"none",border:"none",color:C.txt,fontFamily:"inherit",fontSize:12,cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.s2}
                          onMouseLeave={e=>e.currentTarget.style.background="none"}>
                          Opgaveplan (.pdf)
                        </button>
                      </div>
                    )}
                  </>);
                })()}
              </div>
              <Btn v="danger" small onClick={onDelete}>Slet</Btn>
              <button onClick={onClose} style={{background:"none",border:"none",color:C.txtD,cursor:"pointer",fontSize:22,lineHeight:1,padding:"0 2px",marginLeft:4}}>×</button>
            </div>
          </div>
          {/* TABS */}
          <div style={{display:"flex",gap:0,borderBottom:"1px solid "+C.brd}}>
            {TABS.map(t=><TabBtn key={t.id} id={t.id} label={t.label}/>)}
          </div>
        </div>

        {/*  INDHOLD  */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

          {/* OVERBLIK */}
          {tab==="overblik"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Status-sektion */}
              <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontWeight:700,fontSize:13,color:C.txt,marginBottom:12}}>Patientstatus</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                  {Object.entries(PAT_STATUS).map(([key,st])=>(
                    <button key={key}
                      onClick={()=>{
                        if(p.status===key) return;
                        const hist=[...(p.statusHistorik||[]),{
                          fra:p.status||"aktiv",
                          til:key,
                          dato:today(),
                          tidspunkt:new Date().toISOString(),
                        }];
                        setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,status:key,statusHistorik:hist}:x));
                      }}
                      style={{
                        background:p.status===key?st.bg:"transparent",
                        color:p.status===key?st.col:C.txtM,
                        border:`2px solid ${p.status===key?st.col:C.brd}`,
                        borderRadius:8,padding:"7px 16px",cursor:"pointer",
                        fontFamily:"inherit",fontSize:12,fontWeight:p.status===key?700:400,
                        transition:"all .15s",
                      }}>
                      {st.label}
                    </button>
                  ))}
                </div>
                {(p.statusHistorik||[]).length>0&&(
                  <div style={{borderTop:`1px solid ${C.brd}`,paddingTop:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.txtM,marginBottom:6}}>Historik</div>
                    {[...(p.statusHistorik||[])].reverse().map((h,i)=>(
                      <div key={i} style={{display:"flex",gap:8,alignItems:"center",fontSize:11,color:C.txtM,marginBottom:3}}>
                        <span style={{color:C.txtD,minWidth:80}}>{h.dato}</span>
                        <span style={{color:(PAT_STATUS[h.fra]||PAT_STATUS.aktiv).col}}>{(PAT_STATUS[h.fra]||PAT_STATUS.aktiv).label}</span>
                        <span style={{color:C.txtM}}>{"->"}</span>
                        <span style={{color:(PAT_STATUS[h.til]||PAT_STATUS.aktiv).col,fontWeight:600}}>{(PAT_STATUS[h.til]||PAT_STATUS.aktiv).label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {[{l:"Planlagt",v:done,col:C.grn,bg:C.grnM,key:"planlagt"},{l:"Afventer",v:afv,col:C.amb,bg:C.ambM,key:"afventer"},{l:"Fejl",v:fejl,col:C.red,bg:C.redM,key:"fejl"},{l:"I alt",v:tot,col:C.acc,bg:C.accM,key:"alt"}]
                  .map(({l,v,col,bg,key})=>{
                    const active=kpiDrill===key;
                    return(
                    <div key={l} onClick={()=>setKpiDrill(active?null:key)}
                      style={{background:active?col+"22":bg,borderRadius:10,padding:"12px 14px",
                        border:"2px solid "+(active?col:col+"33"),cursor:"pointer",transition:"all .15s",
                        transform:active?"scale(1.02)":"scale(1)"}}>
                      <div style={{color:col,fontSize:24,fontWeight:900}}>{v}</div>
                      <div style={{color:col,fontSize:11,fontWeight:600,marginTop:2}}>{l}</div>
                      <div style={{color:col+"99",fontSize:10,marginTop:1}}>{active?"Skjul":"Vis opgaver"}</div>
                    </div>);
                  })}
              </div>
              {kpiDrill&&(()=>{
                const drillOps=p.opgaver.filter(o=>{
                  if(kpiDrill==="planlagt") return o.status==="planlagt";
                  if(kpiDrill==="afventer") return o.status==="afventer";
                  if(kpiDrill==="fejl") return o.status==="ikke-planlagt";
                  return true;
                });
                const drillColors={planlagt:C.grn,afventer:C.amb,fejl:C.red,alt:C.acc};
                const dc=drillColors[kpiDrill];
                return(
                  <div style={{border:`1px solid ${dc}33`,borderRadius:10,overflow:"hidden",marginTop:4}}>
                    <div style={{background:dc+"11",padding:"8px 14px",borderBottom:`1px solid ${dc}22`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:dc,fontWeight:700,fontSize:12}}>{drillOps.length} opgave{drillOps.length!==1?"r":""}</span>
                      <button onClick={()=>setKpiDrill(null)} style={{background:"none",border:"none",color:C.txtM,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
                    </div>
                    <div style={{maxHeight:200,overflowY:"auto"}}>
                      {drillOps.map((o,i)=>(
                        <div key={o.id||i} style={{padding:"8px 14px",borderBottom:`1px solid ${C.brd}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.txt}}>{o.titel||o.navn||o.opgave||"—"}</div>
                            {o.dato&&<div style={{fontSize:11,color:C.txtM,marginTop:1}}>{o.dato}{o.startKl?` kl. ${o.startKl}`:""}</div>}
                            {o.medarbejder&&<div style={{fontSize:11,color:C.pur,marginTop:1}}>{o.medarbejder}</div>}
                            {o.lokale&&<div style={{fontSize:11,color:C.txtM,marginTop:1}}>{o.lokale}</div>}
                          </div>
                          <span style={{background:o.status==="planlagt"?C.grnM:o.status==="afventer"?C.ambM:C.redM,
                            color:o.status==="planlagt"?C.grn:o.status==="afventer"?C.amb:C.red,
                            borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
                            {o.status==="planlagt"?"Planlagt":o.status==="afventer"?"Afventer":"Fejl"}
                          </span>
                        </div>
                      ))}
                      {drillOps.length===0&&<div style={{padding:"12px 14px",color:C.txtM,fontSize:12,textAlign:"center"}}>Ingen opgaver</div>}
                    </div>
                  </div>
                );
              })()}
              {tot>0&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:C.txtM,fontSize:12}}>Fremgang</span>
                    <span style={{color:C.acc,fontWeight:700,fontSize:12}}>{pct}%</span>
                  </div>
                  <div style={{height:8,background:C.brd,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:pct===100?C.grn:C.acc,borderRadius:4}}/>
                  </div>
                </div>
              )}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,cursor:"pointer"}}
                  onClick={()=>setEditStam(s=>!s)}>
                  <SekLabel text="STAMDATA"/>
                  <span style={{fontSize:11,color:C.acc,fontWeight:600}}>{editStam?"Luk redigering":"Rediger"}</span>
                </div>
                {!editStam?(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[[p.ansvarligMed,"Ansvarlig medarbejder"],[p.afdeling,"Afdeling"],[`${p.tidStart||"08:00"} – ${p.tidSlut||"17:00"}`,"Tilgængelig"],[p.særligeHensyn,"Særlige hensyn"]]
                      .map(([v,l])=>v?(
                        <div key={l} style={{background:C.s2,borderRadius:8,padding:"10px 14px",border:"1px solid "+C.brd}}>
                          <div style={{color:C.txtM,fontSize:10,fontWeight:600,letterSpacing:"0.05em",marginBottom:2}}>{l.toUpperCase()}</div>
                          <div style={{color:C.txt,fontSize:13,fontWeight:600}}>{v||"—"}</div>
                        </div>
                      ):null)}
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:10,background:C.s2,borderRadius:10,padding:14,border:"1px solid "+C.brd}}>
                    <FRow label="Ansvarlig medarbejder">
                      <Input value={p.ansvarligMed||""} onChange={v=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,ansvarligMed:v}:x))} placeholder="Navn..."/>
                    </FRow>
                    <FRow label="Afdeling">
                      <Input value={p.afdeling||""} onChange={v=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,afdeling:v}:x))} placeholder="Fx Børneafdelingen"/>
                    </FRow>
                    <FRow label="Tilgængelig fra">
                      <Input value={p.tidStart||"08:00"} onChange={v=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,tidStart:v}:x))} placeholder="08:00"/>
                    </FRow>
                    <FRow label="Tilgængelig til">
                      <Input value={p.tidSlut||"17:00"} onChange={v=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,tidSlut:v}:x))} placeholder="17:00"/>
                    </FRow>
                    <FRow label="Særlige hensyn">
                      <Input value={p.særligeHensyn||""} onChange={v=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,særligeHensyn:v}:x))} placeholder="Fx allergi, bevægelsesbegrænsning..."/>
                    </FRow>
                    <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
                      <Btn v="primary" small onClick={()=>setEditStam(false)}>Gem stamdata</Btn>
                    </div>
                  </div>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:C.txtD,fontSize:12}}>Deadline (dage fra henv.):</span>
                <input type="number" min="0" max="365" value={p.maxDageForlob??""}
                  placeholder="Global standard"
                  onChange={e=>setPatienter(ps=>ps.map(x=>x.id===p.id?{...x,maxDageForlob:e.target.value===""?undefined:Number(e.target.value)}:x))}
                  style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:6,padding:"4px 10px",color:C.txt,fontSize:12,fontFamily:"inherit",width:110,outline:"none"}}/>
                {p.maxDageForlob>0&&<span style={{color:C.acc,fontSize:12}}>Frist: {addDays(p.henvDato,p.maxDageForlob)}</span>}
                {p.deadlineAdvarsel&&<span style={{color:C.red,fontSize:12,fontWeight:600}}>! Overskredet</span>}
              </div>
            </div>
          )}

          {/* INDSATSER */}
          {tab==="indsatser"&&(
            <div>
              {p.opgaver.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:C.txtM}}>
                  <div style={{marginBottom:12,fontSize:14}}>Ingen opgaver tildelt endnu</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                    <Btn v="primary" onClick={onTildelForlob}>Tildel forløb</Btn>
                    <Btn v="outline" onClick={onAddOpg}>Tilføj enkeltopgave</Btn>
                  </div>
                </div>
              )}
              {[...p.opgaver].sort((a,b)=>a.sekvens-b.sekvens).map(o=>(
                <div key={o.id} style={{padding:"12px 0",borderBottom:"1px solid "+C.brd,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                    background:o.status==="planlagt"?C.accM:o.status==="ikke-planlagt"?C.redM:C.brd,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:sC(o.status),fontSize:11,fontWeight:700,marginTop:1}}>{o.sekvens}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{color:C.txt,fontSize:13,fontWeight:600}}>{o.opgave}</span>
                      <Pill color={sC(o.status)} bg={sB(o.status)} sm>{sL(o.status)}</Pill>
                      {o.låst&&<Pill color={C.amb} bg={C.ambM} sm>Låst</Pill>}
                    </div>
                    <div style={{color:C.txtM,fontSize:11,marginTop:2}}>{o.minutter} min · {o.patInv?"Med patientdeltagelse":"Uden patientdeltagelse"}</div>
                    {o.status==="planlagt"&&(
                      <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                        <span style={{background:C.accM,color:C.acc,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{o.dato}</span>
                        <span style={{background:C.blueM,color:C.blue,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{o.startKl}–{o.slutKl}</span>
                        {o.lokale&&(()=>{
                          // Prioritet: 1) lokMeta-adresse, 2) patient-adresse for dette lokale, 3) ingen → godkendelse
                          const lokAdr = lokMeta?.[o.lokale]?.adresse;
                          const harLokAdr = lokAdr?.vej && lokAdr?.by;
                          const patAdr = (p.adresser||[]).find(a=>a.navn===o.lokale);
                          const harPatAdr = patAdr?.vej && patAdr?.by;
                          const visAdr = harLokAdr
                            ? [lokAdr.vej,lokAdr.husnr,lokAdr.postnr,lokAdr.by].filter(Boolean).join(" ")
                            : harPatAdr
                              ? [patAdr.vej,patAdr.husnr,patAdr.postnr,patAdr.by].filter(Boolean).join(" ")
                              : null;
                          return(
                            <span style={{background:C.s3,color:C.txtD,borderRadius:5,padding:"2px 8px",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                               {o.lokale}
                              {visAdr&&<span style={{color:C.txtM,fontWeight:400}}>· {visAdr}</span>}
                              {!visAdr&&<span style={{color:C.red,fontWeight:600,fontSize:10}}> Adresse mangler</span>}
                            </span>
                          );
                        })()}
                        {o.medarbejder&&<span style={{background:C.purM,color:C.pur,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{o.medarbejder}</span>}
                        {o.med1&&<span style={{background:C.purM,color:C.pur,borderRadius:5,padding:"2px 8px",fontSize:11}}>{o.med1}</span>}
                        {o.med2&&<span style={{background:C.purM,color:C.pur,borderRadius:5,padding:"2px 8px",fontSize:11}}>{o.med2}</span>}
                        {o.adresseId&&p.adresser&&(()=>{const a=p.adresser.find(x=>x.id===o.adresseId);return a?<span style={{background:C.grnM,color:C.grn,borderRadius:5,padding:"2px 8px",fontSize:11}}>{a.navn}</span>:null;})()}
                      </div>
                    )}
                    {p.adresser&&p.adresser.length>0&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                        <span style={{color:C.txtM,fontSize:11}}>Adresse:</span>
                        <select value={o.adresseId||""} onChange={e=>updateOpg(p.id,o.id,{adresseId:e.target.value||null})}
                          style={{fontSize:11,padding:"2px 7px",border:"1px solid "+C.brd,borderRadius:5,background:C.s1,color:C.txt,fontFamily:"inherit"}}>
                          <option value="">Afdelingens adresse</option>
                          {p.adresser.map(a=><option key={a.id} value={a.id}>{a.navn}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {/* Adresse-mangler banner */}
                  {o.status==="planlagt"&&o.lokale&&(()=>{
                    const lokAdr=(lokMeta||{})[o.lokale]?.adresse;
                    const harLokAdr=lokAdr?.vej&&lokAdr?.by;
                    const patAdr=(p.adresser||[]).find(a=>a.navn===o.lokale);
                    const harPatAdr=patAdr?.vej&&patAdr?.by;
                    if(harLokAdr||harPatAdr) return null;
                    // Tjek om der allerede er oprettet en anmodning for denne opgave
                    return(
                      <div style={{background:C.red+"11",border:`1px solid ${C.red}33`,borderRadius:7,padding:"8px 12px",marginTop:6,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <div>
                          <span style={{color:C.red,fontWeight:700,fontSize:12}}> Adresse mangler for {o.lokale}</span>
                          <div style={{color:C.red+"aa",fontSize:11,marginTop:2}}>
                            Hverken lokalet eller patienten har en registreret adresse for dette lokale.
                          </div>
                        </div>
                        <button onClick={()=>sendAdrMangler(o)}
                          style={{background:C.red,color:"#fff",border:"none",borderRadius:7,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>
                          → Send til godkendelse
                        </button>
                      </div>
                    );
                  })()}
                  <div style={{display:"flex",gap:3,flexShrink:0,alignItems:"center"}}>
                    <Btn v="subtle" small onClick={()=>onEditOpg(p,o)}>Rediger</Btn>
                    <Btn v="subtle" small onClick={()=>toggleLås(p.id,o.id,!o.låst)}>{o.låst?"Oplås":"Lås"}</Btn>
                    <Btn v="subtle" small
                       style={o.omfordel?{background:C.redM,color:C.red,border:`1px solid ${C.red}44`}:{}}
                       onClick={()=>setPatienter(ps=>ps.map(x=>x.id!==p.id?x:{...x,opgaver:x.opgaver.map(oo=>oo.id!==o.id?oo:{...oo,omfordel:!oo.omfordel,omfordelDato:!oo.omfordel?today():""})}))}>
                       {o.omfordel?"Annuller omfordel":"Omfordel"}
                     </Btn>
                    {o.status==="planlagt"&&!o.låst&&<Btn v="subtle" small onClick={()=>resetOpg(p.id,o.id)}>Nulstil</Btn>}
                    {o.status==="planlagt"&&<Btn v="subtle" small
                      style={{background:C.grnM,color:C.grn,border:`1px solid ${C.grn}33`}}
                      onClick={()=>onMarkerLøst&&onMarkerLøst(p,o)}>
                      v Løst
                    </Btn>}
                    <button onClick={()=>deleteOpg(p.id,o.id)} style={{background:"none",color:C.red,border:"none",cursor:"pointer",fontSize:18,padding:"0 3px",lineHeight:1}}>×</button>
                  </div>
                </div>
              ))}
              {p.opgaver.length>0&&(
                <div style={{paddingTop:14}}>
                  <Btn v="outline" small onClick={onAddOpg}>+ Tilføj enkeltopgave</Btn>
                </div>
              )}
            </div>
          )}

          {/* FORÆLDRE / VÆRGE */}
          {tab==="foraeld"&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {foraeldreList.length===0&&(
                <div style={{color:C.txtM,fontSize:13,padding:"16px 0",textAlign:"center"}}>
                  Ingen forældre/værge registreret.
                  <div style={{marginTop:10}}><Btn v="outline" small onClick={onEdit}>Tilføj via Rediger</Btn></div>
                </div>
              )}
              {foraeldreList.map((fp,i)=>(
                <div key={i} style={{background:C.s2,borderRadius:10,padding:"14px 16px",border:"1px solid "+C.brd}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{color:C.txt,fontWeight:700,fontSize:14}}>
                      {foraeldreList.length>1?"Forælder / Værge "+(i+1):"Forælder / Værge"}
                    </div>
                    {fp.myndighedshaver&&<Pill color={C.acc} bg={C.accM} sm>Myndighedshaver</Pill>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                    {fp.navn&&<div><span style={{color:C.txtM}}>Navn: </span><b style={{color:C.txt}}>{fp.navn}</b></div>}
                    {fp.cpr&&<div><span style={{color:C.txtM}}>CPR: </span><b style={{color:C.txt}}>{fp.cpr}</b></div>}
                    {fp.tlf&&<div><span style={{color:C.txtM}}>Tlf: </span><b style={{color:C.txt}}>{fp.tlf}</b></div>}
                    {fp.id&&<div><span style={{color:C.txtM}}>ID: </span><b style={{color:C.txt}}>{fp.id}</b></div>}
                    {fp.eboks&&<div><span style={{color:C.txtM}}>E-boks: </span><b style={{color:C.txt}}>{fp.eboks}</b></div>}
                    {(fp.vej||fp.by)&&(
                      <div style={{gridColumn:"span 2"}}>
                        <span style={{color:C.txtM}}>Adresse: </span>
                        <b style={{color:C.txt}}>{[fp.vej,fp.husnr,fp.postnr,fp.by].filter(Boolean).join(" ")}</b>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {foraeldreList.length>0&&(
                <div><Btn v="outline" small onClick={onEdit}>Rediger oplysninger</Btn></div>
              )}
            </div>
          )}

          {/* ADRESSER */}
          {tab==="adresser"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Eksisterende adresser */}
              {(p.adresser||[]).length===0&&(
                <div style={{color:C.txtM,fontSize:13,padding:"8px 0"}}>Ingen adresser registreret endnu.</div>
              )}
              {(p.adresser||[]).map((a,i)=>(
                <div key={a.id||i} style={{background:C.s2,borderRadius:9,padding:"12px 16px",border:"1px solid "+C.brd,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:3}}>{a.navn||"Adresse "+(i+1)}</div>
                    <div style={{color:C.txtD,fontSize:12}}>{[a.vej,a.husnr,a.postnr,a.by].filter(Boolean).join(" ")||"—"}</div>
                  </div>
                  <button onClick={()=>delAdresse(a.id)} style={{background:"none",color:C.red,border:"1px solid "+C.red+"44",borderRadius:6,cursor:"pointer",fontSize:12,padding:"3px 10px",fontFamily:"inherit"}}>Slet</button>
                </div>
              ))}

              {/* NY ADRESSE formular — direkte i panelet */}
              <div style={{background:C.accM,borderRadius:10,padding:"16px",border:"1px solid "+C.acc+"44"}}>
                <div style={{color:C.acc,fontWeight:700,fontSize:13,marginBottom:12}}>+ Ny adresse</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:8}}>
                  <div>
                    <div style={{color:C.txtM,fontSize:11,marginBottom:3}}>Lokale / adressenavn <span style={{color:C.txtM,fontWeight:400}}>(vælg lokale opgaven løses fra)</span></div>
                    <select value={nyAdr.navn} onChange={e=>setNyAdr(p=>({...p,navn:e.target.value}))}
                      style={{width:"100%",background:C.s1,border:"1px solid "+C.brd,borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit",color:nyAdr.navn?C.txt:C.txtM,outline:"none"}}>
                      <option value="">— Vælg lokale —</option>
                      {lokaler.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
                  {[
                    ["Vejnavn","vej","Nørrebrogade"],
                    ["Husnr.","husnr","44"],
                    ["Postnr.","postnr","8000"],
                    ["By","by","Aarhus C"],
                  ].map(([lbl,key,ph])=>(
                    <div key={key}>
                      <div style={{color:C.txtM,fontSize:11,marginBottom:3}}>{lbl}</div>
                      <input value={nyAdr[key]} onChange={e=>setNyAdr(p=>({...p,[key]:e.target.value}))}
                        placeholder={ph}
                        style={{width:"100%",background:C.s1,border:"1px solid "+C.brd,borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit",color:C.txt,outline:"none"}}/>
                    </div>
                  ))}
                </div>
                <Btn v="primary" small onClick={addAdresse}>Tilføj adresse</Btn>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function PatientKalenderView({patienter,medarbejdere,setPatienter,forlob=FORLOB,showToast=()=>{},onMarkerLøst=null,lokMeta={},setAnmodninger=()=>{},adminData={},lokaler=[]}){
  const [søg,setSøg]=useState("");
  const [fil,setFil]=useState("alle");
  const [statusFil,setStatusFil]=useState("alle");
  const [exportMenu,setExportMenu]=useState(false);
  const [sort,setSort]=useState({col:"navn",dir:1});
  const [valgt,setValgt]=useState(null);
  const [delAfd,setDelAfd]=useState(null);
  const [editOpg,setEditOpg]=useState(null);
  const [editPat,setEditPat]=useState(null);
  const [tildelForlob,setTildelForlob]=useState(null); // patientId
  const [nyPat,setNyPat]=useState(false);
  const [delPat,setDelPat]=useState(null);
  const [addOpg,setAddOpg]=useState(false);
  const [globalLåsMode,setGlobalLåsMode]=useState(false); // "Lås alle planlagte"-toggle

  useEffect(()=>{ if(valgt){ const p=patienter.find(p=>p.id===valgt.id); setValgt(p||null); }}, [patienter]);

  const toggleSort=(col)=>setSort(s=>s.col===col?{col,dir:-s.dir}:{col,dir:1});
  const MenuItem=({label,onClick})=>(
    <button onClick={onClick}
      style={{display:"block",width:"100%",textAlign:"left",padding:"9px 16px",background:"none",border:"none",
        color:C.txt,fontFamily:"inherit",fontSize:13,cursor:"pointer",transition:"background .1s"}}
      onMouseEnter={e=>e.currentTarget.style.background=C.s2}
      onMouseLeave={e=>e.currentTarget.style.background="none"}>
      {label}
    </button>
  );
  useEffect(()=>{
    if(!exportMenu) return;
    const close=()=>setExportMenu(false);
    const tid=setTimeout(()=>window.addEventListener("click",close),50);
    return()=>{clearTimeout(tid);window.removeEventListener("click",close);};
  },[exportMenu]);
  const SortHd=({col,label})=>{
    const act=sort.col===col;
    return(
      <th onClick={()=>toggleSort(col)} style={{padding:"9px 12px",color:act?C.acc:C.txtM,fontSize:11,fontWeight:act?700:600,textAlign:"left",borderBottom:`1px solid ${C.brd}`,cursor:"pointer",whiteSpace:"nowrap",userSelect:"none"}}>
        {label}{act?(sort.dir===1?" ^":" v"):""}
      </th>
    );
  };

  const filPat = useMemo(()=>patienter.filter(p=>{
    if(statusFil!=="alle"&&(p.status||"aktiv")!==statusFil) return false;
    if(søg && !p.navn.toLowerCase().includes(søg.toLowerCase()) && !p.cpr.includes(søg)) return false;
    if(fil==="afventer") return p.opgaver.some(o=>o.status==="afventer");
    if(fil==="planlagt") return p.opgaver.every(o=>o.status==="planlagt");
    if(fil==="problemer") return p.opgaver.some(o=>o.status==="ikke-planlagt");
    return true;
  }),[patienter,søg,statusFil,fil]);


  const sortedPat = [...filPat].sort((a,b)=>{
    let va,vb;
    if(sort.col==="navn"){va=a.navn;vb=b.navn;}
    else if(sort.col==="cpr"){va=a.cpr;vb=b.cpr;}
    else if(sort.col==="henvDato"){va=a.henvDato;vb=b.henvDato;}
    else if(sort.col==="forlob"){va=a.forlobNr;vb=b.forlobNr;}
    else if(sort.col==="løst"){va=a.opgaver.length>0?a.opgaver.filter(o=>o.status==="planlagt").length/a.opgaver.length:0;vb=b.opgaver.length>0?b.opgaver.filter(o=>o.status==="planlagt").length/b.opgaver.length:0;}
    else if(sort.col==="næste"){
      const nA=a.opgaver.filter(o=>o.status==="planlagt"&&o.dato).sort((x,y)=>x.dato.localeCompare(y.dato))[0];
      const nB=b.opgaver.filter(o=>o.status==="planlagt"&&o.dato).sort((x,y)=>x.dato.localeCompare(y.dato))[0];
      va=nA?.dato||"9999";vb=nB?.dato||"9999";
    }
    else if(sort.col==="status"){va=a.status||"aktiv";vb=b.status||"aktiv";}
    else if(sort.col==="med"){va=[...new Set(a.opgaver.filter(o=>o.status==="planlagt"&&o.medarbejder).map(o=>o.medarbejder))].join(",");vb=[...new Set(b.opgaver.filter(o=>o.status==="planlagt"&&o.medarbejder).map(o=>o.medarbejder))].join(",");}
    else if(sort.col==="lås"){va=a.opgaver.filter(o=>o.låst).length;vb=b.opgaver.filter(o=>o.låst).length;}
    else{va=a[sort.col]||"";vb=b[sort.col]||"";}
    if(va<vb) return -sort.dir;
    if(va>vb) return sort.dir;
    return 0;
  });

  const updateOpg=(patId,opgId,ch)=>
    setPatienter(ps=>ps.map(p=>p.id!==patId?p:{...p,opgaver:p.opgaver.map(o=>o.id!==opgId?o:{...o,...ch})}));
  const deleteOpg=(patId,opgId)=>
    setPatienter(ps=>ps.map(p=>p.id!==patId?p:{...p,opgaver:p.opgaver.filter(o=>o.id!==opgId)}));
  const deletePat=(patId)=>{ setPatienter(ps=>ps.filter(p=>p.id!==patId)); setValgt(null); setDelPat(null); };
  const toggleLås=(patId,opgId,lås)=>updateOpg(patId,opgId,{låst:lås});
  const resetOpg=(patId,opgId)=>updateOpg(patId,opgId,{status:"afventer",dato:null,startKl:null,slutKl:null,lokale:null,medarbejder:null,låst:false});

  // Global lås: lås/oplås alle planlagte opgaver for alle patienter
  const handleGlobalLås=()=>{
    const nyLås=!globalLåsMode;
    setGlobalLåsMode(nyLås);
    setPatienter(ps=>ps.map(p=>({...p,opgaver:p.opgaver.map(o=>o.status==="planlagt"?{...o,låst:nyLås}:o)})));
  };

  // Status-hjælpere delegerer nu til det centrale STATUS-objekt (Gestalt: lighed)
  // sC/sB/sL er nu globale

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh-140px)",gap:10,minHeight:500}}>
      <ViewHeader titel="Patienter" undertitel="Oversigt og administration af patienter"/>
      {/* Toolbar */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
        <Input value={søg} onChange={setSøg} placeholder="Søg navn / CPR..." style={{width:210}}/>
        <div style={{display:"flex",gap:4}}>
          {["alle","afventer","planlagt","problemer"].map(f=>(
            <button key={f} onClick={()=>setFil(f)} style={{background:fil===f?C.accM:"transparent",color:fil===f?C.acc:C.txtM,border:`1px solid ${fil===f?C.acc:C.brd}`,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:fil===f?700:400}}>
              {f[0].toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:4}}>
          {[["alle","Alle"],["aktiv","Aktiv"],["venteliste","Venteliste"],["afsluttet","Afsluttet"],["udmeldt","Udmeldt"]].map(([key,lbl])=>{
            const st=PAT_STATUS[key];
            return(
              <button key={key} onClick={()=>setStatusFil(key)}
                style={{background:statusFil===key?(st?st.bg:C.accM):"transparent",
                  color:statusFil===key?(st?st.col:C.acc):C.txtM,
                  border:`1px solid ${statusFil===key?(st?st.col:C.acc):C.brd}`,
                  borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",
                  fontFamily:"inherit",fontWeight:statusFil===key?700:400}}>
                {lbl}
              </button>
            );
          })}
        </div>
        <button onClick={handleGlobalLås}
          style={{background:globalLåsMode?C.ambM:C.s3,color:globalLåsMode?C.amb:C.txtD,border:`1px solid ${globalLåsMode?C.amb:C.brd}`,borderRadius:7,padding:"5px 13px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
          {globalLåsMode?" Lås slået TIL - klik for at låse op":" Lås alle planlagte"}
        </button>
        <span style={{color:C.txtM,fontSize:12,marginLeft:4}}>{sortedPat.length} patienter</span>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",position:"relative"}}>
          <div style={{position:"relative"}}>
            <Btn v="outline" onClick={()=>setExportMenu(m=>!m)}>
              Eksport v
            </Btn>
            {exportMenu&&(
              <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:C.s1,border:`1px solid ${C.brd}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:200,minWidth:240,overflow:"hidden"}}
                onClick={e=>e.stopPropagation()}>
                <div style={{padding:"8px 14px 6px",color:C.txtM,fontSize:10,fontWeight:700,letterSpacing:"0.06em",borderBottom:`1px solid ${C.brd}`}}>EXCEL</div>
                <MenuItem label="Patientliste (.xlsx)" onClick={()=>{eksporterPatientlisteExcel(sortedPat);setExportMenu(false);}}/>
                <MenuItem label="Medarbejderoversigt (.xlsx)" onClick={()=>{eksporterMedarbejdereExcel(medarbejdere);setExportMenu(false);}}/>
                <MenuItem label="Ugeplan (.xlsx)" onClick={()=>{eksporterUgeplanExcel(sortedPat);setExportMenu(false);}}/>
                <div style={{padding:"8px 14px 6px",color:C.txtM,fontSize:10,fontWeight:700,letterSpacing:"0.06em",borderBottom:`1px solid ${C.brd}`,borderTop:`1px solid ${C.brd}`,marginTop:4}}>PDF / HTML (print)</div>
                <MenuItem label="Ugeplan (.pdf)" onClick={()=>{eksporterUgeplanPDF(sortedPat);setExportMenu(false);}}/>
                <div style={{padding:"8px 14px 6px",color:C.txtD,fontSize:10,borderTop:`1px solid ${C.brd}`,marginTop:4}}>Opgaveplan pr. patient — åbn patientens detaljer og vælg Eksport</div>
              </div>
            )}
          </div>
          <Btn v="accent" onClick={()=>setNyPat(true)}>+ Ny patient</Btn>
        </div>
      </div>

      {/* Tabel + detail panel */}
      <div style={{display:"flex",gap:10,flex:1,overflow:"hidden"}}>
        {/* Tabel */}
        <div style={{flex:1,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column",minWidth:0}}>
          <div style={{overflowX:"auto",flex:1,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
              <thead style={{position:"sticky",top:0,background:C.s3,zIndex:1}}>
                <tr>
                  <SortHd col="navn" label="Navn"/>
                  <SortHd col="cpr" label="CPR"/>
                  <SortHd col="henvDato" label="Henvist"/>
                  <SortHd col="forlob" label="Forløb"/>
                  <SortHd col="løst" label="Opgaver"/>
                  <SortHd col="næste" label="Næste planlagt"/>
                  <SortHd col="status" label="Status"/>
                  <SortHd col="med" label="Medarbejder(e)"/>
                  <SortHd col="lås" label="Lås"/>
                </tr>
              </thead>
              <tbody>
                {sortedPat.map((p,i)=>{
                  const done=p.opgaver.filter(o=>o.status==="planlagt").length;
                  const fail=p.opgaver.some(o=>o.status==="ikke-planlagt");
                  const tot=p.opgaver.length;
                  const pct=tot>0?Math.round(done/tot*100):0;
                  const act=valgt?.id===p.id;
                  // Næste planlagte opgave
                  const næste=p.opgaver.filter(o=>o.status==="planlagt"&&o.dato).sort((a,b)=>a.dato.localeCompare(b.dato))[0];
                  const ikkePlanlagtNæste=p.opgaver.find(o=>o.status==="afventer"||o.status==="ikke-planlagt");
                  // Unikke medarbejdere på planlagte opgaver
                  const meds=[...new Set(p.opgaver.filter(o=>o.status==="planlagt"&&o.medarbejder).map(o=>o.medarbejder))];
                  const alleLåst=p.opgaver.filter(o=>o.status==="planlagt").every(o=>o.låst);
                  const nogleLåst=p.opgaver.some(o=>o.låst);

                  return(
                    <tr key={p.id} onClick={()=>setValgt(act?null:p)}
                      style={{borderBottom:`1px solid ${C.brd}`,background:act?C.accM:i%2===0?"transparent":C.s1+"80",cursor:"pointer",transition:"background .1s"}}
                      className={act?"":"pm-tr-hover"}>
                      {/* Navn - F-mønster: vigtigste info til venstre */}
                      <td style={{padding:"9px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          {p.haste&&<span style={{background:C.red+"22",color:C.red,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>! HASTE</span>}
                          <div style={{color:C.txt,fontSize:13,fontWeight:act?700:500}}>{p.navn}</div>
                          {(()=>{const st=PAT_STATUS[p.status||"aktiv"]||PAT_STATUS.aktiv;return(p.status&&p.status!=="aktiv")?<span style={{background:st.bg,color:st.col,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{st.label}</span>:null;})()}
                        </div>
                        {fail&&<StatusBadge status="ikke-planlagt" label="Opgaver mangler" sm style={{marginTop:3}}/>}
                        {p.deadlineAdvarsel&&<div style={{color:C.red,fontSize:10,marginTop:2}}>! Deadline overskredet ({p.deadlineAdvarsel})</div>}
                      </td>
                      <td style={{padding:"9px 12px",color:C.txtM,fontSize:12}}>{p.cpr}</td>
                      <td style={{padding:"9px 12px",color:C.txtD,fontSize:12}}>{p.henvDato}</td>
                      <td style={{padding:"9px 12px"}}>
                        {p.forlobNr
                          ? <Pill color={C.pur} bg={C.purM} sm>nr. {p.forlobNr}</Pill>
                          : <Pill color={C.amb} bg={C.ambM} sm>Intet forløb</Pill>}
                      </td>
                      {/* Opgaver - ProgressRing giver øjeblikkeligt overblik (Gestalt: lukkethed) */}
                      <td style={{padding:"9px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <ProgressRing pct={pct} size={26} stroke={3}/>
                          <span style={{color:C.txtD,fontSize:11,fontVariantNumeric:"tabular-nums"}}>{done}/{tot}</span>
                        </div>
                      </td>
                      <td style={{padding:"9px 12px",fontSize:11}}>
                        {næste
                          ?<div>
                            <div style={{color:C.acc,fontWeight:600}}>{næste.dato}</div>
                            <div style={{color:C.txtM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150}}>{næste.opgave}</div>
                          </div>
                          :ikkePlanlagtNæste
                          ?<StatusBadge status="afventer" label="Ikke planlagt" sm/>
                          :<StatusBadge status="planlagt" label="Fuldt planlagt" sm/>
                        }
                      </td>
                      <td style={{padding:"9px 6px"}}>
                        {(()=>{const st=PAT_STATUS[p.status||"aktiv"]||PAT_STATUS.aktiv;
                          return <span style={{background:st.bg,color:st.col,borderRadius:5,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{st.label}</span>;
                        })()}
                      </td>
                      <td style={{padding:"9px 12px"}}>
                        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                          {meds.slice(0,3).map(m=><Pill key={m} color={C.pur} bg={C.purM} sm>{m}</Pill>)}
                          {meds.length>3&&<Pill color={C.txtM} bg={C.s3} sm>+{meds.length-3}</Pill>}
                          {meds.length===0&&<span style={{color:C.txtM,fontSize:11}}>-</span>}
                        </div>
                      </td>
                      <td style={{padding:"9px 12px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                        <button
                          onClick={()=>{
                            const nyLås=!alleLåst;
                            setPatienter(ps=>ps.map(pp=>pp.id!==p.id?pp:{...pp,opgaver:pp.opgaver.map(o=>o.status==="planlagt"?{...o,låst:nyLås}:o)}));
                          }}
                          title={alleLåst?"Oplås alle planlagte":"Lås alle planlagte"}
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:15,opacity:nogleLåst?1:0.35}}>
                          {alleLåst?"":""}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sortedPat.length===0&&(
                  <tr><td colSpan={9} style={{padding:32,textAlign:"center",color:C.txtM}}>Ingen patienter matcher filtret</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PatientDetalje modal */}
        {valgt&&(
          <PatientDetaljeModal
            pat={valgt}
            medarbejdere={medarbejdere}
            patienter={patienter}
            forlob={forlob}
            onClose={()=>setValgt(null)}
            onEdit={()=>setEditPat(valgt)}
            onDelete={()=>setDelPat(valgt)}
            onTildelForlob={()=>setTildelForlob(valgt.id)}
            onAddOpg={()=>setAddOpg(true)}
            onEditOpg={(pat,opg)=>setEditOpg({pat,opg})}
            setPatienter={setPatienter}
            updateOpg={updateOpg}
            deleteOpg={deleteOpg}
            toggleLås={toggleLås}
            resetOpg={resetOpg}
            onMarkerLøst={onMarkerLøst}
            lokMeta={lokMeta}
            setAnmodninger={setAnmodninger}
            showToast={showToast}
            lokaler={lokaler}
          />
        )}
      </div>

      {/* Modals */}
      {tildelForlob&&(
        <Modal title="Tildel forløb" onClose={()=>setTildelForlob(null)} w={480}>
          <TildelForlobForm
            forlob={forlob}
            onSave={(forlobNr)=>{
              const pat = patienter.find(p=>p.id===tildelForlob);
              const nyOpgaver = buildPatient(
                {...pat, forlobNr},
                forlob
              ).opgaver;
              // Fjern gamle forløbs-opgaver (sekvens < 999 = fra forløb), behold manuelt tilføjede
              const gamleManuelle = (pat?.opgaver||[]).filter(o=>o.sekvens>=999);
              setPatienter(ps=>ps.map(p=>p.id!==tildelForlob?p:{
                ...p,
                forlobNr,
                forlobLabel:"Forløb nr. "+forlobNr,
                opgaver:[...nyOpgaver,...gamleManuelle]
              }));
              setTildelForlob(null);
            }}
            onClose={()=>setTildelForlob(null)}
          />
        </Modal>
      )}
      {editOpg&&(
        <Modal title={`Rediger opgave · ${editOpg.opg.opgave}`} onClose={()=>setEditOpg(null)}>
          <EditOpgForm pat={editOpg.pat} opg={editOpg.opg} medarbejdere={medarbejdere}
            onSave={ch=>{updateOpg(editOpg.pat.id,editOpg.opg.id,ch);setEditOpg(null);}}
            onClose={()=>setEditOpg(null)} lokaler={lokaler}/>
        </Modal>
      )}
      {addOpg&&valgt&&(
        <Modal title={`Tilføj opgave · ${valgt.navn}`} onClose={()=>setAddOpg(false)}>
          <AddOpgForm medarbejdere={medarbejdere}
            onSave={opg=>{setPatienter(ps=>ps.map(p=>p.id!==valgt.id?p:{...p,opgaver:[...p.opgaver,opg]}));setAddOpg(false);}}
            onClose={()=>setAddOpg(false)} lokaler={lokaler}/>
        </Modal>
      )}
      {editPat&&(
        <Modal title={"Rediger patient · "+editPat.navn} onClose={()=>setEditPat(null)} w={640}>
          <EditPatientForm pat={editPat} medarbejdere={medarbejdere}
            onSave={updated=>{setPatienter(ps=>ps.map(p=>p.id===updated.id?updated:p));setEditPat(null);}}
            onClose={()=>setEditPat(null)}/>
        </Modal>
      )}
      {nyPat&&(
        <Modal title="Tilføj ny patient" onClose={()=>setNyPat(false)}>
          <NyPatientForm forlob={forlob} medarbejdere={medarbejdere} patienter={patienter} adminData={adminData} onSave={p=>{setPatienter(ps=>[...ps,p]);setNyPat(false);showToast("Patient oprettet");}} onClose={()=>setNyPat(false)}/>
        </Modal>
      )}
      {delPat&&(
        <Modal title="Bekræft sletning" onClose={()=>setDelPat(null)} w={380}>
          <div style={{color:C.txtD,marginBottom:18}}>Er du sikker på at du vil slette <strong style={{color:C.txt}}>{delPat.navn}</strong> og alle {delPat.opgaver.length} tilknyttede opgaver?</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelPat(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>deletePat(delPat.id)}>Slet permanent</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EditOpgForm({pat,opg,medarbejdere,onSave,onClose,lokaler=[]}){
  const [f,setF]=useState({
    dato:opg.dato||"",startKl:opg.startKl||"",slutKl:opg.slutKl||"",
    lokale:opg.lokale||"",medarbejder:opg.medarbejder||"",
    minutter:opg.minutter||30,status:opg.status,ønsketDato:opg.ønsketDato||"",
    patInv:opg.patInv||false,
    patInvMinDage:opg.patInvMinDage||0,
    cooldownDage:opg.cooldownDage||0,
    udstyr:Array.isArray(opg.udstyr)?[...opg.udstyr]:[],
    ruller:opg.ruller||false,
    rullerOpgave:opg.rullerOpgave||"",
    rullerTidligstUger:opg.rullerTidligstUger||4,
    rullerSenestUger:opg.rullerSenestUger||6,
    rullerLåsUger:opg.rullerLåsUger||2,
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const compat=medarbejdere.filter(m=>m.kompetencer.includes(opg.opgave));
  const secStyle={background:C.s2,border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 14px",marginBottom:10};
  const secHead={color:C.txt,fontWeight:700,fontSize:13,marginBottom:10};

  return(
    <div>
      {/* Planlægning */}
      <div style={secStyle}>
        <div style={secHead}>Planlægning</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <FRow label="Dato"><Input type="date" value={f.dato} onChange={v=>set("dato",v)}/></FRow>
          <FRow label="Minutter"><Input type="number" value={f.minutter} onChange={v=>set("minutter",Number(v))} min="5" max="480"/></FRow>
          <FRow label="Start kl."><Input type="time" value={f.startKl} onChange={v=>{set("startKl",v);set("slutKl",fromMin(toMin(v)+(f.minutter||0)));}} /></FRow>
          <FRow label="Slut kl."><Input type="time" value={f.slutKl} onChange={v=>set("slutKl",v)}/></FRow>
        </div>
        <FRow label="Lokale">
          <Sel value={f.lokale} onChange={v=>set("lokale",v)} options={[{v:"",l:"- Vælg lokale -"},...lokaler.map(l=>({v:l,l}))]} style={{width:"100%"}}/>
        </FRow>
        <FRow label="Medarbejder" hint={`${compat.length} kompetente`}>
          <Sel value={f.medarbejder} onChange={v=>set("medarbejder",v)} style={{width:"100%"}}
            options={[{v:"",l:"- Vælg medarbejder -"},...compat.map(m=>({v:m.navn,l:`${m.navn} (${m.titel})`})),...medarbejdere.filter(m=>!compat.find(cc=>cc.id===m.id)).map(m=>({v:m.navn,l:`${m.navn} — ikke kompetent`}))]}/>
        </FRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <FRow label="Status">
            <Sel value={f.status} onChange={v=>set("status",v)} style={{width:"100%"}}
              options={[{v:"afventer",l:"Afventer"},{v:"planlagt",l:"Planlagt"},{v:"ikke-planlagt",l:"Ikke planlagt"}]}/>
          </FRow>
          <FRow label="Ønsket dato"><Input type="date" value={f.ønsketDato} onChange={v=>set("ønsketDato",v)}/></FRow>
        </div>
      </div>

      {/* Patientdeltagelse */}
      <div style={secStyle}>
        <div style={secHead}>Patientdeltagelse</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <FRow label="Patient deltager">
            <Sel value={f.patInv?"ja":"nej"} onChange={v=>set("patInv",v==="ja")} style={{width:"100%"}}
              options={[{v:"nej",l:"Nej — intern"},{v:"ja",l:"Ja — patient til stede"}]}/>
          </FRow>
          {f.patInv&&(
            <FRow label="Min. dage ml. patientopgaver">
              <Input type="number" value={f.patInvMinDage} onChange={v=>set("patInvMinDage",v)} min="0" max="365"/>
            </FRow>
          )}
        </div>
      </div>

      {/* Cooldown */}
      <div style={secStyle}>
        <div style={secHead}>Cooldown</div>
        <FRow label="Min. dage til næste opgave" hint="0 = ingen begrænsning">
          <Input type="number" value={f.cooldownDage} onChange={v=>set("cooldownDage",v)} min="0" max="365"/>
        </FRow>
      </div>

      {/* Udstyr */}
      <div style={secStyle}>
        <div style={secHead}>Udstyr</div>
        <div style={{color:C.txtM,fontSize:11,marginBottom:8}}>Vælg hvilke udstyr opgaven kræver. Planlæggeren vil kun foreslå lokaler, der har alle valgte udstyr.</div>
        <UdstyrPanel udstyr={f.udstyr} onChange={v=>set("udstyr",v)}/>
      </div>

      {/* Rulleplan */}
      <div style={{...secStyle,border:`1px solid ${f.ruller?C.acc:C.brd}`,background:f.ruller?C.accM+"33":C.s2}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:f.ruller?12:0}}>
          <input type="checkbox" checked={f.ruller} onChange={e=>set("ruller",e.target.checked)} style={{accentColor:C.acc,width:16,height:16}}/>
          <div style={{color:f.ruller?C.acc:C.txt,fontWeight:700,fontSize:13}}>Rulleplan — gentag automatisk</div>
        </label>
        {f.ruller&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <FRow label="Næste opgavetype">
              <Sel value={f.rullerOpgave} onChange={v=>set("rullerOpgave",v)} style={{width:"100%"}}
                options={[{v:"",l:`Samme (${opg.opgave})`},...ALLE_K.filter(k=>k!==opg.opgave).map(k=>({v:k,l:k}))]}/>
            </FRow>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <FRow label="Tidligst om (uger)">
                <Sel value={String(f.rullerTidligstUger)} onChange={v=>set("rullerTidligstUger",Number(v))} style={{width:"100%"}}
                  options={[1,2,3,4,6,8,10,12,16,20,24,26,52].map(n=>({v:String(n),l:`${n} uge${n>1?"r":""}`}))}/>
              </FRow>
              <FRow label="Senest om (uger)">
                <Sel value={String(f.rullerSenestUger)} onChange={v=>set("rullerSenestUger",Number(v))} style={{width:"100%"}}
                  options={[1,2,3,4,6,8,10,12,16,20,24,26,52].map(n=>({v:String(n),l:`${n} uge${n>1?"r":""}`}))}/>
              </FRow>
              <FRow label="Planlæg senest">
                <Sel value={String(f.rullerLåsUger)} onChange={v=>set("rullerLåsUger",Number(v))} style={{width:"100%"}}
                  options={[0,1,2,3,4].map(n=>({v:String(n),l:n===0?"Ingen krav":`${n} uge${n>1?"r":""} før`}))}/>
              </FRow>
            </div>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <Btn v="primary" onClick={()=>onSave(f)}>Gem ændringer</Btn>
      </div>
    </div>
  );
}

function AddOpgForm({medarbejdere,onSave,onClose,lokaler=[]}){
  const [f,setF]=useState({
    opgave:ALLE_K[0],minutter:45,patInv:false,
    tidligst:"08:00",senest:"17:00",muligeLok:[],
    udstyr:[],
    // Patientdeltagelse-interval
    patInvMinDage:0,
    // Cooldown efter opgaven
    cooldownDage:0,
    // Rulleplan
    ruller:false,
    rullerOpgave:"",        // tom = samme opgavetype
    rullerTidligstUger:4,   // tidligst om X uger
    rullerSenestUger:6,     // senest om Y uger
    rullerLåsUger:2,        // planlæg+lås Z uger før tidligst
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const compat=medarbejdere.filter(m=>m.kompetencer.includes(f.opgave));

  const submit=()=>{
    onSave({
      id:`custom_${uid()}`,sekvens:999,
      opgave:f.opgave,minutter:Number(f.minutter),
      patInv:f.patInv,
      patInvMinDage:f.patInv?Number(f.patInvMinDage):0,
      cooldownDage:Number(f.cooldownDage),
      ruller:f.ruller,
      rullerOpgave:f.ruller?(f.rullerOpgave||f.opgave):null,
      rullerTidligstUger:f.ruller?Number(f.rullerTidligstUger):null,
      rullerSenestUger:f.ruller?Number(f.rullerSenestUger):null,
      rullerLåsUger:f.ruller?Number(f.rullerLåsUger):null,
      tidligst:f.tidligst,senest:f.senest,
      muligeLok:f.muligeLok,muligeMed:compat.map(m=>m.navn),
      udstyr:f.udstyr,
      låst:false,status:"afventer",dato:null,startKl:null,slutKl:null,
      lokale:null,medarbejder:null,med1:null,med2:null,
    });
  };

  const secStyle={background:C.s2,border:`1px solid ${C.brd}`,borderRadius:10,padding:"14px 16px",marginBottom:10};
  const secHead={color:C.txt,fontWeight:700,fontSize:13,marginBottom:10};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>

      {/*  Grundoplysninger  */}
      <div style={secStyle}>
        <div style={secHead}>Grundoplysninger</div>
        <FRow label="Opgave">
          <Sel value={f.opgave} onChange={v=>set("opgave",v)} style={{width:"100%"}} options={ALLE_K.map(k=>({v:k,l:k}))}/>
        </FRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <FRow label="Varighed (min)"><Input type="number" value={f.minutter} onChange={v=>set("minutter",v)} min="5"/></FRow>
          <FRow label="Tidligste start"><Input type="time" value={f.tidligst} onChange={v=>set("tidligst",v)}/></FRow>
          <FRow label="Seneste start"><Input type="time" value={f.senest} onChange={v=>set("senest",v)}/></FRow>
        </div>
        <FRow label="Mulige lokaler">
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:2}}>
            {lokaler.map(l=>(
              <button key={l} onClick={()=>set("muligeLok",f.muligeLok.includes(l)?f.muligeLok.filter(x=>x!==l):[...f.muligeLok,l])}
                style={{background:f.muligeLok.includes(l)?C.accM:C.s1,color:f.muligeLok.includes(l)?C.acc:C.txtM,border:`1px solid ${f.muligeLok.includes(l)?C.acc:C.brd}`,borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {l}
              </button>
            ))}
          </div>
        </FRow>
        <div style={{color:C.txtM,fontSize:12,marginTop:6}}>{compat.length} medarbejdere har kompetence til denne opgave</div>
      </div>

      {/*  Patientdeltagelse  */}
      <div style={secStyle}>
        <div style={secHead}>Patientdeltagelse</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <FRow label="Patient deltager">
            <Sel value={f.patInv?"ja":"nej"} onChange={v=>set("patInv",v==="ja")} style={{width:"100%"}} options={[{v:"nej",l:"Nej — intern opgave"},{v:"ja",l:"Ja — patient til stede"}]}/>
          </FRow>
          {f.patInv&&(
            <FRow label="Min. dage ml. patientopgaver" hint="Dage der skal gå før næste opgave med patientdeltagelse">
              <Input type="number" value={f.patInvMinDage} onChange={v=>set("patInvMinDage",v)} min="0" max="365"/>
            </FRow>
          )}
        </div>
      </div>

      {/*  Cooldown  */}
      <div style={secStyle}>
        <div style={secHead}>Cooldown efter opgaven</div>
        <FRow label="Min. dage til næste opgave (uanset type)" hint="0 = ingen begrænsning — opgaven kan følges af en anden samme dag">
          <Input type="number" value={f.cooldownDage} onChange={v=>set("cooldownDage",v)} min="0" max="365"/>
        </FRow>
      </div>

      {/*  Udstyr  */}
      <div style={secStyle}>
        <div style={secHead}>Udstyr</div>
        <div style={{color:C.txtM,fontSize:11,marginBottom:8}}>Vælg hvilke udstyr opgaven kræver. Planlæggeren vil kun foreslå lokaler, der har alle valgte udstyr.</div>
        <UdstyrPanel udstyr={f.udstyr} onChange={v=>set("udstyr",v)}/>
      </div>

      {/*  Rulleplan  */}
      <div style={{...secStyle,border:`1px solid ${f.ruller?C.acc:C.brd}`,background:f.ruller?C.accM+"33":C.s2}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:f.ruller?14:0}}>
          <input type="checkbox" checked={f.ruller} onChange={e=>set("ruller",e.target.checked)} style={{accentColor:C.acc,width:16,height:16}}/>
          <div>
            <div style={{color:f.ruller?C.acc:C.txt,fontWeight:700,fontSize:13}}>Rulleplan — gentag opgaven automatisk</div>
            {!f.ruller&&<div style={{color:C.txtM,fontSize:11,marginTop:1}}>Når opgaven er løst planlægges en ny automatisk</div>}
          </div>
        </label>

        {f.ruller&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <FRow label="Næste opgavetype" hint="Tom = samme som denne opgave">
              <Sel value={f.rullerOpgave} onChange={v=>set("rullerOpgave",v)} style={{width:"100%"}}
                options={[{v:"",l:`Samme type (${f.opgave})`},...ALLE_K.filter(k=>k!==f.opgave).map(k=>({v:k,l:k}))]}/>
            </FRow>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <FRow label="Tidligst om (uger)" hint="Minimum ventetid efter løst opgave">
                <Sel value={String(f.rullerTidligstUger)} onChange={v=>set("rullerTidligstUger",Number(v))} style={{width:"100%"}}
                  options={[1,2,3,4,6,8,10,12,16,20,24,26,52].map(n=>({v:String(n),l:`${n} uge${n>1?"r":""}`}))}/>
              </FRow>
              <FRow label="Senest om (uger)" hint="Maksimal ventetid — deadline for ny opgave">
                <Sel value={String(f.rullerSenestUger)} onChange={v=>set("rullerSenestUger",Number(v))} style={{width:"100%"}}
                  options={[1,2,3,4,6,8,10,12,16,20,24,26,52].map(n=>({v:String(n),l:`${n} uge${n>1?"r":""}`}))}/>
              </FRow>
              <FRow label="Planlæg senest (uger før)" hint="Opgaven skal være låst og planlagt X uger inden tidligst-dato">
                <Sel value={String(f.rullerLåsUger)} onChange={v=>set("rullerLåsUger",Number(v))} style={{width:"100%"}}
                  options={[0,1,2,3,4].map(n=>({v:String(n),l:n===0?"Ingen krav":`${n} uge${n>1?"r":""} før`}))}/>
              </FRow>
            </div>
            <div style={{background:C.s3,borderRadius:7,padding:"8px 12px",border:`1px solid ${C.brd}`,color:C.txtM,fontSize:11}}>
              Eksempel: Opgaven løses 1. januar → ny opgave planlagt tidligst {f.rullerTidligstUger} uge{f.rullerTidligstUger>1?"r":""} efter (≈ {new Date(Date.now()+f.rullerTidligstUger*7*24*3600*1000).toLocaleDateString("da-DK",{day:"numeric",month:"short"})}), senest {f.rullerSenestUger} uge{f.rullerSenestUger>1?"r":""} efter{f.rullerLåsUger>0?`, og skal være planlagt ${f.rullerLåsUger} uge${f.rullerLåsUger>1?"r":""} inden`:""}
            </div>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <Btn v="primary" onClick={submit}>Tilføj opgave</Btn>
      </div>
    </div>
  );
}


function TildelForlobForm({forlob,onSave,onClose}){
  const [valgt,setValgt]=useState(Object.keys(forlob)[0]||"1");
  const fl=forlob[valgt];
  return(
    <div>
      <div style={{color:C.txtD,fontSize:13,marginBottom:14}}>
        Vælg et forløb. Opgaverne genereres automatisk og tilfojes patientens profil.
      </div>
      <FRow label="Forløb">
        <Sel value={String(valgt)} onChange={v=>setValgt(v)} style={{width:"100%"}}
          options={Object.keys(forlob).map(k=>({v:k,l:"Forløb nr. "+k+" ("+forlob[k].length+" opgaver)"}))}/>
      </FRow>
      {fl&&(
        <div style={{marginTop:10,background:C.s3,borderRadius:8,padding:"10px 14px"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:12,marginBottom:6}}>Opgaver i forløb {valgt}:</div>
          {fl.map((o,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:i<fl.length-1?"1px solid "+C.brd:"none"}}>
              <span style={{width:20,height:20,borderRadius:"50%",background:C.accM,color:C.acc,fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
              <span style={{flex:1,fontSize:12,color:C.txt}}>{o.o}</span>
              <span style={{fontSize:11,color:C.txtM}}>{o.m} min</span>
              {o.p&&<Pill color={C.grn} bg={C.grnM} sm>Patient</Pill>}
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <Btn v="primary" onClick={()=>onSave(Number(valgt))}>Tildel forløb</Btn>
      </div>
    </div>
  );
}

// ===============================================
// REDIGER PATIENT FORM
// ===============================================
function EditPatientForm({pat, medarbejdere=[], onSave, onClose, lokaler=[]}){
  const [tab,setTab]=useState("basis");

  // Forældre initialiseres som array (maks 2)
  const initForaeldre = ()=>{
    if(pat.foraeldre&&pat.foraeldre.length>0) return pat.foraeldre;
    // Bagudkompatibilitet: gamle enkeltfelter
    const f1={navn:pat.foraeldreNavn||"",cpr:pat.foraeldreCpr||"",tlf:pat.foraeldreTlf||"",id:pat.foraeldreId||"",eboks:pat.foraeldreEboks||"",vej:pat.foraeldreVej||"",postnr:pat.foraeldrePostnr||"",by:pat.foraeldreBy||"",myndighedshaver:pat.myndighedshaver||false};
    return (f1.navn||f1.cpr) ? [f1] : [];
  };

  const [basis,setBasis]=useState({
    navn: pat.navn||"",
    cpr: pat.cpr||"",
    henvDato: pat.henvDato||today(),
    patientNr: pat.patientNr||"",
    ansvarligMed: pat.ansvarligMed||"",
    særligeHensyn: pat.særligeHensyn||"",
    tidStart: pat.tidStart||"08:00",
    tidSlut: pat.tidSlut||"17:00",
  });
  const [adresser,setAdresser]=useState(pat.adresser||[]);
  const [foraeldre,setForaeldre]=useState(initForaeldre);
  const [nyAdr,setNyAdr]=useState({navn:"",vej:"",husnr:"",postnr:"",by:""});

  const setBas=(k,v)=>setBasis(p=>({...p,[k]:v}));

  const addAdresse=()=>{
    if(!nyAdr.navn.trim()&&!nyAdr.vej.trim()&&!nyAdr.by.trim()){return;}
    const ny={id:`adr_${uid()}`,navn:nyAdr.navn||"Adresse "+(adresser.length+1),vej:nyAdr.vej,postnr:nyAdr.postnr,by:nyAdr.by};
    setAdresser(prev=>[...prev,ny]);
    setNyAdr({navn:"",vej:"",postnr:"",by:""});
  };
  const delAdresse=(id)=>setAdresser(prev=>prev.filter(a=>a.id!==id));
  const updAdresse=(id,k,v)=>setAdresser(prev=>prev.map(a=>a.id===id?{...a,[k]:v}:a));

  const BLANK_FORAELD={navn:"",cpr:"",tlf:"",id:"",eboks:"",vej:"",postnr:"",by:"",myndighedshaver:false};
  const addForaeld=()=>{ if(foraeldre.length<2) setForaeldre(p=>[...p,{...BLANK_FORAELD}]); };
  const delForaeld=(i)=>setForaeldre(p=>p.filter((_,j)=>j!==i));
  const updForaeld=(i,k,v)=>setForaeldre(p=>p.map((f,j)=>j===i?{...f,[k]:v}:f));

  const TABS=[{id:"basis",label:"Stamdata"},{id:"foraeld",label:"Forældre / Værge"+(foraeldre.length>0?" ("+foraeldre.length+")":"")},{id:"adresser",label:"Adresser"+(adresser.length>0?" ("+adresser.length+")":"")}];

  const [patFejl,setPatFejl]=useState("");
  const handleSave=()=>{
    if(!basis.navn?.trim()){
      setPatFejl("Patientens navn er påkrævet.");
      return;
    }
    setPatFejl("");
    onSave({
      ...pat,
      ...basis,
      adresser,
      foraeldre,
      // Bevar bagudkompatible felter fra første forælder
      foraeldreNavn: foraeldre[0]?.navn||"",
      foraeldreCpr: foraeldre[0]?.cpr||"",
      foraeldreTlf: foraeldre[0]?.tlf||"",
    });
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* Tab-bar */}
      <div style={{display:"flex",gap:2,borderBottom:"1px solid "+C.brd,marginBottom:14}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"7px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",
            fontSize:12,fontWeight:tab===t.id?700:400,
            background:"transparent",
            color:tab===t.id?C.acc:C.txtM,
            borderBottom:"2px solid "+(tab===t.id?C.acc:"transparent"),
            marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab==="basis"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Fuldt navn"><Input value={basis.navn} onChange={v=>setBas("navn",v)}/></FRow>
            <FRow label="CPR-nummer"><Input value={basis.cpr} onChange={v=>setBas("cpr",v)}/></FRow>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Patient nr."><Input value={basis.patientNr} onChange={v=>setBas("patientNr",v)} placeholder="f.eks. 123456"/></FRow>
            <FRow label="Henvisningsdato"><Input type="date" value={basis.henvDato} onChange={v=>setBas("henvDato",v)}/></FRow>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Tilgængelig fra"><Input type="time" value={basis.tidStart} onChange={v=>setBas("tidStart",v)}/></FRow>
            <FRow label="Tilgængelig til"><Input type="time" value={basis.tidSlut} onChange={v=>setBas("tidSlut",v)}/></FRow>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Ansvarlig medarbejder">
              <select value={basis.ansvarligMed} onChange={e=>setBas("ansvarligMed",e.target.value)}
                style={{width:"100%",padding:"7px 10px",border:"1px solid "+C.brd,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
                <option value="">— Ingen —</option>
                {medarbejdere.map(m=><option key={m.id||m.navn} value={m.navn}>{m.navn}</option>)}
              </select>
            </FRow>
            <FRow label="Særlige hensyn"><Input value={basis.særligeHensyn} onChange={v=>setBas("særligeHensyn",v)} placeholder="tolk, kørestol..."/></FRow>
          </div>
        </div>
      )}

      {tab==="foraeld"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {foraeldre.map((fp,i)=>(
            <div key={i} style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:9,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{color:C.txt,fontWeight:700,fontSize:13}}>Forælder / Værge {foraeldre.length>1?i+1:""}</div>
                <button onClick={()=>delForaeld(i)} style={{background:C.redM,color:C.red,border:"none",borderRadius:6,cursor:"pointer",fontSize:11,padding:"3px 10px",fontFamily:"inherit"}}>Fjern</button>
              </div>
              {/* Myndighedshaver */}
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
                background:fp.myndighedshaver?C.accM:C.s3,
                border:"1px solid "+(fp.myndighedshaver?C.acc:C.brd),
                borderRadius:7,padding:"8px 12px",marginBottom:10}}>
                <span onClick={()=>updForaeld(i,"myndighedshaver",!fp.myndighedshaver)} style={{
                  width:16,height:16,borderRadius:3,flexShrink:0,
                  border:"1.5px solid "+(fp.myndighedshaver?C.acc:C.brd2),
                  background:fp.myndighedshaver?C.acc:"#fff",
                  display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                  {fp.myndighedshaver&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>OK</span>}
                </span>
                <span style={{fontSize:12,fontWeight:fp.myndighedshaver?700:400,color:fp.myndighedshaver?C.acc:C.txtD}}>Forældremyndighedshaver</span>
              </label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Fuldt navn"><Input value={fp.navn} onChange={v=>updForaeld(i,"navn",v)} placeholder="Fornavn Efternavn"/></FRow>
                <FRow label="CPR-nummer"><Input value={fp.cpr} onChange={v=>updForaeld(i,"cpr",v)} placeholder="010175-1234"/></FRow>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Telefon"><Input value={fp.tlf} onChange={v=>updForaeld(i,"tlf",v)} placeholder="+45 12 34 56 78"/></FRow>
                <FRow label="Forældre-ID"><Input value={fp.id} onChange={v=>updForaeld(i,"id",v)} placeholder="F-123456"/></FRow>
              </div>
              <FRow label="E-boks / Digital post">
                <Input value={fp.eboks} onChange={v=>updForaeld(i,"eboks",v)} placeholder="CPR-nummer eller e-mail"/>
              </FRow>
              <div style={{background:C.s3,borderRadius:7,padding:"10px 12px",marginTop:6}}>
                <div style={{color:C.txtM,fontSize:11,fontWeight:600,marginBottom:8}}>ADRESSE</div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
                  <FRow label="Vejnavn"><Input value={fp.vej} onChange={v=>updForaeld(i,"vej",v)} placeholder="Nørrebrogade 44"/></FRow>
                  <FRow label="Postnr."><Input value={fp.postnr} onChange={v=>updForaeld(i,"postnr",v)} placeholder="8000"/></FRow>
                  <FRow label="By"><Input value={fp.by} onChange={v=>updForaeld(i,"by",v)} placeholder="Aarhus C"/></FRow>
                </div>
              </div>
            </div>
          ))}
          {foraeldre.length<2&&(
            <button onClick={addForaeld} style={{
              background:"transparent",border:"2px dashed "+C.brd2,borderRadius:9,
              padding:"14px",cursor:"pointer",color:C.acc,fontSize:13,fontWeight:600,
              fontFamily:"inherit",width:"100%"}}>
              + Tilføj {foraeldre.length===0?"forælder / værge":"anden forælder / værge"}
            </button>
          )}
          {foraeldre.length===2&&(
            <div style={{color:C.txtM,fontSize:11,textAlign:"center"}}>Maks. 2 forældre / værger registreret</div>
          )}
        </div>
      )}

      {tab==="adresser"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{color:C.txtM,fontSize:12,marginBottom:4}}>
            Adresser bruges til at vælge lokation per opgave. Transport beregnes automatisk via Google Maps.
          </div>
          {adresser.map((a,i)=>(
            <div key={a.id} style={{background:C.s2,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.brd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <input value={a.navn} onChange={e=>updAdresse(a.id,"navn",e.target.value)}
                  placeholder={"Adresse "+(i+1)}
                  style={{fontWeight:700,fontSize:13,border:"none",background:"transparent",
                    color:C.txt,outline:"none",fontFamily:"inherit",width:"55%"}}/>
                <button onClick={()=>delAdresse(a.id)}
                  style={{background:C.redM,color:C.red,border:"none",borderRadius:6,
                    cursor:"pointer",fontSize:11,padding:"3px 10px",fontFamily:"inherit"}}>Slet</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8}}>
                <FRow label="Vejnavn"><Input value={a.vej} onChange={v=>updAdresse(a.id,"vej",v)} placeholder="Nørrebrogade"/></FRow>
                <FRow label="Husnr."><Input value={a.husnr||""} onChange={v=>updAdresse(a.id,"husnr",v)} placeholder="44"/></FRow>
                <FRow label="Postnr."><Input value={a.postnr} onChange={v=>updAdresse(a.id,"postnr",v)} placeholder="8000"/></FRow>
                <FRow label="By"><Input value={a.by} onChange={v=>updAdresse(a.id,"by",v)} placeholder="Aarhus C"/></FRow>
              </div>
            </div>
          ))}
          <div style={{background:C.s2,borderRadius:8,padding:"12px 14px",border:"2px dashed "+C.brd2}}>
            <div style={{color:C.txtM,fontSize:11,fontWeight:600,marginBottom:8}}>NY ADRESSE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
              <FRow label="Lokale"><select value={nyAdr.navn} onChange={e=>setNyAdr(p=>({...p,navn:e.target.value}))}
                  style={{width:"100%",background:C.s1,border:`1px solid ${C.brd}`,borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit",color:nyAdr.navn?C.txt:C.txtM,outline:"none"}}>
                  <option value="">— Vælg lokale —</option>
                  {lokaler.map(l=><option key={l} value={l}>{l}</option>)}
                </select></FRow>
              <FRow label="Vejnavn"><Input value={nyAdr.vej} onChange={v=>setNyAdr(p=>({...p,vej:v}))} placeholder="Nørrebrogade"/></FRow>
              <FRow label="Husnr."><Input value={nyAdr.husnr} onChange={v=>setNyAdr(p=>({...p,husnr:v}))} placeholder="44"/></FRow>
              <FRow label="Postnr."><Input value={nyAdr.postnr} onChange={v=>setNyAdr(p=>({...p,postnr:v}))} placeholder="8000"/></FRow>
              <FRow label="By"><Input value={nyAdr.by} onChange={v=>setNyAdr(p=>({...p,by:v}))} placeholder="Aarhus C"/></FRow>
            </div>
            <Btn v="primary" small onClick={addAdresse}>+ Tilføj adresse</Btn>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16,paddingTop:12,borderTop:"1px solid "+C.brd}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <div style={{flex:1}}>{patFejl&&<span style={{color:C.red,fontSize:12}}>{patFejl}</span>}</div>
        <Btn v="primary" onClick={handleSave}>Gem ændringer</Btn>
      </div>
    </div>
  );
}


function NyPatientForm({onSave,onClose,forlob=FORLOB,medarbejdere=[],patienter=[],adminData={},lokaler=[]}){
  const [fejl,setFejl]=useState("");
  const [tab,setTab]=useState("basis");
  const [basis,setBasis]=useState({navn:"",cpr:"",henvDato:today(),patientNr:"",særligeHensyn:"",ansvarligMed:"",afdeling:"current",tidStart:"08:00",tidSlut:"17:00",tildel:false,forlobNr:Object.keys(forlob)[0]||"1"});
  const [adresser,setAdresser]=useState([]);
  const [foraeldre,setForaeldre]=useState([]);
  const [nyAdr,setNyAdr]=useState({navn:"",vej:"",husnr:"",postnr:"",by:""});
  const setBas=(k,v)=>setBasis(p=>({...p,[k]:v}));

  const addAdresse=()=>{
    if(!nyAdr.navn.trim()&&!nyAdr.vej.trim()&&!nyAdr.by.trim()) return;
    setAdresser(prev=>[...prev,{id:`adr_${uid()}`,navn:nyAdr.navn||"Adresse "+(adresser.length+1),vej:nyAdr.vej,postnr:nyAdr.postnr,by:nyAdr.by}]);
    setNyAdr({navn:"",vej:"",postnr:"",by:""});
  };
  const delAdresse=(id)=>setAdresser(prev=>prev.filter(a=>a.id!==id));
  const updAdresse=(id,k,v)=>setAdresser(prev=>prev.map(a=>a.id===id?{...a,[k]:v}:a));

  const BLANK_F={navn:"",cpr:"",tlf:"",id:"",eboks:"",vej:"",postnr:"",by:"",myndighedshaver:false};
  const addForaeld=()=>{ if(foraeldre.length<2) setForaeldre(p=>[...p,{...BLANK_F}]); };
  const delForaeld=(i)=>setForaeldre(p=>p.filter((_,j)=>j!==i));
  const updForaeld=(i,k,v)=>setForaeldre(p=>p.map((fp,j)=>j===i?{...fp,[k]:v}:fp));

  const submit=()=>{
    if(!basis.navn.trim()||!basis.cpr.trim()){setFejl("Udfyld venligst navn og CPR-nummer.");return;}
    const cprClean=basis.cpr.replace(/[^0-9]/g,"");
    if(cprClean.length!==10){setFejl("CPR-nummer skal indeholde 10 cifre (ddmmåå-xxxx).");return;}
    if(patienter&&patienter.find(p=>p.cpr.replace(/[^0-9]/g,"")===cprClean)){setFejl("En patient med dette CPR-nummer eksisterer allerede.");return;}
    const extra={adresser,foraeldre,foraeldreNavn:foraeldre[0]?.navn||"",foraeldreCpr:foraeldre[0]?.cpr||"",foraeldreTlf:foraeldre[0]?.tlf||"",patientNr:basis.patientNr,tidStart:basis.tidStart,tidSlut:basis.tidSlut,ansvarligMed:basis.ansvarligMed,særligeHensyn:basis.særligeHensyn};
    if(basis.tildel){
      onSave({...buildPatient({...basis,forlobNr:Number(basis.forlobNr)},forlob),...extra});
    } else {
      onSave({id:"p"+Date.now(),navn:basis.navn.trim(),cpr:basis.cpr.trim(),henvDato:basis.henvDato,afdeling:basis.afdeling,forlobNr:null,opgaver:[],...extra});
    }
  };

  const fl=forlob[basis.forlobNr];
  const TABS=[{id:"basis",label:"Stamdata"},{id:"foraeld",label:"Forældre"+(foraeldre.length>0?" ("+foraeldre.length+")":"")},{id:"adresser",label:"Adresser"+(adresser.length>0?" ("+adresser.length+")":"")}];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <div style={{display:"flex",gap:2,borderBottom:"1px solid "+C.brd,marginBottom:14}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"7px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",
            fontSize:12,fontWeight:tab===t.id?700:400,background:"transparent",
            color:tab===t.id?C.acc:C.txtM,
            borderBottom:"2px solid "+(tab===t.id?C.acc:"transparent"),marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab==="basis"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Fuldt navn"><Input value={basis.navn} onChange={v=>setBas("navn",v)} placeholder="Lars Hansen"/></FRow>
            <FRow label="CPR-nummer"><Input value={basis.cpr} onChange={v=>setBas("cpr",v)} placeholder="010175-1234"/></FRow>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Patient nr."><Input value={basis.patientNr} onChange={v=>setBas("patientNr",v)} placeholder="f.eks. 123456"/></FRow>
            <FRow label="Henvisningsdato"><Input type="date" value={basis.henvDato} onChange={v=>setBas("henvDato",v)}/></FRow>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Tilgængelig fra"><Input type="time" value={basis.tidStart} onChange={v=>setBas("tidStart",v)}/></FRow>
            <FRow label="Tilgængelig til"><Input type="time" value={basis.tidSlut} onChange={v=>setBas("tidSlut",v)}/></FRow>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Ansvarlig medarbejder">
              <select value={basis.ansvarligMed} onChange={e=>setBas("ansvarligMed",e.target.value)}
                style={{width:"100%",padding:"7px 10px",border:"1px solid "+C.brd,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
                <option value="">— Ingen —</option>
                {medarbejdere.map(m=><option key={m.id||m.navn} value={m.navn}>{m.navn}</option>)}
              </select>
            </FRow>
            <FRow label="Særlige hensyn"><Input value={basis.særligeHensyn} onChange={v=>setBas("særligeHensyn",v)} placeholder="tolk, kørestol..."/></FRow>
          </div>
          <FRow label="Afdeling">
            <select value={basis.afdeling} onChange={e=>setBas("afdeling",e.target.value)}
              style={{width:"100%",padding:"7px 10px",border:"1px solid "+C.brd,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
              <option value="current">Min afdeling (standard)</option>
              {(adminData?.selskaber?.[0]?.afdelinger||[]).filter(a=>!a.children||a.children.length===0).map(a=>(
                <option key={a.id} value={a.id}>{a.navn}</option>
              ))}
              {!(adminData?.selskaber?.[0]?.afdelinger||[]).length&&(
                <>
                  <option value="a1">Psykiatri Nord</option>
                  <option value="a2">Børnepsykiatri</option>
                  <option value="a3">Ungdomspsykiatri</option>
                </>
              )}
            </select>
          </FRow>
          <div style={{padding:"12px 14px",borderRadius:9,border:"1.5px solid "+(basis.tildel?C.acc:C.brd),background:basis.tildel?C.accM:C.s2}}>
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:basis.tildel?12:0}}>
              <span onClick={()=>setBas("tildel",!basis.tildel)} style={{width:18,height:18,borderRadius:4,flexShrink:0,border:"1.5px solid "+(basis.tildel?C.acc:C.brd2),background:basis.tildel?C.acc:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                {basis.tildel&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>OK</span>}
              </span>
              <span style={{fontSize:13,fontWeight:700,color:basis.tildel?C.acc:C.txtD}}>Tildel forløb nu</span>
              <span style={{fontSize:11,color:C.txtM}}> — kan også gøres senere</span>
            </label>
            {basis.tildel&&(
              <>
                <Sel value={String(basis.forlobNr)} onChange={v=>setBas("forlobNr",Number(v))} style={{width:"100%"}}
                  options={Object.keys(forlob).map(k=>({v:k,l:"Forløb nr. "+k+" ("+forlob[k].length+" opgaver)"}))}/>
                {fl&&<div style={{color:C.txtM,fontSize:11,marginTop:5}}>{fl.length} opgaver · {fl.filter(x=>x.p).length} med patientdeltagelse</div>}
              </>
            )}
            {!basis.tildel&&<div style={{color:C.txtM,fontSize:11,marginTop:4}}>Forløb kan tildeles fra patientens profil.</div>}
          </div>
        </div>
      )}

      {tab==="foraeld"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {foraeldre.map((fp,i)=>(
            <div key={i} style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:9,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{color:C.txt,fontWeight:700,fontSize:13}}>Forælder / Værge {foraeldre.length>1?i+1:""}</div>
                <button onClick={()=>delForaeld(i)} style={{background:C.redM,color:C.red,border:"none",borderRadius:6,cursor:"pointer",fontSize:11,padding:"3px 10px",fontFamily:"inherit"}}>Fjern</button>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:fp.myndighedshaver?C.accM:C.s3,border:"1px solid "+(fp.myndighedshaver?C.acc:C.brd),borderRadius:7,padding:"8px 12px",marginBottom:10}}>
                <span onClick={()=>updForaeld(i,"myndighedshaver",!fp.myndighedshaver)} style={{width:16,height:16,borderRadius:3,flexShrink:0,border:"1.5px solid "+(fp.myndighedshaver?C.acc:C.brd2),background:fp.myndighedshaver?C.acc:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                  {fp.myndighedshaver&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>OK</span>}
                </span>
                <span style={{fontSize:12,fontWeight:fp.myndighedshaver?700:400,color:fp.myndighedshaver?C.acc:C.txtD}}>Forældremyndighedshaver</span>
              </label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Fuldt navn"><Input value={fp.navn} onChange={v=>updForaeld(i,"navn",v)} placeholder="Fornavn Efternavn"/></FRow>
                <FRow label="CPR-nummer"><Input value={fp.cpr} onChange={v=>updForaeld(i,"cpr",v)} placeholder="010175-1234"/></FRow>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Telefon"><Input value={fp.tlf} onChange={v=>updForaeld(i,"tlf",v)} placeholder="+45 12 34 56 78"/></FRow>
                <FRow label="Forældre-ID"><Input value={fp.id} onChange={v=>updForaeld(i,"id",v)} placeholder="F-123456"/></FRow>
              </div>
              <FRow label="E-boks / Digital post"><Input value={fp.eboks} onChange={v=>updForaeld(i,"eboks",v)} placeholder="CPR-nummer eller e-mail"/></FRow>
              <div style={{background:C.s3,borderRadius:7,padding:"10px 12px",marginTop:6}}>
                <div style={{color:C.txtM,fontSize:11,fontWeight:600,marginBottom:8}}>ADRESSE</div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
                  <FRow label="Vejnavn"><Input value={fp.vej} onChange={v=>updForaeld(i,"vej",v)} placeholder="Nørrebrogade 44"/></FRow>
                  <FRow label="Postnr."><Input value={fp.postnr} onChange={v=>updForaeld(i,"postnr",v)} placeholder="8000"/></FRow>
                  <FRow label="By"><Input value={fp.by} onChange={v=>updForaeld(i,"by",v)} placeholder="Aarhus C"/></FRow>
                </div>
              </div>
            </div>
          ))}
          {foraeldre.length<2&&(
            <button onClick={addForaeld} style={{background:"transparent",border:"2px dashed "+C.brd2,borderRadius:9,padding:"14px",cursor:"pointer",color:C.acc,fontSize:13,fontWeight:600,fontFamily:"inherit",width:"100%"}}>
              + Tilføj {foraeldre.length===0?"forælder / værge":"anden forælder / værge"}
            </button>
          )}
        </div>
      )}

      {tab==="adresser"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {adresser.map((a,i)=>(
            <div key={a.id} style={{background:C.s2,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.brd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <input value={a.navn} onChange={e=>updAdresse(a.id,"navn",e.target.value)} placeholder={"Adresse "+(i+1)}
                  style={{fontWeight:700,fontSize:13,border:"none",background:"transparent",color:C.txt,outline:"none",fontFamily:"inherit",width:"55%"}}/>
                <button onClick={()=>delAdresse(a.id)} style={{background:C.redM,color:C.red,border:"none",borderRadius:6,cursor:"pointer",fontSize:11,padding:"3px 10px",fontFamily:"inherit"}}>Slet</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
                <FRow label="Vejnavn"><Input value={a.vej} onChange={v=>updAdresse(a.id,"vej",v)} placeholder="Nørrebrogade 44"/></FRow>
                <FRow label="Postnr."><Input value={a.postnr} onChange={v=>updAdresse(a.id,"postnr",v)} placeholder="8000"/></FRow>
                <FRow label="By"><Input value={a.by} onChange={v=>updAdresse(a.id,"by",v)} placeholder="Aarhus C"/></FRow>
              </div>
            </div>
          ))}
          <div style={{background:C.s2,borderRadius:8,padding:"12px 14px",border:"2px dashed "+C.brd2}}>
            <div style={{color:C.txtM,fontSize:11,fontWeight:600,marginBottom:8}}>NY ADRESSE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr 1fr",gap:8,marginBottom:10}}>
              <FRow label="Lokale"><select value={nyAdr.navn} onChange={e=>setNyAdr(p=>({...p,navn:e.target.value}))}
                  style={{width:"100%",padding:"7px 10px",background:C.s1,border:`1px solid ${C.brd}`,borderRadius:7,fontSize:12,fontFamily:"inherit",color:nyAdr.navn?C.txt:C.txtM,outline:"none"}}>
                  <option value="">— Vælg lokale —</option>
                  {lokaler.map(l=><option key={l} value={l}>{l}</option>)}
                </select></FRow>
              <FRow label="Vejnavn"><Input value={nyAdr.vej} onChange={v=>setNyAdr(p=>({...p,vej:v}))} placeholder="Nørrebrogade 44"/></FRow>
              <FRow label="Postnr."><Input value={nyAdr.postnr} onChange={v=>setNyAdr(p=>({...p,postnr:v}))} placeholder="8000"/></FRow>
              <FRow label="By"><Input value={nyAdr.by} onChange={v=>setNyAdr(p=>({...p,by:v}))} placeholder="Aarhus C"/></FRow>
            </div>
            <Btn v="primary" small onClick={addAdresse}>+ Tilføj adresse</Btn>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16,paddingTop:12,borderTop:"1px solid "+C.brd}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <Btn v="primary" onClick={submit}>Opret patient</Btn>
      </div>
    </div>
  );
}
// ===============================================
// KALENDER VIEW
// ===============================================
// ===============================================
function MedarbejderView({medarbejdere,setMedarbejdere,patienter,setPatienter,anmodninger=[],setAnmodninger,isAdmin,certifikater=[],showToast=()=>{},adminData={}}){
  const iDagMed=today();
  const [fraDato,setFraDato]=useState(iDagMed);
  const [tilDato,setTilDato]=useState(addDays(iDagMed,28));
  const inPeriod=(o)=>o.dato?o.dato>=fraDato&&o.dato<=tilDato:false;
  const periodeUger=useMemo(()=>Math.max(1,Math.ceil(daysBetween(fraDato,tilDato)/7)),[fraDato,tilDato]);
  const [søg,setSøg]=useState("");
  const [filTitel,setFilTitel]=useState("alle");
  const [visning,setVisning]=useState("kasse");
  const [sortMedCol,setSortMedCol]=useState("navn");
  const [sortMedDir,setSortMedDir]=useState("asc"); // "kasse" | "liste"
  const [editMed,setEditMed]=useState(null);
  const [nyMed,setNyMed]=useState(false);
  const [delMed,setDelMed]=useState(null);
  const [profilMed,setProfilMed]=useState(null); // medarbejder der redigerer sin profil
  const [fraværMed,setFraværMed]=useState(null); // medarbejder der sygemeldes
  const [fraværForm,setFraværForm]=useState({type:"syg",fra:today(),til:"",noter:""});

  const medLoad=useMemo(()=>{
    return medarbejdere.map(m=>{
      const opgs=patienter.flatMap(p=>p.opgaver.filter(o=>o.medarbejder===m.navn&&o.status==="planlagt"&&inPeriod(o)));
      const kst=beregnKapStatus(m,patienter,fraDato,tilDato);
      return{...m,h:kst.h,cnt:opgs.length,kapStatus:kst,
        patienter:[...new Set(opgs.map(o=>patienter.find(p=>p.opgaver.some(oo=>oo.id===o.id))?.navn))].filter(Boolean)};
    });
  },[medarbejdere,patienter,fraDato,tilDato]);

  const fil=medLoad.filter(m=>{
    if(søg&&!m.navn.toLowerCase().includes(søg.toLowerCase())&&!(m.mail||"").toLowerCase().includes(søg.toLowerCase()))return false;
    if(filTitel!=="alle"&&(m.titel||"").normalize("NFC")!==filTitel)return false;
    return true;
  }).sort((a,b)=>{
    const av=sortMedCol==="h"?a.h:(sortMedCol==="cnt"?a.cnt:(a[sortMedCol]||"").toString().toLowerCase());
    const bv=sortMedCol==="h"?b.h:(sortMedCol==="cnt"?b.cnt:(b[sortMedCol]||"").toString().toLowerCase());
    return sortMedDir==="asc"?(av>bv?1:av<bv?-1:0):(av<bv?1:av>bv?-1:0);
  });

  const saveMed=(m)=>{
    if(m.id){setMedarbejdere(ms=>ms.map(mm=>mm.id!==m.id?mm:m));showToast&&showToast("Medarbejder gemt v");}
    else{setMedarbejdere(ms=>[...ms,{...m,id:`m${uid()}`}]);showToast&&showToast("Medarbejder oprettet v");}
    setEditMed(null); setNyMed(false);
  };
  const deleteMed=(id)=>{
    const med=medarbejdere.find(m=>m.id===id);
    if(med){
      setPatienter(ps=>ps.map(p=>({
        ...p,
        opgaver:p.opgaver.map(o=>({
          ...o,
          medarbejder:o.medarbejder===med.navn?null:o.medarbejder,
          med1:o.med1===med.navn?null:o.med1,
          med2:o.med2===med.navn?null:o.med2,
        }))
      })));
    }
    setMedarbejdere(ms=>ms.filter(m=>m.id!==id));
    setDelMed(null);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <ViewHeader titel="Medarbejdere" undertitel="Oversigt og administration af medarbejdere"/>
      <PeriodeVaelger fraDato={fraDato} setFraDato={setFraDato} tilDato={tilDato} setTilDato={setTilDato}/>
      {/* Toolbar */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Input value={søg} onChange={setSøg} placeholder="Søg navn / mail..." style={{width:220}}/>
        <div style={{display:"flex",gap:5}}>
          {(()=>{
            const fra=(adminData?.titler||[]).map(t=>t.navn);
            const ibrug=[...new Set(medarbejdere.map(m=>m?.titel).filter(Boolean))];
            const samlet=["alle",...new Set([...fra,...ibrug])];
            return samlet.map(t=>(
              <button key={t} onClick={()=>setFilTitel(t)}
                style={{background:filTitel===t?C.accM:"transparent",color:filTitel===t?C.acc:C.txtM,border:`1px solid ${filTitel===t?C.acc:C.brd}`,borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:filTitel===t?700:400}}>
                {t}
              </button>
            ));
          })()}
        </div>
        {/* Visning toggle */}
        <div style={{display:"flex",gap:0,border:`1px solid ${C.brd}`,borderRadius:8,overflow:"hidden"}}>
          {[{v:"kasse",icon:"+"},{v:"liste",icon:"="}].map(({v,icon})=>(
            <button key={v} onClick={()=>setVisning(v)}
              style={{background:visning===v?C.accM:"transparent",color:visning===v?C.acc:C.txtD,border:"none",padding:"5px 13px",cursor:"pointer",fontSize:15,fontFamily:"inherit"}}>
              {icon}
            </button>
          ))}
        </div>
        <span style={{color:C.txtM,fontSize:12}}>{fil.length} medarbej.</span>
        <div style={{marginLeft:"auto"}}>
          <Btn v="accent" onClick={()=>setNyMed(true)}>+ Ny medarbejder</Btn>
        </div>
      </div>

      {/* KASSEFVISNING */}
      {visning==="kasse"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {fil.map(m=>{
            const col=TITLE_C[m.titel]||C.acc;
            const {pct,maxH,rulGns,rulMax,rulPct,advarsel,kap}=m.kapStatus||{pct:0,maxH:0,rulGns:0,rulMax:0,rulPct:0,advarsel:false,kap:{}};
            const ini=m.navn.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
            const aktivtFravær = (m.fravær||[]).find(f=>{
              const nu = today();
              return f.fra<=nu && (f.til===''||f.til>=nu);
            });
            return(
              <div key={m.id} style={{background:C.s2,border:`1px solid ${aktivtFravær?C.amb:C.brd}`,borderRadius:12,padding:"15px 16px",position:"relative"}}>
                {aktivtFravær&&(
                  <div style={{position:"absolute",top:10,right:10,background:C.ambM,color:C.amb,
                    fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 8px",border:`1px solid ${C.amb}44`}}>
                    Fraværende
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:10}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:col+"20",display:"flex",alignItems:"center",justifyContent:"center",color:col,fontSize:14,fontWeight:800,flexShrink:0}}>{ini}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.txt,fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.navn}</div>
                    <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                      <Pill color={col} bg={col+"20"} sm>{m.titel}</Pill>
                      <Pill color={C.txtD} bg={C.s3} sm>{m.timer}t/uge</Pill>
                    </div>
                    {m.mail&&<div style={{color:C.txtM,fontSize:11,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.mail}</div>}
                    {m.arbejdssted&&<div style={{color:C.txtM,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.arbejdssted}</div>}
                  </div>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{color:C.txtM,fontSize:11}}>Belastning</span>
                    <span style={{color:advarsel?C.amb:pct>90?C.red:pct>70?C.amb:col,fontSize:11,fontWeight:600}}>
                    {m.h.toFixed(1)}t / {maxH.toFixed(1)}t ({pct}%){advarsel&&" (!)"}</span>
                  </div>
                  <div style={{background:C.brd,borderRadius:3,height:6}}>
                    <div style={{background:pct>90?C.red:pct>70?C.amb:col,width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:3}}/>
                  </div>
                </div>
                {/* Arbejdsdage kompakt */}
                {m.arbejdsdage&&(
                  <div style={{display:"flex",gap:3,marginTop:6,flexWrap:"wrap"}}>
                    {["Man","Tir","Ons","Tor","Fre","Lør","Søn"].map((dag,di)=>{
                      const dk=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"][di];
                      const ad=m.arbejdsdage[dk];
                      return ad?.aktiv
                        ?<span key={dag} style={{background:col+"18",color:col,borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700}}>{dag}</span>
                        :null;
                    }).filter(Boolean)}
                  </div>
                )}
                <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                  <Pill color={C.blue} bg={C.blueM} sm>{m.cnt} opgaver</Pill>
                  <Pill color={C.pur} bg={C.purM} sm>{m.patienter.length} pat.</Pill>
                  <Pill color={C.acc} bg={C.accM} sm>{m.kompetencer.length} komp.</Pill>
                </div>
                <div style={{display:"flex",gap:6,marginTop:12,paddingTop:10,borderTop:`1px solid ${C.brd}`,alignItems:"center"}}>
                  <Btn v="accent" small onClick={()=>setProfilMed(m)}>Min profil</Btn>
                  <span style={{marginLeft:"auto",color:C.txtM,fontSize:11}}>
                    {(()=>{const kr=m.krPrTime!==null&&m.krPrTime!==undefined?m.krPrTime:(adminData?.taktDefaults||{})[m.titel]?.krPrTime;return kr?formatBeloeb(kr,adminData?.valuta,"/t"):""})()}
                  </span>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LISTEVISNING */}
      {visning==="liste"&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead style={{background:C.s3}}>
              <tr>
                {[["Navn","navn"],["Titel","titel"],["Telefon","telefon"],["Leder","leder"],["Afdeling","afdeling"],["Timer/uge","timer"],["Belastning","h"],["Opgaver","cnt"],["",""]].map(([lbl,col])=>(
                  <th key={lbl} onClick={col?()=>{if(sortMedCol===col)setSortMedDir(d=>d==="asc"?"desc":"asc");else{setSortMedCol(col);setSortMedDir("asc");}}:undefined}
                    style={{padding:"9px 12px",color:sortMedCol===col?C.acc:C.txtM,fontSize:11,textAlign:"left",borderBottom:`1px solid ${C.brd}`,fontWeight:600,whiteSpace:"nowrap",cursor:col?"pointer":"default",userSelect:"none"}}>
                    {lbl}{col&&sortMedCol===col?(sortMedDir==="asc"?" ↑":" ↓"):""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fil.map((m,i)=>{
                const col=TITLE_C[m.titel]||C.acc;
                const {pct,maxH,rulGns,rulMax,rulPct,advarsel,kap}=m.kapStatus||{pct:0,maxH:0,rulGns:0,rulMax:0,rulPct:0,advarsel:false,kap:{}};
                const ini=m.navn.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
                const aktiveDage=m.arbejdsdage
                  ?["Man","Tir","Ons","Tor","Fre","Lør","Søn"].filter((d,di)=>{
                      const dk=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"][di];
                      return m.arbejdsdage[dk]?.aktiv;
                    })
                  :[];
                return(
                  <tr key={m.id} style={{borderBottom:`1px solid ${C.brd}`,background:i%2===0?"transparent":C.s1+"80"}}>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:col+"20",color:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{ini}</div>
                        <span style={{color:C.txt,fontSize:13,fontWeight:500}}>{m.navn}</span>
                      </div>
                    </td>
                    <td style={{padding:"9px 12px"}}><Pill color={col} bg={col+"20"} sm>{m.titel}</Pill></td>
                    <td style={{padding:"9px 12px",color:C.txtD,fontSize:12}}>{m.telefon||<span style={{color:C.txtM}}>-</span>}</td>
                    <td style={{padding:"9px 12px",color:C.txtD,fontSize:12}}>{m.leder||<span style={{color:C.txtM}}>-</span>}</td>
                    <td style={{padding:"9px 12px",color:C.txtD,fontSize:12}}>{m.afdeling==="a1"?"Psykiatri Nord":m.afdeling==="a2"?"Boerne-psy.":m.afdeling==="a3"?"Ungdoms-psy.":"Min afdeling"}</td>
                    <td style={{padding:"9px 12px",color:C.txtD,fontSize:12,textAlign:"center"}}>{m.timer}t</td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:60,background:C.brd,borderRadius:3,height:5}}>
                          <div style={{background:pct>90?C.red:pct>70?C.amb:col,width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:3}}/>
                        </div>
                        <span style={{color:pct>90?C.red:pct>70?C.amb:col,fontSize:11,fontWeight:600}}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"9px 12px"}}><Pill color={C.blue} bg={C.blueM} sm>{m.cnt}</Pill></td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",gap:3}}>
                        {aktiveDage.map(d=><span key={d} style={{background:col+"18",color:col,borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700}}>{d}</span>)}
                        {aktiveDage.length===0&&<span style={{color:C.txtM,fontSize:11}}>-</span>}
                      </div>
                    </td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <Btn v="accent" small onClick={()=>setProfilMed(m)}></Btn>
                                              </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editMed&&(
        <Modal title={`Rediger . ${editMed.navn}`} onClose={()=>setEditMed(null)} w={640}>
          <MedForm med={editMed} onSave={saveMed} onClose={()=>setEditMed(null)} certifikater={certifikater} adminData={adminData}/>
        </Modal>
      )}
      {profilMed&&(
        <Modal title={` Min profil - ${profilMed.navn}`} onClose={()=>setProfilMed(null)} w={700}>
          <MinProfilPanel
            med={profilMed}
            medarbejdere={medarbejdere}
            certifikater={certifikater}
            adminData={adminData}
            onSave={(opdateret)=>{
              setMedarbejdere(ms=>ms.map(m=>m.id===opdateret.id?opdateret:m));
              showToast&&showToast("Profil gemt");
            }}
            onDelete={(id)=>{
              setMedarbejdere(ms=>ms.filter(m=>m.id!==id));
              showToast&&showToast("Medarbejder slettet");
              setProfilMed(null);
            }}
            isAdmin={isAdmin}
            onSendAnmodning={(anm)=>{
              if(setAnmodninger) setAnmodninger(prev=>[anm,...prev]);
              setProfilMed(null);
            }}
          />
        </Modal>
      )}
      {nyMed&&(
        <Modal title="Ny medarbejder" onClose={()=>setNyMed(false)} w={640}>
          <MedForm med={null} onSave={saveMed} onClose={()=>setNyMed(false)} certifikater={certifikater} adminData={adminData}/>
        </Modal>
      )}
      {fraværMed&&(
        <Modal title={`Sygemelding — ${fraværMed.navn}`} onClose={()=>setFraværMed(null)} w={480}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Aktive fravær */}
            {(fraværMed.fravær||[]).length>0&&(
              <div style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:9,padding:"12px 14px"}}>
                <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:8}}>Registrerede fravær</div>
                {(fraværMed.fravær||[]).map((f,fi)=>{
                  const nu=today();
                  const aktiv=f.fra<=nu&&(f.til===''||f.til>=nu);
                  return(
                    <div key={fi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                      padding:"7px 10px",background:aktiv?C.ambM:C.s1,borderRadius:7,marginBottom:4,
                      border:`1px solid ${aktiv?C.amb+"44":C.brd}`}}>
                      <div>
                        <span style={{fontSize:12,fontWeight:600,color:aktiv?C.amb:C.txt}}>
                          {f.type==="syg"?"Syg":f.type==="ferie"?"Ferie":f.type==="kursus"?"Kursus":"Andet"}
                        </span>
                        <span style={{fontSize:11,color:C.txtM,marginLeft:8}}>
                          {f.fra} — {f.til||"åben"}
                        </span>
                        {aktiv&&<span style={{fontSize:10,color:C.amb,fontWeight:700,marginLeft:6}}>Aktiv</span>}
                        {f.noter&&<div style={{fontSize:11,color:C.txtM,marginTop:2}}>{f.noter}</div>}
                      </div>
                      <button onClick={()=>{
                        const nyFravær=(fraværMed.fravær||[]).filter((_,i)=>i!==fi);
                        setMedarbejdere(ms=>ms.map(m=>m.id===fraværMed.id?{...m,fravær:nyFravær}:m));
                        setFraværMed(prev=>({...prev,fravær:nyFravær}));
                      }} style={{background:"none",border:"none",color:C.txtM,cursor:"pointer",fontSize:14,padding:"2px 6px"}}>
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nyt fravær-formular */}
            <div style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:9,padding:"12px 14px"}}>
              <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:10}}>Registrer nyt fravær</div>
              <FRow label="Fraværstype">
                <Sel value={fraværForm.type} onChange={v=>setFraværForm(p=>({...p,type:v}))}
                  options={[{v:"syg",l:"Syg"},{v:"ferie",l:"Ferie"},{v:"kursus",l:"Kursus"},{v:"andet",l:"Andet"}]}/>
              </FRow>
              <FRow label="Fra dato">
                <Input type="date" value={fraværForm.fra} onChange={v=>setFraværForm(p=>({...p,fra:v}))}/>
              </FRow>
              <FRow label="Til dato (tom = åben)">
                <Input type="date" value={fraværForm.til} onChange={v=>setFraværForm(p=>({...p,til:v}))}/>
              </FRow>
              <FRow label="Noter (valgfrit)">
                <Input value={fraværForm.noter} onChange={v=>setFraværForm(p=>({...p,noter:v}))} placeholder="fx kl. 08:15 ringet og sygemeldt"/>
              </FRow>
            </div>

            {/* Berørte opgaver */}
            {(()=>{
              const berørt=patienter.flatMap(p=>p.opgaver.filter(o=>
                o.medarbejder===fraværMed.navn&&o.status==="planlagt"&&
                o.dato>=fraværForm.fra&&(fraværForm.til===''||o.dato<=fraværForm.til)
              ).map(o=>({...o,patientNavn:p.navn})));
              if(berørt.length===0) return null;
              return(
                <div style={{background:C.s3,border:`1px solid ${C.amb}44`,borderRadius:9,padding:"12px 14px"}}>
                  <div style={{color:C.amb,fontWeight:700,fontSize:13,marginBottom:6}}>
                    {berørt.length} planlagte opgaver påvirkes i perioden
                  </div>
                  <div style={{maxHeight:160,overflowY:"auto"}}>
                    {berørt.map((o,oi)=>(
                      <div key={oi} style={{fontSize:11,color:C.txtD,padding:"3px 0",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between"}}>
                        <span>{o.patientNavn} — {o.titel||o.opgave||o.navn||"—"}</span>
                        <span style={{color:C.txtM}}>{o.dato} {o.startKl}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:C.txtM,marginTop:8}}>
                    Disse opgaver markeres til omfordeling. Find stand-in under Admin.
                  </div>
                </div>
              );
            })()}

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn v="ghost" onClick={()=>setFraværMed(null)}>Annuller</Btn>
              <Btn v="primary" onClick={()=>{
                if(!fraværForm.fra){showToast("Angiv startdato","error");return;}
                const nytFravær={...fraværForm,id:"fr"+Date.now()};
                const nyFraværListe=[...(fraværMed.fravær||[]),nytFravær];
                setMedarbejdere(ms=>ms.map(m=>m.id===fraværMed.id?{...m,fravær:nyFraværListe}:m));
                // Markér berørte opgaver til omfordeling
                setPatienter(ps=>ps.map(p=>({...p,opgaver:p.opgaver.map(o=>{
                  if(o.medarbejder!==fraværMed.navn||o.status!=="planlagt"||!o.dato) return o;
                  if(o.dato<fraværForm.fra||(fraværForm.til&&o.dato>fraværForm.til)) return o;
                  return {...o,omfordeling:true};
                })})));
                showToast(`Sygemelding registreret for ${fraværMed.navn}`,"success");
                setFraværMed(null);
              }}>Gem sygemelding</Btn>
            </div>
          </div>
        </Modal>
      )}

            {delMed&&(
        <Modal title="Slet medarbejder?" onClose={()=>setDelMed(null)} w={360}>
          <div style={{color:C.txtD,marginBottom:18}}>Slet <strong style={{color:C.txt}}>{delMed.navn}</strong>? Allerede planlagte opgaver beholder dette navn.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelMed(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>deleteMed(delMed.id)}>Slet</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Ny MedForm med mail, arbejdssted, arbejdsdage
function MedForm({med,onSave,onClose,certifikater=[],adminData={}}){
  const dagNavne=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"];
  const defaultDage=Object.fromEntries(dagNavne.map(d=>([d,{aktiv:["Mandag","Tirsdag","Onsdag","Torsdag","Fredag"].includes(d),start:"08:30",slut:"16:00"}])));

  const [medFejl,setMedFejl]=useState("");
  const [f,setF]=useState({
    navn:med?.navn||"",
    titel:med?.titel||"Psykolog",
    timer:med?.timer||23,
    mail:med?.mail||"",
    telefon:med?.telefon||"",
    leder:med?.leder||"",
    afdeling:med?.afdeling||"a1",
    arbejdsstedNavn:med?.arbejdsstedNavn||"",
    arbejdsstedVej:med?.arbejdsstedVej||"",
    arbejdsstedPostnr:med?.arbejdsstedPostnr||"",
    arbejdsstedBy:med?.arbejdsstedBy||"",
    kompetencer:(med?.kompetencer&&med.kompetencer.length>0)?med.kompetencer:(()=>{const t=med?.titel||"Psykolog";return t==="Læge"?[...LK]:t==="Pædagog"?[...PD]:[...PK];})(),
    arbejdsdage:med?.arbejdsdage||defaultDage,
    medarbejderId:med?.medarbejderId||"",
    epjKalenderApi:med?.epjKalenderApi||"",
    krPrTime:med?.krPrTime||null,
    kapacitet:med?.kapacitet||{grænseType:"uge",grænseTimer:med?.timer||23,rullendePeriodeUger:4,rullendeMaxTimer:Math.round((med?.timer||23)*0.85),ialtFra:"",ialtTil:"",brugerDefault:true},
    hjemVej:med?.hjemVej||"",
    hjemPostnr:med?.hjemPostnr||"",
    hjemBy:med?.hjemBy||"",
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const togK=(k)=>set("kompetencer",f.kompetencer.includes(k)?f.kompetencer.filter(c=>c!==k):[...f.kompetencer,k]);
  const setAll=(title)=>{const km=title==="Læge"?LK:title==="Psykolog"?PK:title==="Pædagog"?PD:[];set("kompetencer",km);};
  const setDag=(dag,field,val)=>setF(p=>({...p,arbejdsdage:{...p.arbejdsdage,[dag]:{...p.arbejdsdage[dag],[field]:val}}}));

  const submit=()=>{
    if(!f.navn.trim()){setMedFejl("Angiv navn på medarbejderen.");return;}
    onSave({...(med||{}),navn:f.navn.trim(),titel:f.titel,timer:Number(f.timer),mail:f.mail,telefon:f.telefon.trim(),leder:f.leder.trim(),afdeling:f.afdeling,arbejdsstedNavn:f.arbejdsstedNavn.trim(),arbejdsstedVej:f.arbejdsstedVej.trim(),
    arbejdsstedPostnr:f.arbejdsstedPostnr.trim(),
    arbejdsstedBy:f.arbejdsstedBy.trim(),kompetencer:f.kompetencer,arbejdsdage:f.arbejdsdage,medarbejderId:f.medarbejderId.trim(),epjKalenderApi:f.epjKalenderApi.trim(),
    hjemVej:f.hjemVej.trim(),hjemPostnr:f.hjemPostnr.trim(),hjemBy:f.hjemBy.trim()});
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <FRow label="Navn"><Input value={f.navn} onChange={v=>set("navn",v)} placeholder="Navn Navnesen"/></FRow>
        <FRow label="Timer pr. uge"><Input type="number" value={f.timer} onChange={v=>set("timer",v)} min="1" max="40"/></FRow>
        <FRow label="Mail"><Input value={f.mail} onChange={v=>set("mail",v)} placeholder="navn@klinik.dk" type="text"/></FRow>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <FRow label="Telefon"><Input value={f.telefon} onChange={v=>set("telefon",v)} placeholder="f.eks. 20 30 40 50"/></FRow>
        <FRow label="Leder"><Input value={f.leder} onChange={v=>set("leder",v)} placeholder="Leders navn"/></FRow>
        <FRow label="Afdeling">
          <select value={f.afdeling} onChange={e=>set("afdeling",e.target.value)}
            style={{width:"100%",padding:"7px 10px",border:"1px solid "+C.brd,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
            <option value="current">Min afdeling</option>
            <option value="a1">Psykiatri Nord</option>
            <option value="a2">Børne-psykiatri</option>
            <option value="a3">Ungdomspsykiatri</option>
          </select>
        </FRow>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FRow label="Arbejdssted - navn"><Input value={f.arbejdsstedNavn} onChange={v=>set("arbejdsstedNavn",v)} placeholder="f.eks. Aarhus Universitetshospital"/></FRow>
        <FRow label="Arbejdssted - vejnavn"><Input value={f.arbejdsstedVej} onChange={v=>set("arbejdsstedVej",v)} placeholder="f.eks. Palle Juul-Jensens Boulevard 99"/></FRow>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:10}}>
        <FRow label="Postnummer"><Input value={f.arbejdsstedPostnr} onChange={v=>set("arbejdsstedPostnr",v)} placeholder="f.eks. 8200"/></FRow>
        <FRow label="By"><Input value={f.arbejdsstedBy} onChange={v=>set("arbejdsstedBy",v)} placeholder="f.eks. Aarhus N"/></FRow>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FRow label="Medarbejder ID"><Input value={f.medarbejderId} onChange={v=>set("medarbejderId",v)} placeholder="f.eks. EMP-1042"/></FRow>
        <FRow label="EPJ Kalender API"><Input value={f.epjKalenderApi} onChange={v=>set("epjKalenderApi",v)} placeholder="f.eks. https://epj.dk/api/kalender/..."/></FRow>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div/>
        <FRow label="Titel">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {((adminData?.titler||[]).map(t=>t.navn)).map(t=>{
              const titelObj=(adminData?.titler||[]).find(x=>x.navn===t);
              const farve=titelObj?.farve||TITLE_C[t]||C.acc;
              return(
                <button key={t} onClick={()=>{set("titel",t);setAll(t);}}
                  style={{flex:1,minWidth:90,background:f.titel===t?farve+"22":"transparent",color:f.titel===t?farve:C.txtM,border:`1px solid ${f.titel===t?farve:C.brd}`,borderRadius:8,padding:"7px 0",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13}}>
                  {t}
                </button>
              );
            })}
          </div>
        </FRow>
      </div>

      {/* Arbejdsdage */}
      <FRow label="Arbejdsdage og arbejdstider">
        <div style={{border:`1px solid ${C.brd}`,borderRadius:9,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"100px 44px 90px 90px",padding:"6px 10px",background:C.s3,gap:8}}>
            <span style={{color:C.txtM,fontSize:11,fontWeight:600}}>Dag</span>
            <span style={{color:C.txtM,fontSize:11,fontWeight:600,textAlign:"center"}}>Aktiv</span>
            <span style={{color:C.txtM,fontSize:11,fontWeight:600}}>Start</span>
            <span style={{color:C.txtM,fontSize:11,fontWeight:600}}>Slut</span>
          </div>
          {dagNavne.map(dag=>{
            const d=f.arbejdsdage[dag]||{aktiv:false,start:"08:30",slut:"16:00"};
            return(
              <div key={dag} style={{display:"grid",gridTemplateColumns:"100px 44px 90px 90px",padding:"6px 10px",borderTop:`1px solid ${C.brd}`,gap:8,alignItems:"center",background:d.aktiv?C.accM+"44":"transparent"}}>
                <span style={{color:d.aktiv?C.txt:C.txtM,fontSize:13,fontWeight:d.aktiv?600:400}}>{dag}</span>
                <div style={{display:"flex",justifyContent:"center"}}>
                  <input type="checkbox" checked={d.aktiv} onChange={e=>setDag(dag,"aktiv",e.target.checked)} style={{accentColor:C.acc,cursor:"pointer"}}/>
                </div>
                <input type="time" value={d.start} disabled={!d.aktiv} onChange={e=>setDag(dag,"start",e.target.value)}
                  style={{background:d.aktiv?C.s1:C.s3,border:`1px solid ${C.brd}`,borderRadius:6,padding:"4px 7px",color:d.aktiv?C.txt:C.txtM,fontSize:12,fontFamily:"inherit",outline:"none",cursor:d.aktiv?"pointer":"default"}}/>
                <input type="time" value={d.slut} disabled={!d.aktiv} onChange={e=>setDag(dag,"slut",e.target.value)}
                  style={{background:d.aktiv?C.s1:C.s3,border:`1px solid ${C.brd}`,borderRadius:6,padding:"4px 7px",color:d.aktiv?C.txt:C.txtM,fontSize:12,fontFamily:"inherit",outline:"none",cursor:d.aktiv?"pointer":"default"}}/>
              </div>
            );
          })}
        </div>
      </FRow>

      {/* Kompetencer — grupperet efter titel */}
      <FRow label={`Kompetencer (${f.kompetencer.length} valgt)`}>
        <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,background:C.s1,borderRadius:8,padding:10,border:`1px solid ${C.brd}`}}>
          {(()=>{
            const grupper=[
              {id:"Psykolog",label:"Psykolog",komp:PK},
              {id:"Læge",label:"Læge",komp:LK},
              {id:"Pædagog",label:"Pædagog",komp:PD},
            ];
            const egne=(f.kompetencer||[]).filter(k=>![...PK,...LK,...PD].includes(k));
            if(egne.length>0) grupper.push({id:"oevrig",label:"Øvrige",komp:egne});
            return grupper.map(({id,label,komp})=>{
              const alleMarkeret=komp.every(k=>f.kompetencer.includes(k));
              const nogenMarkeret=komp.some(k=>f.kompetencer.includes(k));
              const togGruppe=()=>{
                if(alleMarkeret) set("kompetencer",f.kompetencer.filter(k=>!komp.includes(k)));
                else set("kompetencer",[...new Set([...f.kompetencer,...komp])]);
              };
              return(
                <div key={id}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,cursor:"pointer"}} onClick={togGruppe}>
                    <span style={{padding:"2px 10px",borderRadius:12,fontSize:11,fontWeight:700,
                      background:alleMarkeret?C.acc:nogenMarkeret?C.accM:"transparent",
                      color:alleMarkeret?"#fff":nogenMarkeret?C.acc:C.txtD,
                      border:`1px solid ${alleMarkeret?C.acc:nogenMarkeret?C.acc:C.brd}`}}>{label}</span>
                    <div style={{height:1,flex:1,background:C.brd}}/>
                    <span style={{fontSize:10,color:C.txtM}}>{f.kompetencer.filter(k=>komp.includes(k)).length}/{komp.length}</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {komp.map(k=>(
                      <button key={k} onClick={()=>togK(k)}
                        style={{padding:"3px 8px",borderRadius:5,cursor:"pointer",fontFamily:"inherit",fontSize:11,
                          fontWeight:f.kompetencer.includes(k)?700:400,
                          background:f.kompetencer.includes(k)?C.accM:"transparent",
                          color:f.kompetencer.includes(k)?C.acc:C.txtM,
                          border:`1px solid ${f.kompetencer.includes(k)?C.acc:C.brd}`,transition:"all .1s"}}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </FRow>
      {/* Certifikater */}
      {/* Adresser */}
      <FRow label="Arbejdsstedets adresse (blank = afdelingens adresse)">
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
          <Input value={f.arbejdsstedVej||""} onChange={v=>set("arbejdsstedVej",v)} placeholder="Vejnavn"/>
          <Input value={f.arbejdsstedPostnr||""} onChange={v=>set("arbejdsstedPostnr",v)} placeholder="Postnr."/>
          <Input value={f.arbejdsstedBy||""} onChange={v=>set("arbejdsstedBy",v)} placeholder="By"/>
        </div>
      </FRow>
      <FRow label="Hjemmeadresse (bruges til transport-beregning)">
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
          <Input value={f.hjemVej||""} onChange={v=>set("hjemVej",v)} placeholder="Vejnavn (valgfri)"/>
          <Input value={f.hjemPostnr||""} onChange={v=>set("hjemPostnr",v)} placeholder="Postnr."/>
          <Input value={f.hjemBy||""} onChange={v=>set("hjemBy",v)} placeholder="By"/>
        </div>
      </FRow>
      <FRow label={`Certifikater (${(f.certifikater||[]).length} tildelt)`}>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,padding:"8px",background:C.s1,borderRadius:8,border:`1px solid ${C.brd}`,minHeight:40}}>
          {certifikater.map(cc=>{
            const har=(f.certifikater||[]).includes(cc.id);
            return(
              <button key={cc.id}
                onClick={()=>{ const cur=f.certifikater||[]; set("certifikater",har?cur.filter(x=>x!==cc.id):[...cur,cc.id]); }}
                title={cc.beskrivelse}
                style={{background:har?C.ambM:"transparent",color:har?C.amb:C.txtD,
                  border:`1px solid ${har?C.amb:C.brd}`,borderRadius:6,padding:"3px 10px",
                  fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:har?700:400}}>
                {har?"[v] ":""}{cc.navn}
              </button>
            );
          })}
          {certifikater.length===0&&<span style={{color:C.txtM,fontSize:12,padding:"2px 4px"}}>Ingen certifikater — opret dem under Opgaver › Certifikater</span>}
        </div>
        <div style={{color:C.txtM,fontSize:11,marginTop:4}}>Certifikater defineres under fanebladet Opgaver › Certifikater</div>
      </FRow>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
        {medFejl&&<span style={{color:C.red,fontSize:12,marginRight:"auto"}}>{medFejl}</span>}
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <Btn v="primary" onClick={submit}>{med?"Gem ændringer":"Opret medarbejder"}</Btn>
      </div>
    </div>
  );
}

// LOKALER VIEW - redigerbare åbningstider + næste/seneste bookinger
// ===============================================
function LokalerView({patienter,lokTider,setLokTider,lokMeta={},setLokMeta,lokaler=[],saveLokaler=()=>{},adminData={},udstyrsKat=[],saveUdstyrsKat=()=>{},udstyrsPakker=[],saveUdstyrsPakker=()=>{}}){
  const [topTab,setTopTab]=useState("lokaler"); // "lokaler" | "udstyr"
  const iDagLok=today();
  const [fraDato,setFraDato]=useState(addDays(iDagLok,-28));
  const [tilDato,setTilDato]=useState(iDagLok);
  const inPeriod=(o)=>o.dato?o.dato>=fraDato&&o.dato<=tilDato:false;
  const [valgt,setValgt]=useState(null);
  const [bookingRetning,setBookingRetning]=useState("seneste");
  const [editTiderLok,setEditTiderLok]=useState(null);
  const [editMetaLok,setEditMetaLok]=useState(null);

  const LT = lokTider || DEFAULT_LOK_TIDER;
  const dagNavne=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"];
  const iDag = today();

  const lokStats=useMemo(()=>{
    return lokaler.map(lok=>{
      const booket=patienter.flatMap(p=>p.opgaver.filter(o=>o.lokale===lok&&o.status==="planlagt"&&inPeriod(o)));
      const h=booket.reduce((a,o)=>a+o.minutter/60,0);
        const antalDageFn=(dagNr)=>{
          const totalDage=daysBetween(fraDato,tilDato)+1;
          const startDag=parseLocalDate(fraDato).getDay();
          const fuldeUger=Math.floor(totalDage/7);
          const resDage=totalDage%7;
          const normDag=(dagNr-startDag+7)%7;
          return fuldeUger+(normDag<resDage?1:0);
        };
        const DAG_NAVNE=["Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag"];
        const dagStats=DAG_NAVNE.slice(1).concat(["Søndag"]).map(dag=>{
          const dagNr=DAG_NAVNE.indexOf(dag);
          const t=LT[dag]?.[lok];
          const opAbn=t&&t.l!=="00:00"&&t.å!=="00:00";
          const åbMinPerDag=opAbn?Math.max(0,toMin(t.l)-toMin(t.å)):0;
          const antalDage=Math.max(0,antalDageFn(dagNr));
          const dagBookinger=booket.filter(o=>getDag(o.dato)===dag);
          const booketMin=dagBookinger.reduce((a,o)=>a+o.minutter,0);
          const totalÅbMin=åbMinPerDag*antalDage;
          return{dag,opAbn,åbMin:åbMinPerDag,booketMin,antalDage,
            pct:totalÅbMin>0?Math.round(booketMin/totalÅbMin*100):0};
        });
        const totalÅbMinAlle=dagStats.reduce((a,d)=>a+d.åbMin*d.antalDage,0);
        const totalBooketMin=dagStats.reduce((a,d)=>a+d.booketMin,0);
        const samletPct=totalÅbMinAlle>0?Math.round(totalBooketMin/totalÅbMinAlle*100):0;
        return{lok,booket,h,cnt:booket.length,dagStats,totalÅbMinAlle,totalBooketMin,samletPct};
    });
  },[patienter,LT,lokaler,fraDato,tilDato]);

  const getBookinger=(stat)=>{
    if(bookingRetning==="seneste"){
      return stat.booket.filter(o=>o.dato<=iDag).sort((a,b)=>b.dato.localeCompare(a.dato)||b.startKl.localeCompare(a.startKl)).slice(0,15);
    } else {
      return stat.booket.filter(o=>o.dato>=iDag).sort((a,b)=>a.dato.localeCompare(b.dato)||a.startKl.localeCompare(b.startKl)).slice(0,15);
    }
  };

  const saveTider=(lok,nyTider)=>{
    setLokTider(prev=>({
      ...prev,
      ...Object.fromEntries(dagNavne.map(dag=>[dag,{...prev[dag],[lok]:nyTider[dag]}]))
    }));
    setEditTiderLok(null);
  };

  // Alle udstyr items fra kategorier (fladt)
  const alleUdstyrItems=useMemo(()=>udstyrsKat.flatMap(k=>(k.items||[]).map(i=>({...i,kategori:k.navn}))),[udstyrsKat]);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh-100px)",gap:0}}>
      <ViewHeader titel="Lokaler & Udstyr" undertitel="Administrer lokaler, udstyr og udstyrspakker"/>

      {/* Top-tabs */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.brd}`,marginBottom:8}}>
        {[{id:"lokaler",label:"Lokaler"},{id:"udstyr",label:"Udstyr"}].map(t=>(
          <button key={t.id} onClick={()=>setTopTab(t.id)}
            style={{padding:"10px 24px",border:"none",fontFamily:"inherit",cursor:"pointer",
              background:"none",fontWeight:topTab===t.id?700:400,fontSize:14,
              color:topTab===t.id?C.acc:C.txtD,
              borderBottom:topTab===t.id?`2px solid ${C.acc}`:"2px solid transparent",marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ LOKALER TAB ══════ */}
      {topTab==="lokaler"&&(<>
      <PeriodeVaelger fraDato={fraDato} setFraDato={setFraDato} tilDato={tilDato} setTilDato={setTilDato}/>
      <div style={{display:"flex",gap:14,flex:1,overflow:"hidden",marginTop:12}}>

      {/* Sidebar */}
      <div style={{width:230,flexShrink:0,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 13px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Lokaler</span>
          <button onClick={()=>{
            // Unik default: "Nyt lokale", evt. med suffix hvis navnet allerede findes
            let nyt="Nyt lokale";
            let n=2;
            while(lokaler.includes(nyt)){nyt="Nyt lokale "+n;n++;}
            const nyListe=[...lokaler,nyt];
            saveLokaler(nyListe);
            setLokMeta(p=>({...p,[nyt]:{lokaleId:"",kapacitet:"",udstyr:"",adresse:{}}}));
            // Tilføj standard-åbningstider for det nye lokale (08-16 hverdage, weekend lukket)
            setLokTider(prev=>{
              const next={...prev};
              ["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"].forEach(dag=>{
                next[dag]={...(prev[dag]||{}), [nyt]:{...STANDARD_AABNINGSTIDER[dag]}};
              });
              return next;
            });
            setValgt(nyt);
          }} style={{background:C.accM,color:C.acc,border:`1px solid ${C.acc}44`,borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            + Nyt
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {lokStats.map(l=>{
            const act=valgt===l.lok;
            const harAdr=!!(lokMeta[l.lok]?.adresse?.vej);
            return(
              <div key={l.lok} onClick={()=>setValgt(l.lok)}
                style={{padding:"10px 13px",cursor:"pointer",borderBottom:`1px solid ${C.brd}`,
                  background:act?C.accM:"transparent",borderLeft:`3px solid ${act?C.acc:"transparent"}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{color:act?C.acc:C.txt,fontSize:13,fontWeight:act?700:500}}>{l.lok}</span>
                  {harAdr&&<span style={{fontSize:10,color:C.grn}} title="Adresse registreret"></span>}
                </div>
                <div style={{display:"flex",gap:4}}>
                  <Pill color={C.blue} bg={C.blueM} sm>{l.cnt} booket</Pill>
                  <Pill color={C.acc} bg={C.accM} sm>{l.h.toFixed(1)}t</Pill>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalje */}
      <div style={{flex:1,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {!valgt?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:C.txtM}}>
            <span style={{fontSize:36}}></span><span>Vælg et lokale</span>
          </div>
        ):(()=>{
          const stat=lokStats.find(l=>l.lok===valgt);
          if(!stat) return null;
          const bookinger=getBookinger(stat);
          const lokUdstyr=lokMeta[valgt]?.udstyrIds||[];
          const lokPakker=lokMeta[valgt]?.udstyrsPakkeIds||[];
          return(
            <>
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{color:C.txt,fontWeight:800,fontSize:18}}>{valgt}</div>
                  <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                    <Pill color={C.blue} bg={C.blueM}>{stat.cnt} bookinger</Pill>
                    <Pill color={C.acc} bg={C.accM}>{stat.h.toFixed(1)} timer booket</Pill>
                    {lokMeta[valgt]?.lokaleId&&<Pill color={C.txtM} bg={C.s3}>ID: {lokMeta[valgt].lokaleId}</Pill>}
                    {lokMeta[valgt]?.kapacitet&&<Pill color={C.txtM} bg={C.s3}> {lokMeta[valgt].kapacitet} pers.</Pill>}
                    {lokUdstyr.length>0&&<Pill color={C.pur} bg={C.purM}>{lokUdstyr.length} udstyr</Pill>}
                    {lokPakker.length>0&&<Pill color={C.blue} bg={C.blueM}>{lokPakker.length} pakker</Pill>}
                    {(()=>{const kr=lokMeta[valgt]?.krPrTime;const adminKr=(adminData?.taktDefaults?.Lokale?.krPrTime);const vis=kr??adminKr;return vis?<Pill color={C.acc} bg={C.accM}>{formatBeloeb(vis,adminData?.valuta,"/t")}</Pill>:null;})()}
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn v="subtle" small onClick={()=>setEditMetaLok(valgt)}> Rediger lokale</Btn>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                {/* Udstyr & pakker på lokalet */}
                {(lokUdstyr.length>0||lokPakker.length>0)&&(
                  <div style={{marginBottom:20}}>
                    <div style={{color:C.txt,fontWeight:700,marginBottom:8,fontSize:13}}>Tilknyttet udstyr & pakker</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {lokUdstyr.map(uid=>{const it=alleUdstyrItems.find(x=>x.id===uid);return it?<Pill key={uid} color={C.pur} bg={C.purM}>{it.navn} <span style={{opacity:.6,fontSize:10}}>({it.kategori})</span></Pill>:null;})}
                      {lokPakker.map(pid=>{const pk=udstyrsPakker.find(x=>x.id===pid);return pk?<Pill key={pid} color={C.blue} bg={C.blueM}>{pk.navn}</Pill>:null;})}
                    </div>
                  </div>
                )}

                {/* Åbningstider tabel */}
                <div style={{color:C.txt,fontWeight:700,marginBottom:10,fontSize:13}}>Åbningstider & udnyttelse pr. dag</div>
                <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
                  <thead>
                    <tr>
                      {["Dag","Åbner","Lukker","Booket","Udnyttelse"].map(h=>(
                        <th key={h} style={{color:C.txtM,fontSize:11,textAlign:"left",padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stat.dagStats.map(d=>(
                      <tr key={d.dag} style={{opacity:d.opAbn?1:0.4}}>
                        <td style={{padding:"7px 8px",color:d.opAbn?C.txt:C.txtM,fontSize:13}}>{d.dag}{!d.opAbn&&<span style={{fontSize:10,color:C.txtM,marginLeft:6}}>lukket</span>}</td>
                        <td style={{padding:"7px 8px",color:C.txtD,fontSize:12}}>{d.opAbn?LT[d.dag]?.[valgt]?.å:"-"}</td>
                        <td style={{padding:"7px 8px",color:C.txtD,fontSize:12}}>{d.opAbn?LT[d.dag]?.[valgt]?.l:"-"}</td>
                        <td style={{padding:"7px 8px",color:C.txtD,fontSize:12}}>{d.opAbn?`${d.booketMin}min (${d.antalDage||1} dage)`:"-"}</td>
                        <td style={{padding:"7px 8px"}}>
                          {d.opAbn?(
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{flex:1,background:C.brd,borderRadius:3,height:5}}>
                                <div style={{background:d.pct>100?C.red:d.pct>80?C.amb:C.acc,width:`${Math.min(d.pct,100)}%`,height:"100%",borderRadius:3}}/>
                              </div>
                              <span style={{color:C.txtM,fontSize:11,width:30}}>{d.pct}%</span>
                            </div>
                          ):<span style={{color:C.txtM,fontSize:11}}>Lukket</span>}
                        </td>
                      </tr>
                    ))}
                      <tr style={{borderTop:`2px solid ${C.brd}`,background:C.s3}}>
                        <td style={{padding:"8px 8px",color:C.txt,fontSize:13,fontWeight:700}}>Samlet</td>
                        <td style={{padding:"8px 8px",color:C.txtM,fontSize:12}}>—</td>
                        <td style={{padding:"8px 8px",color:C.txtM,fontSize:12}}>—</td>
                        <td style={{padding:"8px 8px",color:C.txtD,fontSize:12,fontWeight:600}}>
                          {stat.totalBooketMin}min ({Math.round(stat.totalBooketMin/60*10)/10}t)
                        </td>
                        <td style={{padding:"8px 8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{flex:1,background:C.brd,borderRadius:3,height:6}}>
                              <div style={{background:stat.samletPct>100?C.red:stat.samletPct>80?C.amb:C.acc,
                                width:`${Math.min(stat.samletPct,100)}%`,height:6,borderRadius:3}}/>
                            </div>
                            <span style={{color:stat.samletPct>100?C.red:stat.samletPct>80?C.amb:C.txt,
                              fontSize:12,fontWeight:700,minWidth:36}}>{stat.samletPct}%</span>
                          </div>
                        </td>
                      </tr>
                  </tbody>
                </table>

                {/* Bookinger med toggle */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{color:C.txt,fontWeight:700,fontSize:13}}>Bookinger</div>
                  <div style={{display:"flex",gap:0,border:`1px solid ${C.brd}`,borderRadius:8,overflow:"hidden"}}>
                    {[{v:"seneste",label:"< Seneste"},{v:"næste",label:"Næste >"}].map(({v,label})=>(
                      <button key={v} onClick={()=>setBookingRetning(v)}
                        style={{background:bookingRetning===v?C.accM:"transparent",color:bookingRetning===v?C.acc:C.txtD,border:"none",padding:"5px 13px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:bookingRetning===v?700:400}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {bookinger.length===0
                  ?<div style={{color:C.txtM,fontSize:13,textAlign:"center",padding:20}}>{bookingRetning==="seneste"?"Ingen tidligere bookinger":"Ingen kommende bookinger"}</div>
                  :bookinger.map((o,i)=>{
                    const pat=patienter.find(p=>p.opgaver.some(oo=>oo.id===o.id));
                    const erFremtidig=o.dato>=iDag;
                    return(
                      <div key={i} style={{background:C.s3,borderRadius:8,padding:"8px 12px",marginBottom:5,display:"flex",gap:8,alignItems:"center",borderLeft:`3px solid ${erFremtidig?C.blue:C.brd}`}}>
                        <Pill color={erFremtidig?C.blue:C.acc} bg={erFremtidig?C.blueM:C.accM} sm>{o.dato}</Pill>
                        <Pill color={C.pur} bg={C.purM} sm>{o.startKl}-{o.slutKl}</Pill>
                        <span style={{color:C.txtD,fontSize:12,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pat?.navn||"?"} . {o.opgave}</span>
                        <Pill color={C.acc} bg={C.accM} sm>{o.medarbejder}</Pill>
                      </div>
                    );
                  })
                }
              </div>
            </>
          );
        })()}
      </div>

      {/* Modal: Rediger lokale */}
      {editMetaLok&&(
        <Modal title={`Lokaleinfo - ${editMetaLok}`} onClose={()=>setEditMetaLok(null)} w={560}>
          <LokMetaForm
              lok={editMetaLok}
              meta={lokMeta[editMetaLok]||{}}
              lokaler={lokaler}
              lokTider={lokTider}
              setLokTider={setLokTider}
              udstyrsKat={udstyrsKat}
              udstyrsPakker={udstyrsPakker}
              adminData={adminData}
              onSave={(gammelLok,m)=>{
                if(m.navn && m.navn!==gammelLok){
                  const nyLok=m.navn.trim();
                  saveLokaler(lokaler.map(l=>l===gammelLok?nyLok:l));
                  setLokMeta(p=>{const{[gammelLok]:_,...rest}=p;return{...rest,[nyLok]:{...m,_editOpen:undefined}};});
                  if(valgt===gammelLok) setValgt(nyLok);
                } else {
                  setLokMeta(p=>({...p,[gammelLok]:{...p[gammelLok],...m,_editOpen:undefined}}));
                }
                setEditMetaLok(null);
              }}
              onDelete={(lok)=>{
                saveLokaler(lokaler.filter(l=>l!==lok));
                setLokMeta(p=>{const{[lok]:_,...rest}=p;return rest;});
                if(valgt===lok) setValgt(lokaler.filter(l=>l!==lok)[0]||null);
                setEditMetaLok(null);
              }}
              onClose={()=>setEditMetaLok(null)}/>
        </Modal>
      )}
      {editTiderLok&&(
        <Modal title={`Åbningstider - ${editTiderLok}`} onClose={()=>setEditTiderLok(null)} w={480}>
          <LokalTiderForm lok={editTiderLok} lokTider={LT} onSave={saveTider} onClose={()=>setEditTiderLok(null)}/>
        </Modal>
      )}
      </div>
      </>)}

      {/* ══════ UDSTYR TAB ══════ */}
      {topTab==="udstyr"&&(
        <UdstyrsTabView udstyrsKat={udstyrsKat} saveUdstyrsKat={saveUdstyrsKat} udstyrsPakker={udstyrsPakker} saveUdstyrsPakker={saveUdstyrsPakker}/>
      )}
    </div>
  );
}

// ── Udstyr-fanen: Kategorier, items og pakker ──────────────────
function UdstyrsTabView({udstyrsKat,saveUdstyrsKat,udstyrsPakker,saveUdstyrsPakker}){
  const [subTab,setSubTab]=useState("kategorier"); // "kategorier" | "pakker"
  const [editKat,setEditKat]=useState(null);
  const [editPakke,setEditPakke]=useState(null);
  const [nyKatNavn,setNyKatNavn]=useState("");
  const [nyPakkeNavn,setNyPakkeNavn]=useState("");

  // Alle items fra alle kategorier
  const alleItems=useMemo(()=>udstyrsKat.flatMap(k=>(k.items||[]).map(i=>({...i,katId:k.id,katNavn:k.navn}))),[udstyrsKat]);

  // ── Kategori CRUD ──
  const addKat=()=>{
    const n=nyKatNavn.trim();if(!n)return;
    saveUdstyrsKat([...udstyrsKat,{id:`ukat_${uid()}`,navn:n,items:[]}]);
    setNyKatNavn("");
  };
  const delKat=(id)=>saveUdstyrsKat(udstyrsKat.filter(k=>k.id!==id));
  const renameKat=(id,navn)=>saveUdstyrsKat(udstyrsKat.map(k=>k.id===id?{...k,navn}:k));

  // ── Item CRUD ──
  const addItem=(katId,navn)=>{
    const n=navn.trim();if(!n)return;
    saveUdstyrsKat(udstyrsKat.map(k=>k.id===katId?{...k,items:[...(k.items||[]),{id:`uitm_${uid()}`,navn:n}]}:k));
  };
  const delItem=(katId,itemId)=>saveUdstyrsKat(udstyrsKat.map(k=>k.id===katId?{...k,items:(k.items||[]).filter(i=>i.id!==itemId)}:k));
  const renameItem=(katId,itemId,navn)=>saveUdstyrsKat(udstyrsKat.map(k=>k.id===katId?{...k,items:(k.items||[]).map(i=>i.id===itemId?{...i,navn}:i)}:k));

  // ── Pakke CRUD ──
  const addPakke=()=>{
    const n=nyPakkeNavn.trim();if(!n)return;
    saveUdstyrsPakker([...udstyrsPakker,{id:`upak_${uid()}`,navn:n,itemIds:[]}]);
    setNyPakkeNavn("");
  };
  const delPakke=(id)=>saveUdstyrsPakker(udstyrsPakker.filter(p=>p.id!==id));
  const renamePakke=(id,navn)=>saveUdstyrsPakker(udstyrsPakker.map(p=>p.id===id?{...p,navn}:p));
  const togglePakkeItem=(pakkeId,itemId)=>{
    saveUdstyrsPakker(udstyrsPakker.map(p=>{
      if(p.id!==pakkeId)return p;
      const has=p.itemIds.includes(itemId);
      return{...p,itemIds:has?p.itemIds.filter(x=>x!==itemId):[...p.itemIds,itemId]};
    }));
  };

  return(
    <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[{id:"kategorier",label:"Kategorier & Udstyr"},{id:"pakker",label:"Udstyrspakker"}].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"7px 18px",borderRadius:8,border:`1px solid ${subTab===t.id?C.acc:C.brd}`,
              background:subTab===t.id?C.accM:"transparent",color:subTab===t.id?C.acc:C.txtD,
              fontSize:13,fontWeight:subTab===t.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── KATEGORIER & UDSTYR ── */}
      {subTab==="kategorier"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          {/* Opret kategori */}
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={nyKatNavn} onChange={e=>setNyKatNavn(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addKat();}}
              placeholder="Ny kategori-navn..."
              style={{flex:1,padding:"9px 13px",borderRadius:8,border:`1px solid ${C.brd}`,background:C.s2,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            <Btn v="primary" onClick={addKat}>+ Kategori</Btn>
          </div>

          {udstyrsKat.length===0&&(
            <div style={{color:C.txtM,fontSize:13,textAlign:"center",padding:40}}>
              Ingen udstyrskategorier oprettet endnu. Opret en kategori for at tilfoeje udstyr.
            </div>
          )}

          {udstyrsKat.map(kat=>(
            <KategoriKort key={kat.id} kat={kat} onRename={(n)=>renameKat(kat.id,n)} onDelete={()=>delKat(kat.id)}
              onAddItem={(n)=>addItem(kat.id,n)} onDelItem={(iid)=>delItem(kat.id,iid)} onRenameItem={(iid,n)=>renameItem(kat.id,iid,n)}/>
          ))}
        </div>
      )}

      {/* ── UDSTYRSPAKKER ── */}
      {subTab==="pakker"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          {/* Opret pakke */}
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={nyPakkeNavn} onChange={e=>setNyPakkeNavn(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addPakke();}}
              placeholder="Ny pakke-navn..."
              style={{flex:1,padding:"9px 13px",borderRadius:8,border:`1px solid ${C.brd}`,background:C.s2,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            <Btn v="primary" onClick={addPakke}>+ Pakke</Btn>
          </div>

          {alleItems.length===0&&(
            <div style={{color:C.txtM,fontSize:13,textAlign:"center",padding:20,background:C.s2,borderRadius:10,border:`1px solid ${C.brd}`,marginBottom:16}}>
              Opret kategorier og udstyr under "Kategorier & Udstyr" foerst, for at kunne samle dem i pakker.
            </div>
          )}

          {udstyrsPakker.length===0&&alleItems.length>0&&(
            <div style={{color:C.txtM,fontSize:13,textAlign:"center",padding:40}}>
              Ingen udstyrspakker oprettet endnu.
            </div>
          )}

          {udstyrsPakker.map(pakke=>(
            <PakkeKort key={pakke.id} pakke={pakke} alleItems={alleItems} udstyrsKat={udstyrsKat}
              onRename={(n)=>renamePakke(pakke.id,n)} onDelete={()=>delPakke(pakke.id)}
              onToggleItem={(iid)=>togglePakkeItem(pakke.id,iid)}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kategori-kort med items ──
function KategoriKort({kat,onRename,onDelete,onAddItem,onDelItem,onRenameItem}){
  const [editNavn,setEditNavn]=useState(false);
  const [navn,setNavn]=useState(kat.navn);
  const [nytItem,setNytItem]=useState("");
  const [editItemId,setEditItemId]=useState(null);
  const [editItemNavn,setEditItemNavn]=useState("");
  const [confirmDel,setConfirmDel]=useState(false);

  return(
    <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.s3}}>
        {editNavn?(
          <div style={{display:"flex",gap:6,flex:1}}>
            <input value={navn} onChange={e=>setNavn(e.target.value)} autoFocus
              onKeyDown={e=>{if(e.key==="Enter"){onRename(navn);setEditNavn(false);}if(e.key==="Escape")setEditNavn(false);}}
              style={{flex:1,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
            <Btn v="primary" small onClick={()=>{onRename(navn);setEditNavn(false);}}>Gem</Btn>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:C.txt,fontWeight:700,fontSize:14}}>{kat.navn}</span>
            <Pill color={C.txtM} bg={C.s2} sm>{(kat.items||[]).length} udstyr</Pill>
          </div>
        )}
        {!editNavn&&(
          <div style={{display:"flex",gap:4}}>
            <Btn v="ghost" small onClick={()=>{setNavn(kat.navn);setEditNavn(true);}}>Omdoeb</Btn>
            <Btn v="ghost" small onClick={()=>setConfirmDel(true)} style={{color:C.red}}>Slet</Btn>
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{padding:"10px 14px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {(kat.items||[]).map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:4,background:C.accM,border:`1px solid ${C.acc}44`,borderRadius:7,padding:"4px 10px"}}>
              {editItemId===item.id?(
                <input value={editItemNavn} onChange={e=>setEditItemNavn(e.target.value)} autoFocus
                  onKeyDown={e=>{if(e.key==="Enter"){onRenameItem(item.id,editItemNavn);setEditItemId(null);}if(e.key==="Escape")setEditItemId(null);}}
                  style={{width:100,padding:"2px 4px",borderRadius:4,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
              ):(
                <span style={{color:C.acc,fontSize:12,fontWeight:600,cursor:"pointer"}}
                  onClick={()=>{setEditItemId(item.id);setEditItemNavn(item.navn);}}>{item.navn}</span>
              )}
              <button onClick={()=>onDelItem(item.id)}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:0,lineHeight:1,fontFamily:"inherit"}}>x</button>
            </div>
          ))}
        </div>
        {/* Tilfoej item */}
        <div style={{display:"flex",gap:6}}>
          <input value={nytItem} onChange={e=>setNytItem(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){onAddItem(nytItem);setNytItem("");}}}
            placeholder="Tilfoej udstyr..."
            style={{flex:1,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s3,color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={()=>{onAddItem(nytItem);setNytItem("");}}
            style={{padding:"6px 14px",borderRadius:7,border:"none",background:C.acc,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            + Tilfoej
          </button>
        </div>
      </div>

      {confirmDel&&<ConfirmDialog tekst={`Slet kategorien "${kat.navn}" og alt udstyr i den?`} onJa={()=>{onDelete();setConfirmDel(false);}} onNej={()=>setConfirmDel(false)}/>}
    </div>
  );
}

// ── Pakke-kort med item-toggle ──
function PakkeKort({pakke,alleItems,udstyrsKat,onRename,onDelete,onToggleItem}){
  const [editNavn,setEditNavn]=useState(false);
  const [navn,setNavn]=useState(pakke.navn);
  const [confirmDel,setConfirmDel]=useState(false);
  const [expanded,setExpanded]=useState(false);

  return(
    <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.s3}}>
        {editNavn?(
          <div style={{display:"flex",gap:6,flex:1}}>
            <input value={navn} onChange={e=>setNavn(e.target.value)} autoFocus
              onKeyDown={e=>{if(e.key==="Enter"){onRename(navn);setEditNavn(false);}if(e.key==="Escape")setEditNavn(false);}}
              style={{flex:1,padding:"4px 8px",borderRadius:6,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
            <Btn v="primary" small onClick={()=>{onRename(navn);setEditNavn(false);}}>Gem</Btn>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
            <span style={{color:C.txt,fontWeight:700,fontSize:14}}>{pakke.navn}</span>
            <Pill color={C.blue} bg={C.blueM} sm>{pakke.itemIds.length} udstyr</Pill>
            <span style={{color:C.txtM,fontSize:10}}>{expanded?"v":">"}</span>
          </div>
        )}
        {!editNavn&&(
          <div style={{display:"flex",gap:4}}>
            <Btn v="ghost" small onClick={()=>{setNavn(pakke.navn);setEditNavn(true);}}>Omdoeb</Btn>
            <Btn v="ghost" small onClick={()=>setConfirmDel(true)} style={{color:C.red}}>Slet</Btn>
          </div>
        )}
      </div>

      {/* Valgte items opsummering */}
      {!expanded&&pakke.itemIds.length>0&&(
        <div style={{padding:"8px 14px",display:"flex",flexWrap:"wrap",gap:4}}>
          {pakke.itemIds.map(iid=>{const it=alleItems.find(x=>x.id===iid);return it?<Pill key={iid} color={C.acc} bg={C.accM} sm>{it.navn}</Pill>:null;})}
        </div>
      )}

      {/* Expanded: toggle items by kategori */}
      {expanded&&(
        <div style={{padding:"10px 14px"}}>
          {udstyrsKat.map(kat=>{
            const items=kat.items||[];
            if(items.length===0)return null;
            return(
              <div key={kat.id} style={{marginBottom:10}}>
                <div style={{color:C.txtM,fontSize:11,fontWeight:600,marginBottom:5}}>{kat.navn}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {items.map(item=>{
                    const aktiv=pakke.itemIds.includes(item.id);
                    return(
                      <button key={item.id} onClick={()=>onToggleItem(item.id)}
                        style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12,
                          fontWeight:aktiv?700:400,background:aktiv?C.accM:"transparent",
                          color:aktiv?C.acc:C.txtM,border:`1px solid ${aktiv?C.acc:C.brd}`,transition:"all .12s"}}>
                        {item.navn}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDel&&<ConfirmDialog tekst={`Slet pakken "${pakke.navn}"?`} onJa={()=>{onDelete();setConfirmDel(false);}} onNej={()=>setConfirmDel(false)}/>}
    </div>
  );
}

function LokalTiderForm({lok,lokTider,onSave,onClose}){
  const dagNavne=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"];
  const [tider,setTider]=useState(
    Object.fromEntries(dagNavne.map(dag=>[dag,{...(lokTider[dag]?.[lok]||{å:"00:00",l:"00:00"})}]))
  );
  const set=(dag,field,val)=>setTider(t=>({...t,[dag]:{...t[dag],[field]:val}}));
  const erÅben=(dag)=>tider[dag]?.å!=="00:00"||tider[dag]?.l!=="00:00";
  const togÅben=(dag)=>{
    if(erÅben(dag)) setTider(t=>({...t,[dag]:{å:"00:00",l:"00:00"}}));
    else setTider(t=>({...t,[dag]:{å:"08:30",l:"16:00"}}));
  };

  return(
    <div>
      <div style={{border:`1px solid ${C.brd}`,borderRadius:9,overflow:"hidden",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"110px 50px 90px 90px",padding:"7px 12px",background:C.s3,gap:8}}>
          {["Dag","Åben","Åbner","Lukker"].map(h=><span key={h} style={{color:C.txtM,fontSize:11,fontWeight:600}}>{h}</span>)}
        </div>
        {dagNavne.map(dag=>{
          const åben=erÅben(dag);
          return(
            <div key={dag} style={{display:"grid",gridTemplateColumns:"110px 50px 90px 90px",padding:"7px 12px",borderTop:`1px solid ${C.brd}`,gap:8,alignItems:"center",background:åben?C.accM+"33":"transparent"}}>
              <span style={{color:åben?C.txt:C.txtM,fontSize:13,fontWeight:åben?600:400}}>{dag}</span>
              <div style={{display:"flex",justifyContent:"center"}}>
                <input type="checkbox" checked={åben} onChange={()=>togÅben(dag)} style={{accentColor:C.acc,cursor:"pointer"}}/>
              </div>
              <input type="time" value={tider[dag]?.å||"00:00"} disabled={!åben} onChange={e=>set(dag,"å",e.target.value)}
                style={{background:åben?C.s1:C.s3,border:`1px solid ${C.brd}`,borderRadius:6,padding:"4px 7px",color:åben?C.txt:C.txtM,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <input type="time" value={tider[dag]?.l||"00:00"} disabled={!åben} onChange={e=>set(dag,"l",e.target.value)}
                style={{background:åben?C.s1:C.s3,border:`1px solid ${C.brd}`,borderRadius:6,padding:"4px 7px",color:åben?C.txt:C.txtM,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <Btn v="primary" onClick={()=>onSave(lok,tider)}>Gem åbningstider</Btn>
      </div>
    </div>
  );
}

// ── UdstyrPanel ──────────────────────────────────────────────
// Toggle-baseret udstyrsliste, ligesom kompetencer på medarbejdere
function UdstyrPanel({udstyr=[], onChange}) {
  const [nytNavn, setNytNavn] = React.useState("");

  // Globalt udstyr-katalog — alle kendte udstyr på tværs af lokaler
  const KENDT_UDSTYR = [
    "Whiteboard","Projektor","Skærm","Computer","Printer",
    "Sofa","Briks","Rundt bord","Lydproofing","Dæmpet lys",
    "Måtter","Bolde","Klatrevæg","Kunstudstyr","Musikinstrumenter",
    "ECT-udstyr","Anæstesi","EKG","Nødkald","Håndvask",
    "Testkuffert","Piktogrammer","Tegnetavle",
  ];

  const togUdstyr = (u) => {
    if(udstyr.includes(u)) onChange(udstyr.filter(x=>x!==u));
    else onChange([...udstyr, u]);
  };

  const tilføj = () => {
    const t = nytNavn.trim();
    if(!t || udstyr.includes(t)) return;
    onChange([...udstyr, t]);
    setNytNavn("");
  };

  // Kombinér kendt + tildelt (vis tildelte øverst)
  const alle = [...new Set([...udstyr, ...KENDT_UDSTYR])];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Tilføj nyt */}
      <div style={{display:"flex",gap:8}}>
        <input value={nytNavn} onChange={e=>setNytNavn(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();tilføj();}}}
          placeholder="Tilføj nyt udstyr..."
          style={{flex:1,padding:"7px 11px",borderRadius:7,border:`1px solid ${C.brd}`,
            background:C.s3,color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
        <button onClick={tilføj}
          style={{padding:"7px 16px",borderRadius:7,border:"none",background:C.acc,
            color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          + Tilføj
        </button>
      </div>

      {/* Toggle-grid */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {alle.map(u=>{
          const aktiv = udstyr.includes(u);
          return(
            <button key={u} onClick={()=>togUdstyr(u)}
              style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",
                fontFamily:"inherit",fontSize:12,transition:"all .12s",
                fontWeight:aktiv?700:400,
                background:aktiv?C.accM:"transparent",
                color:aktiv?C.acc:C.txtM,
                border:`1px solid ${aktiv?C.acc:C.brd}`}}>
              {u}
            </button>
          );
        })}
      </div>

      {udstyr.length===0&&(
        <div style={{color:C.txtM,fontSize:12,fontStyle:"italic"}}>
          Ingen udstyr valgt endnu
        </div>
      )}

      {/* Valgte */}
      {udstyr.length>0&&(
        <div style={{fontSize:11,color:C.txtM}}>
          {udstyr.length} valgt: {udstyr.join(", ")}
        </div>
      )}
    </div>
  );
}


function LokMetaForm({lok,meta,onSave,onClose,onDelete=null,onRename=null,lokaler=[],lokTider={},setLokTider=()=>{},indsatser=[],setIndsatser=()=>{},udstyrsKat=[],udstyrsPakker=[],adminData={}}){
  const [delLok,setDelLok]=useState(null);
  const [lmfTab,setLmfTab]=useState("info");
  const dagNavne=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"];
  const [f,setF]=useState({
    lokaleId:meta.lokaleId||"",
    kapacitet:meta.kapacitet||"",
    udstyr:(typeof meta.udstyr==="string"&&meta.udstyr?meta.udstyr.split(/[,،]+/).map(s=>s.trim()).filter(Boolean):Array.isArray(meta.udstyr)?meta.udstyr:[]),
    udstyrIds:meta.udstyrIds||[],
    udstyrsPakkeIds:meta.udstyrsPakkeIds||[],
    krPrTime:meta.krPrTime!==undefined?meta.krPrTime:null,
    navn:lok,
    vej:(meta.adresse||{}).vej||"",
    husnr:(meta.adresse||{}).husnr||"",
    postnr:(meta.adresse||{}).postnr||"",
    by:(meta.adresse||{}).by||"",
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const harAdresse = f.vej&&f.by;
  const LT_DAG = Object.fromEntries(Object.keys(lokTider||{}).map(dag=>[dag,(lokTider[dag]||{})[lok]||{å:"00:00",l:"00:00"}]));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.brd}`,marginBottom:12}}>
        {[{id:"info",label:"Lokale & Udstyr"},{id:"tider",label:"Åbningstider"}].map(t=>(
          <button key={t.id} onClick={()=>setLmfTab(t.id)}
            style={{padding:"8px 18px",border:"none",fontFamily:"inherit",cursor:"pointer",
              background:"none",fontWeight:lmfTab===t.id?700:400,color:lmfTab===t.id?C.acc:C.txtD,
              borderBottom:lmfTab===t.id?`2px solid ${C.acc}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Åbningstider tab */}
      {lmfTab==="tider"&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <div style={{color:C.txtM,fontSize:12,marginBottom:8}}>Sæt åbnings- og lukketider per ugedag</div>
          <div style={{border:`1px solid ${C.brd}`,borderRadius:9,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 90px 90px",padding:"7px 14px",background:C.s3}}>
              {["Dag","Åbner","Lukker"].map(h=><span key={h} style={{color:C.txtM,fontSize:11,fontWeight:600}}>{h}</span>)}
            </div>
            {dagNavne.map(dag=>{
              const t=LT_DAG[dag]||{å:"00:00",l:"00:00"};
              const erLukket=t.l==="00:00"||!t.l;
              // Når brugeren klikker "Åbn" — uanset ugedag — sæt et brugbart tidsinterval
              // (08:00–16:00) så input-felterne ikke straks bliver disabled igen.
              const ÅBN_DEFAULT={å:"08:00",l:"16:00"};
              return(
                <div key={dag} style={{display:"grid",gridTemplateColumns:"110px 90px 90px",padding:"6px 14px",
                  borderTop:`1px solid ${C.brd}`,gap:8,alignItems:"center",background:erLukket?C.s3:"transparent"}}>
                  <span style={{color:erLukket?C.txtM:C.txt,fontSize:13,fontWeight:erLukket?400:500}}>{dag}</span>
                  <input type="time" value={erLukket?"":t.å||"08:00"} disabled={erLukket}
                    onChange={e=>setLokTider(lt=>({...lt,[dag]:{...(lt[dag]||{}),[lok]:{...((lt[dag]||{})[lok]||{}),å:e.target.value}}}))}
                    style={{padding:"4px 6px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    <input type="time" value={erLukket?"":t.l||"16:00"} disabled={erLukket}
                      onChange={e=>setLokTider(lt=>({...lt,[dag]:{...(lt[dag]||{}),[lok]:{...((lt[dag]||{})[lok]||{}),l:e.target.value}}}))}
                      style={{padding:"4px 6px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit",flex:1}}/>
                    <button onClick={()=>setLokTider(lt=>({...lt,[dag]:{...(lt[dag]||{}),[lok]:erLukket?{...ÅBN_DEFAULT}:{å:"00:00",l:"00:00"}}}))}
                      style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${C.brd}`,cursor:"pointer",fontSize:11,fontFamily:"inherit",
                        background:erLukket?C.grnM:"transparent",color:erLukket?C.grn:C.txtM}}>
                      {erLukket?"Åbn":"Luk"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lokale & Udstyr tab */}
      {lmfTab==="info"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
            <FRow label="Lokale-navn">
              <Input value={f.navn} onChange={v=>set("navn",v)} placeholder="Lokalenavn"/>
            </FRow>
          </div>
          <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
            <FRow label="Lokale ID"><Input value={f.lokaleId} onChange={v=>set("lokaleId",v)} placeholder="f.eks. LOK-101"/></FRow>
            <FRow label="Kapacitet (antal personer)"><Input type="number" value={f.kapacitet} onChange={v=>set("kapacitet",v)} placeholder="f.eks. 6"/></FRow>
            <FRow label={`Timepris (${valutaSymbol(adminData?.valuta)}/t)`}><Input type="number" value={f.krPrTime||""} onChange={v=>set("krPrTime",v?Number(v):null)} placeholder="Fra admin-standard"/></FRow>
          </div>
          <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
            <div style={{color:C.txtD,fontWeight:700,fontSize:12,marginBottom:8}}>Adresse</div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8,marginBottom:6}}>
              <FRow label="Vejnavn"><Input value={f.vej} onChange={v=>set("vej",v)} placeholder="Skovvænget"/></FRow>
              <FRow label="Husnr."><Input value={f.husnr} onChange={v=>set("husnr",v)} placeholder="3"/></FRow>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8}}>
              <FRow label="Postnr."><Input value={f.postnr} onChange={v=>set("postnr",v)} placeholder="8240"/></FRow>
              <FRow label="By"><Input value={f.by} onChange={v=>set("by",v)} placeholder="Risskov"/></FRow>
            </div>
          </div>

          {/* Udstyr afsnit — fra centralt katalog */}
          <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
            <div style={{color:C.txtD,fontWeight:700,fontSize:12,marginBottom:10}}>Udstyr (fra katalog)</div>
            {udstyrsKat.length===0?(
              <div style={{color:C.txtM,fontSize:12}}>Opret udstyrskategorier under fanen "Udstyr" foerst.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {udstyrsKat.map(kat=>{
                  const items=kat.items||[];
                  if(items.length===0)return null;
                  return(
                    <div key={kat.id}>
                      <div style={{color:C.txtM,fontSize:11,fontWeight:600,marginBottom:4}}>{kat.navn}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {items.map(item=>{
                          const aktiv=f.udstyrIds.includes(item.id);
                          return(
                            <button key={item.id} onClick={()=>set("udstyrIds",aktiv?f.udstyrIds.filter(x=>x!==item.id):[...f.udstyrIds,item.id])}
                              style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12,
                                fontWeight:aktiv?700:400,background:aktiv?C.accM:"transparent",
                                color:aktiv?C.acc:C.txtM,border:`1px solid ${aktiv?C.acc:C.brd}`,transition:"all .12s"}}>
                              {item.navn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Udstyrspakker */}
          {udstyrsPakker.length>0&&(
            <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
              <div style={{color:C.txtD,fontWeight:700,fontSize:12,marginBottom:10}}>Udstyrspakker</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {udstyrsPakker.map(pk=>{
                  const aktiv=f.udstyrsPakkeIds.includes(pk.id);
                  return(
                    <button key={pk.id} onClick={()=>set("udstyrsPakkeIds",aktiv?f.udstyrsPakkeIds.filter(x=>x!==pk.id):[...f.udstyrsPakkeIds,pk.id])}
                      style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12,
                        fontWeight:aktiv?700:400,background:aktiv?C.blueM:"transparent",
                        color:aktiv?C.blue:C.txtM,border:`1px solid ${aktiv?C.blue:C.brd}`,transition:"all .12s"}}>
                      {pk.navn} <span style={{opacity:.5,fontSize:10}}>({pk.itemIds.length})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Knapper */}
      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        {onDelete&&(
          <button onClick={()=>setDelLok(lok)}
            style={{background:C.red+"11",color:C.red,border:`1px solid ${C.red}33`,
              borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
            Slet lokale
          </button>
        )}
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          <Btn v="ghost" onClick={onClose}>Annuller</Btn>
          <Btn v="primary" onClick={()=>onSave(lok,{
            lokaleId:f.lokaleId,kapacitet:f.kapacitet,
            udstyr:f.udstyr,udstyrIds:f.udstyrIds,udstyrsPakkeIds:f.udstyrsPakkeIds,
            adresse:{vej:f.vej,husnr:f.husnr,postnr:f.postnr,by:f.by},
            navn:f.navn,krPrTime:f.krPrTime!==null?Number(f.krPrTime):null,
          })}>Gem info</Btn>
        </div>
      </div>
      {delLok&&<ConfirmDialog
        tekst={`Slet "${delLok}" permanent?`}
        onJa={()=>{onDelete(delLok);setDelLok(null);onClose();}}
        onNej={()=>setDelLok(null)}/>}
    </div>
  );
}

function NumEnhedInput({value, enhed, onValChange, onEnhedChange}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <input type="number" value={value||0} min="0" max="999"
        onChange={e=>onValChange(Number(e.target.value))}
        style={{width:60,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.brd}`,
          background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
      <select value={enhed||"dage"} onChange={e=>onEnhedChange(e.target.value)}
        style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${C.brd}`,
          background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}>
        <option value="dage">dage</option>
        <option value="uger">uger</option>
        <option value="måneder">måneder</option>
      </select>
    </div>
  );
}

function IndsatsForm({indsats, onSave, onClose, lokaler=[]}) {
  const blankEl = (i) => ({
    id:`e_${uid()}`, navn:"", minutter:30, patInv:false,
    samMed: i > 0,
    tidligst:"08:00", senest:"17:00", lokaler:[], certifikat:"",
    udstyr:[],
    // patInv interval
    patInvMinDage:0, patInvMinDageEnhed:"dage",
    // rulleplan
    ruller:false, rullerOpgave:"",
    rullerTidligstAntal:4, rullerTidligstEnhed:"uger",
    rullerSenestAntal:6, rullerSenestEnhed:"uger",
    rullerLåsAntal:2, rullerLåsEnhed:"uger",
    // cooldown
    cooldownAktiv:false, cooldownAntal:3, cooldownEnhed:"dage",
    // e-Boks
    eBoksAktiv:false, eBoksDokNavn:null, eBoksTid:"lås",
  });
  const blank = { id:`ins_${uid()}`, navn:"", elementer:[blankEl(0)] };
  const initIndsats = (src) => {
    if(!src) return blank;
    const c = structuredClone(src);
    // Flat format (fra Excel): ingen elementer, har opgave/muligeMed
    if(!c.elementer && (c.opgave||c.muligeMed)){
      return {
        id:c.id, navn:c.indsatsGruppe||c.navn||c.opgave||"",
        elementer:[{...blankEl(0), id:c.id+"_e0", navn:c.opgave||c.navn||"",
          minutter:c.minutter||60, patInv:c.patInv||false,
          tidligst:c.tidligst||"08:00", senest:c.senest||"17:00",
          lokaler:c.muligeLok||["Kontor"], certifikat:c.certifikat||""}]
      };
    }
    // Ensure navn and elementer exist
    c.navn = c.navn || c.indsatsGruppe || c.opgave || "";
    c.elementer = (c.elementer||[]).map(e=>({...e, navn:e.navn||e.opgave||"", lokaler:e.lokaler||e.muligeLok||["Kontor"]}));
    return c;
  };
  const [f, setF] = useState(()=>initIndsats(indsats));
  const [grpFejl, setGrpFejl] = useState("");
  const [collapsed, setCollapsed] = useState({}); // {elIndex: true/false}
  const toggleCollapse = i => setCollapsed(p=>({...p,[i]:!p[i]}));
  const sNavn = v => setF(p=>({...p, navn:v}));

  // Elementer CRUD
  const addEl    = ()      => setF(p=>({...p, elementer:[...p.elementer, blankEl(p.elementer.length)]}));
  const updEl    = (i,k,v) => setF(p=>({...p, elementer:p.elementer.map((e,j)=>j===i?{...e,[k]:v}:e)}));
  const togElLok = (i,l)   => setF(p=>({...p, elementer:p.elementer.map((e,j)=>j!==i?e:
    {...e, lokaler:e.lokaler.includes(l)?e.lokaler.filter(x=>x!==l):[...e.lokaler,l]})}));
  const delEl    = i        => setF(p=>({...p, elementer:p.elementer.filter((_,j)=>j!==i)}));
  const moveEl   = (i,dir)  => setF(p=>{
    const arr=[...p.elementer]; const ni=i+dir;
    if(ni<0||ni>=arr.length) return p;
    [arr[i],arr[ni]]=[arr[ni],arr[i]];
    return {...p, elementer:arr};
  });

  const certOpts = ["(Intet krav)", ...ALLE_K];
  const isValid  = (f.navn||"").trim().length>0 && (f.elementer||[]).length>0 &&
                   (f.elementer||[]).every(e=>(e.navn||"").trim().length>0 && (e.lokaler||[]).length>0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Indsatsens overordnede navn */}
      <div style={{background:C.s3,borderRadius:10,padding:"12px 16px",border:`1px solid ${C.brd}`}}>
        <FRow label="Opgavens navn (gruppenavn)">
          <Input value={f.navn} onChange={sNavn} placeholder="F.eks. ADOS 4"/>
        </FRow>
      </div>

      {/* Sekvens af elementer */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:13}}>
            Elementer i sekvens
            <span style={{color:C.txtM,fontWeight:400,fontSize:12,marginLeft:6}}>({f.elementer.length})</span>
          </div>
          <button onClick={addEl} style={{background:C.accM,color:C.acc,border:`1px solid ${C.acc}44`,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>+ Tilføj element</button>
        </div>

        {f.elementer.length===0&&(
          <div style={{color:C.txtM,fontSize:12,padding:"16px 0",textAlign:"center",border:`1px dashed ${C.brd}`,borderRadius:8}}>
            Ingen elementer endnu - klik + for at tilføje
          </div>
        )}

        {f.elementer.map((el,i)=>{
          const erFørste = i===0;
          const numColor = erFørste ? C.acc : C.pur;
          const isCollapsed = collapsed[i];
          
          return(
            <div key={el.id} style={{background:C.s3,border:`1px solid ${el.ruller?C.acc:el.cooldownAktiv?C.pur:C.brd}`,borderRadius:9,padding:"12px 14px",marginBottom:8}}>

              {/* -- Topbar -- */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:isCollapsed?0:10}}>
                <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                  <button onClick={()=>moveEl(i,-1)} disabled={erFørste}
                    style={{background:"none",border:"none",color:erFørste?C.brd:C.txtD,cursor:erFørste?"default":"pointer",fontSize:9,padding:0,lineHeight:1}}>^</button>
                  <button onClick={()=>moveEl(i,1)} disabled={i===f.elementer.length-1}
                    style={{background:"none",border:"none",color:i===f.elementer.length-1?C.brd:C.txtD,cursor:i===f.elementer.length-1?"default":"pointer",fontSize:9,padding:0,lineHeight:1}}>v</button>
                </div>
                <div style={{width:24,height:24,borderRadius:"50%",background:`${numColor}22`,color:numColor,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                <input value={el.navn} onChange={e=>updEl(i,"navn",e.target.value)}
                  placeholder="F.eks. Forberedelse"
                  style={{flex:1,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                <input type="number" value={el.minutter} min="5" max="480"
                  onChange={e=>updEl(i,"minutter",Number(e.target.value))}
                  style={{width:56,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
                <span style={{color:C.txtM,fontSize:11,flexShrink:0}}>min</span>
                <button onClick={()=>delEl(i)}
                  style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:5,padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit",marginLeft:2}}>X</button>
                <button onClick={()=>toggleCollapse(i)}
                  style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:5,padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit",color:C.txtM,marginLeft:2}}>
                  {isCollapsed?"":""}
                </button>
              </div>

              {!isCollapsed&&<>

              {/* -- Krav-række: patInv + samMed -- */}
              <div style={{paddingLeft:32,display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>

                {/* 1. Patient til stede */}
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="checkbox" checked={el.patInv} onChange={e=>updEl(i,"patInv",e.target.checked)}
                    style={{accentColor:C.grn,width:14,height:14}}/>
                  <span style={{color:el.patInv?C.grn:C.txtM,fontSize:12,fontWeight:el.patInv?600:400}}>
                    Patient til stede
                    {erFørste&&<span style={{color:C.txtM,fontWeight:400,fontStyle:"italic",marginLeft:6,fontSize:11}}>NB: dette element sætter medarbejderen for hele opgaven</span>}
                  </span>
                </label>
                {el.patInv&&(
                  <div style={{marginLeft:22,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{color:C.txtM,fontSize:11}}>Min. ventetid ml. patientopgaver:</span>
                    <NumEnhedInput value={el["patInvMinDage"]} enhed={el["patInvMinDageEnhed"]||"dage"} onValChange={v=>updEl(i,"patInvMinDage",v)} onEnhedChange={v=>updEl(i,"patInvMinDageEnhed",v)}/>
                  </div>
                )}

                {/* 2. Rulleplan — direkte under patInv */}
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="checkbox" checked={el.ruller||false} onChange={e=>updEl(i,"ruller",e.target.checked)}
                    style={{accentColor:C.acc,width:14,height:14}}/>
                  <span style={{color:el.ruller?C.acc:C.txtM,fontSize:12,fontWeight:el.ruller?600:400}}>
                    Rullende opgave — planlæg ny automatisk når løst
                  </span>
                </label>
                {el.ruller&&(
                  <div style={{marginLeft:22,background:C.accM+"33",border:`1px solid ${C.acc}33`,borderRadius:8,padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div>
                        <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:4}}>NÆSTE OPGAVETYPE</div>
                        <select value={el.rullerOpgave||""} onChange={e=>updEl(i,"rullerOpgave",e.target.value)}
                          style={{width:"100%",background:C.s1,border:`1px solid ${C.brd}`,borderRadius:6,padding:"5px 8px",color:C.txt,fontSize:11,fontFamily:"inherit",outline:"none"}}>
                          <option value="">Samme type ({el.navn||"dette element"})</option>
                          {ALLE_K.map(k=><option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:4}}>PLANLÆG SENEST</div>
                        <NumEnhedInput value={el["rullerLåsAntal"]} enhed={el["rullerLåsEnhed"]||"uger"} onValChange={v=>updEl(i,"rullerLåsAntal",v)} onEnhedChange={v=>updEl(i,"rullerLåsEnhed",v)}/>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div>
                        <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:4}}>TIDLIGST OM</div>
                        <NumEnhedInput value={el["rullerTidligstAntal"]} enhed={el["rullerTidligstEnhed"]||"uger"} onValChange={v=>updEl(i,"rullerTidligstAntal",v)} onEnhedChange={v=>updEl(i,"rullerTidligstEnhed",v)}/>
                      </div>
                      <div>
                        <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:4}}>SENEST OM</div>
                        <NumEnhedInput value={el["rullerSenestAntal"]} enhed={el["rullerSenestEnhed"]||"uger"} onValChange={v=>updEl(i,"rullerSenestAntal",v)} onEnhedChange={v=>updEl(i,"rullerSenestEnhed",v)}/>
                      </div>
                    </div>
                    <div style={{color:C.txtM,fontSize:10,background:C.s3,borderRadius:6,padding:"5px 8px"}}>
                      Ny opgave planlagt tidligst om {el.rullerTidligstAntal||4} {el.rullerTidligstEnhed||"uger"} – senest om {el.rullerSenestAntal||6} {el.rullerSenestEnhed||"uger"}
                      {(el.rullerLåsAntal||0)>0?`, låst ${el.rullerLåsAntal} ${el.rullerLåsEnhed||"uger"} inden`:""}
                    </div>
                  </div>
                )}

                {/* 3. Cooldown */}
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="checkbox" checked={el.cooldownAktiv||false} onChange={e=>updEl(i,"cooldownAktiv",e.target.checked)}
                    style={{accentColor:C.pur,width:14,height:14}}/>
                  <span style={{color:el.cooldownAktiv?C.pur:C.txtM,fontSize:12,fontWeight:el.cooldownAktiv?600:400}}>
                    Cooldown — ventetid til næste opgave
                  </span>
                </label>
                {el.cooldownAktiv&&(
                  <div style={{marginLeft:22,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{color:C.txtM,fontSize:11}}>Min. ventetid:</span>
                    <NumEnhedInput value={el["cooldownAntal"]} enhed={el["cooldownEnhed"]||"dage"} onValChange={v=>updEl(i,"cooldownAntal",v)} onEnhedChange={v=>updEl(i,"cooldownEnhed",v)}/>
                  </div>
                )}

                {/* 4. Samme medarbejder */}
                {!erFørste&&(
                  <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                    <input type="checkbox" checked={el.samMed} onChange={e=>updEl(i,"samMed",e.target.checked)}
                      style={{width:14,height:14}}/>
                    <span style={{color:el.samMed?C.acc:C.txtM,fontSize:12,fontWeight:el.samMed?600:400}}>
                      Samme medarbejder som element 1
                    </span>
                  </label>
                )}
              </div>

              {/* -- Tidsvinduer -- */}
              <div style={{paddingLeft:32,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{color:C.txtD,fontSize:11,fontWeight:600,marginBottom:4}}>Tidligst start</div>
                  <input type="time" value={el.tidligst} onChange={e=>updEl(i,"tidligst",e.target.value)}
                    style={{width:"100%",padding:"6px 10px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                </div>
                <div>
                  <div style={{color:C.txtD,fontSize:11,fontWeight:600,marginBottom:4}}>Senest slut</div>
                  <input type="time" value={el.senest} onChange={e=>updEl(i,"senest",e.target.value)}
                    style={{width:"100%",padding:"6px 10px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                </div>
              </div>

              {/* -- Lokaler -- */}
              <div style={{paddingLeft:32,marginBottom:10}}>
                <div style={{color:C.txtD,fontSize:11,fontWeight:600,marginBottom:5}}>Lokaler</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {lokaler.map(l=>(
                    <button key={l} onClick={()=>togElLok(i,l)}
                      style={{background:el.lokaler.includes(l)?C.accM:C.s1,color:el.lokaler.includes(l)?C.acc:C.txtM,
                        border:`1px solid ${el.lokaler.includes(l)?C.acc:C.brd}`,borderRadius:7,
                        padding:"3px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:el.lokaler.includes(l)?600:400}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* -- Udstyr -- */}
              <div style={{paddingLeft:32,marginBottom:10}}>
                <div style={{color:C.txtD,fontSize:11,fontWeight:600,marginBottom:5}}>Krævet udstyr <span style={{color:C.txtM,fontWeight:400}}>(planlæggeren foreslår kun lokaler med alle valgte udstyr)</span></div>
                <UdstyrPanel udstyr={el.udstyr||[]} onChange={v=>updEl(i,"udstyr",v)}/>
              </div>

              {/* -- Certifikat -- */}
              <div style={{paddingLeft:32,marginBottom:10}}>
                <div style={{color:C.txtD,fontSize:11,fontWeight:600,marginBottom:5}}>Certifikatkrav <span style={{color:C.txtM,fontWeight:400}}>(valgfrit)</span></div>
                <select value={el.certifikat||""} onChange={e=>updEl(i,"certifikat",e.target.value)}
                  style={{background:C.s1,border:`1px solid ${C.brd}`,borderRadius:6,padding:"5px 10px",color:el.certifikat?C.txt:C.txtM,fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",maxWidth:380}}>
                  {certOpts.map(o=><option key={o} value={o==="(Intet krav)"?"":o}>{o}</option>)}
                </select>
                {el.certifikat&&<span style={{color:C.amb,fontSize:10,marginLeft:6}}>! {el.certifikat.split("  ")[0]}</span>}
              </div>

              {/* -- E-boks dokument -- */}
              <div style={{paddingLeft:32,paddingTop:8,borderTop:`1px solid ${C.brd}`,marginTop:4}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:el.eBoksAktiv?8:0}}>
                  <input type="checkbox" checked={el.eBoksAktiv||false} onChange={e=>updEl(i,"eBoksAktiv",e.target.checked)}
                    style={{accentColor:C.blue,width:14,height:14}}/>
                  <span style={{color:el.eBoksAktiv?C.blue:C.txtM,fontSize:12,fontWeight:el.eBoksAktiv?600:400}}>
                     Send dokument til e-Boks
                  </span>
                </label>
                {el.eBoksAktiv&&(
                  <div style={{marginLeft:22,display:"flex",flexDirection:"column",gap:8}}>
                    {/* Fil-upload */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <label style={{background:C.accM,color:C.acc,border:`1px solid ${C.acc}44`,borderRadius:7,
                        padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                         Vælg Word/PDF
                        <input type="file" accept=".docx,.pdf,.doc" style={{display:"none"}}
                          onChange={e=>{
                            const file=e.target.files[0];
                            if(file) updEl(i,"eBoksDokNavn",file.name);
                          }}/>
                      </label>
                      {el.eBoksDokNavn&&(
                        <span style={{color:C.txt,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
                           {el.eBoksDokNavn}
                          <button onClick={()=>updEl(i,"eBoksDokNavn",null)}
                            style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,padding:"0 2px"}}>×</button>
                        </span>
                      )}
                      {!el.eBoksDokNavn&&<span style={{color:C.txtM,fontSize:11}}>Intet dokument valgt</span>}
                    </div>
                    {/* Sendingstidspunkt */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:C.txtD,fontSize:11,fontWeight:600}}>Send:</span>
                      <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}>
                        <input type="radio" name={`eboks_tid_${el.id}`} value="lås"
                          checked={(el.eBoksTid||"lås")==="lås"} onChange={()=>updEl(i,"eBoksTid","lås")}
                          style={{accentColor:C.blue}}/>
                        <span style={{fontSize:12,color:C.txt}}>Ved låsning af opgave</span>
                      </label>
                      <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}>
                        <input type="radio" name={`eboks_tid_${el.id}`} value="afslut"
                          checked={el.eBoksTid==="afslut"} onChange={()=>updEl(i,"eBoksTid","afslut")}
                          style={{accentColor:C.blue}}/>
                        <span style={{fontSize:12,color:C.txt}}>Ved afslutning</span>
                      </label>
                    </div>
                    <div style={{background:C.blue+"11",border:`1px solid ${C.blue}22`,borderRadius:6,padding:"5px 10px",color:C.blue,fontSize:11}}>
                      Dokument sendes automatisk til patientens e-Boks {(el.eBoksTid||"lås")==="lås"?"når opgaven låses":"når opgaven markeres afsluttet"}
                    </div>
                  </div>
                )}
              </div>

              </>}
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        {grpFejl&&<span style={{color:C.red,fontSize:12,flex:1}}>{grpFejl}</span>}
        <Btn v="primary" onClick={()=>{
          if(!isValid){setGrpFejl("Angiv gruppenavn, og sørg for at alle elementer har navn og mindst ét lokale");return;}
          setGrpFejl("");
          onSave(f);
        }}>Gem opgave</Btn>
      </div>
    </div>
  );
}

// -- ForlobView (nu OgpvaerView / Opgaver view) -----------------------------

// INIT_CERTIFIKATER flyttet til /src/data/constants.js

function CertifikaterTab({certifikater=[],setCertifikater}){
  const certs=certifikater;
  const setCerts=setCertifikater||(()=>{});
  const [nytNavn, setNytNavn] = React.useState("");
  const [nytBeskrivelse, setNytBeskrivelse] = React.useState("");
  const [nytKategori, setNytKategori] = React.useState("");
  const [fejl, setFejl] = React.useState("");
  const [redigerer, setRedigerer] = React.useState(null);
  const [nyKatNavn, setNyKatNavn] = React.useState("");
  const [editKatId, setEditKatId] = React.useState(null);
  const [editKatNavn, setEditKatNavn] = React.useState("");

  // Kategorier: udled fra certifikater + evt. tomme kategorier gemt i _certKategorier
  const [extraKats, setExtraKats] = React.useState(()=>{try{const s=localStorage.getItem("planmed_certKategorier");return s?JSON.parse(s):[];}catch(e){return[];}});
  const saveExtraKats=(v)=>{setExtraKats(v);try{localStorage.setItem("planmed_certKategorier",JSON.stringify(v));}catch(e){}};

  // Alle kategorier: fra certifikater + ekstra
  const kategorier=React.useMemo(()=>{
    const fraKat=[...new Set(certs.map(c=>c.kategori).filter(Boolean))];
    const ekstra=extraKats.filter(k=>!fraKat.includes(k));
    return[...fraKat,...ekstra].sort();
  },[certs,extraKats]);

  const addKat=()=>{
    const n=nyKatNavn.trim();
    if(!n||kategorier.includes(n))return;
    saveExtraKats([...extraKats,n]);
    setNyKatNavn("");
  };
  const delKat=(kat)=>{
    // Fjern kategori fra alle certifikater i den + fjern fra ekstra
    setCerts(p=>p.map(c=>c.kategori===kat?{...c,kategori:""}:c));
    saveExtraKats(extraKats.filter(k=>k!==kat));
  };
  const renameKat=(oldName,newName)=>{
    const n=newName.trim();if(!n||n===oldName)return;
    setCerts(p=>p.map(c=>c.kategori===oldName?{...c,kategori:n}:c));
    saveExtraKats(extraKats.map(k=>k===oldName?n:k));
    if(nytKategori===oldName) setNytKategori(n);
  };

  const tilfoej = () => {
    if(!nytNavn.trim()){setFejl("Certifikatnavn er paakraevet");return;}
    if(certs.find(cc=>cc.navn.toLowerCase()===nytNavn.trim().toLowerCase())){setFejl("Et certifikat med dette navn findes allerede");return;}
    setCerts(prev=>[...prev,{id:"c"+Date.now(),navn:nytNavn.trim(),beskrivelse:nytBeskrivelse.trim(),kategori:nytKategori}]);
    setNytNavn(""); setNytBeskrivelse(""); setFejl("");
  };

  const slet = (id) => setCerts(prev=>prev.filter(cc=>cc.id!==id));

  // Gruppér certifikater efter kategori
  const udenKat=certs.filter(c=>!c.kategori);
  const medKat=kategorier.map(k=>({kat:k,certs:certs.filter(c=>c.kategori===k)}));

  const CertKort=({cc})=>(
    <div key={cc.id} style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
      {redigerer===cc.id ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
          <Input value={cc.navn} onChange={v=>setCerts(p=>p.map(x=>x.id===cc.id?{...x,navn:v}:x))} placeholder="Certifikatnavn"/>
          <Input value={cc.beskrivelse||""} onChange={v=>setCerts(p=>p.map(x=>x.id===cc.id?{...x,beskrivelse:v}:x))} placeholder="Beskrivelse (valgfri)"/>
          <Sel value={cc.kategori||""} onChange={v=>setCerts(p=>p.map(x=>x.id===cc.id?{...x,kategori:v}:x))}
            options={[{v:"",l:"Ingen kategori"},...kategorier.map(k=>({v:k,l:k}))]}/>
          <Btn v="primary" small onClick={()=>setRedigerer(null)}>Gem</Btn>
        </div>
      ) : (
        <div style={{flex:1}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14}}>{cc.navn}</div>
          {cc.beskrivelse&&<div style={{color:C.txtM,fontSize:12,marginTop:2}}>{cc.beskrivelse}</div>}
        </div>
      )}
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        <Btn v="outline" small onClick={()=>setRedigerer(redigerer===cc.id?null:cc.id)}>~ Rediger</Btn>
        <Btn v="danger" small onClick={()=>slet(cc.id)}>X</Btn>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:700}}>
      <div style={{color:C.txtM,fontSize:12}}>
        Certifikater defineres her og kan tildeles medarbejdere under fanen <strong style={{color:C.txt}}>Medarbejdere</strong>.
        Brug kategorier til at organisere certifikater.
      </div>

      {/* Kategorier administration */}
      <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"14px 16px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:10}}>Kategorier</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {kategorier.map(kat=>(
            <div key={kat} style={{display:"flex",alignItems:"center",gap:4,background:C.accM,border:`1px solid ${C.acc}44`,borderRadius:7,padding:"4px 10px"}}>
              {editKatId===kat?(
                <div style={{display:"flex",gap:4}}>
                  <input value={editKatNavn} onChange={e=>setEditKatNavn(e.target.value)} autoFocus
                    onKeyDown={e=>{if(e.key==="Enter"){renameKat(kat,editKatNavn);setEditKatId(null);}if(e.key==="Escape")setEditKatId(null);}}
                    style={{width:100,padding:"2px 4px",borderRadius:4,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                  <button onClick={()=>{renameKat(kat,editKatNavn);setEditKatId(null);}}
                    style={{background:"none",border:"none",color:C.acc,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>OK</button>
                </div>
              ):(
                <span style={{color:C.acc,fontSize:12,fontWeight:600,cursor:"pointer"}}
                  onClick={()=>{setEditKatId(kat);setEditKatNavn(kat);}}>{kat}</span>
              )}
              <span style={{color:C.txtM,fontSize:10}}>({certs.filter(c=>c.kategori===kat).length})</span>
              <button onClick={()=>delKat(kat)}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:0,lineHeight:1,fontFamily:"inherit"}}>x</button>
            </div>
          ))}
          {kategorier.length===0&&<span style={{color:C.txtM,fontSize:12}}>Ingen kategorier oprettet</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={nyKatNavn} onChange={e=>setNyKatNavn(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addKat();}}
            placeholder="Ny kategori..."
            style={{flex:1,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s3,color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={addKat}
            style={{padding:"6px 14px",borderRadius:7,border:"none",background:C.acc,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            + Kategori
          </button>
        </div>
      </div>

      {/* Certifikater grupperet efter kategori */}
      {medKat.map(({kat,certs:kCerts})=>kCerts.length>0&&(
        <div key={kat}>
          <div style={{color:C.acc,fontWeight:700,fontSize:13,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
            {kat} <Pill color={C.txtM} bg={C.s3} sm>{kCerts.length}</Pill>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {kCerts.map(cc=><CertKort key={cc.id} cc={cc}/>)}
          </div>
        </div>
      ))}

      {/* Uden kategori */}
      {udenKat.length>0&&(
        <div>
          {kategorier.length>0&&<div style={{color:C.txtM,fontWeight:700,fontSize:13,marginBottom:6}}>Uden kategori</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {udenKat.map(cc=><CertKort key={cc.id} cc={cc}/>)}
          </div>
        </div>
      )}

      {certs.length===0&&(
        <div style={{color:C.txtM,textAlign:"center",padding:32,border:"2px dashed "+C.brd,borderRadius:12}}>
          Ingen certifikater oprettet endnu
        </div>
      )}

      {/* Opret nyt */}
      <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"16px 18px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:12}}>+ Opret nyt certifikat</div>
        <FRow label="Certifikatnavn">
          <Input value={nytNavn} onChange={v=>{setNytNavn(v);setFejl("");}} placeholder="f.eks. ADOS-2"/>
        </FRow>
        <FRow label="Beskrivelse (valgfri)">
          <Input value={nytBeskrivelse} onChange={setNytBeskrivelse} placeholder="Kort beskrivelse af certifikatet"/>
        </FRow>
        {kategorier.length>0&&(
          <FRow label="Kategori">
            <Sel value={nytKategori} onChange={setNytKategori}
              options={[{v:"",l:"Ingen kategori"},...kategorier.map(k=>({v:k,l:k}))]}/>
          </FRow>
        )}
        {fejl&&<div style={{color:C.red,fontSize:12,marginBottom:8}}>{fejl}</div>}
        <Btn v="primary" onClick={tilfoej}>Tilfoej certifikat</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// IndsatsPanelModal — oversigt over alle indsatser med stilling
// og masse-tildeling til medarbejdere
// ══════════════════════════════════════════════════════════════
function IndsatsPanelModal({indsatser=[], medarbejdere=[], setIndsatser, setMedarbejdere, onClose, onNy}) {
  const [søg, setSøg] = React.useState("");
  const [valgtTitel, setValgtTitel] = React.useState(null); // til masse-tildeling
  const [tildelStatus, setTildelStatus] = React.useState(null);

  // Gruppér indsatser efter muligeMedarbejdere titler
  const titler = ["Psykolog","Læge","Pædagog"];
  const TITEL_FARVE = {Psykolog:C.acc, Læge:C.grn, Pædagog:C.pur};
  const TITEL_BG    = {Psykolog:C.accM, Læge:C.grnM, Pædagog:C.purM};

  const getTitler = (ind) => {
    const mm = ind.muligeMed||[];
    const fundet = titler.filter(t=>mm.includes(t));
    return fundet.length>0 ? fundet : ["Alle"];
  };

  const filtreret = indsatser.filter(ind=>{
    const match = søg===""||
      (ind.opgave||ind.navn||"").toLowerCase().includes(søg.toLowerCase())||
      getTitler(ind).some(t=>t.toLowerCase().includes(søg.toLowerCase()));
    return match;
  });

  // Masse-tildeling: giv alle medarbejdere med given titel
  // alle indsatser der matcher titlen som kompetence
  const masseTildel = (titel) => {
    const relevante = indsatser.filter(ind=>getTitler(ind).includes(titel));
    const kompNavne = relevante.map(ind=>ind.opgave||ind.navn||"").filter(Boolean);
    if(kompNavne.length===0){setTildelStatus(`Ingen opgaver fundet for ${titel}`);return;}
    let antal=0;
    setMedarbejdere(prev=>prev.map(m=>{
      if(m.titel!==titel) return m;
      const nye=[...new Set([...(m.kompetencer||[]),...kompNavne])];
      if(nye.length!==(m.kompetencer||[]).length) antal++;
      return {...m,kompetencer:nye};
    }));
    setTildelStatus(`OK ${kompNavne.length} opgaver tildelt alle ${titel.toLowerCase()}r (${medarbejdere.filter(m=>m.titel===titel).length} medarbejdere opdateret)`);
    setTimeout(()=>setTildelStatus(null),4000);
  };

  return(
    <Modal title="Opgaveoversigt" onClose={onClose} w={760}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Søg + tilføj */}
        <div style={{display:"flex",gap:8}}>
          <input value={søg} onChange={e=>setSøg(e.target.value)} placeholder="Søg opgave eller stilling..."
            style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.brd}`,
              background:C.s3,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          <Btn v="primary" onClick={onNy}>+ Ny opgave</Btn>
        </div>

        {/* Masse-tildeling sektion */}
        <div style={{background:C.s3,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
          <div style={{fontSize:12,fontWeight:600,color:C.txt,marginBottom:8}}>
            Tildel alle opgaver til stilling
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {titler.map(t=>{
              const antal=indsatser.filter(ind=>getTitler(ind).includes(t)).length;
              const medAntal=medarbejdere.filter(m=>m.titel===t).length;
              return(
                <button key={t} onClick={()=>masseTildel(t)}
                  style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${TITEL_FARVE[t]||C.acc}`,
                    background:TITEL_BG[t]||C.accM,color:TITEL_FARVE[t]||C.acc,
                    fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                    display:"flex",alignItems:"center",gap:6}}>
                  <span>{t}</span>
                  <span style={{opacity:0.7,fontSize:11}}>{antal} opgaver · {medAntal} med.</span>
                </button>
              );
            })}
          </div>
          {tildelStatus&&(
            <div style={{marginTop:8,fontSize:12,color:C.grn,fontWeight:500}}>{tildelStatus}</div>
          )}
        </div>

        {/* Indsats liste grupperet efter stilling */}
        <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:420,overflowY:"auto"}}>
          {filtreret.length===0&&(
            <div style={{color:C.txtM,fontSize:13,textAlign:"center",padding:32}}>
              Ingen opgaver matcher søgningen
            </div>
          )}
          {filtreret.map(ind=>{
            const stilTitler = getTitler(ind);
            const navn = ind.opgave||ind.navn||"Uden navn";
            const min = ind.minutter||60;
            const grp = ind.indsatsGruppe||ind.certifikat||"";
            return(
              <div key={ind.id} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 12px",borderRadius:8,background:C.s2,
                border:`1px solid ${C.brd}44`}}>
                {/* Stilling badges */}
                <div style={{display:"flex",gap:4,flexShrink:0,minWidth:160}}>
                  {stilTitler.map(t=>(
                    <span key={t} style={{padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:700,
                      background:TITEL_BG[t]||C.s3,color:TITEL_FARVE[t]||C.txtM,
                      border:`1px solid ${TITEL_FARVE[t]||C.brd}44`}}>
                      {t}
                    </span>
                  ))}
                </div>
                {/* Navn */}
                <div style={{flex:1,fontSize:13,fontWeight:500,color:C.txt}}>{navn}</div>
                {/* Varighed */}
                <div style={{fontSize:11,color:C.txtM,flexShrink:0}}>{min} min</div>
                {/* Gruppe/certifikat */}
                {grp&&<div style={{fontSize:10,color:C.txtM,background:C.s3,padding:"2px 8px",
                  borderRadius:10,border:`1px solid ${C.brd}`,flexShrink:0}}>{grp}</div>}
                {/* Lokaler */}
                <div style={{fontSize:10,color:C.txtM,flexShrink:0,maxWidth:120,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {(ind.muligeLok||[]).join(", ")||"—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bundlinje */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          borderTop:`1px solid ${C.brd}`,paddingTop:10}}>
          <span style={{fontSize:12,color:C.txtM}}>
            {filtreret.length} af {indsatser.length} opgaver
          </span>
          <Btn v="ghost" onClick={onClose}>Luk</Btn>
        </div>
      </div>
    </Modal>
  );
}


function ForlobView({forlob,setForlob,medarbejdere,setMedarbejdere,indsatser,setIndsatser,certifikater=[],setCertifikater,lokaler=[],setPatienter,adminData={}}){
  const [tab,setTab]=useState("indsatser"); // "indsatser" | "forlob" | "certifikater"

  // -- Indsats state --
  const [editIns, setEditIns]  = useState(null);  // indsats-objekt |
  const [visIndsatsPanel, setVisIndsatsPanel] = useState(false);
  const [tildelTitel, setTildelTitel] = useState(null); // til masse-tildeling "ny"
  const [delIns,  setDelIns]   = useState(null);

  const saveIns = (data) => {
    if(data.id && indsatser.find(x=>x.id===data.id)) {
      setIndsatser(ps=>ps.map(x=>x.id===data.id?data:x));
    } else {
      setIndsatser(ps=>[...ps,{...data,id:`ins_${uid()}`}]);
    }
    setEditIns(null);
  };
  const sletIns = (id) => { setIndsatser(ps=>ps.filter(x=>x.id!==id)); setDelIns(null); };

  // -- Forløb state --
  const [selId,setSelId]=useState(Object.keys(forlob)[0]||"1");
  const [editOpg,setEditOpg]=useState(null);
  const [nytForlob,setNytForlob]=useState(false);
  const [delForlob,setDelForlob]=useState(null);
  const fl=forlob[selId]||[];
  // Filtrer forløb der har mindst ét element ud
const ids=Object.keys(forlob).filter(k=>(forlob[k]||[]).length>0).sort((a,b)=>Number(a)-Number(b));

  // ── Synkroniser forløbsændringer til patienter ──
  // Gen-bygger opgaver fra forløbet og bevarer status/dato fra eksisterende
  const syncForlobTilPatienter = (forlobNr, nyeForlobOpgaver) => {
    setPatienter(ps=>ps.map(p=>{
      if(String(p.forlobNr)!==String(forlobNr)) return p;
      // Byg nye opgaver fra det opdaterede forløb
      const nyBuild = buildPatient({...p, forlobNr}, {[forlobNr]:nyeForlobOpgaver}).opgaver;
      // Bevar planlagt-status fra eksisterende opgaver (match på opgavenavn)
      const merged = nyBuild.map(ny=>{
        const eksist = p.opgaver.find(e=>e.opgave===ny.opgave);
        if(eksist) {
          // Bevar dato/tid/medarbejder/status, men tag ny sekvens
          return {...eksist, sekvens:ny.sekvens, indsatsGruppe:ny.indsatsGruppe};
        }
        return ny;
      });
      // Tilføj manuelt tilføjede opgaver (sekvens >= 999)
      const manuelle = p.opgaver.filter(o=>o.sekvens>=999);
      return {...p, opgaver:[...merged,...manuelle]};
    }));
  };

  const saveOpg=(idx,data)=>{
    let nyeOpgaver;
    setForlob(prev=>{
      nyeOpgaver=[...(prev[selId]||[])];
      if(idx==="ny") nyeOpgaver.push({...data,s:nyeOpgaver.length+1});
      else nyeOpgaver[idx]={...data,s:idx+1};
      return {...prev,[selId]:nyeOpgaver};
    });
    setEditOpg(null);
    // Sync sekvens til patienter
    setTimeout(()=>{if(nyeOpgaver) syncForlobTilPatienter(selId, nyeOpgaver);},0);
  };
  const deleteOpg=(idx)=>{
    let nyeOpgaver;
    setForlob(prev=>{
      nyeOpgaver=(prev[selId]||[]).filter((_,i)=>i!==idx).map((o,i)=>({...o,s:i+1}));
      return {...prev,[selId]:nyeOpgaver};
    });
    setTimeout(()=>{if(nyeOpgaver) syncForlobTilPatienter(selId, nyeOpgaver);},0);
  };
  const moveOpg=(idx,dir)=>{
    let nyeOpgaver;
    setForlob(prev=>{
      nyeOpgaver=[...(prev[selId]||[])];
      const ni=idx+dir;
      if(ni<0||ni>=nyeOpgaver.length) return prev;
      [nyeOpgaver[idx],nyeOpgaver[ni]]=[nyeOpgaver[ni],nyeOpgaver[idx]];
      nyeOpgaver=nyeOpgaver.map((o,i)=>({...o,s:i+1}));
      return {...prev,[selId]:nyeOpgaver};
    });
    setTimeout(()=>{if(nyeOpgaver) syncForlobTilPatienter(selId, nyeOpgaver);},0);
  };
  const opretForlob=()=>{
    const nk=String(Math.max(0,...Object.keys(forlob).map(Number))+1);
    setForlob(prev=>({...prev,[nk]:[]}));
    setSelId(nk);
    setNytForlob(false);
  };
  const sletForlob=(id)=>{
    // Fjern forløb-tilknytning fra patienter der bruger dette forløb
    setPatienter(ps=>ps.map(p=>p.forlobNr==id?{...p,forlobNr:null,forlobLabel:null,opgaver:p.opgaver.filter(o=>o.fraForlob!==id)}:p));
    setForlob(prev=>{const n={...prev};delete n[id];return n;});
    setSelId(ids.find(i=>i!==id)||ids[0]||"1");
    setDelForlob(null);
  };

  // -- Medarbejder CRUD (Certifikater-tab) --
  const [medSøg,setMedSøg]=useState("");
  const [medFilt,setMedFilt]=useState("alle");
  const [editMed,setEditMed]=useState(null);
  const [delMed,setDelMed]=useState(null);
  const filtMed=medarbejdere.filter(m=>{
    if(medFilt!=="alle"&&m.titel!==medFilt) return false;
    if(medSøg&&!m.navn.toLowerCase().includes(medSøg.toLowerCase())) return false;
    return true;
  });
  const saveMed=(data)=>{
    if(data.id){ setMedarbejdere(ms=>ms.map(m=>m.id===data.id?{...m,...data}:m)); }
    else { setMedarbejdere(ms=>[...ms,{...data,id:`m_${uid()}`}]); }
    setEditMed(null);
  };
  const sletMed=(id)=>{ setMedarbejdere(ms=>ms.filter(m=>m.id!==id)); setDelMed(null); };

  // -- Tab bar --
  const TABS = [
    {id:"indsatser",   label:" Opgaver"},
    {id:"forlob",      label:" Forløb"},
    {id:"certifikater",label:"* Certifikater"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 140px)",gap:0}}>
      <ViewHeader titel="Opgaver" undertitel="Forløbstyper og opgaveskabeloner"/>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:tab===t.id?C.accM:"transparent",color:tab===t.id?C.acc:C.txtD,border:`1px solid ${tab===t.id?C.acc:C.brd}`,borderRadius:8,padding:"7px 16px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===t.id?700:400}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* -- TAB: INDSATSER -- */}
      {tab==="indsatser"&&(
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <div style={{display:"flex",gap:6}}>
              <Btn v="outline" onClick={()=>setVisIndsatsPanel(true)}>Opgaveoversigt</Btn>
              <Btn v="primary" onClick={()=>setEditIns("ny")}>+ Ny opgave</Btn>
            </div>
          </div>

          {indsatser.length===0&&(
            <div style={{color:C.txtM,textAlign:"center",padding:40,border:`2px dashed ${C.brd}`,borderRadius:12}}>
              Ingen opgaver endnu - klik + Ny opgave
            </div>
          )}

          {indsatser.map(ins=>{
            // Understøt både gammelt format (elementer) og nyt fladt format (fra Excel)
            const isFlad = !ins.elementer && (ins.opgave||ins.muligeMed);
            const els = isFlad
              ? [{id:ins.id,opgave:ins.opgave||ins.navn||"",minutter:ins.minutter||60,
                  muligeMed:ins.muligeMed||[],muligeLok:ins.muligeLok||[],
                  certifikat:ins.certifikat||"",samMed:false,patInv:ins.patInv||false,
                  tidligst:ins.tidligst||"08:00",senest:ins.senest||"17:00",sekvens:ins.sekvens||1}]
              : (ins.elementer||[]);
            const insNavn = ins.indsatsGruppe||ins.navn||ins.opgave||"(uden navn)";
            const samMedCount = els.filter(e=>e.samMed).length;
            const certCount   = els.filter(e=>e.certifikat).length;
            const totalMin    = isFlad ? (ins.minutter||60) : els.reduce((a,e)=>a+e.minutter,0);
            return(
              <div key={ins.id} style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1}}>
                    {/* Gruppenavn + totaltid */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{color:C.txt,fontWeight:800,fontSize:15}}>{insNavn}</div>
                      <Pill color={C.acc} bg={C.accM} sm>{els.length} elementer</Pill>
                      <Pill color={C.txtD} bg={C.s3} sm>{totalMin} min total</Pill>
                      {certCount>0&&<Pill color={C.amb} bg={C.ambM} sm>* {certCount} cert.krav</Pill>}
                    </div>
                    {/* Sekvensvisning */}
                    {els.length>0&&(
                      <div style={{background:C.s3,borderRadius:8,padding:"8px 12px"}}>
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {els.map((el,i)=>{
                            const erFørste = i===0;
                            const numC = erFørste ? C.acc : C.pur;
                            return(
                              <div key={el.id} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
                                <div style={{width:20,height:20,borderRadius:"50%",background:`${numC}22`,color:numC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{i+1}</div>
                                <span style={{color:C.txt,fontWeight:600,minWidth:110}}>{el.opgave||el.navn||"(uden navn)"}</span>
                                <Pill color={C.acc} bg={C.accM} sm>{el.minutter} min</Pill>
                                {el.patInv&&<Pill color={C.grn} bg={C.grnM} sm> Patient</Pill>}
                                {!erFørste&&el.samMed&&<Pill color={C.acc} bg={C.accM} sm>= med.</Pill>}
                                {erFørste&&<Pill color={C.txtD} bg={C.s1} sm>sætter med.</Pill>}
                                {el.certifikat&&<Pill color={C.amb} bg={C.ambM} sm>* {el.certifikat.split("  ")[0]}</Pill>}
                                {(el.lokaler||[]).slice(0,3).map(l=><Pill key={l} color={C.blue} bg={C.blueM} sm>{l}</Pill>)}
                                {(el.lokaler||[]).length>3&&<span style={{color:C.txtM,fontSize:10}}>+{el.lokaler.length-3}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>setEditIns(ins)} style={{background:C.s1,color:C.txtD,border:`1px solid ${C.brd}`,borderRadius:7,padding:"4px 11px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>~ Rediger</button>
                    <button onClick={()=>setDelIns(ins)} style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>X</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- TAB: FORLØB -- */}
      {tab==="forlob"&&(
        <div style={{display:"flex",gap:12,flex:1,overflow:"hidden"}}>
          <div style={{width:190,flexShrink:0,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.txt,fontWeight:700,fontSize:13}}>Forløb</span>
              <button onClick={()=>setNytForlob(true)} style={{background:C.accM,color:C.acc,border:`1px solid ${C.acc}44`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700}}>+ Ny</button>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {ids.map(k=>{
                const act=selId===k;
                return(
                  <div key={k} onClick={()=>setSelId(k)} style={{padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.brd}`,background:act?C.accM:"transparent",borderLeft:`3px solid ${act?C.acc:"transparent"}`,display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.txt,fontSize:12,fontWeight:act?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Forløb nr. {k}</div>
                      <div style={{color:C.txtM,fontSize:10,marginTop:1}}>{forlob[k]?.length||0} opgaver</div>
                    </div>
                    {act&&<button onClick={e=>{e.stopPropagation();setDelForlob(k)}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:11,padding:"1px 3px",flexShrink:0}}>X</button>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{flex:1,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:C.txt,fontWeight:800,fontSize:16}}>Forløb nr. {selId}</div>
                <div style={{color:C.txtM,fontSize:12}}>{fl.length} opgaver . {fl.filter(x=>x.p).length} med patient . {fl.reduce((a,x)=>a+x.m,0)} min total</div>
              </div>
              <Btn v="primary" onClick={()=>setEditOpg({idx:"ny",data:{o:ALLE_K[0],m:45,p:false,tl:"08:00",ss:"17:00",l:["Kontor"]}})} small>+ Ny opgave</Btn>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:10}}>
              {fl.length===0&&<div style={{color:C.txtM,padding:24,textAlign:"center"}}>Ingen opgaver endnu. Tilføj en opgave ovenfor.</div>}
              {fl.map((f,i)=>{
                const isLæge=f.o.includes("Læge"),isPsy=f.o.includes("Psykolog"),isPæd=f.o.includes("Pædagog");
                const c=isLæge?C.acc:isPsy?C.blue:isPæd?C.pur:C.txtD;
                const kompMed=BASE_MED.filter(m=>m.kompetencer.includes(f.o)).length;
                return(
                  <div key={i} style={{background:C.s3,borderRadius:9,padding:"10px 13px",marginBottom:6,border:`1px solid ${C.brd}`,display:"flex",gap:9,alignItems:"flex-start"}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:`${c}22`,color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{f.s}</div>
                      <button onClick={()=>moveOpg(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?C.txtM:C.txtD,cursor:i===0?"default":"pointer",fontSize:10,padding:0,lineHeight:1}}>^</button>
                      <button onClick={()=>moveOpg(i,1)} disabled={i===fl.length-1} style={{background:"none",border:"none",color:i===fl.length-1?C.txtM:C.txtD,cursor:i===fl.length-1?"default":"pointer",fontSize:10,padding:0,lineHeight:1}}>v</button>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.txt,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.o}</div>
                      <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                        <Pill color={c} bg={`${c}18`} sm>{f.m} min</Pill>
                        {f.p&&<Pill color={C.grn} bg={C.grnM} sm> Patient</Pill>}
                        <Pill color={C.txtD} bg={C.s1} sm>{f.tl}-{f.ss}</Pill>
                        <Pill color={C.pur} bg={C.purM} sm>{kompMed} medarbej.</Pill>
                        {f.l.map(l=><Pill key={l} color={C.blue} bg={C.blueM} sm>{l}</Pill>)}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:5,flexShrink:0}}>
                      <button onClick={()=>setEditOpg({idx:i,data:{...f}})} style={{background:C.s1,color:C.txtD,border:`1px solid ${C.brd}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>~ Rediger</button>
                      <button onClick={()=>deleteOpg(i)} style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>X</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -- TAB: CERTIFIKATER -- */}
      {tab==="certifikater"&&(
        <CertifikaterTab certifikater={certifikater} setCertifikater={setCertifikater}/>
      )}

      {/* -- Modals: Indsats -- */}
      {visIndsatsPanel&&<IndsatsPanelModal indsatser={indsatser} medarbejdere={medarbejdere} setIndsatser={setIndsatser} setMedarbejdere={setMedarbejdere} onClose={()=>setVisIndsatsPanel(false)} onNy={()=>{setVisIndsatsPanel(false);setEditIns("ny");}}/>}
      {editIns&&(
        <Modal title={editIns==="ny"?"Ny opgave":`Rediger: ${editIns.navn||"opgave"}`} onClose={()=>setEditIns(null)} w={680}>
          <IndsatsForm indsats={editIns==="ny"?null:editIns} onSave={saveIns} onClose={()=>setEditIns(null)} lokaler={lokaler}/>
        </Modal>
      )}
      {delIns&&(
        <Modal title="Slet opgave?" onClose={()=>setDelIns(null)} w={400}>
          <div style={{color:C.txtD,marginBottom:16,lineHeight:1.6}}>
            Slet <strong style={{color:C.txt}}>{delIns.navn}</strong> med {delIns.elementer?.length||0} elementer?
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelIns(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>sletIns(delIns.id)}>Slet permanent</Btn>
          </div>
        </Modal>
      )}

      {/* -- Modals: Forløb -- */}
      {editOpg&&(
        <Modal title={editOpg.idx==="ny"?"Ny opgave":"Rediger opgave"} onClose={()=>setEditOpg(null)} w={600}>
          <OpgaveForm data={editOpg.data} onSave={d=>saveOpg(editOpg.idx,d)} onClose={()=>setEditOpg(null)} lokaler={lokaler}/>
        </Modal>
      )}
      {nytForlob&&(
        <Modal title="Nyt forløb" onClose={()=>setNytForlob(false)} w={400}>
          <div style={{color:C.txtD,marginBottom:12,fontSize:13}}>Et nyt tomt forløb oprettes som nr. {Math.max(0,...Object.keys(forlob).map(Number))+1}.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setNytForlob(false)}>Annuller</Btn>
            <Btn v="primary" onClick={()=>opretForlob()}>Opret forløb</Btn>
          </div>
        </Modal>
      )}
      {delForlob&&(
        <Modal title="Slet forløb?" onClose={()=>setDelForlob(null)} w={400}>
          <div style={{color:C.txtD,marginBottom:16,lineHeight:1.6}}>Slet <strong style={{color:C.txt}}>Forløb nr. {delForlob}</strong> med {forlob[delForlob]?.length||0} opgaver?</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelForlob(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>sletForlob(delForlob)}>Slet permanent</Btn>
          </div>
        </Modal>
      )}

      {/* -- Modals: Medarbejder -- */}
      {editMed&&(
        <Modal title={editMed==="ny"?"Ny medarbejder":`Rediger: ${editMed.navn}`} onClose={()=>setEditMed(null)} w={680}>
          <MedForm med={editMed==="ny"?null:editMed} onSave={saveMed} onClose={()=>setEditMed(null)} adminData={adminData}/>
        </Modal>
      )}
      {delMed&&(
        <Modal title="Slet medarbejder?" onClose={()=>setDelMed(null)} w={380}>
          <div style={{color:C.txtD,marginBottom:14}}>Slet <strong style={{color:C.txt}}>{delMed.navn}</strong>?</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelMed(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>sletMed(delMed.id)}>Slet</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// -- OpgaveForm (bruges i Forløb-tab) ----------------------------
function OpgaveForm({data,onSave,onClose,lokaler=[]}){
  const [grpFejl,setGrpFejl]=useState("");
  const [f,setF]=useState({o:data?.o||ALLE_K[0],m:data?.m||45,p:data?.p||false,tl:data?.tl||"08:00",ss:data?.ss||"17:00",l:data?.l||[],udstyr:Array.isArray(data?.udstyr)?[...data.udstyr]:[]});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const togLok=(l)=>setF(p=>({...p,l:p.l.includes(l)?p.l.filter(x=>x!==l):[...p.l,l]}));
  const kompMed=BASE_MED.filter(m=>m.kompetencer.includes(f.o));
  const grps=[{label:"Psykolog",c:C.blue,ks:PK},{label:"Pædagog",c:C.pur,ks:PD},{label:"Læge",c:C.acc,ks:LK}];
  return(
    <div>
      <FRow label="Opgavetype">
        <Sel value={f.o} onChange={v=>s("o",v)} style={{width:"100%"}} options={grps.flatMap(g=>[{v:`__${g.label}__`,l:`-- ${g.label} --`,disabled:true},...g.ks.map(k=>({v:k,l:k}))])}/>
        <div style={{color:C.txtM,fontSize:11,marginTop:4}}>{kompMed.length} medarbejdere har denne kompetence</div>
      </FRow>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <FRow label="Varighed (min)"><Input type="number" value={f.m} onChange={v=>s("m",Number(v))}/></FRow>
        <FRow label="Tidligst start"><Input type="time" value={f.tl} onChange={v=>s("tl",v)}/></FRow>
        <FRow label="Senest slut"><Input type="time" value={f.ss} onChange={v=>s("ss",v)}/></FRow>
      </div>
      <FRow label="Patientdeltagelse">
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <input type="checkbox" checked={f.p} onChange={e=>s("p",e.target.checked)}/>
          <span style={{color:C.txt,fontSize:13}}>Patient er til stede</span>
        </label>
      </FRow>
      <FRow label="Mulige lokaler">
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {lokaler.map(l=>{const on=f.l.includes(l);return(
            <button key={l} onClick={()=>togLok(l)} style={{background:on?C.blueM:"transparent",color:on?C.blue:C.txtM,border:`1px solid ${on?C.blue:C.brd}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:on?700:400}}>{l}</button>
          );})}
        </div>
        {f.l.length===0&&<div style={{color:C.red,fontSize:11,marginTop:4}}>Mindst ét lokale skal vælges</div>}
      </FRow>
      <FRow label="Udstyr" hint="Planlæggeren foreslår kun lokaler, der har alle valgte udstyr">
        <UdstyrPanel udstyr={f.udstyr} onChange={v=>s("udstyr",v)}/>
      </FRow>
      <div style={{background:C.s3,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:C.txtD}}>
        <span style={{color:C.txt,fontWeight:600}}>Kompetente medarbejdere: </span>
        {kompMed.length===0?"Ingen":kompMed.slice(0,8).map(m=><span key={m.id} style={{marginRight:4,color:TITLE_C[m.titel]||C.acc}}>{m.navn}</span>)}
        {kompMed.length>8&&<span style={{color:C.txtM}}>+{kompMed.length-8} flere</span>}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <div style={{flex:1}}>{f.l.length===0&&<span style={{color:C.red,fontSize:12}}>Vælg mindst ét lokale</span>}</div>
        <Btn v="primary" onClick={()=>{if(f.l.length===0)return;onSave(f);}}>Gem opgave</Btn>
      </div>
    </div>
  );
}

// Hjælpe-komponent: blød/hård toggle
function StrenghedToggle({value, onChange}) {
  return(
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

// ── Planlægningsindstillinger (genbruges i Planlæg-fanen) ──
function KompetenceTilfoej({kompetencer, onChange, alleK=[]}) {
  const [søg, setSøg] = React.useState("");
  const [vis, setVis] = React.useState(false);
  const forslag = søg.length > 0
    ? [...new Set([...alleK,...kompetencer])].filter(k=>k.toLowerCase().includes(søg.toLowerCase())&&!kompetencer.includes(k)).slice(0,8)
    : [];
  const tilføj = (k) => { onChange([...kompetencer, k]); setSøg(""); setVis(false); };
  const tilføjNy = () => { if(søg.trim()&&!kompetencer.includes(søg.trim())) tilføj(søg.trim()); };
  return(
    <div style={{position:"relative",marginTop:6}}>
      <div style={{display:"flex",gap:6}}>
        <input value={søg} onChange={e=>{setSøg(e.target.value);setVis(true);}}
          onFocus={()=>setVis(true)} onBlur={()=>setTimeout(()=>setVis(false),150)}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();tilføjNy();}}}
          placeholder="Tilføj kompetence..."
          style={{flex:1,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.brd}`,
            background:C.s3,color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
        <button onClick={tilføjNy} style={{padding:"6px 14px",borderRadius:7,border:"none",
          background:C.acc,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          + Tilføj
        </button>
      </div>
      {vis&&forslag.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.s1,
          border:`1px solid ${C.brd}`,borderRadius:8,zIndex:100,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",
          maxHeight:200,overflowY:"auto",marginTop:3}}>
          {forslag.map(k=>(
            <div key={k} onMouseDown={()=>tilføj(k)}
              style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:C.txt,
                borderBottom:`1px solid ${C.brd}44`}}
              onMouseEnter={e=>e.target.style.background=C.s3}
              onMouseLeave={e=>e.target.style.background="transparent"}>
              {k}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MinProfilPanel({med, medarbejdere, certifikater=[], onSave=()=>{}, onSendAnmodning, onDelete=null, isAdmin=false, adminData={}}){
  const dagNavne=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"];
  const defaultDage=Object.fromEntries(dagNavne.map(d=>([d,{aktiv:["Mandag","Tirsdag","Onsdag","Torsdag","Fredag"].includes(d),start:"08:30",slut:"16:00"}])));
  const [tab,setTab]=useState("stamdata");
  const [gemt,setGemt]=useState(false);
  const [visAnmodning,setVisAnmodning]=useState(false);
  const [visSlet,setVisSlet]=useState(false);
  const [valgtLeder,setValgtLeder]=useState("");
  const [kommentar,setKommentar]=useState("");

  const [f,setF]=useState({
    navn:med?.navn||"",
    titel:med?.titel||"Psykolog",
    timer:med?.timer||23,
    mail:med?.mail||"",
    telefon:med?.telefon||"",
    leder:med?.leder||"",
    afdeling:med?.afdeling||"a1",
    arbejdsstedNavn:med?.arbejdsstedNavn||"",
    arbejdsstedVej:med?.arbejdsstedVej||"",
    arbejdsstedPostnr:med?.arbejdsstedPostnr||"",
    arbejdsstedBy:med?.arbejdsstedBy||"",
    hjemVej:med?.hjemVej||"",
    hjemPostnr:med?.hjemPostnr||"",
    hjemBy:med?.hjemBy||"",
    medarbejderId:med?.medarbejderId||"",
    epjKalenderApi:med?.epjKalenderApi||"",
    kompetencer:(med?.kompetencer&&med.kompetencer.length>0)?med.kompetencer:(()=>{const t=med?.titel||"Psykolog";return t==="Læge"?[...LK]:t==="Pædagog"?[...PD]:[...PK];})(),
    arbejdsdage:med?.arbejdsdage||defaultDage,
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const togK=(k)=>set("kompetencer",f.kompetencer.includes(k)?f.kompetencer.filter(x=>x!==k):[...f.kompetencer,k]);
  const setDag=(dag,field,val)=>setF(p=>({...p,arbejdsdage:{...p.arbejdsdage,[dag]:{...p.arbejdsdage[dag],[field]:val}}}));

  const gemDirekte=()=>{
    onSave({...med,...f,timer:Number(f.timer)});
    setGemt(true);
    setTimeout(()=>setGemt(false),2000);
  };

  const afdNavn={a1:"Psykiatri Nord",a2:"Børne-psykiatri",a3:"Ungdomspsykiatri"};
  const ledere=medarbejdere.filter(m=>m.id!==med?.id&&m.mail);

  const sendAnmodning=()=>{
    if(!valgtLeder){return;}
    const leder=ledere.find(l=>l.id===valgtLeder);
    onSendAnmodning({
      id:"anm"+Date.now(),
      medId:med?.id,medNavn:med?.navn,medEmail:med?.mail||"",
      lederNavn:leder?.navn,lederEmail:leder?.mail||"",
      tidspunkt:new Date().toISOString(),
      ændringer:[{felt:"Profilopdatering",fra:"Se detaljer",til:"Se detaljer"}],
      nyProfil:{...f},kommentar,status:"afventer",
    });
    setVisAnmodning(false);setKommentar("");
  };

  const tabs=[
    {id:"stamdata",label:"Stamdata"},
    {id:"kompetencer",label:"Kompetencer"},
    {id:"arbejdstider",label:"Arbejdstider"},
    {id:"adresse",label:"Adresse"},
    {id:"kapacitet",label:"Kapacitet"},
    {id:"system",label:"System"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* Header */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:"12px 12px 0 0",padding:"16px 20px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:C.accM,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:C.acc,flexShrink:0}}>
          {(med?.navn||"?")[0]}
        </div>
        <div style={{flex:1}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:16}}>{med?.navn}</div>
          <div style={{color:C.txtM,fontSize:12}}>{med?.titel} · {afdNavn[med?.afdeling]||med?.afdeling||""}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {onSendAnmodning&&<Btn v="ghost" onClick={()=>setVisAnmodning(true)}>Send til godkendelse</Btn>}
          <Btn v="primary" onClick={gemDirekte}>{gemt?"Gemt":"Gem profil"}</Btn>
          {isAdmin&&onDelete&&<Btn v="danger" onClick={()=>setVisSlet(true)}>Slet medarbejder</Btn>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.brd}`,background:C.s2,borderLeft:`1px solid ${C.brd}`,borderRight:`1px solid ${C.brd}`}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.acc:"transparent"}`,
              color:tab===t.id?C.acc:C.txtM,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",
              fontSize:13,fontWeight:tab===t.id?700:400}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderTop:"none",borderRadius:"0 0 12px 12px",padding:"20px"}}>

        {/* STAMDATA */}
        {tab==="stamdata"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <FRow label="Navn"><Input value={f.navn} onChange={v=>set("navn",v)} placeholder="Navn Navnesen"/></FRow>
              <FRow label="Mail"><Input value={f.mail} onChange={v=>set("mail",v)} placeholder="navn@klinik.dk"/></FRow>
              <FRow label="Telefon"><Input value={f.telefon} onChange={v=>set("telefon",v)} placeholder="20 30 40 50"/></FRow>
              <FRow label="Timer pr. uge"><Input type="number" value={f.timer} onChange={v=>set("timer",v)} min="1" max="40"/></FRow>
              <FRow label="Leder"><Input value={f.leder} onChange={v=>set("leder",v)} placeholder="Leders navn"/></FRow>
              <FRow label="Afdeling">
                <select value={f.afdeling} onChange={e=>set("afdeling",e.target.value)}
                  style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
                  <option value="a1">Psykiatri Nord</option>
                  <option value="a2">Børne-psykiatri</option>
                  <option value="a3">Ungdomspsykiatri</option>
                </select>
              </FRow>
            </div>
            <FRow label={`Timepris (${valutaSymbol(adminData?.valuta)}/t)`}>
                <Input type="number" value={f.krPrTime||""} onChange={v=>set("krPrTime",v?Number(v):null)}
                  placeholder="Fra admin-standard"/>
              </FRow>
            <FRow label="Titel">
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {((adminData?.titler||[]).map(t=>t.navn)).map(t=>{
                  const titelObj=(adminData?.titler||[]).find(x=>x.navn===t);
                  const farve=titelObj?.farve||TITLE_C[t]||C.acc;
                  return(
                    <button key={t} onClick={()=>set("titel",t)}
                      style={{flex:1,minWidth:90,background:f.titel===t?farve+"22":"transparent",color:f.titel===t?farve:C.txtM,
                        border:`1px solid ${f.titel===t?farve:C.brd}`,borderRadius:8,padding:"8px 0",
                        cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13}}>{t}</button>
                  );
                })}
              </div>
            </FRow>
          </div>
        )}

        {/* KOMPETENCER */}
        {tab==="kompetencer"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {(()=>{
                  // Gruppér kompetencer efter stillingstitlen
                  const titler=[
                    {id:"Psykolog", label:"Psykolog", komp:PK},
                    {id:"Læge",     label:"Læge",     komp:LK},
                    {id:"Pædagog",  label:"Pædagog",  komp:PD},
                  ];
                  // Egne kompetencer der ikke hører til nogen standardgruppe
                  const egne=(f.kompetencer||[]).filter(k=>![...PK,...LK,...PD].includes(k));
                  const grupper=[...titler, ...(egne.length>0?[{id:"egne",label:"Øvrige",komp:egne}]:[])];
                  return grupper.map(({id,label,komp})=>{
                    // Kombiner standard-kompetencer med egne fra denne titel
                    const alleIGruppe=[...komp,...(f.kompetencer||[]).filter(k=>komp.includes(k))].filter((k,i,a)=>a.indexOf(k)===i);
                    const alleMarkeret=alleIGruppe.every(k=>(f.kompetencer||[]).includes(k));
                    const nogenMarkeret=alleIGruppe.some(k=>(f.kompetencer||[]).includes(k));
                    const togAlle=()=>{
                      if(alleMarkeret){
                        // Fjern alle i gruppen
                        set("kompetencer",(f.kompetencer||[]).filter(k=>!alleIGruppe.includes(k)));
                      } else {
                        // Tilføj alle i gruppen
                        const ny=[...(f.kompetencer||[]),...alleIGruppe].filter((k,i,a)=>a.indexOf(k)===i);
                        set("kompetencer",ny);
                      }
                    };
                    return(
                      <div key={id}>
                        {/* Overskrift — klik markerer/afmarkerer alle */}
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer"}}
                          onClick={togAlle}>
                          <div style={{
                            padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:700,
                            background:alleMarkeret?C.acc:nogenMarkeret?C.accM:"transparent",
                            color:alleMarkeret?"#fff":nogenMarkeret?C.acc:C.txtD,
                            border:`1px solid ${alleMarkeret?C.acc:nogenMarkeret?C.acc:C.brd}`,
                            userSelect:"none",transition:"all .15s"
                          }}>
                            {label}
                          </div>
                          <div style={{height:1,flex:1,background:C.brd}}/>
                          <span style={{fontSize:10,color:C.txtM}}>
                            {(f.kompetencer||[]).filter(k=>alleIGruppe.includes(k)).length}/{alleIGruppe.length}
                          </span>
                        </div>
                        {/* Kompetencer */}
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {alleIGruppe.map(k=>(
                            <button key={k} onClick={e=>{e.stopPropagation();togK(k);}}
                              style={{background:(f.kompetencer||[]).includes(k)?C.accM:"transparent",
                                color:(f.kompetencer||[]).includes(k)?C.acc:C.txtM,
                                border:`1px solid ${(f.kompetencer||[]).includes(k)?C.acc:C.brd}`,
                                borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",
                                fontSize:11,fontWeight:(f.kompetencer||[]).includes(k)?700:400,
                                transition:"all .12s"}}>
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div>
              <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:8}}>Certifikater</div>
              {(certifikater||[]).length===0
                ?<div style={{color:C.txtM,fontSize:12,padding:"10px 0"}}>Ingen certifikater oprettet i systemet endnu.</div>
                :<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(certifikater||[]).map(cert=>{
                    const harCert=(f.certifikater||[]).includes(cert.id||cert.navn);
                    const cid=cert.id||cert.navn;
                    return(
                      <button key={cid}
                        onClick={()=>setF(p=>({...p,certifikater:harCert
                          ?(p.certifikater||[]).filter(x=>x!==cid)
                          :[...(p.certifikater||[]),cid]}))}
                        style={{background:harCert?"#0050b322":"transparent",
                          color:harCert?"#0050b3":C.txtM,
                          border:`1px solid ${harCert?"#0050b3":C.brd}`,
                          borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",
                          fontSize:12,fontWeight:harCert?700:400}}>
                        {cert.navn||cert}
                      </button>
                    );
                  })}
                </div>
              }
            </div>
          </div>
        )}

        {/* ARBEJDSTIDER */}
        {tab==="arbejdstider"&&(
          <div style={{border:`1px solid ${C.brd}`,borderRadius:9,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 44px 90px 90px",padding:"7px 12px",background:C.s3,gap:8}}>
              {["Dag","Aktiv","Start","Slut"].map(h=><span key={h} style={{color:C.txtM,fontSize:11,fontWeight:600}}>{h}</span>)}
            </div>
            {dagNavne.map(dag=>{
              const d=f.arbejdsdage[dag]||{aktiv:false,start:"08:30",slut:"16:00"};
              return(
                <div key={dag} style={{display:"grid",gridTemplateColumns:"110px 44px 90px 90px",padding:"7px 12px",borderTop:`1px solid ${C.brd}`,gap:8,alignItems:"center",background:d.aktiv?C.s2:C.s3}}>
                  <span style={{color:d.aktiv?C.txt:C.txtM,fontSize:13,fontWeight:d.aktiv?600:400}}>{dag}</span>
                  <input type="checkbox" checked={d.aktiv} onChange={e=>setDag(dag,"aktiv",e.target.checked)} style={{width:18,height:18,cursor:"pointer",accentColor:C.acc}}/>
                  {d.aktiv?<>
                    <input type="time" value={d.start} onChange={e=>setDag(dag,"start",e.target.value)}
                      style={{padding:"4px 6px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                    <input type="time" value={d.slut} onChange={e=>setDag(dag,"slut",e.target.value)}
                      style={{padding:"4px 6px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                  </>:<><span style={{color:C.txtM,fontSize:12}}>—</span><span/></>}
                </div>
              );
            })}
          </div>
        )}

        {/* ADRESSE */}
        {tab==="adresse"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:8}}>Arbejdssted</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Navn på arbejdssted"><Input value={f.arbejdsstedNavn} onChange={v=>set("arbejdsstedNavn",v)} placeholder="Aarhus Universitetshospital"/></FRow>
                <FRow label="Vejnavn"><Input value={f.arbejdsstedVej} onChange={v=>set("arbejdsstedVej",v)} placeholder="Palle Juul-Jensens Boulevard 99"/></FRow>
                <FRow label="Postnummer"><Input value={f.arbejdsstedPostnr} onChange={v=>set("arbejdsstedPostnr",v)} placeholder="8200"/></FRow>
                <FRow label="By"><Input value={f.arbejdsstedBy} onChange={v=>set("arbejdsstedBy",v)} placeholder="Aarhus N"/></FRow>
              </div>
            </div>
            <div>
              <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:8}}>Hjemadresse</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Vejnavn"><Input value={f.hjemVej} onChange={v=>set("hjemVej",v)} placeholder="Eksempelvej 12"/></FRow>
                <FRow label="Postnummer"><Input value={f.hjemPostnr} onChange={v=>set("hjemPostnr",v)} placeholder="8000"/></FRow>
                <FRow label="By"><Input value={f.hjemBy} onChange={v=>set("hjemBy",v)} placeholder="Aarhus C"/></FRow>
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM */}
        {tab==="kapacitet"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:C.s3,borderRadius:9,padding:"14px 16px",border:`1px solid ${C.brd}`}}>
              <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:12}}>Fast kapacitetsgrænse</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Grænse pr.">
                  <select value={f.kapacitet?.grænseType||"uge"} onChange={e=>set("kapacitet",{...f.kapacitet,grænseType:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
                    {KAP_TYPER.map(kt=><option key={kt.id} value={kt.id}>{kt.label}</option>)}
                  </select>
                </FRow>
                <FRow label={`Max timer (${(KAP_TYPER.find(k=>k.id===(f.kapacitet?.grænseType||"uge"))||{}).label||"uge"})`}>
                  <Input type="number" value={f.kapacitet?.grænseTimer||f.timer||23} min="0" max="500"
                    onChange={v=>set("kapacitet",{...f.kapacitet,grænseTimer:Number(v)})}/>
                </FRow>
                {(f.kapacitet?.grænseType||"uge")==="ialt"&&<>
                  <FRow label="Fra dato">
                    <input type="date" value={f.kapacitet?.ialtFra||""} onChange={e=>set("kapacitet",{...f.kapacitet,ialtFra:e.target.value})}
                      style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                  </FRow>
                  <FRow label="Til dato">
                    <input type="date" value={f.kapacitet?.ialtTil||""} onChange={e=>set("kapacitet",{...f.kapacitet,ialtTil:e.target.value})}
                      style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                  </FRow>
                </>}
              </div>
            </div>
            <div style={{background:C.s3,borderRadius:9,padding:"14px 16px",border:`1px solid ${C.brd}`}}>
              <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:12}}>Rullende gennemsnit</div>
              <div style={{color:C.txtM,fontSize:12,marginBottom:10}}>Max gennemsnitlige timer pr. uge beregnet over et rullende vindue.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Vindue (uger)">
                  <Input type="number" value={f.kapacitet?.rullendePeriodeUger||4} min="1" max="52"
                    onChange={v=>set("kapacitet",{...f.kapacitet,rullendePeriodeUger:Number(v)})}/>
                </FRow>
                <FRow label="Max timer/uge (gns)">
                  <Input type="number" value={f.kapacitet?.rullendeMaxTimer||Math.round((f.timer||23)*0.85)} min="0" max="168"
                    onChange={v=>set("kapacitet",{...f.kapacitet,rullendeMaxTimer:Number(v)})}/>
                </FRow>
              </div>
              <div style={{marginTop:10,padding:"8px 12px",background:C.accM,borderRadius:7,fontSize:12,color:C.acc}}>
                Advarsel vises ved 97% af grænsen
              </div>
            </div>
            <div style={{background:C.ambM,borderRadius:9,padding:"10px 14px",border:`1px solid ${C.amb}`,fontSize:12,color:C.amb}}>
              Disse indstillinger kan overskrives af Admin-standarder under Admin indstillinger.
            </div>
          </div>
        )}
        {tab==="system"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Medarbejder ID"><Input value={f.medarbejderId} onChange={v=>set("medarbejderId",v)} placeholder="EMP-1042"/></FRow>
            <FRow label="EPJ Kalender API"><Input value={f.epjKalenderApi} onChange={v=>set("epjKalenderApi",v)} placeholder="https://epj.dk/api/kalender/..."/></FRow>
            <div style={{gridColumn:"1/-1",marginTop:8,padding:12,background:C.s3,borderRadius:8,border:`1px solid ${C.brd}`}}>
              <div style={{color:C.txtM,fontSize:12}}>System-ID: <strong style={{color:C.txt}}>{med?.id||"—"}</strong></div>
              <div style={{color:C.txtM,fontSize:12,marginTop:4}}>Oprettet: <strong style={{color:C.txt}}>{med?.oprettet||"—"}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Anmodning modal */}
      {visAnmodning&&(
        <Modal title="Send til leder-godkendelse" onClose={()=>setVisAnmodning(false)} w={420}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{color:C.txtM,fontSize:13}}>Ændringer sendes til din leder til godkendelse inden de træder i kraft.</div>
            <FRow label="Vælg leder">
              <select value={valgtLeder} onChange={e=>setValgtLeder(e.target.value)}
                style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
                <option value="">— Vælg leder —</option>
                {ledere.map(l=><option key={l.id} value={l.id}>{l.navn} ({l.mail})</option>)}
              </select>
            </FRow>
            <FRow label="Kommentar (valgfri)">
              <textarea value={kommentar} onChange={e=>setKommentar(e.target.value)}
                rows={3} placeholder="Beskriv ændringerne..."
                style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
            </FRow>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn v="ghost" onClick={()=>setVisAnmodning(false)}>Annuller</Btn>
              <Btn v="primary" onClick={sendAnmodning} disabled={!valgtLeder}>Send anmodning</Btn>
            </div>
          </div>
        </Modal>
      )}
      {visSlet&&<ConfirmDialog
        tekst={`Slet ${med?.navn}? Allerede planlagte opgaver beholder medarbejdernavnet.`}
        onJa={()=>{onDelete&&onDelete(med?.id);setVisSlet(false);}}
        onNej={()=>setVisSlet(false)}
      />}
    </div>
  );
}

function GodkendelsesView({anmodninger,setAnmodninger,medarbejdere,setMedarbejdere,rulNotif=[],setRulNotif=()=>{},patienter=[],setPatienter=()=>{}}){
  const [tab,setTab]=useState("godkendelser");
  const [valgt,setValgt]=useState(null);
  const omfCount=(patienter||[]).flatMap(p=>p.opgaver.filter(o=>o.omfordel)).length;
  const [kommentar,setKommentar]=useState("");
  const afventer=anmodninger.filter(a=>a.status==="afventer");
  const behandlet=anmodninger.filter(a=>a.status!=="afventer");
  const rulAfventer=rulNotif.filter(n=>n.status==="afventer-svar"||n.status==="rykket").length;

  const beslut=(id,status)=>{
    setAnmodninger(prev=>prev.map(a=>{
      if(a.id!==id) return a;
      if(status==="godkendt"){
        if(a.type==="fravær"){
          setMedarbejdere(meds=>meds.map(m=>{
            if(m.id!==a.medId) return m;
            const nytFravær={
              id:"fr"+Date.now(),type:a.fraværType||"syg",
              fra:a.fra,til:a.til||"",
              årsag:a.årsag||"",noter:a.noter||"",
              godkendt:true,godkendtTidspunkt:new Date().toISOString(),
            };
            return {...m,fravær:[...(m.fravær||[]),nytFravær]};
          }));
        } else {
          setMedarbejdere(meds=>meds.map(m=>{
            if(m.id!==a.medId) return m;
            return {...m,...a.nyProfil};
          }));
        }
      }
      return {...a,status,kommentar};
    }));
    setValgt(null);
    setKommentar("");
  };

  const fmtDato=(iso)=>{
    try{const d=new Date(iso);return`${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
    catch{return iso;}
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Tab-header */}
      <div style={{display:"flex",gap:0,borderBottom:`2px solid ${C.brd}`,paddingBottom:0}}>
        {[
          {id:"godkendelser",label:"Leder-godkendelser",count:afventer.length},
          {id:"rulleplan",label:"Rulleplan-mail",count:rulAfventer},
          {id:"omfordeling",label:"Omfordeling",count:omfCount},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.acc:"transparent"}`,
              marginBottom:-2,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",
              color:tab===t.id?C.acc:C.txtM,fontWeight:tab===t.id?700:400,fontSize:13,
              display:"flex",alignItems:"center",gap:6}}>
            {t.label}
            {t.count>0&&<span style={{background:t.id==="rulleplan"?C.amb:C.acc,color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab==="rulleplan"&&<RulleplanNotifView rulNotif={rulNotif} setRulNotif={setRulNotif} medarbejdere={medarbejdere}/>}
      {tab==="godkendelser"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>

      {anmodninger.filter(a=>a.status==="afventer").length===0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"40px",textAlign:"center",color:C.txtM}}>
          <div style={{fontSize:36,marginBottom:8}}>v</div>
          <div style={{fontSize:14,fontWeight:600}}>Ingen afventende anmodninger</div>
          <div style={{fontSize:12,marginTop:4}}>Medarbejdere kan sende profilopdateringer — adresse-mangler-notifikationer vises her automatisk</div>
        </div>
      )}

      {/*  Adresse-mangler anmodninger  */}
      {(()=>{
        const adrAnm = anmodninger.filter(a=>a.type==="adresse-mangler"&&a.status==="afventer");
        if(adrAnm.length===0) return null;
        return(
          <div style={{background:C.s2,border:`1px solid ${C.red}44`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,background:C.red+"11",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:14}}></span>
              <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Manglende adresser ({adrAnm.length})</span>
              <span style={{color:C.txtM,fontSize:12}}>— Opgaver kan ikke gennemføres uden adresse</span>
            </div>
            {adrAnm.map((a,i)=>(
              <div key={a.id} style={{padding:"14px 18px",borderBottom:i<adrAnm.length-1?`1px solid ${C.brd}`:"none",background:"transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{color:C.txt,fontWeight:700,fontSize:14}}> {a.lokale}</span>
                      <Pill color={C.red} bg={C.red+"22"} sm>adresse mangler</Pill>
                      <span style={{color:C.txtM,fontSize:11}}>{fmtDato(a.tidspunkt)}</span>
                    </div>
                    <div style={{color:C.txtD,fontSize:12,marginBottom:4}}>
                      Patient: <strong>{a.patientNavn}</strong> · Opgave: <em>{a.opgaveTitel}</em>
                    </div>
                    {a.medNavn&&<div style={{color:C.txtM,fontSize:11}}>Ansvarlig medarbejder: {a.medNavn}</div>}
                    {a.ansvarligNavn&&<div style={{color:C.txtM,fontSize:11}}>Patientansvarlig: {a.ansvarligNavn}</div>}
                    {/* Mail-log */}
                    {a.mailLog&&a.mailLog.length>0&&(
                      <div style={{marginTop:8,background:C.s3,borderRadius:7,padding:"7px 10px"}}>
                        <div style={{color:C.txtM,fontSize:10,fontWeight:700,marginBottom:4}}>MAIL LOG</div>
                        {a.mailLog.map((l,j)=>(
                          <div key={j} style={{color:C.txtM,fontSize:11,marginBottom:2}}>
                            <span style={{color:C.txtD}}>{l.tid}</span> — {l.tekst}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                    <button onClick={()=>{
                      // Send rykker-mail til ansvarlig
                      setAnmodninger(prev=>prev.map(x=>x.id!==a.id?x:{
                        ...x,
                        mailLog:[...(x.mailLog||[]),{
                          tid:new Date().toISOString().slice(0,10),
                          tekst:`[SIMULERET RYKKER] Til: ${a.ansvarligEmail||a.ansvarligNavn||"ansvarlig"} — Manglende adresse for ${a.lokale} på patient ${a.patientNavn} er stadig ikke registreret.`
                        }]
                      }));
                    }} style={{background:C.ambM,color:C.amb,border:`1px solid ${C.amb}44`,borderRadius:7,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                       Send rykker
                    </button>
                    <button onClick={()=>setAnmodninger(prev=>prev.map(x=>x.id!==a.id?x:{...x,status:"afsluttet"}))}
                      style={{background:C.grnM,color:C.grn,border:`1px solid ${C.grn}44`,borderRadius:7,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                      v Markér løst
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Afventende */}
      {afventer.filter(a=>a.type!=="adresse-mangler").length>0&&(
        <div style={{background:C.s2,border:`1px solid ${C.amb}44`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,background:C.ambM+"33",display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:C.amb,fontSize:14}}></span>
            <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Afventer godkendelse</span>
          </div>
          {(()=>{const filteredAfv=afventer.filter(a=>a.type!=="adresse-mangler");return filteredAfv.map((a,i)=>(
            <div key={a.id} style={{padding:"16px 18px",borderBottom:i<filteredAfv.length-1?`1px solid ${C.brd}`:"none",
              background:valgt?.id===a.id?C.accM:"transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span style={{color:C.txt,fontWeight:700,fontSize:14}}>{a.medNavn}</span>
                    <span style={{color:C.txtM,fontSize:11}}>{fmtDato(a.tidspunkt)}</span>
                    {a.type==="fravær"&&(
                      <Pill color={C.pur} bg={C.purM} sm>
                        {a.fraværType==="syg"?"Sygemelding":a.fraværType==="ferie"?"Ferie":a.fraværType==="kursus"?"Kursus":"Fravær"}
                      </Pill>
                    )}
                    <Pill color={C.amb} bg={C.ambM} sm>afventer</Pill>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {a.ændringer.map((æ,j)=>(
                      <span key={j} style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:5,padding:"3px 8px",fontSize:11,color:C.txtD}}>
                        {æ.felt}
                      </span>
                    ))}
                  </div>
                  {a.kommentar&&<div style={{color:C.txtM,fontSize:12,fontStyle:"italic"}}>"{a.kommentar}"</div>}
                  {a.medEmail&&<div style={{color:C.txtM,fontSize:11,marginTop:4}}>Fra: {a.medEmail}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <Btn v="subtle" small onClick={()=>setValgt(valgt?.id===a.id?null:a)}>
                    {valgt?.id===a.id?"Luk":"Se detaljer"}
                  </Btn>
                </div>
              </div>

              {/* Detalje-panel */}
              {valgt?.id===a.id&&(
                <div style={{marginTop:14,padding:14,background:C.s3,borderRadius:9,border:`1px solid ${C.brd}`}}>
                  <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:10}}>
                    {a.type==="fravær"?"Fravær — detaljer":"Ændringer i detaljer"}
                  </div>
                  {a.type==="fravær"&&(
                    <div style={{background:C.s1,borderRadius:8,padding:"10px 14px",marginBottom:12,
                      border:`1px solid ${C.brd}`}}>
                      <div style={{display:"grid",gridTemplateColumns:"110px 1fr",gap:6}}>
                        <span style={{color:C.txtM,fontSize:12}}>Type:</span>
                        <span style={{color:C.txt,fontSize:12,fontWeight:600}}>
                          {a.fraværType==="syg"?"Sygemelding":a.fraværType==="ferie"?"Ferie":
                           a.fraværType==="kursus"?"Kursus / efteruddannelse":"Andet fravær"}
                        </span>
                        <span style={{color:C.txtM,fontSize:12}}>Periode:</span>
                        <span style={{color:C.txt,fontSize:12}}>{a.fra} — {a.til||"åben"}</span>
                        <span style={{color:C.txtM,fontSize:12}}>Årsag:</span>
                        <span style={{color:C.txt,fontSize:12,fontStyle:"italic"}}>{a.årsag||"—"}</span>
                        {a.noter&&<><span style={{color:C.txtM,fontSize:12}}>Noter:</span>
                        <span style={{color:C.txtD,fontSize:12}}>{a.noter}</span></>}
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                    {a.ændringer.map((æ,j)=>(
                      <div key={j} style={{display:"grid",gridTemplateColumns:"120px 1fr 20px 1fr",gap:8,alignItems:"center",
                        background:C.s1,borderRadius:7,padding:"8px 12px",border:`1px solid ${C.brd}`}}>
                        <span style={{color:C.acc,fontWeight:700,fontSize:12}}>{æ.felt}</span>
                        <span style={{color:C.red,fontSize:12,textDecoration:"line-through",opacity:.7}}>{String(æ.fra)||"-"}</span>
                        <span style={{color:C.txtD,fontSize:12,textAlign:"center"}}>{">"}</span>
                        <span style={{color:C.grn,fontSize:12}}>{String(æ.til)||"-"}</span>
                      </div>
                    ))}
                  </div>
                  <FRow label="Din kommentar (valgfrit)">
                    <textarea value={kommentar} onChange={e=>setKommentar(e.target.value)}
                      placeholder="Skriv en begrundelse..."
                      style={{width:"100%",background:C.s2,border:`1px solid ${C.brd}`,borderRadius:8,
                        padding:"8px 12px",color:C.txt,fontSize:13,fontFamily:"inherit",resize:"vertical",minHeight:60,outline:"none"}}/>
                  </FRow>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
                    <button onClick={()=>beslut(a.id,"afvist")}
                      style={{background:"transparent",border:`1px solid ${C.red}`,borderRadius:8,padding:"8px 20px",
                        color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      X Afvis
                    </button>
                    <button onClick={()=>beslut(a.id,"godkendt")}
                      style={{background:C.grn,border:"none",borderRadius:8,padding:"8px 20px",
                        color:C.txt,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      OK Godkend
                    </button>
                  </div>
                </div>
              )}
            </div>
          ));})()}
        </div>
      )}

      {/* Behandlet historik */}
      {behandlet.length>0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`}}>
            <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Behandlet historik</span>
          </div>
          {behandlet.map((a,i)=>(
            <div key={a.id} style={{padding:"12px 18px",borderBottom:i<behandlet.length-1?`1px solid ${C.brd}`:"none",
              display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:C.txt,fontWeight:600,fontSize:13}}>{a.medNavn}</span>
                  <span style={{color:C.txtM,fontSize:11}}>{fmtDato(a.tidspunkt)}</span>
                </div>
                <div style={{color:C.txtM,fontSize:11,marginTop:3}}>{a.ændringer.map(æ=>æ.felt).join(" . ")}</div>
                {a.kommentar&&<div style={{color:C.txtM,fontSize:11,marginTop:2,fontStyle:"italic"}}>"{a.kommentar}"</div>}
              </div>
              <Pill color={a.status==="godkendt"?C.grn:C.red} bg={a.status==="godkendt"?C.grnM:C.redM}>
                {a.status==="godkendt"?"OK Godkendt":"X Afvist"}
              </Pill>
            </div>
          ))}
        </div>
      )}
      </div>}
    </div>
  );
}

// ===========================================================
// ADMIN VIEW - Selskab, Afdelinger, FHIR, Brugere
// ===========================================================

function OmfordelingView({patienter=[],setPatienter=()=>{},medarbejdere=[]}){
  const [valgtOpg,setValgtOpg]=useState(null); // {patId, opgId}
  const [standinSøg,setStandinSøg]=useState("");
  const [bekræft,setBekræft]=useState(null); // {patId,opgId,nyMed}

  // Alle opgaver markeret til omfordeling
  const omfOps=useMemo(()=>patienter.flatMap(p=>
    p.opgaver.filter(o=>o.omfordel).map(o=>({...o,pNavn:p.navn,pCpr:p.cpr,pId:p.id,pStatus:p.status}))
  ),[patienter]);

  // Marker/afmarker omfordeling på opgave
  const toggleOmfordel=(patId,opgId,val)=>{
    setPatienter(ps=>ps.map(p=>p.id!==patId?p:{...p,
      opgaver:p.opgaver.map(o=>o.id!==opgId?o:{...o,omfordel:val,omfordelNote:val?o.omfordelNote:"",omfordelDato:val?today():""})}));
  };

  // Find potentielle stand-ins — medarbejdere der kan tage opgaven
  const valgtOp=valgtOpg?omfOps.find(o=>o.id===valgtOpg.opgId):null;
  const standinKandidater=medarbejdere.filter(m=>{
    if(!standinSøg&&!valgtOp) return true;
    if(standinSøg&&!m.navn.toLowerCase().includes(standinSøg.toLowerCase())
      &&!(m.stilling||"").toLowerCase().includes(standinSøg.toLowerCase())) return false;
    // Ekskluder den nuværende medarbejder
    if(valgtOp&&m.navn===valgtOp.medarbejder) return false;
    return true;
  }).slice(0,8);

  // Udfør omfordeling
  const udfør=(patId,opgId,nyMed)=>{
    setPatienter(ps=>ps.map(p=>p.id!==patId?p:{...p,
      opgaver:p.opgaver.map(o=>o.id!==opgId?o:{...o,
        medarbejder:nyMed,omfordel:false,omfordelNote:"",
        omfordelHistorik:[...(o.omfordelHistorik||[]),{fra:o.medarbejder,til:nyMed,dato:today()}]
      })}));
    setValgtOpg(null);
    setBekræft(null);
  };

  const statusColors={aktiv:C.grn,venteliste:C.amb,afsluttet:C.pur,udmeldt:C.red};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <ViewHeader titel="Omfordeling" undertitel="Opgaver der afventer ny medarbejder"/>

      {/* KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[
          {l:"Afventer omfordeling",v:omfOps.length,col:C.red,bg:C.redM},
          {l:"Berørte patienter",v:new Set(omfOps.map(o=>o.pId)).size,col:C.amb,bg:C.ambM},
          {l:"Medarbejdere tilgængelige",v:medarbejdere.length,col:C.grn,bg:C.grnM},
        ].map(({l,v,col,bg})=>(
          <div key={l} style={{background:bg,borderRadius:10,padding:"14px 18px",border:`1px solid ${col}33`}}>
            <div style={{color:col,fontSize:28,fontWeight:900}}>{v}</div>
            <div style={{color:col,fontSize:11,fontWeight:600,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {omfOps.length===0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"40px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>OK</div>
          <div style={{color:C.txt,fontWeight:700,fontSize:16,marginBottom:6}}>Ingen opgaver til omfordeling</div>
          <div style={{color:C.txtM,fontSize:13}}>Marker en opgave til omfordeling fra patientens detaljepanel</div>
        </div>
      )}

      {omfOps.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:valgtOpg?"1fr 360px":"1fr",gap:16,alignItems:"start"}}>

          {/* Venstre: opgaveliste */}
          <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,fontWeight:700,fontSize:13,color:C.txt,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>Opgaver til omfordeling</span>
              <span style={{color:C.txtM,fontSize:11,fontWeight:400}}>{omfOps.length} opgave{omfOps.length!==1?"r":""}</span>
            </div>
            {omfOps.map((o,i)=>{
              const isValgt=valgtOpg?.opgId===o.id;
              const pst=PAT_STATUS[o.pStatus||"aktiv"]||PAT_STATUS.aktiv;
              return(
                <div key={o.id||i} onClick={()=>setValgtOpg(isValgt?null:{patId:o.pId,opgId:o.id})}
                  style={{padding:"14px 16px",borderBottom:`1px solid ${C.brd}`,cursor:"pointer",
                    background:isValgt?C.accM:"transparent",transition:"background .1s",
                    borderLeft:`3px solid ${isValgt?C.acc:C.red}`}}
                  onMouseEnter={e=>{if(!isValgt)e.currentTarget.style.background=C.s1;}}
                  onMouseLeave={e=>{if(!isValgt)e.currentTarget.style.background="transparent";}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:C.txt,marginBottom:3}}>{o.titel||o.navn||o.opgave||"—"}</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <span style={{color:C.txtM,fontSize:11}}>{o.pNavn}</span>
                        <span style={{background:pst.bg,color:pst.col,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{pst.label}</span>
                      </div>
                      <div style={{display:"flex",gap:12,fontSize:11,color:C.txtM,flexWrap:"wrap"}}>
                        {o.medarbejder&&<span>Nuværende: <b style={{color:C.txt}}>{o.medarbejder}</b></span>}
                        {o.dato&&<span>Dato: <b style={{color:C.txt}}>{o.dato}</b>{o.startKl?` kl. ${o.startKl}`:""}</span>}
                        {o.lokale&&<span>Lokale: <b style={{color:C.txt}}>{o.lokale}</b></span>}
                      </div>
                      {o.omfordelNote&&<div style={{marginTop:6,background:C.ambM,borderRadius:6,padding:"5px 10px",fontSize:11,color:C.amb}}>Note: {o.omfordelNote}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
                      <span style={{background:C.redM,color:C.red,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700}}>Omfordel</span>
                      {o.omfordelDato&&<span style={{color:C.txtD,fontSize:10}}>Markeret {o.omfordelDato}</span>}
                      <button onClick={e=>{e.stopPropagation();toggleOmfordel(o.pId,o.id,false);}}
                        style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.txtM,cursor:"pointer",fontFamily:"inherit"}}>
                        Fortryd
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Højre: stand-in panel */}
          {valgtOpg&&valgtOp&&(
            <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",position:"sticky",top:20}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,fontWeight:700,fontSize:13,color:C.txt}}>
                Vælg ny medarbejder
              </div>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`}}>
                <div style={{fontSize:12,color:C.txtM,marginBottom:8}}>Opgave: <b style={{color:C.txt}}>{valgtOp.titel||valgtOp.navn||valgtOp.opgave}</b></div>
                {valgtOp.medarbejder&&<div style={{fontSize:12,color:C.txtM,marginBottom:4}}>Nuværende: <b style={{color:C.red}}>{valgtOp.medarbejder}</b></div>}
              </div>
              <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.brd}`}}>
                <input value={standinSøg} onChange={e=>setStandinSøg(e.target.value)}
                  placeholder="Søg medarbejder..."
                  style={{width:"100%",background:C.s1,border:`1px solid ${C.brd}`,borderRadius:7,padding:"7px 10px",fontSize:12,color:C.txt,fontFamily:"inherit",outline:"none"}}/>
              </div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {standinKandidater.map(m=>(
                  <div key={m.id||m.navn}
                    style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,cursor:"pointer",transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.s1}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    onClick={()=>setBekræft({patId:valgtOpg.patId,opgId:valgtOpg.opgId,nyMed:m.navn})}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:13,color:C.txt}}>{m.navn}</div>
                        <div style={{fontSize:11,color:C.txtM,marginTop:1}}>{m.stilling||m.titel||""}{m.afdeling?` · ${m.afdeling}`:""}</div>
                      </div>
                      <span style={{background:C.accM,color:C.acc,borderRadius:5,padding:"3px 9px",fontSize:11,fontWeight:600}}>Vælg</span>
                    </div>
                  </div>
                ))}
                {standinKandidater.length===0&&(
                  <div style={{padding:"20px",textAlign:"center",color:C.txtM,fontSize:12}}>Ingen medarbejdere fundet</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bekræft modal */}
      {bekræft&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setBekræft(null)}>
          <div style={{background:C.s1,borderRadius:14,padding:28,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:17,color:C.txt,marginBottom:8}}>Bekræft omfordeling</div>
            <div style={{color:C.txtM,fontSize:13,marginBottom:20,lineHeight:1.6}}>
              Opgaven <b style={{color:C.txt}}>{valgtOp?.titel||valgtOp?.navn||valgtOp?.opgave}</b> flyttes til <b style={{color:C.acc}}>{bekræft.nyMed}</b>.
              {valgtOp?.medarbejder&&<span> Den nuværende medarbejder <b style={{color:C.red}}>{valgtOp.medarbejder}</b> fjernes.</span>}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn v="ghost" onClick={()=>setBekræft(null)}>Annuller</Btn>
              <Btn v="primary" onClick={()=>udfør(bekræft.patId,bekræft.opgId,bekræft.nyMed)}>Bekræft omfordeling</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ================================================================
// AKTIVITETS-LOG VIEW
// ================================================================
function AktivLogView({aktivLog=[],setAktivLog,gemLog,adminData={}}){
  const [søg,setSøg]=useState("");
  const [filType,setFilType]=useState("alle");
  const [visIndstillinger,setVisIndstillinger]=useState(false);

  // Typer
  const TYPER=["alle","patient","medarbejder","opgave","planlægning","login","system"];

  // Rens log ældre end gemPeriodeDage
  const gemPeriodeDage=adminData?.logIndstillinger?.gemPeriodeDage||60;
  const cutoff=addDays(today(),-gemPeriodeDage);
  const aktivFiltreret=aktivLog.filter(e=>e.dato>=cutoff);

  const filtreret=aktivFiltreret.filter(e=>
    (filType==="alle"||e.type===filType)&&
    (søg===""||e.tekst?.toLowerCase().includes(søg.toLowerCase())||
     e.bruger?.toLowerCase().includes(søg.toLowerCase()))
  );

  // Eksporter log som HTML til print (PDF)
  const eksporterPdf=()=>{
    const rows=filtreret.map(e=>`<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${e.dato} ${e.tid||""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${e.bruger||"—"}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${e.type||""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${e.tekst||""}</td>
    </tr>`).join("");
    const html=`<!DOCTYPE html><html><head><title>Aktivitets-log ${today()}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse}
    th{background:#f0f4ff;padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #ccc}</style></head>
    <body><h1>PlanMed Aktivitets-log — ${today()}</h1>
    <p style="font-size:12px;color:#666">Eksporteret: ${today()} | Periode: seneste ${gemPeriodeDage} dage | ${filtreret.length} poster</p>
    <table><thead><tr><th>Dato/tid</th><th>Bruger</th><th>Type</th><th>Hændelse</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
    const w=window.open("","_blank");
    w.document.write(html);w.document.close();
    setTimeout(()=>w.print(),400);
  };

  // Nulstil log
  const nulstilLog=()=>{
    setAktivLog([]);
    gemLog([]);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Header */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:15}}>Aktivitets-log</div>
          <div style={{color:C.txtM,fontSize:12}}>{aktivFiltreret.length} poster · gemmes {gemPeriodeDage} dage · {filtreret.length} vises</div>
        </div>
        <Btn v="ghost" onClick={()=>setVisIndstillinger(v=>!v)}>Indstillinger</Btn>
        <Btn v="subtle" onClick={eksporterPdf}>Eksporter PDF</Btn>
        {aktivLog.length>0&&<Btn v="danger" onClick={nulstilLog}>Nulstil log</Btn>}
      </div>

      {/* Indstillinger */}
      {visIndstillinger&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FRow label="Gem log i (dage)">
            <input type="number" min="7" max="365"
              value={adminData?.logIndstillinger?.gemPeriodeDage||60}
              onChange={e=>{}}
              style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
          </FRow>
          <FRow label="Automatisk PDF-eksport d.">
            <input type="number" min="1" max="31"
              value={adminData?.logIndstillinger?.eksportDag||30}
              onChange={e=>{}}
              style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
          </FRow>
          <FRow label="Send til (super-admin email)">
            <input type="email"
              value={adminData?.logIndstillinger?.sendTilEmail||""}
              onChange={e=>{}}
              placeholder="superadmin@klinik.dk"
              style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
          </FRow>
          <div style={{color:C.txtM,fontSize:12,alignSelf:"flex-end",paddingBottom:4}}>
            Automatisk eksport kræver backend-integration (Fase 2).
          </div>
        </div>
      )}

      {/* Filter toolbar */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input value={søg} onChange={e=>setSøg(e.target.value)}
          placeholder="Søg i log..." 
          style={{flex:1,minWidth:200,padding:"7px 12px",border:`1px solid ${C.brd}`,borderRadius:8,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
        {TYPER.map(t=>(
          <button key={t} onClick={()=>setFilType(t)}
            style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${filType===t?C.acc:C.brd}`,
              background:filType===t?C.accM:"transparent",color:filType===t?C.acc:C.txtM,
              fontSize:12,fontWeight:filType===t?700:400,cursor:"pointer",fontFamily:"inherit",
              textTransform:"capitalize"}}>
            {t}
          </button>
        ))}
      </div>

      {/* Log tabel */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"140px 140px 110px 1fr",
          padding:"9px 16px",background:C.s3,borderBottom:`1px solid ${C.brd}`}}>
          {["Dato / tid","Bruger","Type","Hændelse"].map(h=>(
            <span key={h} style={{color:C.txtM,fontSize:11,fontWeight:600}}>{h}</span>
          ))}
        </div>
        {filtreret.length===0?(
          <div style={{padding:"32px",textAlign:"center",color:C.txtM,fontSize:13}}>
            {aktivLog.length===0?"Ingen aktivitet logget endnu — handlinger registreres automatisk":"Ingen resultater matcher filteret"}
          </div>
        ):(
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {[...filtreret].reverse().map((e,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"140px 140px 110px 1fr",
                padding:"8px 16px",borderBottom:`1px solid ${C.brd}44`,
                background:i%2===0?C.s2:C.s3+"80"}}>
                <span style={{color:C.txtM,fontSize:11}}>{e.dato} {e.tid||""}</span>
                <span style={{color:C.txtD,fontSize:12,fontWeight:500}}>{e.bruger||"—"}</span>
                <span style={{color:C.acc,fontSize:11,fontWeight:600,textTransform:"capitalize"}}>{e.type||""}</span>
                <span style={{color:C.txt,fontSize:12}}>{e.tekst||""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App(){
  const {t} = useTranslation();
  const [authStage,setAuthStage]=useState("app");
  const [authData,setAuthData]=useState({email:"admin@psykiatri.rm.dk",password:"",navn:"Systemadministrator",selskab:"Psykiatri Region Midtjylland",afdeling:"Alle afdelinger",rolle:"admin"});
  const isAdmin = authData.rolle==="admin" || authData.rolle==="superadmin" || authData.rolle==="ejer";
  // Ejer-konto fra localStorage (oprettes ved førstegangs-opstart)
  const [ejerKonto,setEjerKontoState]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("planmed_ejerKonto")||"null");}catch{return null;}
  });
  const setEjerKonto=(v)=>{setEjerKontoState(v);try{localStorage.setItem("planmed_ejerKonto",JSON.stringify(v));}catch(e){}};
  const EJER_EMAIL=ejerKonto?.email||"";
  const EJER_KODE=ejerKonto?.kode||"";
  const [ejerUnlocked,setEjerUnlocked]=useState(false);
  const isEjer = (ejerKonto && (authData.email===EJER_EMAIL || authData.rolle==="ejer")) && ejerUnlocked;
  const [visTester,setVisTester]=useState(false);
  const [aktivLog,setAktivLog]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("planmed_aktivlog")||"[]");}catch{return [];}
  });
  const gemAktivLog=(entries)=>{try{localStorage.setItem("planmed_aktivlog",JSON.stringify(entries));}catch(e){}};
  const logEntry=useCallback((type,tekst)=>{
    const entry={
      id:Date.now()+"_"+Math.random().toString(36).slice(2,6),
      dato:today(),
      tid:new Date().toLocaleTimeString("da-DK",{hour:"2-digit",minute:"2-digit"}),
      bruger:authData?.navn||authData?.email||"Ukendt",
      type,tekst
    };
    setAktivLog(prev=>{
      const ny=[...prev,entry].slice(-2000); // max 2000 i hukommelsen
      gemAktivLog(ny);
      return ny;
    });
  },[authData]);
  const [view,setView]=useState("dashboard");
  const [gsOpen,setGsOpen]=useState(false);
  const [gsQuery,setGsQuery]=useState("");
  const [patienter,setPatienter]=useState(()=>{try{return INIT_PATIENTER_RAW.map(r=>buildPatient(r));}catch(e){
return [];}});
  const [medarbejdere,setMedarbejdereRaw]=useState(()=>[...BASE_MED].map(ensureKompetencer));
  const setMedarbejdere=React.useCallback((valOrFn)=>{
    setMedarbejdereRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      return ny.map(ensureKompetencer);
    });
  },[]);
  const [forlob,setForlobRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_forlob"); if(s) return JSON.parse(s);}catch(e){}
    try{return structuredClone(FORLOB);}catch(e){return {};}
  });
  const setForlob=React.useCallback((valOrFn)=>{
    setForlobRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_forlob",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  // Sidecar: navn + beskrivelse per forløbs-skabelon-id
  const [forlobMeta,setForlobMetaRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_forlobMeta"); if(s) return JSON.parse(s);}catch(e){}
    return {};
  });
  const setForlobMeta=React.useCallback((valOrFn)=>{
    setForlobMetaRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_forlobMeta",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  const [indsatser,setIndsatser]=useState([]);
  const [lokTider,setLokTiderRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_lokTider"); if(s) return JSON.parse(s);}catch(e){}
    return structuredClone(DEFAULT_LOK_TIDER);
  });
  const setLokTider=React.useCallback((valOrFn)=>{
    setLokTiderRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_lokTider",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  const ADMIN_DEFAULTS={
    titler:DEFAULT_TITLER.map(t=>({...t})),
    kapDefaults:{
      "Læge":    {grænseType:"uge",grænseTimer:30,rullendePeriodeUger:4,rullendeMaxTimer:25,ialtFra:"",ialtTil:""},
      "Psykolog":{grænseType:"uge",grænseTimer:23,rullendePeriodeUger:4,rullendeMaxTimer:20,ialtFra:"",ialtTil:""},
      "Pædagog": {grænseType:"uge",grænseTimer:23,rullendePeriodeUger:4,rullendeMaxTimer:18,ialtFra:"",ialtTil:""},
    },
    // Default-priser er 0 — wizarden eller admin sætter selv priser per faggruppe.
    taktDefaults:{
      "Læge":    {krPrTime:0},
      "Psykolog":{krPrTime:0},
      "Pædagog": {krPrTime:0},
      "Lokale":  {krPrTime:0},
    },
    valuta:"DKK",
    selskaber:[],
  };
  const [adminData,setAdminDataRaw]=useState(()=>{
    try{
      const s=localStorage.getItem("planmed_adminData");
      if(s){
        const parsed=JSON.parse(s);
        // Migration: hvis gammel data uden titler-liste, start med defaults
        if(!Array.isArray(parsed.titler)) parsed.titler=[];
        if(parsed.titler.length===0){
          parsed.titler=DEFAULT_TITLER.map(t=>({...t}));
        }
        // Bagudkompatibilitet: bevar custom-titler fra tidligere versioner
        // ved at aflede manglende titler-entries fra eksisterende kapDefaults/taktDefaults-keys
        const kendteNavne=new Set(parsed.titler.map(t=>t.navn));
        const ekstraNavne=new Set();
        Object.keys(parsed.kapDefaults||{}).forEach(k=>{if(k&&k!=="Lokale"&&!kendteNavne.has(k)) ekstraNavne.add(k);});
        Object.keys(parsed.taktDefaults||{}).forEach(k=>{if(k&&k!=="Lokale"&&!kendteNavne.has(k)) ekstraNavne.add(k);});
        ekstraNavne.forEach(navn=>{
          const kd=parsed.kapDefaults?.[navn]||{};
          const td=parsed.taktDefaults?.[navn]||{};
          parsed.titler.push({
            id:navn, navn,
            farve:"#0050b3",
            defaultTimerPerUge:Number(kd.grænseTimer)||23,
            defaultKrPrTime:Number(td.krPrTime)||0,
          });
        });
        // Migration: gammel data uden valuta antages at være DKK (Danish kroner)
        if(!parsed.valuta||!VALUTAER[parsed.valuta]) parsed.valuta="DKK";
        return {...ADMIN_DEFAULTS,...parsed};
      }
    }catch(e){}
    return ADMIN_DEFAULTS;
  });
  const setAdminData=React.useCallback((valOrFn)=>{
    setAdminDataRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_adminData",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  const [lokaler,setLokaler]=useState(()=>{
    try{const s=localStorage.getItem("planmed_lokaler"); if(s) return JSON.parse(s);}catch(e){}
    return [...ALLE_LOK];
  });
  const saveLokaler=(ny)=>{setLokaler(ny);try{localStorage.setItem("planmed_lokaler",JSON.stringify(ny));}catch(e){}};
  const [lokMeta,setLokMetaRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_lokMeta"); if(s) return JSON.parse(s);}catch(e){}
    return {};
  });
  const setLokMeta=React.useCallback((valOrFn)=>{
    setLokMetaRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_lokMeta",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  // Udstyr: kategorier med items, og pakker
  const [udstyrsKat,setUdstyrsKat]=useState(()=>{try{const s=localStorage.getItem("planmed_udstyrsKat");return s?JSON.parse(s):[];}catch(e){return[];}});
  const [udstyrsPakker,setUdstyrsPakker]=useState(()=>{try{const s=localStorage.getItem("planmed_udstyrsPakker");return s?JSON.parse(s):[];}catch(e){return[];}});
  const saveUdstyrsKat=(v)=>{setUdstyrsKat(v);try{localStorage.setItem("planmed_udstyrsKat",JSON.stringify(v));}catch(e){}};
  const saveUdstyrsPakker=(v)=>{setUdstyrsPakker(v);try{localStorage.setItem("planmed_udstyrsPakker",JSON.stringify(v));}catch(e){}};
  const [certifikater,setCertifikater]=useState(()=>structuredClone(INIT_CERTIFIKATER));
  const [anmodninger,setAnmodninger]=useState([]); // {id,medId,medNavn,medEmail,lederNavn,lederEmail,
  const [rulNotif,setRulNotif]=useState([]); // rulleplan-notifikationer: {id,patId,patNavn,opgaveId,opgaveType,medNavn,medMail,ansvarligNavn,ansvarligMail,oprettet,deadline,rykkerdato,status,log:[]}tidspunkt,felt,fra,til,status:"afventer"|"godkendt"|"afvist",kommentar:""}
  const [planFraDato,setPlanFraDato]=useState(today());
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState(null);
  const [planLog,setPlanLog]=useState([]);
  const [planDebug,setPlanDebug]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);};

  //  Rulleplan: marker opgave løst + send notifikation 
  const handleMarkerLøst=(pat,opg)=>{
    const dato=new Date().toISOString().slice(0,10);
    // 1. Marker opgaven som løst
    setPatienter(ps=>ps.map(p=>p.id!==pat.id?p:{
      ...p,
      opgaver:p.opgaver.map(o=>o.id!==opg.id?o:{...o,status:"godkendt",løstDato:dato,låst:false})
    }));

    // 2. Opret rulNotif hvis opgaven har rulleplan
    if(opg.ruller){
      const medNavn   = opg.medarbejder||"";
      const medObj    = medarbejdere.find(m=>m.navn===medNavn);
      const medMail   = medObj?.mail||"";
      const ansvarlig = medarbejdere.find(m=>m.navn===pat.ansvarligMed);
      const svarFrist = new Date(Date.now()+7*24*3600*1000).toISOString().slice(0,10); // 7 dage
      const rykkDato  = new Date(Date.now()+5*24*3600*1000).toISOString().slice(0,10); // rykker dag 5
      const notif = {
        id:"rn"+Date.now(),
        patId:pat.id, patNavn:pat.navn, cpr:pat.cpr,
        opgaveId:opg.id, opgaveType:opg.opgave,
        rullerOpgave:opg.rullerOpgave||opg.opgave,
        rullerTidligstUger:opg.rullerTidligstUger||4,
        rullerSenestUger:opg.rullerSenestUger||6,
        rullerLåsUger:opg.rullerLåsUger||2,
        løstDato:dato,
        medNavn, medMail,
        ansvarligNavn:ansvarlig?.navn||pat.ansvarligMed||"",
        ansvarligMail:ansvarlig?.mail||"",
        svarFrist, rykkDato,
        status:"afventer-svar", // afventer-svar | rykket | besluttet | afsluttet
        beslutning:null, // "forlæng" | "afslut"
        log:[
          {tid:new Date().toISOString(),tekst:`Opgave "${opg.opgave}" markeret løst. Mail #1 sendt til ${medNavn||"(ingen medarbejder)"}${medMail?" ("+medMail+")":""}.`},
        ],
      };
      setRulNotif(prev=>[...prev,notif]);
      showToast(`Løst — rulleplan-notifikation sendt til ${medNavn||"medarbejder"}`,"success");
    } else {
      showToast("Opgave markeret løst v","success");
    }
  };

  const [visScope,setVisScope]=useState(false);

  // GLOBALT AFDELINGSSCOPE
  // Byg afdelinger dynamisk fra adminData
  const alleAfdelinger = useMemo(()=>{
    const fromAdmin = (adminData?.selskaber?.[0]?.afdelinger || []).map(a=>({id:a.id, navn:a.navn}));
    // Tilføj afdelinger fra importerede patienter og medarbejdere
    const dataAfds = new Set([
      ...patienter.map(p=>p.afdeling||"current"),
      ...medarbejdere.map(m=>m.afdeling||"current"),
    ]);
    const adminIds = new Set(fromAdmin.map(a=>a.id));
    const extra = [...dataAfds].filter(id=>!adminIds.has(id)).map(id=>({id, navn:id==="current"?(authData?.afdeling||"Min afdeling"):id}));
    const result = [...fromAdmin, ...extra];
    if(result.length > 0) return result;
    return [{id:"current", navn: authData?.afdeling||"Min afdeling"}];
  },[adminData, authData, patienter, medarbejdere]);
  const [afdScope, setAfdScope] = useState(()=>{
    // Initialisér scope — alle afdelinger aktive som standard
    const afdIds = (adminData?.selskaber?.[0]?.afdelinger||[]).map(a=>a.id);
    const defaultIds = afdIds.length>0 ? afdIds : ["current","a1","a2","a3"];
    return Object.fromEntries(defaultIds.map(id=>[id,{aktiv:true,med:true,lok:true,pat:true}]));
  });
  // Sync afdScope når adminData afdelinger ændrer sig
  useEffect(()=>{
    const afdIds=(adminData?.selskaber?.[0]?.afdelinger||[]).map(a=>a.id);
    if(afdIds.length===0) return;
    setAfdScope(prev=>{
      const next={...prev};
      afdIds.forEach(id=>{if(!next[id]) next[id]={aktiv:true,med:true,lok:true,pat:true};});
      return next;
    });
  },[adminData]);

  // Sync afdScope med afdelinger fra importerede patienter og medarbejdere
  useEffect(()=>{
    const patAfds=new Set(patienter.map(p=>p.afdeling||"current"));
    const medAfds=new Set(medarbejdere.map(m=>m.afdeling||"current"));
    const alleAfds=new Set([...patAfds,...medAfds]);
    setAfdScope(prev=>{
      let changed=false;
      const next={...prev};
      alleAfds.forEach(id=>{if(!next[id]){next[id]={aktiv:true,med:true,lok:true,pat:true};changed=true;}});
      return changed?next:prev;
    });
  },[patienter,medarbejdere]);

  // Bagudkompatibilitet: auto-tilføj titler fundet på medarbejdere/opgaver
  // hvis de ikke allerede findes i adminData.titler. Sikrer at gammel data
  // (fx importeret fra Excel med custom titler som "Sygeplejerske") forbliver
  // synlig i UI og brugbar i runPlanner.
  useEffect(()=>{
    const kendte=new Set((adminData?.titler||[]).map(t=>t.navn));
    const fundne=new Set();
    medarbejdere.forEach(m=>{if(m?.titel&&!kendte.has(m.titel)) fundne.add(m.titel);});
    patienter.forEach(p=>(p.opgaver||[]).forEach(o=>{
      (o.muligeMed||[]).forEach(mm=>{
        // kun hvis det ligner en titel (matcher en eksisterende medarbejder.titel) og ikke en navn
        if(mm&&!kendte.has(mm)&&medarbejdere.some(m=>m.titel===mm)) fundne.add(mm);
      });
    }));
    if(fundne.size===0) return;
    setAdminData(d=>({
      ...d,
      titler:[...(d.titler||[]),...[...fundne].map(navn=>({
        id:navn, navn, farve:"#0050b3", defaultTimerPerUge:23, defaultKrPrTime:0,
      }))],
    }));
  },[medarbejdere,patienter]); // adminData bevidst udeladt: forhindrer loop, opdateres kun ved ændringer i kilderne

  const toggleAktiv = (id) => setAfdScope(prev=>{
    const aktive=Object.entries(prev).filter(([,v])=>v.aktiv).length;
    if(prev[id]?.aktiv&&aktive<=1) return prev;
    return {...prev,[id]:{...(prev[id]||{med:true,lok:true,pat:true}),aktiv:!prev[id]?.aktiv}};
  });
  const toggleRes = (afdId,res) => setAfdScope(prev=>({
    ...prev,[afdId]:{...prev[afdId],[res]:!prev[afdId][res]}
  }));

  const [config,setConfig]=useState({
    pause:5, minGapDays:2, step:5, maxDage:90,
    // Besøgsgrænse per medarbejder per uge
    maxPatVisitsPerMedPerUge: 10,
    maxPatVisitsStrenged: "bloed",
    // Max antal forskellige medarbejdere per patient
    maxMedPerPatient: 0,
    maxMedStrenged: "bloed",
    // Prioritering af patienter
    prioritering: "henvDato",
    // Deadline-beregning
    deadlineMode: "henvDato",   // "henvDato" | "indsatsDato"
    indsatsDato: "",            // bruges kun hvis deadlineMode==="indsatsDato"
    // Låste opgaver
    tilladOverstigLåste: false,
    tilladOverstigLåsteStrenged: "bloed",
    // Max dage fra henvisning til afsluttet forløb
    maxDageForlob: 0,
    maxDageForlobStrenged: "bloed",
  });

  // SCOPE-FILTREREDE DATA — opdateres automatisk når afdScope ændres
  const scopedMed = useMemo(()=>{
    const aktive = Object.entries(afdScope).filter(([,v])=>v.aktiv&&v.med).map(([id])=>id);
    if(aktive.length===0) return medarbejdere;
    return medarbejdere.filter(m=>{
      const afd = m.afdeling||"current";
      return aktive.includes(afd);
    });
  },[medarbejdere,afdScope]);

  const scopedPatienter = useMemo(()=>{
    const aktivePat = Object.entries(afdScope).filter(([,v])=>v.aktiv&&v.pat).map(([id])=>id);
    if(aktivePat.length===0) return patienter;
    return patienter.filter(p=>{
      const afd = p.afdeling||"current";
      // Vis patient hvis afdeling matcher ELLER hvis current er aktiv og ingen afdeling sat
      return aktivePat.includes(afd) || (afd==="current"&&aktivePat.includes("current"));
    });
  },[patienter,afdScope]);

  const fejl=useMemo(()=>{try{return [];}catch(e){
return [];}},[scopedPatienter,lokTider]);

  const handlePlan=useCallback(async ()=>{
    if(running)return;
    setRunning(true);
    // Nulstil alle ikke-låste opgaver før planlægning
    const nulstillet=patienter.map(p=>({
      ...p,
      opgaver:p.opgaver.map(o=>o.låst?o:{...o,status:"afventer",dato:null,startKl:null,slutKl:null,lokale:null,medarbejder:null})
    }));
    const total=nulstillet.reduce((a,p)=>a+p.opgaver.filter(o=>!o.låst).length,0);
    setProgress({done:0,total});
    await new Promise(r=>setTimeout(r,80));
    const planConfig={
      ...config,lokTider,planFraDato:planFraDato||null,
      medarbejdere,lokaler,transportKmHt:config.transportKmHt||40,
      afdPostnr:config.afdPostnr||"",
      googleMapsKey:config.googleMapsKey||"",transportCache:config.transportCache||{},
      titler:adminData?.titler,
      lokMeta,
    };
    let res;
    try {
      res=runPlanner(nulstillet,planConfig);
    } catch(e) {
      setRunning(false); setProgress(null);
      setToast({msg:"Fejl i planlægger: "+e.message,type:"error"});
      return;
    }
    setProgress({done:res.planned+res.failed,total});
    await new Promise(r=>setTimeout(r,50));
    setPatienter(res.patienter);
    setPlanLog(res.planLog||[]);
    setRunning(false);
    setProgress(null);
    logEntry("planlægning","Auto: "+res.planned+" planlagt, "+res.failed+" ikke fundet");
    const type=res.planned===0&&total>0?"warn":res.failed>0?"warn":"success";
    setToast({msg:"Planlagt: "+res.planned+" | Ikke fundet: "+res.failed+" | Total: "+total,type});
  },[patienter,medarbejdere,running,config,lokTider,planFraDato]);

  const afventer=patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="afventer").length,0);
  const errors=fejl.filter(f=>f.type==="Fejl").length;

  useEffect(()=>{
    const handler=(e)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();setGsOpen(o=>!o);setGsQuery("");}
      if(e.key==="Escape") setGsOpen(false);
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  if(authStage !== "app") return <ErrorBoundary><AuthFlow stage={authStage} setStage={setAuthStage} data={authData} setData={setAuthData}/></ErrorBoundary>;

  // Førstegangs-opstart: vis ejer-opsætning hvis ingen ejerKonto er gemt
  if(!ejerKonto){
    return(
      <EjerSetupDialog onSave={(email,kode)=>{
        setEjerKonto({email,kode});
      }}/>
    );
  }

  // Førstegangs-opstart 2: vis selskabs-wizard hvis ingen selskaber er oprettet
  if(!adminData.selskaber || adminData.selskaber.length===0){
    return(
      <SelskabSetupWizard onSave={({selskab,lokaler:lokListe,lokTider:lokTiderMap,valuta,taktDefaults})=>{
        setAdminData(d=>({
          ...d,
          selskaber:[selskab],
          valuta:valuta||d.valuta||"DKK",
          taktDefaults:{...(d.taktDefaults||{}),...(taktDefaults||{})},
        }));
        if(Array.isArray(lokListe)&&lokListe.length>0){
          saveLokaler(lokListe);
          setLokTider(lokTiderMap);
        }
      }}/>
    );
  }

  return(
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.txt}}>
      <style>{`
        *{box-sizing:border-box}
        body{font-family:'DM Sans','Segoe UI',system-ui,sans-serif}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.brd};border-radius:3px}
        input[type=checkbox]{width:14px;height:14px;cursor:pointer}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
        .pm-btn-hover:hover{filter:brightness(1.12)}
        .pm-tr-hover:hover{background:rgba(0,80,179,0.05)!important}
        .pm-nav-hover:hover{background:rgba(0,80,179,0.05)!important}
        .auth-input:focus{border-color:#0050b3!important;outline:none}
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
      `}</style>

      {/* Global Search Overlay */}
      {gsOpen&&<GlobalSearch
        patienter={patienter}
        medarbejdere={medarbejdere}
        onClose={()=>{setGsOpen(false);setGsQuery("");}}
        onNavigate={(r)=>setView(r.nav)}
      />}

      {/* Sidebar */}
      <div style={{width:220,flexShrink:0,background:C.s1,borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.brd}`}}>
          <div style={{color:C.acc,fontWeight:900,fontSize:22,letterSpacing:"-0.02em"}}>{t("common.appName")}</div>
          <div style={{color:C.txtM,fontSize:11,marginTop:2}}>{t("nav.subtitle")}</div>
        </div>
        <div style={{padding:"8px 10px",borderBottom:`1px solid ${C.brd}`}}>
          <button onClick={()=>{setGsOpen(true);setGsQuery("");}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",color:C.txtM,fontFamily:"inherit",fontSize:12,transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.acc}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.brd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{flex:1,textAlign:"left"}}>{t("nav.searchHint")}</span>
            <kbd style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:4,padding:"1px 5px",fontSize:10}}>Ctrl+K</kbd>
          </button>
        </div>

        <nav style={{flex:1,padding:"8px 8px",overflowY:"auto"}}>
          {NAV_ITEMS.map((item,i)=>{
            if(item.sep) return <div key={`sep${i}`} style={{height:1,background:C.brd,margin:"6px 8px",opacity:.5}}/>;
            if(item.adminOnly && !isAdmin) return null;
            if(item.ejOnly && authData.email!==EJER_EMAIL && authData.rolle!=="ejer") return null;
            const act=view===item.id;
            const rulNotifCount=rulNotif.filter(n=>n.status==="afventer-svar"||n.status==="rykket").length;
      const badge=item.id==="planlog"?planLog.length||null:item.id==="dashboard"&&errors>0?errors:item.id==="admin"?(anmodninger.filter(a=>a.status==="afventer").length+rulNotifCount)||null:null;
            return(
              <button key={item.id} onClick={()=>setView(item.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,border:"none",background:act?C.accM:"transparent",color:act?C.acc:C.txtD,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:act?700:400,marginBottom:2,textAlign:"left",transition:"background .12s,color .12s",position:"relative"}}
                className={act?"":"pm-nav-hover"}>
                <span style={{flex:1}}>{t(item.label)}</span>
                {badge&&<span style={{background:act?C.acc:C.red,color:act?C.bg:"#fff",borderRadius:10,fontSize:10,fontWeight:700,padding:"1px 6px",minWidth:18,textAlign:"center"}}>{badge}</span>}
                {/* Aktiv indikator - Fitts: tydelig markering */}
                {act&&<div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:3,height:18,background:C.acc,borderRadius:"0 2px 2px 0"}}/>}
              </button>
            );
          })}
        </nav>

        <div style={{padding:"12px 12px",borderTop:"1px solid "+C.brd}}>
          <div style={{background:C.accM,borderRadius:8,padding:"10px 12px"}}>
            <div style={{color:C.acc,fontSize:12,fontWeight:700,marginBottom:4}}>{t("nav.afventer")}</div>
            <div style={{color:C.txt,fontSize:20,fontWeight:900,fontVariantNumeric:"tabular-nums"}}>{afventer}</div>
            <div style={{color:C.txtM,fontSize:11}}>{t("nav.afventerTasks")}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.s1,flexShrink:0}}>
          <div>
            <div style={{color:C.txt,fontWeight:800,fontSize:18}}>{(()=>{const it=NAV_ITEMS.find(n=>n.id===view);return it?t(it.label):"";})()}</div>
            {/* Aktive afdelinger i header */}
            {(()=>{
              const aktiveAfd=alleAfdelinger.filter(af=>afdScope[af.id]?.aktiv);
              const harScope=aktiveAfd.length>0&&aktiveAfd.length<alleAfdelinger.length;
              return(
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:3}}>
                  {harScope?(
                    <>
                      <span style={{color:C.txtM,fontSize:11,fontWeight:500}}>{t("nav.viewing")}</span>
                      {aktiveAfd.map(af=>(
                        <span key={af.id} style={{background:C.accM,color:C.acc,fontSize:11,fontWeight:700,borderRadius:5,padding:"2px 8px",display:"inline-flex",alignItems:"center",gap:4,border:"1px solid "+C.acc+"44"}}>
                          {af.navn}
                        </span>
                      ))}
                      <span style={{color:C.txtM,fontSize:11,marginLeft:2}}>
                        · {scopedPatienter.length} {t("nav.patients")} · {scopedMed.length} {t("nav.employees")}
                      </span>
                    </>
                  ):(
                    <span style={{color:C.txtM,fontSize:11}}>
                      {t("nav.allDepartments")} · {alleAfdelinger.length} {t("nav.departments")} · {scopedPatienter.length} {t("nav.patients")} · {scopedMed.length} {t("nav.employees")}
                    </span>
                  )}
                </div>
              );
            })()}
            {isAdmin&&view!=="admin"&&<span style={{background:C.accM,color:C.acc,fontSize:10,borderRadius:4,padding:"2px 7px",fontWeight:700,marginLeft:6}}>ADMIN</span>}
            {isEjer&&<span style={{background:C.redM,color:C.red,fontSize:10,borderRadius:4,padding:"2px 7px",fontWeight:700,marginLeft:6}}>EJER</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <LanguageSwitcher/>
            {errors>0&&<Pill color={C.red} bg={C.redM}>{errors} regelfejl</Pill>}
            <Pill color={C.acc} bg={C.accM}>{patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="planlagt").length,0)} planlagt</Pill>
            <button onClick={()=>setVisScope(true)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",
                borderRadius:7,border:"1.5px solid "+C.acc,background:C.accM,
                color:C.acc,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                transition:"background .12s"}}>
              <span style={{fontSize:11}}>⊞</span>
              {(()=>{const n=Object.values(afdScope).filter(v=>v.aktiv).length;return n===0||n===alleAfdelinger.length?"Vælg afdeling":n+" afd. valgt";})()}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <ErrorBoundary key={view}>
          {view==="dashboard"&&<ErrorBoundary><Dashboard patienter={scopedPatienter} medarbejdere={scopedMed} fejl={fejl} onLogout={()=>setAuthStage("welcome")} alleAfdelinger={alleAfdelinger} afdScope={afdScope}/></ErrorBoundary>}
          {view==="patienter"&&<ErrorBoundary><PatientKalenderView patienter={scopedPatienter} medarbejdere={scopedMed} setPatienter={setPatienter} forlob={forlob} showToast={showToast} onMarkerLøst={handleMarkerLøst} lokMeta={lokMeta} setAnmodninger={setAnmodninger} adminData={adminData} lokaler={lokaler}/></ErrorBoundary>}
          {view==="kalender"&&<ErrorBoundary><KalenderView patienter={scopedPatienter} medarbejdere={scopedMed} lokaler={lokaler}/></ErrorBoundary>}
          {view==="medarbejdere"&&<ErrorBoundary><MedarbejderView medarbejdere={scopedMed} setMedarbejdere={setMedarbejdere} patienter={scopedPatienter} setPatienter={setPatienter} anmodninger={anmodninger} setAnmodninger={setAnmodninger} isAdmin={isAdmin} certifikater={certifikater} showToast={showToast} adminData={adminData}/></ErrorBoundary>}
          {view==="lokaler"&&<ErrorBoundary><LokalerView patienter={patienter} lokTider={lokTider} setLokTider={setLokTider} lokMeta={lokMeta} setLokMeta={setLokMeta} lokaler={lokaler} saveLokaler={saveLokaler} adminData={adminData} udstyrsKat={udstyrsKat} saveUdstyrsKat={saveUdstyrsKat} udstyrsPakker={udstyrsPakker} saveUdstyrsPakker={saveUdstyrsPakker}/></ErrorBoundary>}
          {view==="forlob"&&<ErrorBoundary><ForlobView forlob={forlob} setForlob={setForlob} medarbejdere={scopedMed} setMedarbejdere={setMedarbejdere} indsatser={indsatser} setIndsatser={setIndsatser} certifikater={certifikater} setCertifikater={setCertifikater} lokaler={lokaler} setPatienter={setPatienter} adminData={adminData}/></ErrorBoundary>}
          {view==="planlog"&&<ErrorBoundary><PlanLogView patienter={scopedPatienter} planLog={planLog} medarbejdere={scopedMed} setPatienter={setPatienter} setMedarbejdere={setMedarbejdere} onPlan={handlePlan} running={running} progress={progress} planFraDato={planFraDato} setPlanFraDato={setPlanFraDato} afdScope={afdScope} alleAfdelinger={alleAfdelinger} toggleAktiv={toggleAktiv} toggleRes={toggleRes} lokaler={lokaler} certifikater={certifikater} planDebug={planDebug} config={config} setConfig={setConfig} setForlob={setForlob} forlob={forlob} lokTider={lokTider} setLokTider={setLokTider} lokMeta={lokMeta} setLokMeta={setLokMeta} saveLokaler={saveLokaler} setIndsatser={setIndsatser} indsatser={indsatser} adminData={adminData}/></ErrorBoundary>}
          {view==="admin"&&isAdmin&&<ErrorBoundary><AdminView adminData={adminData} setAdminData={setAdminData} authData={authData} anmodninger={anmodninger} setAnmodninger={setAnmodninger} medarbejdere={medarbejdere} setMedarbejdere={setMedarbejdere} rulNotif={rulNotif} setRulNotif={setRulNotif} patienter={patienter} setPatienter={setPatienter} aktivLog={aktivLog} setAktivLog={setAktivLog} gemLog={gemAktivLog} lokMeta={lokMeta} config={config} setConfig={setConfig} setForlob={setForlob} forlob={forlob} forlobMeta={forlobMeta} setForlobMeta={setForlobMeta} setLokTider={setLokTider} setLokMeta={setLokMeta} lokaler={lokaler} saveLokaler={saveLokaler} indsatser={indsatser} setIndsatser={setIndsatser} showToast={showToast}/></ErrorBoundary>}
          {view==="ejer"&&(authData.email===EJER_EMAIL||authData.rolle==="ejer")&&<ErrorBoundary><EjerView patienter={patienter} medarbejdere={medarbejdere} adminData={adminData} setAdminData={setAdminData} authData={authData} isUnlocked={isEjer} setEjerUnlocked={setEjerUnlocked} ejerKode={EJER_KODE} ejerKonto={ejerKonto} setEjerKonto={setEjerKonto} lokaler={lokaler} lokMeta={lokMeta} showToast={showToast} certifikater={certifikater} config={config}/></ErrorBoundary>}
          </ErrorBoundary>
        </div>
      </div>

      {visScope&&<ScopeModal alleAfdelinger={alleAfdelinger} afdScope={afdScope} toggleAktiv={toggleAktiv} toggleRes={toggleRes} onClose={()=>setVisScope(false)}/>}
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {visTester&&<PlanMedTester onClose={()=>setVisTester(false)}/>}
    </div>
  );
}
// ── EKSPORT FUNKTIONER ──────────────────────────────────

function eksporterPatientlisteExcel(patienter){
  const rows=patienter.map(p=>({
    Navn:p.navn,
    CPR:p.cpr,
    "Pat.nr":p.patientNr||"",
    "Henvist dato":p.henvDato||"",
    Forløb:p.forlobLabel||"",
    Status:(PAT_STATUS[p.status]||PAT_STATUS.aktiv).label,
    "Opgaver i alt":p.opgaver.length,
    "Planlagt":p.opgaver.filter(o=>o.status==="planlagt").length,
    "Afventer":p.opgaver.filter(o=>o.status==="afventer").length,
    Afdeling:p.afdeling||"",
    "Ansvarlig":p.ansvarligMed||"",
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:22},{wch:14},{wch:10},{wch:14},{wch:14},{wch:12},{wch:14},{wch:10},{wch:10},{wch:20},{wch:20}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Patienter");
  XLSX.writeFile(wb,`Patientliste_${today()}.xlsx`);
}

function eksporterMedarbejdereExcel(medarbejdere){
  const rows=medarbejdere.map(m=>({
    Navn:m.navn,
    Stilling:m.stilling||m.titel||"",
    Afdeling:m.afdeling||"",
    Mail:m.mail||m.email||"",
    "Timer/uge":m.timerPrUge||"",
    Certifikater:(m.certifikater||[]).join(", "),
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:22},{wch:20},{wch:20},{wch:28},{wch:10},{wch:30}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Medarbejdere");
  XLSX.writeFile(wb,`Medarbejdere_${today()}.xlsx`);
}

function eksporterOpgaveplanExcel(pat){
  const rows=(pat.opgaver||[]).map(o=>({
    Opgave:o.titel||o.navn||o.opgave||"",
    Status:o.status==="planlagt"?"Planlagt":o.status==="afventer"?"Afventer":"Fejl",
    Dato:o.dato||"",
    "Start kl.":o.startKl||"",
    "Slut kl.":o.slutKl||"",
    Medarbejder:o.medarbejder||"",
    Lokale:o.lokale||"",
    Låst:o.låst?"Ja":"Nej",
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:30},{wch:12},{wch:12},{wch:10},{wch:10},{wch:22},{wch:18},{wch:8}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,pat.navn.slice(0,31));
  XLSX.writeFile(wb,`Opgaveplan_${pat.navn.replace(/\s+/g,"_")}_${today()}.xlsx`);
}

function eksporterUgeplanExcel(patienter){
  // Samler alle planlagte opgaver med dato, grupperet på ugenummer
  const rows=patienter.flatMap(p=>
    p.opgaver.filter(o=>o.status==="planlagt"&&o.dato).map(o=>({
      Uge:getUge(o.dato),
      Dato:o.dato,
      "Start kl.":o.startKl||"",
      "Slut kl.":o.slutKl||"",
      Patient:p.navn,
      CPR:p.cpr,
      Opgave:o.titel||o.navn||o.opgave||"",
      Medarbejder:o.medarbejder||"",
      Lokale:o.lokale||"",
    }))
  ).sort((a,b)=>a.Dato.localeCompare(b.Dato));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:6},{wch:12},{wch:10},{wch:10},{wch:22},{wch:14},{wch:28},{wch:22},{wch:18}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Ugeplan");
  XLSX.writeFile(wb,`Ugeplan_${today()}.xlsx`);
}

function getUge(datoStr){
  const d=new Date(datoStr);
  const jan4=new Date(d.getFullYear(),0,4);
  const start=new Date(jan4);
  start.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
  return Math.ceil(((d-start)/86400000+1)/7);
}

function eksporterOpgaveplanPDF(pat){
  const lines=[];
  lines.push(`OPGAVEPLAN — ${pat.navn}`);
  lines.push(`CPR: ${pat.cpr}  |  ${pat.forlobLabel||""}  |  Status: ${(PAT_STATUS[pat.status]||PAT_STATUS.aktiv).label}`);
  lines.push(`Udskrevet: ${today()}`);
  lines.push("");
  lines.push("Opgave                           Dato        Tid         Medarbejder           Lokale        Status");
  lines.push("─".repeat(100));
  (pat.opgaver||[]).forEach(o=>{
    const navn=(o.titel||o.navn||o.opgave||"").padEnd(32).slice(0,32);
    const dato=(o.dato||"–").padEnd(11);
    const tid=o.startKl?(o.startKl+(o.slutKl?"–"+o.slutKl:"")).padEnd(11):"–".padEnd(11);
    const med=(o.medarbejder||"–").padEnd(21).slice(0,21);
    const lok=(o.lokale||"–").padEnd(13).slice(0,13);
    const st=o.status==="planlagt"?"Planlagt":o.status==="afventer"?"Afventer":"Fejl";
    lines.push(`${navn} ${dato} ${tid} ${med} ${lok} ${st}`);
  });
  lines.push("");
  lines.push(`Planlagt: ${pat.opgaver.filter(o=>o.status==="planlagt").length}  |  Afventer: ${pat.opgaver.filter(o=>o.status==="afventer").length}  |  I alt: ${pat.opgaver.length}`);
  genererTekstPDF(lines,`Opgaveplan_${pat.navn.replace(/\s+/g,"_")}_${today()}.html`);
}

function eksporterUgeplanPDF(patienter){
  const planlagt=patienter.flatMap(p=>
    p.opgaver.filter(o=>o.status==="planlagt"&&o.dato).map(o=>({...o,pNavn:p.navn,pCpr:p.cpr}))
  ).sort((a,b)=>a.dato.localeCompare(b.dato));

  // Grupper på uge
  const uger={};
  planlagt.forEach(o=>{
    const uge=getUge(o.dato);
    if(!uger[uge]) uger[uge]=[];
    uger[uge].push(o);
  });

  const lines=[];
  lines.push("UGEPLAN — ALLE PATIENTER");
  lines.push(`Udskrevet: ${today()}`);
  lines.push("");

  Object.entries(uger).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([uge,ops])=>{
    lines.push(`UGE ${uge}`);
    lines.push("─".repeat(90));
    ops.forEach(o=>{
      const dato=o.dato.padEnd(12);
      const tid=o.startKl?(o.startKl+(o.slutKl?"–"+o.slutKl:"")).padEnd(12):"".padEnd(12);
      const patient=o.pNavn.padEnd(22).slice(0,22);
      const opgave=(o.titel||o.navn||o.opgave||"").padEnd(28).slice(0,28);
      const med=(o.medarbejder||"–").padEnd(20).slice(0,20);
      lines.push(`  ${dato} ${tid} ${patient} ${opgave} ${med}`);
    });
    lines.push("");
  });
  genererTekstPDF(lines,`Ugeplan_${today()}.html`);
}

function genererTekstPDF(lines, filnavn){
  // Genererer HTML-fil der printer som PDF
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filnavn}</title>
<style>
  body{font-family:"Courier New",monospace;font-size:11px;line-height:1.5;padding:20mm;color:#111}
  @page{size:A4 landscape;margin:15mm}
  @media print{body{padding:0}}
  h1{font-size:14px;margin-bottom:4px}
  pre{white-space:pre-wrap;word-break:break-all}
</style>
<script>window.onload=()=>{window.print();}<\/script>
</head><body><pre>${lines.map(l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")).join("\n")}</pre></body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filnavn;
  a.click();
  URL.revokeObjectURL(a.href);
}



// ConfirmDialog - erstat window.confirm
function ConfirmDialog({tekst, onJa, onNej}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={onNej}>
      <div style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:14,padding:"28px 32px",maxWidth:420,width:"90%",boxShadow:"0 8px 40px rgba(0,0,0,0.4)"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{color:C.txt,fontSize:15,fontWeight:500,marginBottom:20,lineHeight:1.5}}>{tekst}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={onNej}>Annuller</Btn>
          <Btn v="danger" onClick={onJa}>Bekræft</Btn>
        </div>
      </div>
    </div>
  );
}

function GlobalSearch({patienter=[],medarbejdere=[],onClose,onNavigate}){
  const [q,setQ]=useState("");
  const inputRef=useRef(null);

  useEffect(()=>{
    setTimeout(()=>inputRef.current?.focus(),50);
  },[]);

  const results=useMemo(()=>{
    if(!q||q.trim().length<2) return [];
    const lq=q.toLowerCase();
    const hits=[];

    // Patienter
    patienter.forEach(p=>{
      const match=p.navn.toLowerCase().includes(lq)||p.cpr.includes(lq)||(p.patientNr||"").toLowerCase().includes(lq);
      if(match) hits.push({type:"patient",icon:"P",color:"#003d8a",label:p.navn,sub:`CPR: ${p.cpr}`,id:p.id,nav:"patienter"});
      // Opgaver på patient
      p.opgaver.forEach(o=>{
        const otitel=(o.titel||o.navn||o.opgave||"").toLowerCase();
        if(otitel.includes(lq)){
          hits.push({type:"opgave",icon:"O",color:"#0050b3",label:o.titel||o.navn||o.opgave,sub:`${p.navn} · ${o.dato||"Ikke planlagt"}`,id:p.id,nav:"patienter"});
        }
      });
    });

    // Medarbejdere
    medarbejdere.forEach(m=>{
      if(m.navn.toLowerCase().includes(lq)||(m.mail||"").toLowerCase().includes(lq)||(m.stilling||m.titel||"").toLowerCase().includes(lq)){
        hits.push({type:"medarbejder",icon:"M",color:"#1a5fb4",label:m.navn,sub:`${m.stilling||m.titel||""} · ${m.afdeling||""}`,id:m.id,nav:"medarbejdere"});
      }
    });

    return hits.slice(0,12);
  },[q,patienter,medarbejdere]);

  const typeColors={patient:"#003d8a",opgave:"#0050b3",medarbejder:"#1a5fb4"};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9000,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"12vh"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.s1,borderRadius:16,width:"100%",maxWidth:580,boxShadow:"0 24px 80px rgba(0,0,0,0.4)",border:`1px solid ${C.brd}`,overflow:"hidden"}}>

        {/* Søgefelt */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderBottom:`1px solid ${C.brd}`}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.txtM} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Søg patienter, medarbejdere, opgaver..."
            onKeyDown={e=>{if(e.key==="Escape")onClose();}}
            style={{flex:1,background:"none",border:"none",outline:"none",fontSize:16,color:C.txt,fontFamily:"inherit"}}/>
          {q&&<button onClick={()=>setQ("")} style={{background:"none",border:"none",color:C.txtM,cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 4px"}}>×</button>}
          <kbd style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:5,padding:"2px 7px",fontSize:11,color:C.txtM}}>Esc</kbd>
        </div>

        {/* Resultater */}
        <div style={{maxHeight:400,overflowY:"auto"}}>
          {q.length<2&&(
            <div style={{padding:"24px 18px",textAlign:"center",color:C.txtM,fontSize:13}}>
              Skriv mindst 2 tegn for at søge
              <div style={{marginTop:8,fontSize:11,color:C.txtD}}>Søger i patienter · medarbejdere · opgaver</div>
            </div>
          )}
          {q.length>=2&&results.length===0&&(
            <div style={{padding:"24px 18px",textAlign:"center",color:C.txtM,fontSize:13}}>
              Ingen resultater for <b style={{color:C.txt}}>"{q}"</b>
            </div>
          )}
          {results.map((r,i)=>(
            <div key={i} onClick={()=>{onNavigate(r);onClose();}}
              style={{display:"flex",alignItems:"center",gap:12,padding:"11px 18px",cursor:"pointer",borderBottom:`1px solid ${C.brd}22`,transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.s2}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:32,height:32,borderRadius:8,background:typeColors[r.type]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:typeColors[r.type],flexShrink:0}}>
                {r.icon}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.txt,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.label}</div>
                <div style={{fontSize:11,color:C.txtM,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.sub}</div>
              </div>
              <span style={{fontSize:10,color:typeColors[r.type],background:typeColors[r.type]+"11",borderRadius:4,padding:"2px 7px",fontWeight:600,flexShrink:0}}>
                {r.type==="patient"?"Patient":r.type==="medarbejder"?"Medarbejder":"Opgave"}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{padding:"8px 18px",borderTop:`1px solid ${C.brd}`,display:"flex",gap:16,alignItems:"center"}}>
          <span style={{fontSize:11,color:C.txtD}}>
            <kbd style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:4,padding:"1px 5px",fontSize:10}}>Ctrl K</kbd> for at åbne
          </span>
          <span style={{fontSize:11,color:C.txtD,marginLeft:"auto"}}>{results.length>0?`${results.length} resultater`:""}</span>
        </div>
      </div>
    </div>
  );
}

