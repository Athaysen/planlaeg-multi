// Patient-klynge: kalender-view + detalje-modal + tilknyttede forms.
// Holdes samlet i én fil fordi komponenterne er tæt koblede
// (PatientKalenderView mounter PatientDetaljeModal, som mounter form-modals).
import React, { useState, useEffect, useMemo } from "react";
import { today, addDays, toMin, fromMin, uid } from "../utils/index.js";
import { C, FORLOB, ALLE_K, PAT_STATUS, STATUS, sC, sB, sL, buildPatient } from "../data/constants.js";
import { Btn, Input, Sel, Modal, FRow, Pill, StatusBadge, ProgressRing, ViewHeader } from "../components/primitives.jsx";
import { UdstyrPanel } from "./LokalerView.jsx";

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

export default function PatientKalenderView({patienter,medarbejdere,setPatienter,forlob=FORLOB,showToast=()=>{},onMarkerLøst=null,lokMeta={},setAnmodninger=()=>{},adminData={},lokaler=[]}){
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
