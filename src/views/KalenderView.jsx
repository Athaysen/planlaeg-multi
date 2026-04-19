import React, { useState, useMemo } from "react";
import { today, toMin, fmtDate } from "../utils/index.js";
import { C, TITLE_C } from "../data/constants.js";
import { Btn, Sel, ViewHeader } from "../components/primitives.jsx";

export default function KalenderView({patienter,medarbejdere,lokaler=[]}){
  const [ugeOff,setUgeOff]=useState(0);
  const [filterMed,setFilterMed]=useState("alle");
  const [filterLok,setFilterLok]=useState("alle");
  const [hov,setHov]=useState(null);

  const getMandag=(off)=>{
    const d=new Date(); const dow=d.getDay();
    d.setDate(d.getDate()-(dow===0?6:dow-1)+off*7);
    return Array.from({length:5},(_,i)=>{const dd=new Date(d);dd.setDate(d.getDate()+i);return dd;});
  };
  const dage=getMandag(ugeOff);

  const H_START=8, H_END=17, HH=68;
  const toTop=(t)=>{const[h,m]=(t||"8:0").split(":").map(Number);return(h-H_START)*HH+(m/60)*HH;};
  const toHt=(s,e)=>Math.max((toMin(e)-toMin(s))/60*HH,16);
  const medC=(nav)=>TITLE_C[medarbejdere.find(m=>m.navn===nav)?.titel||""]||C.acc;

  const alle=useMemo(()=>
    patienter.flatMap(p=>p.opgaver.filter(o=>o.status==="planlagt"&&o.dato).map(o=>({...o,pNavn:p.navn,pId:p.id})))
  ,[patienter]);
  const vis=useMemo(()=>
    alle.filter(o=>(filterMed==="alle"||o.medarbejder===filterMed)&&(filterLok==="alle"||o.lokale===filterLok))
  ,[alle,filterMed,filterLok]);
  const medNavne=useMemo(()=>medarbejdere.map(m=>m.navn).sort(),[medarbejdere]);

  const todayStr=today();

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh-140px)",gap:10}}>
      <ViewHeader titel="Kalender" undertitel="Ugeoversigt over planlagte opgaver"/>
      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <Btn v="subtle" small onClick={()=>setUgeOff(u=>u-1)}>&lt; Forrige uge</Btn>
        <Btn v="accent" small onClick={()=>setUgeOff(0)}>I dag</Btn>
        <Btn v="subtle" small onClick={()=>setUgeOff(u=>u+1)}>Næste uge</Btn>
        <span style={{color:C.txtM,fontSize:12}}>
          {dage[0].toLocaleDateString("da-DK",{day:"numeric",month:"short"})} - {dage[4].toLocaleDateString("da-DK",{day:"numeric",month:"short",year:"numeric"})}
        </span>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <Sel value={filterMed} onChange={setFilterMed} style={{width:160}}
            options={[{v:"alle",l:"Alle medarbej."},...medNavne.map(m=>({v:m,l:m}))]}/>
          <Sel value={filterLok} onChange={setFilterLok} style={{width:130}}
            options={[{v:"alle",l:"Alle lokaler"},...lokaler.map(l=>({v:l,l}))]}/>
        </div>
      </div>

      {/* Grid */}
      <div style={{flex:1,display:"flex",background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
        {/* Time col */}
        <div style={{width:46,flexShrink:0,borderRight:`1px solid ${C.brd}`}}>
          <div style={{height:44,borderBottom:`1px solid ${C.brd}`}}/>
          <div style={{position:"relative",height:(H_END-H_START)*HH,overflow:"visible"}}>
            {Array.from({length:H_END-H_START},(_,i)=>(
              <div key={i} style={{position:"absolute",top:i*HH-7,right:6,color:C.txtM,fontSize:10}}>{i+H_START}:00</div>
            ))}
          </div>
        </div>

        {/* Day cols */}
        <div style={{flex:1,display:"flex",overflowX:"auto"}}>
          {dage.map((dag,di)=>{
            const ds=fmtDate(dag);
            const isT=ds===todayStr;
            const dagOpg=vis.filter(o=>o.dato===ds);
            const DAG5=["Man","Tir","Ons","Tor","Fre"];
            return(
              <div key={di} style={{flex:1,minWidth:130,borderRight:di<4?`1px solid ${C.brd}`:"none",display:"flex",flexDirection:"column",overflowY:"auto"}}>
                <div style={{height:44,borderBottom:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:isT?C.accM:"transparent",position:"sticky",top:0,zIndex:2}}>
                  <span style={{color:isT?C.acc:C.txtM,fontSize:9,textTransform:"uppercase",letterSpacing:".05em"}}>{DAG5[di]}</span>
                  <span style={{color:isT?C.acc:C.txt,fontSize:18,fontWeight:700,lineHeight:1.1}}>{dag.getDate()}</span>
                </div>
                <div style={{position:"relative",height:(H_END-H_START)*HH,flex:"0 0 auto"}}>
                  {/* Hour lines */}
                  {Array.from({length:H_END-H_START},(_,i)=>(
                    <div key={i} style={{position:"absolute",top:i*HH,left:0,right:0,borderTop:`1px solid ${C.brd}`,opacity:.5}}/>
                  ))}
                  {/* Opgave blocks */}
                  {dagOpg.map((o,oi)=>{
                    const top=toTop(o.startKl);
                    const h=toHt(o.startKl,o.slutKl);
                    const col=medC(o.medarbejder);
                    const isHov=hov===o.id;
                    return(
                      <div key={o.id} onMouseEnter={()=>setHov(o.id)} onMouseLeave={()=>setHov(null)}
                        style={{position:"absolute",top,left:3,right:3,height:h,background:C.s3,borderLeft:`3px solid ${col}`,borderRadius:5,padding:"3px 6px",overflow:"hidden",cursor:"pointer",zIndex:isHov?10:1,boxShadow:isHov?`0 4px 20px rgba(0,0,0,.5)`:"none",transition:"box-shadow .15s",borderTop:`1px solid ${C.brd2}`,borderRight:`1px solid ${C.brd2}`,borderBottom:`1px solid ${C.brd2}`}}>
                        <div style={{color:C.txt,fontSize:10,fontWeight:700,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.opgave.split(" ").slice(0,2).join(" ")}</div>
                        {h>26&&<div style={{color:C.txtM,fontSize:9,lineHeight:1.2}}>{o.pNavn}</div>}
                        {h>40&&<div style={{color:col,fontSize:9,lineHeight:1.2}}>{o.startKl}-{o.slutKl}</div>}
                        {isHov&&(
                          <div style={{position:"absolute",left:"calc(100% + 6px)",top:0,background:C.s2,border:`1px solid ${C.brd2}`,borderRadius:8,padding:"10px 13px",minWidth:200,zIndex:100,boxShadow:"0 8px 32px rgba(0,80,179,0.12)",pointerEvents:"none"}}>
                            <div style={{color:C.txt,fontWeight:700,fontSize:12,marginBottom:6}}>{o.opgave}</div>
                            <div style={{color:C.txtD,fontSize:11,marginBottom:2}}> {o.pNavn}</div>
                            <div style={{color:C.txtD,fontSize:11,marginBottom:2}}> {o.startKl}-{o.slutKl} ({o.minutter} min)</div>
                            <div style={{color:C.txtD,fontSize:11,marginBottom:2}}> {o.lokale}</div>
                            <div style={{color:col,fontSize:11}}>+ {o.medarbejder}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ===============================================
// MEDARBEJDER VIEW - kasse + liste + nye felter
