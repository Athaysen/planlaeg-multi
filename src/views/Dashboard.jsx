import React, { useState, useMemo } from "react";
import { today, addDays, daysBetween, fmtDate, isWeekend, parseLocalDate } from "../utils/index.js";
import { C, TITLE_C } from "../data/constants.js";
import { Modal, Pill, PatientDrillModal } from "../components/primitives.jsx";

export default function Dashboard({patienter,medarbejdere,fejl,onLogout}){
  const [drill,setDrill]=useState(null);
  const iDag=today();
  const [fraDato,setFraDato]=useState(iDag);
  const [tilDato,setTilDato]=useState(addDays(iDag,28)); // 4 uger frem

  // -- Filtrer opgaver til perioden --
  const inPeriod=(o)=>o.dato?o.dato>=fraDato&&o.dato<=tilDato:true;
  const inPeriodStrict=(o)=>o.dato&&o.dato>=fraDato&&o.dato<=tilDato;

  // -- Basis tal (filtreret til periode) --
  const totalOpg   = patienter.reduce((a,p)=>a+p.opgaver.filter(o=>inPeriod(o)).length,0);
  const planlagt   = patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="planlagt"&&inPeriodStrict(o)).length,0);
  const failed     = patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="ikke-planlagt"&&inPeriod(o)).length,0);
  const afventer   = patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="afventer").length,0);
  const komplet    = patienter.filter(p=>p.opgaver.filter(o=>inPeriod(o)).every(o=>o.status==="planlagt")).length;
  const errors     = fejl.filter(f=>f.type==="Fejl").length;
  const warnings   = fejl.filter(f=>f.type==="Advarsel").length;

  // -- Medarbejder KPI'er --
  // Antal uger i den valgte periode (minimum 1/7 for at undgå division med 0)
  // Eksempel: 28 dage = 4 uger > kapacitet = 23t x 4 = 92t
  const periodeUger = Math.max((daysBetween(fraDato,tilDato)+1)/7, 1/7);

  const medLoad = useMemo(()=>medarbejdere.map(m=>{
    const opgs=patienter.flatMap(p=>p.opgaver.filter(o=>o.medarbejder===m.navn&&o.status==="planlagt"&&o.dato&&o.dato>=fraDato&&o.dato<=tilDato));
    const h=opgs.reduce((a,o)=>a+o.minutter/60,0);
    // kapacitetTimer = hvad medarbejderen KAN arbejde i hele perioden (ikke bare 1 uge)
    const kapacitetTimer = m.timer * periodeUger;
    const pct=kapacitetTimer>0?Math.round(h/kapacitetTimer*100):0;
    const unikPat=new Set(patienter.filter(p=>p.opgaver.some(o=>o.medarbejder===m.navn&&o.status==="planlagt"&&o.dato&&o.dato>=fraDato&&o.dato<=tilDato)).map(p=>p.id)).size;
    return{...m,h,kapacitetTimer,pct,cnt:opgs.length,unikPat};
  }),[patienter,medarbejdere,fraDato,tilDato,periodeUger]);

  const overbelastet  = medLoad.filter(m=>m.pct>90).length;
  const underudnyttet = medLoad.filter(m=>m.pct<30&&m.cnt>0).length;
  const ledigKap      = medLoad.filter(m=>m.pct===0).length;
  const aktiveMed     = medLoad.filter(m=>m.timer>0);
  const samletKapPct  = aktiveMed.length>0?Math.round(aktiveMed.reduce((a,m)=>a+m.pct,0)/aktiveMed.length):0;

  // -- Patient KPI'er --
  const deadlineRisiko = patienter.filter(p=>{
    if(!p.maxDageForlob||!p.henvDato) return false;
    const deadline=addDays(p.henvDato,p.maxDageForlob);
    const sidsteOpg=p.opgaver.filter(o=>o.status==="planlagt"&&o.dato&&o.dato>=fraDato&&o.dato<=tilDato).sort((a,b)=>b.dato?.localeCompare(a.dato||"")||0)[0];
    return sidsteOpg?.dato>deadline || (!sidsteOpg && deadline>=fraDato && deadline<=tilDato);
  }).length;

  const genVentetid = useMemo(()=>{
    const tider=patienter.map(p=>{
      const første=p.opgaver.filter(o=>o.status==="planlagt"&&o.patInv&&o.dato&&o.dato>=fraDato&&o.dato<=tilDato).sort((a,b)=>a.dato.localeCompare(b.dato))[0];
      if(!første||!p.henvDato) return null;
      return daysBetween(p.henvDato,første.dato);
    }).filter(t=>t!==null&&t>=0);
    return tider.length>0?Math.round(tider.reduce((a,b)=>a+b,0)/tider.length):0;
  },[patienter,fraDato,tilDato]);

  const hasteManglerPlan = patienter.filter(p=>p.haste&&p.opgaver.some(o=>o.status==="afventer")).length;
  const forlobFremgangPct = totalOpg>0?Math.round(planlagt/totalOpg*100):0;

  // -- Afdeling KPI'er --
  const afsluttetForlob   = patienter.filter(p=>{
    const oPeriode=p.opgaver.filter(o=>inPeriod(o));
    return oPeriode.length>0&&oPeriode.every(o=>o.status==="planlagt");
  }).length;
  const deadlineOverskredetRate = patienter.length>0?Math.round(deadlineRisiko/patienter.length*100):0;
  const genDageFraHenvPlanlagt = useMemo(()=>{
    const dage=patienter.filter(p=>p.henvDato).map(p=>{
      const sidst=p.opgaver.filter(o=>o.status==="planlagt"&&o.dato&&o.dato>=fraDato&&o.dato<=tilDato).sort((a,b)=>b.dato.localeCompare(a.dato))[0];
      return sidst?daysBetween(p.henvDato,sidst.dato):null;
    }).filter(Boolean);
    return dage.length>0?Math.round(dage.reduce((a,b)=>a+b,0)/dage.length):0;
  },[patienter,fraDato,tilDato]);

  // -- Tempo KPI'er --
  const planlagt7dage = patienter.reduce((a,p)=>a+p.opgaver.filter(o=>{
    if(o.status!=="planlagt"||!o.dato) return false;
    return o.dato>=fraDato&&o.dato<=tilDato;
  }).length,0);

  const backlogTrend = afventer>0?"stigende":afventer===0&&planlagt>0?"faldende":"stabil";

  const prognose = useMemo(()=>{
    if(afventer===0) return "Alle planlagt";
    if(planlagt7dage===0) return "Ukendt";
    // Beregn dagsrate ud fra periodens faktiske længde (ikke hardkodet 7)
    const periodeDage=Math.max(daysBetween(fraDato,tilDato),1);
    const dagsRate=planlagt7dage/periodeDage;
    const dageTilbage=Math.ceil(afventer/Math.max(dagsRate,0.1));
    const d=parseLocalDate(tilDato); d.setDate(d.getDate()+dageTilbage);
    return fmtDate(d);
  },[afventer,planlagt7dage,fraDato,tilDato]);

  // -- Kommende dage --
  const komDage = useMemo(()=>{
    const res=[]; let d=parseLocalDate(fraDato);
    while(res.length<5&&fmtDate(d)<=tilDato){
      const ds=fmtDate(d);
      if(!isWeekend(ds)){
        const opgs=patienter.flatMap(p=>p.opgaver.filter(o=>o.dato===ds&&o.status==="planlagt"));
        res.push({dato:ds,dag:["Søn","Man","Tir","Ons","Tor","Fre","Lør"][d.getDay()],nr:d.getDate(),antal:opgs.length,pat:opgs.filter(o=>o.patInv).length});
      }
      d.setDate(d.getDate()+1);
    }
    return res;
  },[patienter,fraDato,tilDato]);

  // -- Belastningsfordeling til søjlediagram (SVG) --
  const belastningBuckets=[
    {label:"0%",   fra:0,  til:1,  col:C.txtM},
    {label:"1-30%",fra:1,  til:30, col:C.grn},
    {label:"30-70%",fra:30,til:70, col:C.blue},
    {label:"70-90%",fra:70,til:90, col:C.amb},
    {label:">90%", fra:90, til:200,col:C.red},
  ].map(b=>({...b,antal:medLoad.filter(m=>m.pct>=b.fra&&m.pct<b.til).length}));
  const maxBucket=Math.max(...belastningBuckets.map(b=>b.antal),1);

  // -- Forløbsfremgang til staplet bar --
  const fremgangData=patienter.map(p=>{
    const oPeriode=p.opgaver.filter(o=>inPeriod(o));
    return{
      navn:p.navn,
      planlagt:oPeriode.filter(o=>o.status==="planlagt").length,
      afventer:oPeriode.filter(o=>o.status==="afventer").length,
      fejlet:oPeriode.filter(o=>o.status==="ikke-planlagt").length,
      total:oPeriode.length,
    };
  }).filter(p=>p.total>0).sort((a,b)=>(b.total>0?(b.planlagt/b.total):0)-(a.total>0?(a.planlagt/a.total):0));

  // drill-down konfiguration
  const kpiDrills={
    patienter_ialt:{title:`Alle patienter (${patienter.length})`,isPat:true,filterPat:()=>true},
    planlagte_opgaver:{title:`Planlagte opgaver (${planlagt})`,filter:p=>({opgaver:p.opgaver.filter(o=>o.status==="planlagt")})},
    afventer:{title:`Afventende opgaver (${afventer})`,filter:p=>({opgaver:p.opgaver.filter(o=>o.status==="afventer")})},
    ikke_fundet:{title:`Ikke fundet (${failed})`,filter:p=>({opgaver:p.opgaver.filter(o=>o.status==="ikke-planlagt")})},
    regelkontrol:{title:`Regelkontrol - ${errors} fejl, ${warnings} advarsler`,isRegel:true},
  };

  const Kpi=({id,label,val,sub,col,icon,suffix=""})=>{
    const [hov,setHov]=useState(false);
    const act=drill===id;
    return(
      <div onClick={()=>id&&setDrill(act?null:id)}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{background:act?col+"15":hov?C.s3:C.s2,border:`1px solid ${act||hov?col:C.brd}`,
          borderRadius:12,padding:"16px 18px",cursor:id?"pointer":"default",
          position:"relative",overflow:"hidden",transition:"all .15s"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:col}}/>
        {icon&&<div style={{position:"absolute",right:12,top:12,fontSize:22,opacity:.1}}>{icon}</div>}
        <div style={{color:C.txtM,fontSize:10,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>{label}</div>
        <div style={{color:col,fontSize:32,fontWeight:900,lineHeight:1,letterSpacing:"-0.02em"}}>{val}{suffix}</div>
        <div style={{color:C.txtD,fontSize:11,marginTop:5,opacity:.8}}>{sub}</div>
        {hov&&id&&<div style={{position:"absolute",bottom:6,right:10,color:col,fontSize:10,fontWeight:600,opacity:.6}}>detaljer ^</div>}
      </div>
    );
  };

  const SektionHeader=({label,farve})=>(
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:3,height:16,background:farve,borderRadius:2}}/>
      <div style={{color:C.txt,fontWeight:700,fontSize:13,textTransform:"uppercase",letterSpacing:".05em"}}>{label}</div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {onLogout&&<div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={onLogout} style={{background:C.s1,border:`1px solid ${C.brd}`,borderRadius:8,padding:"6px 14px",color:C.txtM,fontSize:12,cursor:"pointer"}}>&lt; Startside</button>
      </div>}
      {/* Periode-label under filteret så det er klart hvad KPIerne dækker */}

      {/* -- DATOINTERVAL FILTER -- */}
      <div style={{background:C.s1,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}></span>
          <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Måleperiode</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Fra</span>
            <input type="date" value={fraDato} onChange={e=>setFraDato(e.target.value)}
              style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:7,padding:"6px 10px",color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer"}}/>
          </div>
          <span style={{color:C.txtD,fontSize:12}}>-</span>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Til</span>
            <input type="date" value={tilDato} onChange={e=>setTilDato(e.target.value)}
              style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:7,padding:"6px 10px",color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[
            ["I dag",    iDag,             iDag],
            ["1 uge",    iDag,             addDays(iDag,7)],
            ["4 uger",   iDag,             addDays(iDag,28)],
            ["3 mdr",    iDag,             addDays(iDag,90)],
            ["Hele året",`${iDag.slice(0,4)}-01-01`,`${iDag.slice(0,4)}-12-31`],
          ].map(([label,fra,til])=>{
            const act=fraDato===fra&&tilDato===til;
            return(
              <button key={label} onClick={()=>{setFraDato(fra);setTilDato(til);}}
                style={{background:act?C.accM:"transparent",color:act?C.acc:C.txtM,
                  border:`1px solid ${act?C.acc:C.brd}`,borderRadius:6,padding:"5px 11px",
                  cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:act?700:400,transition:"all .12s"}}>
                {label}
              </button>
            );
          })}
        </div>
        <div style={{color:C.txtM,fontSize:11,marginLeft:"auto",whiteSpace:"nowrap"}}>
          {(()=>{try{const d=Math.round((parseLocalDate(tilDato)-parseLocalDate(fraDato))/(1000*60*60*24));return`${d} dage`;}catch{return ""}})()}
        </div>
      </div>

      {/* -- SEKTION 1: MEDARBEJDERE -- */}
      <div>
        <SektionHeader label="Medarbejdere" farve={C.blue}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          <Kpi label="Samlet kapacitetsudnyttelse" val={samletKapPct} suffix="%" sub={`${medarbejdere.length} medarbejdere . ${periodeUger.toFixed(1)} uger`} col={samletKapPct>85?C.red:samletKapPct>60?C.amb:C.blue} icon=""/>
          <Kpi label="Overbelastede (>90%)" val={overbelastet} sub="medarbejdere over kapacitet" col={overbelastet>0?C.red:C.grn} icon="*"/>
          <Kpi label="Ledig kapacitet" val={ledigKap} sub="medarbejdere uden bookinger" col={ledigKap>0?C.amb:C.grn} icon="[]"/>
          <Kpi label="Underudnyttede (<30%)" val={underudnyttet} sub="kan tage flere opgaver" col={underudnyttet>0?C.amb:C.grn} icon="v"/>
        </div>
      </div>

      {/* -- SEKTION 2: PATIENTER -- */}
      <div>
        <SektionHeader label="Patienter" farve={C.acc}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          <Kpi id="patienter_ialt" label="Patienter i alt" val={patienter.length} sub={`${komplet} fuldt planlagt`} col={C.acc} icon=""/>
          <Kpi label="Gns. ventetid til 1. samtale" val={genVentetid} suffix=" dg" sub="fra henvisning til første besøg" col={genVentetid>30?C.red:genVentetid>14?C.amb:C.grn} icon=""/>
          <Kpi label="Deadline-risiko" val={deadlineRisiko} sub="patienter tæt på overskridelse" col={deadlineRisiko>0?C.red:C.grn} icon="!"/>
          <Kpi label="Haste uden plan" val={hasteManglerPlan} sub="hastepatienter ikke planlagt" col={hasteManglerPlan>0?C.red:C.grn} icon="!"/>
        </div>
      </div>

      {/* -- SEKTION 3: AFDELING / EFFEKTIVITET -- */}
      <div>
        <SektionHeader label="Afdeling & Effektivitet" farve={C.grn}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          <Kpi label="Forløbsfremgang" val={forlobFremgangPct} suffix="%" sub={`${planlagt} af ${totalOpg} opgaver planlagt`} col={forlobFremgangPct>80?C.grn:forlobFremgangPct>50?C.amb:C.red} icon="^"/>
          <Kpi label="Fuldt planlagte forløb" val={afsluttetForlob} sub={`af ${patienter.length} patienter`} col={C.grn} icon="OK"/>
          <Kpi label="Deadline-overskridelsesrate" val={deadlineOverskredetRate} suffix="%" sub="af patienter med risiko" col={deadlineOverskredetRate>10?C.red:deadlineOverskredetRate>5?C.amb:C.grn} icon=""/>
          <Kpi label="Gns. dage henvist > planlagt" val={genDageFraHenvPlanlagt} suffix=" dg" sub="for fuldt planlagte forløb" col={genDageFraHenvPlanlagt>60?C.red:genDageFraHenvPlanlagt>30?C.amb:C.grn} icon=""/>
        </div>
      </div>

      {/* -- SEKTION 4: TEMPO -- */}
      <div>
        <SektionHeader label="Tempo & Backlog" farve={C.amb}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          <Kpi id="afventer" label="Backlog (afventer)" val={afventer} sub="opgaver klar til planlægning" col={afventer>50?C.red:afventer>20?C.amb:C.grn} icon=""/>
          <Kpi label="Planlagt seneste 7 dage" val={planlagt7dage} sub="opgaver booket denne uge" col={C.blue} icon=">"/>
          <Kpi label="Backlog-trend" val={backlogTrend==="faldende"?"v":backlogTrend==="stigende"?"^":">"} sub={backlogTrend} col={backlogTrend==="faldende"?C.grn:backlogTrend==="stigende"?C.red:C.amb} icon=""/>
          <Kpi id="ikke_fundet" label="Prognose fuldt planlagt" val={prognose} sub="estimeret ved nuværende tempo" col={C.blue} icon=""/>
        </div>
      </div>

      {/* -- GRAFER -- */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

        {/* Medarbejder belastningsfordeling - SVG søjlediagram */}
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:18}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:4}}>Belastningsfordeling</div>
          <div style={{color:C.txtM,fontSize:11,marginBottom:14}}>Antal medarbejdere per kapacitetsniveau</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:120,paddingBottom:24,position:"relative"}}>
            {belastningBuckets.map((b,i)=>{
              const h=maxBucket>0?Math.round(b.antal/maxBucket*100):0;
              return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%",justifyContent:"flex-end"}}>
                  <div style={{color:b.col,fontSize:11,fontWeight:700}}>{b.antal>0?b.antal:""}</div>
                  <div style={{width:"100%",background:b.col+"33",borderRadius:"4px 4px 0 0",height:`${h}%`,minHeight:b.antal>0?4:0,position:"relative",overflow:"hidden",transition:"height .4s"}}>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,background:b.col,height:"40%",opacity:.7}}/>
                  </div>
                  <div style={{color:C.txtM,fontSize:9,textAlign:"center",position:"absolute",bottom:0}}>{b.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginTop:8}}>
            {belastningBuckets.map(b=>(
              <div key={b.label} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:2,background:b.col}}/>
                <span style={{color:C.txtM,fontSize:10}}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kommende dage */}
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:18}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:4}}>Kommende arbejdsdage</div>
          <div style={{color:C.txtM,fontSize:11,marginBottom:14}}>Planlagte opgaver de næste 5 dage</div>
          {komDage.map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<4?`1px solid ${C.brd}`:"none"}}>
              <div style={{width:40,height:40,borderRadius:8,background:C.s3,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{color:C.txtM,fontSize:9,textTransform:"uppercase"}}>{d.dag}</span>
                <span style={{color:C.txt,fontSize:16,fontWeight:700,lineHeight:1.1}}>{d.nr}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  <Pill color={C.blue} bg={C.blueM}>{d.antal} opgaver</Pill>
                  {d.pat>0&&<Pill color={C.acc} bg={C.accM}>{d.pat} m. patient</Pill>}
                  {d.antal===0&&<Pill color={C.txtM} bg={C.s3}>Ingen bookinger</Pill>}
                </div>
                {d.antal>0&&(
                  <div style={{marginTop:5,background:C.brd,borderRadius:2,height:3}}>
                    <div style={{background:C.blue,width:`${Math.min(d.antal/5*100,100)}%`,height:"100%",borderRadius:2}}/>
                  </div>
                )}
              </div>
              <span style={{color:C.txtM,fontSize:10,flexShrink:0}}>{d.dato}</span>
            </div>
          ))}
        </div>

        {/* Medarbejderudnyttelse - horisontal bar */}
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:18}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:4}}>Medarbejderudnyttelse</div>
          <div style={{color:C.txtM,fontSize:11,marginBottom:14}}>Bookede timer vs. kapacitet</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:240,overflowY:"auto"}}>
            {[...medLoad].sort((a,b)=>b.pct-a.pct).map(m=>{
              const col=m.pct>90?C.red:m.pct>70?C.amb:TITLE_C[m.titel]||C.acc;
              return(
                <div key={m.id}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{color:C.txtD,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{m.navn}</span>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{color:C.txtM,fontSize:10}}>{m.unikPat} pat.</span>
                      <span style={{color:C.txtM,fontSize:10}}>{m.h.toFixed(1)}t/{(m.kapacitetTimer||m.timer).toFixed(0)}t</span>
                      <span style={{color:col,fontSize:11,fontWeight:700}}>{m.pct}%</span>
                    </div>
                  </div>
                  <div style={{background:C.brd,borderRadius:3,height:6,position:"relative"}}>
                    <div style={{background:col,width:`${Math.min(m.pct,100)}%`,height:"100%",borderRadius:3,transition:"width .4s"}}/>
                    {m.pct>100&&<div style={{position:"absolute",right:0,top:-1,width:3,height:8,background:C.red,borderRadius:1}}/>}
                  </div>
                </div>
              );
            })}
            {medLoad.length===0&&<div style={{color:C.txtM,fontSize:12}}>Ingen planlagte opgaver endnu</div>}
          </div>
        </div>

        {/* Patientfremgang - staplet bar */}
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:18}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:4}}>Patientfremgang</div>
          <div style={{color:C.txtM,fontSize:11,marginBottom:14}}>Forløbsstatus per patient</div>
          <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:240,overflowY:"auto"}}>
            {fremgangData.map(p=>{
              const pPlan=p.total>0?Math.round(p.planlagt/p.total*100):0;
              const pAfv=p.total>0?Math.round(p.afventer/p.total*100):0;
              const pFejl=p.total>0?Math.round(p.fejlet/p.total*100):0;
              return(
                <div key={p.navn}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{color:C.txtD,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{p.navn}</span>
                    <span style={{color:C.txtM,fontSize:10}}>{p.planlagt}/{p.total}</span>
                  </div>
                  <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",background:C.brd}}>
                    {pPlan>0&&<div style={{width:`${pPlan}%`,background:C.grn}}/>}
                    {pAfv>0&&<div style={{width:`${pAfv}%`,background:C.amb}}/>}
                    {pFejl>0&&<div style={{width:`${pFejl}%`,background:C.red}}/>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:12,marginTop:10}}>
            {[[C.grn,"Planlagt"],[C.amb,"Afventer"],[C.red,"Ikke fundet"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:2,background:c}}/>
                <span style={{color:C.txtM,fontSize:10}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Valideringsrapport */}
      {fejl.length>0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:18}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:12}}>Regelkontrol</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto"}}>
            {fejl.map((f,i)=>(
              <div key={i} style={{background:f.type==="Fejl"?C.redM:C.ambM,borderLeft:`3px solid ${f.type==="Fejl"?C.red:C.amb}`,borderRadius:6,padding:"6px 10px",fontSize:12}}>
                <span style={{color:f.type==="Fejl"?C.red:C.amb,fontWeight:700}}>{f.type} . {f.emne}: </span>
                <span style={{color:C.txtD}}>{f.beskriv}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {drill&&kpiDrills[drill]&&(
        <Modal title={kpiDrills[drill].title} onClose={()=>setDrill(null)} w={700}>
          {kpiDrills[drill].isRegel?(
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:400,overflowY:"auto"}}>
              {fejl.length===0?<div style={{color:C.grn}}>OK Ingen regelovertrædelser</div>:fejl.map((f,i)=>(
                <div key={i} style={{background:f.type==="Fejl"?C.redM:C.ambM,borderLeft:`3px solid ${f.type==="Fejl"?C.red:C.amb}`,borderRadius:6,padding:"8px 12px",fontSize:13}}>
                  <span style={{color:f.type==="Fejl"?C.red:C.amb,fontWeight:700}}>{f.type} . {f.emne}: </span>
                  <span style={{color:C.txtD}}>{f.beskriv}</span>
                </div>
              ))}
            </div>
          ):(
            <PatientDrillModal title={kpiDrills[drill].title} patienter={patienter}
              filterPat={kpiDrills[drill]?.filterPat||(()=>true)} onClose={()=>setDrill(null)}/>
          )}
        </Modal>
      )}
    </div>
  );
}


// PATIENT KALENDER VIEW - liste med sortering + detail-panel
// ===============================================
// ===============================================
// PATIENT DETALJE MODAL
// ===============================================
