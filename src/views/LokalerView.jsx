// Lokaler & udstyr-klynge: view, forms og underkomponenter.
// IndsatsForm eksporteres fordi ForlobView også bruger den.
import React, { useState, useMemo } from "react";
import { today, addDays, toMin, uid, parseLocalDate, daysBetween, getDag, valutaSymbol, formatBeloeb } from "../utils/index.js";
import { C, ALLE_K, DEFAULT_LOK_TIDER, STANDARD_AABNINGSTIDER, INIT_CERTIFIKATER } from "../data/constants.js";
import { Btn, Input, Modal, FRow, Pill, ViewHeader, PeriodeVaelger } from "../components/primitives.jsx";
import { ConfirmDialog } from "../components/dialogs.jsx";

export default function LokalerView({patienter,lokTider,setLokTider,lokMeta={},setLokMeta,lokaler=[],saveLokaler=()=>{},adminData={},udstyrsKat=[],saveUdstyrsKat=()=>{},udstyrsPakker=[],saveUdstyrsPakker=()=>{}}){
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
export function UdstyrPanel({udstyr=[], onChange}) {
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

export function IndsatsForm({indsats, onSave, onClose, lokaler=[]}) {
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

