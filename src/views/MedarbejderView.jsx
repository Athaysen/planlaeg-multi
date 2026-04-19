// Medarbejder-klynge: view + MedForm.
import React, { useState, useMemo } from "react";
import { today, addDays, daysBetween, uid, formatBeloeb } from "../utils/index.js";
import { C, LK, PK, PD, TITLE_C } from "../data/constants.js";
import { Btn, Input, Sel, Modal, FRow, Pill, ViewHeader, PeriodeVaelger, beregnKapStatus } from "../components/primitives.jsx";
import MinProfilPanel from "../modals/MinProfilPanel.jsx";

export default function MedarbejderView({medarbejdere,setMedarbejdere,patienter,setPatienter,anmodninger=[],setAnmodninger,isAdmin,certifikater=[],showToast=()=>{},adminData={}}){
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
export function MedForm({med,onSave,onClose,certifikater=[],adminData={}}){
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
