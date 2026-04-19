// ConfirmDialog og global søgning.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { C } from "../data/constants.js";
import { Btn } from "./primitives.jsx";

// ConfirmDialog - erstat window.confirm
export function ConfirmDialog({tekst, onJa, onNej}){
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

export function GlobalSearch({patienter=[],medarbejdere=[],onClose,onNavigate}){
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

