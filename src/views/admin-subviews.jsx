// Admin-sub-views: Godkendelser, Omfordeling, AktivitetsLog.
// Disse er top-level views men hører tæt sammen med admin-fanen.
import React, { useState, useMemo } from "react";
import { today, addDays } from "../utils/index.js";
import { C, PAT_STATUS } from "../data/constants.js";
import { Btn, FRow, Pill, ViewHeader } from "../components/primitives.jsx";
import { RulleplanNotifView } from "../admin/AdminView.jsx";

export function GodkendelsesView({anmodninger,setAnmodninger,medarbejdere,setMedarbejdere,rulNotif=[],setRulNotif=()=>{},patienter=[],setPatienter=()=>{}}){
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

export function OmfordelingView({patienter=[],setPatienter=()=>{},medarbejdere=[]}){
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
export function AktivLogView({aktivLog=[],setAktivLog,gemLog,adminData={}}){
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

