import React, { useState, useMemo } from "react";
import { today } from "../utils/index.js";
import { C } from "../data/constants.js";
import { ErrorBoundary } from "../components/primitives.jsx";
import { analyserRessourcer } from "../planner/runPlanner.js";
import { PlanlaegIndstillingerPanel } from "./IndstillingerView.jsx";

export default function PlanLogView({patienter,planLog=[],medarbejdere=[],setPatienter,onPlan,running,progress,planFraDato,setPlanFraDato,afdScope,alleAfdelinger=[],toggleAktiv,toggleRes,lokaler=[],certifikater=[],planDebug,config={},setConfig=()=>{},setMedarbejdere=()=>{},setForlob=()=>{},forlob={},lokTider={},setLokTider=()=>{},lokMeta={},setLokMeta=()=>{},saveLokaler=()=>{},setIndsatser=()=>{},indsatser=[],adminData={}}){
  const [planTab,setPlanTab]=useState("planlaegning");
  const [filter,setFilter]=useState("alle");
  const [sortCol,setSortCol]=useState("dato");
  const [sortDir,setSortDir]=useState("asc");

  const todayStr=today();

  const alleOpgaver=useMemo(()=>{
    return patienter.flatMap(p=>
      p.opgaver.map(o=>({...o,patientNavn:p.navn,patientCpr:p.cpr,patientId:p.id}))
    );
  },[patienter]);

  const filtered=useMemo(()=>{
    let list=alleOpgaver;
    if(filter==="planlagt") list=list.filter(o=>o.status==="planlagt"&&o.dato);
    else if(filter==="ikke-planlagt") list=list.filter(o=>o.status!=="planlagt"||!o.dato);
    list=[...list].sort((a,b)=>{
      let va,vb;
      if(sortCol==="dato"){va=a.dato||"";vb=b.dato||"";}
      else if(sortCol==="patient"){va=a.patientNavn||"";vb=b.patientNavn||"";}
      else if(sortCol==="opgave"){va=a.opgave||"";vb=b.opgave||"";}
      else if(sortCol==="medarbejder"){va=a.medarbejder||"";vb=b.medarbejder||"";}
      else if(sortCol==="lokale"){va=a.lokale||"";vb=b.lokale||"";}
      else{va="";vb="";}
      const cmp=va.localeCompare(vb);
      return sortDir==="asc"?cmp:-cmp;
    });
    return list;
  },[alleOpgaver,filter,sortCol,sortDir]);

  const planlagte=alleOpgaver.filter(o=>o.status==="planlagt"&&o.dato).length;
  const ikkePlanlagte=alleOpgaver.filter(o=>o.status!=="planlagt"||!o.dato).length;

  const handleSort=(col)=>{
    if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortCol(col);setSortDir("asc");}
  };

  const thStyle={padding:"8px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:C.txtD,
    cursor:"pointer",userSelect:"none",borderBottom:`2px solid ${C.brd}`,background:C.s2};
  const tdStyle={padding:"8px 12px",fontSize:13,color:C.txt,borderBottom:`1px solid ${C.brd}`};
  const sortIcon=(col)=>sortCol===col?(sortDir==="asc"?" ↑":" ↓"):"";

  return(
    <div style={{padding:"0 0 40px"}}>
      {/* Top tabs */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.brd}`,marginBottom:16}}>
        {[{id:"planlaegning",label:"Planlægning"},{id:"ressourcer",label:"Ressource-analyse"},{id:"indstillinger",label:"Planlæg indstillinger"}].map(t=>(
          <button key={t.id} onClick={()=>setPlanTab(t.id)}
            style={{padding:"10px 24px",border:"none",fontFamily:"inherit",cursor:"pointer",
              background:"none",fontWeight:planTab===t.id?700:400,fontSize:14,
              color:planTab===t.id?C.acc:C.txtD,
              borderBottom:planTab===t.id?`2px solid ${C.acc}`:"2px solid transparent",marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ PLANLÆGNING TAB ══════ */}
      {planTab==="planlaegning"&&(<>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.txt}}>Planlægning</div>
          <div style={{fontSize:13,color:C.txtM,marginTop:2}}>
            {planlagte} planlagt · {ikkePlanlagte} afventer
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:C.txtD,fontWeight:600}}>Fra dato:</span>
            <input type="date" value={planFraDato||todayStr}
              onChange={e=>setPlanFraDato(e.target.value)}
              style={{border:`1px solid ${C.brd}`,borderRadius:8,padding:"6px 10px",fontSize:13,
                fontFamily:"inherit",color:C.txt,background:C.s1,outline:"none"}}/>
          </div>
          <button onClick={onPlan} disabled={running}
            style={{background:running?C.s3:C.acc,color:running?C.txtM:"#fff",border:"none",
              borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:700,cursor:running?"default":"pointer",
              fontFamily:"inherit",opacity:running?0.7:1}}>
            {running?"Planlægger...":"Planlæg nu"}
          </button>
        </div>
      </div>


      {/* Progress */}
      {running&&progress&&(
        <div style={{marginBottom:20,background:C.s2,borderRadius:10,padding:"14px 18px",border:`1px solid ${C.brd}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:600,color:C.txt}}>Planlægger opgaver...</span>
            <span style={{fontSize:12,color:C.txtM}}>{progress.done} / {progress.total}</span>
          </div>
          <div style={{background:C.s3,borderRadius:6,height:8,overflow:"hidden"}}>
            <div style={{background:C.acc,height:"100%",borderRadius:6,transition:"width 0.3s",
              width:progress.total>0?`${Math.round(progress.done/progress.total*100)}%`:"0%"}}/>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:`1px solid ${C.brd}`}}>
        {[{id:"alle",label:`Alle (${alleOpgaver.length})`},{id:"planlagt",label:`Planlagt (${planlagte})`},{id:"ikke-planlagt",label:`Afventer (${ikkePlanlagte})`}].map(t=>(
          <button key={t.id} onClick={()=>setFilter(t.id)}
            style={{padding:"8px 18px",border:"none",fontFamily:"inherit",cursor:"pointer",
              background:"none",fontWeight:filter===t.id?700:400,fontSize:13,
              color:filter===t.id?C.acc:C.txtD,
              borderBottom:filter===t.id?`2px solid ${C.acc}`:"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PlanLog entries */}
      {planLog.length>0&&(
        <div style={{marginBottom:20,background:C.s2,borderRadius:10,padding:"14px 18px",border:`1px solid ${C.brd}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:8}}>Seneste kørsel</div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {planLog.map((entry,i)=>(
              <div key={i} style={{padding:"4px 0",fontSize:12,color:entry.type==="error"?C.red:entry.type==="warn"?C.amb:C.txtD,
                borderBottom:i<planLog.length-1?`1px solid ${C.brd}22`:"none"}}>
                {entry.msg||entry.tekst||JSON.stringify(entry)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opgave-tabel */}
      <div style={{background:C.s1,borderRadius:12,border:`1px solid ${C.brd}`,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={thStyle} onClick={()=>handleSort("patient")}>Patient{sortIcon("patient")}</th>
              <th style={thStyle} onClick={()=>handleSort("opgave")}>Opgave{sortIcon("opgave")}</th>
              <th style={thStyle} onClick={()=>handleSort("dato")}>Dato{sortIcon("dato")}</th>
              <th style={thStyle} onClick={()=>handleSort("tid")}>Tid</th>
              <th style={thStyle} onClick={()=>handleSort("medarbejder")}>Medarbejder{sortIcon("medarbejder")}</th>
              <th style={thStyle} onClick={()=>handleSort("lokale")}>Lokale{sortIcon("lokale")}</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&(
              <tr><td colSpan={7} style={{padding:32,textAlign:"center",color:C.txtM}}>
                {alleOpgaver.length===0?"Ingen opgaver endnu":"Ingen opgaver matcher filtret"}
              </td></tr>
            )}
            {filtered.map((o,i)=>{
              const isPlanlagt=o.status==="planlagt"&&o.dato;
              return(
                <tr key={o.id||i} style={{background:i%2===0?"transparent":C.s2+"44"}}>
                  <td style={tdStyle}>{o.patientNavn||"—"}</td>
                  <td style={tdStyle}>{o.titel||o.opgave||"—"}</td>
                  <td style={tdStyle}>{o.dato||<span style={{color:C.txtM,fontStyle:"italic"}}>—</span>}</td>
                  <td style={tdStyle}>{o.startKl?`${o.startKl}–${o.slutKl||""}`:""}</td>
                  <td style={tdStyle}>{o.medarbejder||<span style={{color:C.txtM}}>—</span>}</td>
                  <td style={tdStyle}>{o.lokale||"—"}</td>
                  <td style={tdStyle}>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,
                      background:isPlanlagt?C.grnM:C.ambM,
                      color:isPlanlagt?C.grn:C.amb}}>
                      {isPlanlagt?"Planlagt":"Afventer"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Debug info */}
      {planDebug&&(
        <div style={{marginTop:20,background:C.s2,borderRadius:10,padding:"14px 18px",border:`1px solid ${C.brd}`,fontSize:11,color:C.txtM}}>
          <div style={{fontWeight:700,marginBottom:4}}>Debug</div>
          <pre style={{whiteSpace:"pre-wrap",margin:0}}>{JSON.stringify({planFraDato,afdScope,patienter:patienter.length,medarbejdere:medarbejdere.length,lokaler:lokaler.length},null,2)}</pre>
        </div>
      )}
      </>)}

      {/* ══════ RESSOURCE-ANALYSE TAB ══════ */}
      {planTab==="ressourcer"&&(()=>{ try {
        const ana = analyserRessourcer(patienter, {...config, lokTider, medarbejdere, lokaler:lokaler||[], titler:adminData?.titler});
        return(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Medarbejdere */}
            <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:14}}>Medarbejder-kapacitet</div>
              {ana.medarbejdere.map(r=>(
                <div key={r.titel} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 12px",background:C.s3,borderRadius:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.txt,width:90}}>{r.titel}</span>
                  <span style={{fontSize:12,color:C.txtM,width:55}}>{r.antal} pers.</span>
                  <div style={{flex:1,background:C.brd,borderRadius:4,height:10,overflow:"hidden"}}>
                    <div style={{background:r.ratio>1.5?C.red:r.ratio>1?C.amb:C.grn,height:"100%",borderRadius:4,
                      width:`${Math.min(r.ratio*50,100)}%`,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:12,color:C.txtD,width:100,textAlign:"right"}}>{Math.round(r.kapacitet/60)}t kap.</span>
                  <span style={{fontSize:12,color:C.txtD,width:100,textAlign:"right"}}>{Math.round(r.efterspørgsel/60)}t behov</span>
                  <span style={{fontSize:13,fontWeight:700,width:50,textAlign:"right",
                    color:r.ratio>1.5?C.red:r.ratio>1?C.amb:C.grn}}>{r.ratio}x</span>
                  {r.flaskehals&&<span style={{fontSize:10,background:C.redM,color:C.red,padding:"2px 8px",borderRadius:6,fontWeight:700}}>FLASKEHALS</span>}
                </div>
              ))}
            </div>

            {/* Lokaler */}
            <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:14}}>Lokale-kapacitet</div>
              {ana.lokaler.map(r=>(
                <div key={r.navn} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:C.s3,borderRadius:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.txt,width:120}}>{r.navn}</span>
                  <span style={{fontSize:12,color:C.txtM,width:50}}>{r.antal} stk.</span>
                  <div style={{flex:1,background:C.brd,borderRadius:4,height:10,overflow:"hidden"}}>
                    <div style={{background:r.ratio>1.5?C.red:r.ratio>1?C.amb:C.grn,height:"100%",borderRadius:4,
                      width:`${Math.min(r.ratio*50,100)}%`,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:12,color:C.txtD,width:100,textAlign:"right"}}>{Math.round(r.kapacitet/60)}t kap.</span>
                  <span style={{fontSize:12,color:C.txtD,width:100,textAlign:"right"}}>{Math.round(r.efterspørgsel/60)}t behov</span>
                  <span style={{fontSize:13,fontWeight:700,width:50,textAlign:"right",
                    color:r.ratio>1.5?C.red:r.ratio>1?C.amb:C.grn}}>{r.ratio}x</span>
                  {r.flaskehals&&<span style={{fontSize:10,background:C.redM,color:C.red,padding:"2px 8px",borderRadius:6,fontWeight:700}}>FLASKEHALS</span>}
                </div>
              ))}
            </div>

            {/* Opsummering */}
            <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:10}}>Opsummering</div>
              <div style={{fontSize:13,color:C.txt,marginBottom:6}}><strong>Primær flaskehals:</strong> {ana.primærFlaskehals}</div>
              {ana.anbefaling&&<div style={{fontSize:13,color:C.amb,background:C.ambM,padding:"10px 14px",borderRadius:8,border:`1px solid ${C.amb}44`}}>{ana.anbefaling}</div>}
              <div style={{marginTop:12,fontSize:12,color:C.txtM}}>
                Ratio over 1.0 = efterspørgslen overstiger kapaciteten. Over 1.5 = kritisk.
              </div>
            </div>
          </div>
        );
      } catch(e) { return <div style={{padding:20,color:C.red}}>Fejl i ressource-analyse: {String(e)}</div>; }
      })()}

      {/* ══════ PLANLÆG INDSTILLINGER TAB ══════ */}
      {planTab==="indstillinger"&&(
        <PlanlaegIndstillingerPanel config={config} setConfig={setConfig} setPatienter={setPatienter} setMedarbejdere={setMedarbejdere} setForlob={setForlob} forlob={forlob} setLokTider={setLokTider} lokMeta={lokMeta} setLokMeta={setLokMeta} patienter={patienter} lokaler={lokaler} saveLokaler={saveLokaler} medarbejdere={medarbejdere} setIndsatser={setIndsatser} indsatser={indsatser}/>
      )}
    </div>
  );
}

// ErrorBoundary flyttet til /src/components/primitives.jsx


// ===============================================
// EJER VIEW
// ===============================================
