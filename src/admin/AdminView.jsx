import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { today, addDays, VALUTAER, valutaSymbol, formatBeloeb } from "../utils/index.js";
import { C, KAP_TYPER, FORLOB_GALLERI, TITLE_C } from "../data/constants.js";
import { Btn, Input, Sel, Modal, FRow, Pill, ViewHeader, beregnMaxTimer } from "../components/primitives.jsx";

// Eneste export — AdminView. De andre (RulleplanNotifView, AdminAfdelingerTab,
// AdminBrugereTab, FaggrupperTab, ForlobAdminTab) er intern til admin-siden.
export default 
function AdminView({adminData,setAdminData,anmodninger=[],setAnmodninger,medarbejdere=[],setMedarbejdere,rulNotif=[],setRulNotif=()=>{},patienter=[],setPatienter=()=>{},aktivLog=[],setAktivLog=()=>{},gemLog=()=>{},lokMeta={},config={},setConfig=()=>{},setForlob=()=>{},forlob={},forlobMeta={},setForlobMeta=()=>{},setLokTider=()=>{},setLokMeta=()=>{},lokaler=[],saveLokaler=()=>{},indsatser=[],setIndsatser=()=>{},showToast=()=>{}}){
  const [tab,setTab]=useState("selskab");
  const [dstTab,setDstTab]=useState("feltregler");
  const [patOmkFra,setPatOmkFra]=useState(today());
  const [patOmkTil,setPatOmkTil]=useState(addDays(today(),28));
  const [patOmkGrp,setPatOmkGrp]=useState("patient");
  const [kapMedSøg,setKapMedSøg]=useState("");
  const [kapMedTitel,setKapMedTitel]=useState("alle");
  const [kapMedÅben,setKapMedÅben]=useState(null);
  const [kapSubTab,setKapSubTab]=useState("medarbejdere");
  const [opgKapGruppe,setOpgKapGruppe]=useState("faggruppe");
  const [allokeringsMetode,setAllokeringsMetode]=useState("prioriteret"); // "prioriteret" | "proportional"
  const [opgKapFra,setOpgKapFra]=useState(today());
  const [opgKapTil,setOpgKapTil]=useState(addDays(today(),28));
 // "selskab"|"afdelinger"|"fhir"|"brugere"
  const upd=(fn)=>setAdminData(d=>({...d,...fn(d)}));
  const selskab=adminData.selskaber[0];
  const updS=(k,v)=>upd(d=>({selskaber:[{...d.selskaber[0],[k]:v},...d.selskaber.slice(1)]}));

  const afventer=anmodninger.filter(a=>a.status==="afventer").length;
  const TABS=[
    {id:"selskab",      label:" Selskab",       desc:"Navn, CVR og servermodel"},
    {id:"afdelinger",   label:" Afdelinger",     desc:"Hierarki og underafdelinger"},
    {id:"brugere",      label:" Brugere",        desc:"Roller og adgange"},
    {id:"faggrupper",   label:" Faggrupper",     desc:"Titler og standard-takster"},
    {id:"forlob",       label:" Forløb",         desc:"Skabeloner, import/eksport, galleri"},
    {id:"admindst",     label:"Admin indstillinger", desc:"Hvad medarbejdere kan ændre selv"},
    {id:"aktivlog",     label:"Aktivitets-log",        desc:"Alle bevægelser i systemet"},
    {id:"indstillinger",label:"Indstillinger",          desc:"Planlægning, IT og hjælp"},
    {id:"godkendelser", label:"Godkendelser",      desc:afventer>0?`${afventer} afventer`:"Profilanmodninger"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Header */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 22px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}></span>
          <div>
            <div style={{color:C.txt,fontWeight:800,fontSize:18}}>Admin Panel</div>
            <div style={{color:C.txtM,fontSize:12,marginTop:2}}>{selskab.navn} - kun synlig for administratorer</div>
          </div>
          <span style={{marginLeft:"auto",background:C.accM,color:C.acc,fontSize:11,fontWeight:700,borderRadius:6,padding:"4px 10px"}}>ADMIN</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:tab===t.id?C.accM:"transparent",color:tab===t.id?C.acc:C.txtD,
              border:`1px solid ${tab===t.id?C.acc:C.brd}`,borderRadius:9,padding:"8px 16px",
              cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===t.id?700:400,
              display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2}}>
            <span>{t.label}</span>
            <span style={{fontSize:10,color:C.txtM,fontWeight:400}}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* -- TAB: SELSKAB -- */}
      {tab==="selskab"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Stamoplysninger */}
          <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"18px 20px"}}>
            <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:14}}>Stamoplysninger</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <FRow label="Selskabsnavn"><Input value={selskab.navn} onChange={v=>updS("navn",v)} placeholder="f.eks. Region Hovedstaden"/></FRow>
              <FRow label="CVR-nummer"><Input value={selskab.cvr} onChange={v=>updS("cvr",v)} placeholder="12345678"/></FRow>
              <FRow label="Land"><Input value={selskab.land} onChange={v=>updS("land",v)} placeholder="Danmark"/></FRow>
              <FRow label="Telefon"><Input value={selskab.telefon||""} onChange={v=>updS("telefon",v)} placeholder="f.eks. 89 49 00 00"/></FRow>
              <FRow label="Email"><Input value={selskab.email||""} onChange={v=>updS("email",v)} placeholder="kontakt@selskab.dk"/></FRow>
              <FRow label="Hjemmeside"><Input value={selskab.website||""} onChange={v=>updS("website",v)} placeholder="www.selskab.dk"/></FRow>
            </div>
            <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 100px 1fr",gap:10}}>
              <FRow label="Vejnavn"><Input value={selskab.adresseVej||""} onChange={v=>updS("adresseVej",v)} placeholder="f.eks. Nørrebrogade 44"/></FRow>
              <FRow label="Postnr."><Input value={selskab.adressePostnr||""} onChange={v=>updS("adressePostnr",v)} placeholder="8000"/></FRow>
              <FRow label="By"><Input value={selskab.adresseBy||""} onChange={v=>updS("adresseBy",v)} placeholder="Aarhus C"/></FRow>
            </div>
          </div>

          {/* Ledere */}
          <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"18px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{color:C.txt,fontWeight:700,fontSize:14}}>Ledelse ({(selskab.ledere||[]).length})</div>
              <Btn v="outline" small onClick={()=>updS("ledere",[...(selskab.ledere||[]),{id:"l"+Date.now(),navn:"",mail:"",telefon:"",titel:""}])}>
                + Tilføj leder
              </Btn>
            </div>
            {(selskab.ledere||[]).length===0&&(
              <div style={{color:C.txtM,fontSize:12,fontStyle:"italic"}}>Ingen ledere registreret endnu</div>
            )}
            {(selskab.ledere||[]).map((l,i)=>(
              <div key={l.id} style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:9,padding:"10px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{color:C.acc,fontWeight:700,fontSize:12}}>Leder {i+1}</div>
                  <button onClick={()=>updS("ledere",(selskab.ledere||[]).filter(x=>x.id!==l.id))}
                    style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>Fjern</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  <FRow label="Navn"><Input value={l.navn} onChange={v=>updS("ledere",(selskab.ledere||[]).map(x=>x.id===l.id?{...x,navn:v}:x))} placeholder="Fulde navn"/></FRow>
                  <FRow label="Titel"><Input value={l.titel||""} onChange={v=>updS("ledere",(selskab.ledere||[]).map(x=>x.id===l.id?{...x,titel:v}:x))} placeholder="f.eks. Direktør"/></FRow>
                  <FRow label="Email"><Input value={l.mail} onChange={v=>updS("ledere",(selskab.ledere||[]).map(x=>x.id===l.id?{...x,mail:v}:x))} placeholder="leder@selskab.dk"/></FRow>
                  <FRow label="Telefon"><Input value={l.telefon} onChange={v=>updS("ledere",(selskab.ledere||[]).map(x=>x.id===l.id?{...x,telefon:v}:x))} placeholder="f.eks. 20 30 40 50"/></FRow>
                </div>
              </div>
            ))}
          </div>


          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <Btn v="primary" onClick={()=>{}}>Gem ændringer</Btn>
          </div>
        </div>
      )}

      {/* -- TAB: AFDELINGER -- */}
      {tab==="afdelinger"&&(
        <AdminAfdelingerTab selskab={selskab} updS={updS} medarbejdere={medarbejdere}/>
      )}

      {/* -- TAB: FHIR -- */}
      {tab==="brugere"&&(
        <AdminBrugereTab selskab={selskab} updS={updS}/>
      )}

      {/* -- TAB: FAGGRUPPER -- */}
      {tab==="faggrupper"&&(
        <FaggrupperTab adminData={adminData} setAdminData={setAdminData}/>
      )}

      {/* -- TAB: FORLØB -- */}
      {tab==="forlob"&&(
        <ForlobAdminTab forlob={forlob} setForlob={setForlob} forlobMeta={forlobMeta} setForlobMeta={setForlobMeta} lokaler={lokaler} showToast={showToast}/>
      )}

      {/* -- TAB: KAPACITET STANDARDER -- */}
      {tab==="admindst"&&(
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {/* Sub-menu */}
          <>
              <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.brd}`,marginBottom:16}}>
                {[
                  {id:"feltregler",label:"Feltrettigheder",desc:"Hvad medarbejdere kan ændre"},
                  {id:"takster",   label:"Takster",             desc:"Timepris pr. faggruppe og lokale"},
                  {id:"kapacitet", label:"Kapacitetsstandarder",desc:"Grænser pr. faggruppe"},
                ].map(s=>(
                  <button key={s.id} onClick={()=>setDstTab(s.id)}
                    style={{padding:"10px 20px",border:"none",background:"none",cursor:"pointer",
                      fontFamily:"inherit",textAlign:"left",
                      borderBottom:dstTab===s.id?`2px solid ${C.acc}`:"2px solid transparent",
                      color:dstTab===s.id?C.acc:C.txtD}}>
                    <div style={{fontSize:13,fontWeight:dstTab===s.id?700:500}}>{s.label}</div>
                    <div style={{fontSize:11,color:C.txtM}}>{s.desc}</div>
                  </button>
                ))}
              </div>

              {/* FELTRETTIGHEDER */}
              {dstTab==="feltregler"&&(
                <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"20px 22px"}}>
                  <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:4}}>Hvad må medarbejdere ændre selv?</div>
                  <div style={{color:C.txtM,fontSize:12,marginBottom:16}}>Vælg for hvert felt om medarbejderen kan gemme direkte, eller om det kræver leder-godkendelse.</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[
                      {id:"navn",label:"Navn",group:"Stamdata"},{id:"telefon",label:"Telefon",group:"Stamdata"},
                      {id:"mail",label:"Mail",group:"Stamdata"},{id:"afdeling",label:"Afdeling",group:"Stamdata"},
                      {id:"leder",label:"Leder",group:"Stamdata"},{id:"timer",label:"Timer pr. uge",group:"Stamdata"},
                      {id:"titel",label:"Titel",group:"Stamdata"},{id:"kompetencer",label:"Kompetencer",group:"Fagligt"},
                      {id:"certifikater",label:"Certifikater",group:"Fagligt"},{id:"arbejdstider",label:"Arbejdstider",group:"Planlægning"},
                      {id:"hjemadresse",label:"Hjemadresse",group:"Adresse"},{id:"arbejdssted",label:"Arbejdssted",group:"Adresse"},
                      {id:"kapacitet",label:"Kapacitetsindstillinger",group:"Kapacitet"},
                    ].reduce((acc,felt)=>{const grp=acc.find(g=>g.navn===felt.group);if(grp)grp.felter.push(felt);else acc.push({navn:felt.group,felter:[felt]});return acc;},[]).map(grp=>(
                      <div key={grp.navn}>
                        <div style={{color:C.txtM,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6,marginTop:8}}>{grp.navn}</div>
                        {grp.felter.map(felt=>{
                          const val=(adminData.feltRegler||{})[felt.id]||"direkte";
                          return(
                            <div key={felt.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:C.s3,borderRadius:8,border:`1px solid ${C.brd}`,marginBottom:6}}>
                              <div style={{color:C.txt,fontSize:13,fontWeight:500}}>{felt.label}</div>
                              <div style={{display:"flex",gap:4}}>
                                {[["direkte","Gem direkte",C.grn],["godkendelse","Kræver godkendelse",C.acc],["laast","Låst (kun admin)",C.red]].map(([v,lbl,col])=>(
                                  <button key={v} onClick={()=>setAdminData(d=>({...d,feltRegler:{...(d.feltRegler||{}),[felt.id]:v}}))}
                                    style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${val===v?col:C.brd}`,
                                      background:val===v?col+"22":"transparent",color:val===v?col:C.txtM,
                                      fontSize:11,fontWeight:val===v?700:400,cursor:"pointer",fontFamily:"inherit"}}>
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAKTINDSTILLINGER */}
              {dstTab==="takster"&&(
                  <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"20px 22px",marginTop:16}}>
                    <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:4}}>Omkostning pr. patient</div>
                    <div style={{color:C.txtM,fontSize:12,marginBottom:14}}>Beregnet ud fra planlagte opgavers varighed × medarbejderens timepris + lokalets timepris.</div>
                    {/* Periode + gruppering */}
                    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Fra</span>
                        <input type="date" value={patOmkFra||today()} onChange={e=>setPatOmkFra(e.target.value)}
                          style={{padding:"6px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                      </div>
                      <span style={{color:C.txtD}}>-</span>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Til</span>
                        <input type="date" value={patOmkTil||addDays(today(),28)} onChange={e=>setPatOmkTil(e.target.value)}
                          style={{padding:"6px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                      </div>
                      {[["4 uger",today(),addDays(today(),28)],["3 mdr",today(),addDays(today(),90)],["Hele året",`${today().slice(0,4)}-01-01`,`${today().slice(0,4)}-12-31`]].map(([lbl,fra,til])=>{
                        const act=patOmkFra===fra&&patOmkTil===til;
                        return <button key={lbl} onClick={()=>{setPatOmkFra(fra);setPatOmkTil(til);}}
                          style={{padding:"5px 11px",borderRadius:6,border:`1px solid ${act?C.acc:C.brd}`,
                            background:act?C.accM:"transparent",color:act?C.acc:C.txtM,
                            fontSize:12,fontWeight:act?700:400,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>;
                      })}
                      <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                        {[["patient","Pr. patient"],["faggruppe","Faggruppe"],["lokale","Lokale"]].map(([id,lbl])=>(
                          <button key={id} onClick={()=>setPatOmkGrp(id)}
                            style={{padding:"5px 11px",borderRadius:6,border:`1px solid ${patOmkGrp===id?C.acc:C.brd}`,
                              background:patOmkGrp===id?C.accM:"transparent",color:patOmkGrp===id?C.acc:C.txtM,
                              fontSize:12,fontWeight:patOmkGrp===id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    {/* Tabel */}
                    {(()=>{
                      const fra=patOmkFra||today();
                      const til=patOmkTil||addDays(today(),28);
                      const inP=(o)=>o.dato&&o.dato>=fra&&o.dato<=til;
                      const effKr=(m)=>m?.krPrTime??((adminData.taktDefaults||{})[m?.titel]?.krPrTime??0);
                      const lokKr=(lok)=>(lokMeta[lok]?.krPrTime)??((adminData.taktDefaults?.Lokale?.krPrTime)??0);

                      // Byg rækker
                      const rows=[];
                      patienter.forEach(p=>{
                        const opgs=p.opgaver.filter(o=>o.status==="planlagt"&&inP(o));
                        if(opgs.length===0) return;
                        opgs.forEach(o=>{
                          const med=medarbejdere.find(m=>m.navn===o.medarbejder);
                          const timer=(o.minutter||0)/60;
                          const medKr=effKr(med);
                          const lKr=lokKr(o.lokale);
                          rows.push({
                            patientNavn:p.navn,patientId:p.id,
                            faggruppe:med?.titel||"Ukendt",
                            lokale:o.lokale||"—",
                            opgave:o.opgave,timer,
                            medOmk:medKr*timer,lokOmk:lKr*timer,
                            total:(medKr+lKr)*timer,
                          });
                        });
                      });

                      // Gruppér
                      const grupper={};
                      rows.forEach(r=>{
                        const k=patOmkGrp==="patient"?r.patientNavn:patOmkGrp==="faggruppe"?r.faggruppe:r.lokale;
                        if(!grupper[k]) grupper[k]={opgaver:0,timer:0,medOmk:0,lokOmk:0,total:0};
                        grupper[k].opgaver++;
                        grupper[k].timer+=r.timer;
                        grupper[k].medOmk+=r.medOmk;
                        grupper[k].lokOmk+=r.lokOmk;
                        grupper[k].total+=r.total;
                      });

                      const sortedRows=Object.entries(grupper).sort((a,b)=>b[1].total-a[1].total);
                      const grandTotal=sortedRows.reduce((a,[,g])=>a+g.total,0);
                      const fmtKr=(kr)=>formatBeloeb(kr,adminData?.valuta);

                      return sortedRows.length===0?(
                        <div style={{padding:"24px",textAlign:"center",color:C.txtM,fontSize:13,background:C.s3,borderRadius:9}}>
                          Ingen planlagte opgaver i perioden
                        </div>
                      ):(
                        <div style={{border:`1px solid ${C.brd}`,borderRadius:10,overflow:"hidden"}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 80px 110px 110px 120px",
                            padding:"9px 14px",background:C.s3,borderBottom:`1px solid ${C.brd}`}}>
                            {[patOmkGrp==="patient"?"Patient":patOmkGrp==="faggruppe"?"Faggruppe":"Lokale",
                              "Opgaver","Timer","Medarbejder","Lokale","Total"].map(h=>(
                              <span key={h} style={{color:C.txtM,fontSize:11,fontWeight:600}}>{h}</span>
                            ))}
                          </div>
                          {sortedRows.map(([grp,g])=>(
                            <div key={grp} style={{display:"grid",gridTemplateColumns:"1fr 70px 80px 110px 110px 120px",
                              padding:"8px 14px",borderBottom:`1px solid ${C.brd}44`}}>
                              <span style={{color:C.txt,fontSize:13,fontWeight:500}}>{grp}</span>
                              <span style={{color:C.txtD,fontSize:12}}>{g.opgaver}</span>
                              <span style={{color:C.txtD,fontSize:12}}>{g.timer.toFixed(1)}t</span>
                              <span style={{color:C.txtD,fontSize:12}}>{fmtKr(g.medOmk)}</span>
                              <span style={{color:C.txtD,fontSize:12}}>{fmtKr(g.lokOmk)}</span>
                              <span style={{color:C.acc,fontSize:12,fontWeight:700}}>{fmtKr(g.total)}</span>
                            </div>
                          ))}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 80px 110px 110px 120px",
                            padding:"10px 14px",background:C.s3,borderTop:`2px solid ${C.brd}`}}>
                            <span style={{color:C.txt,fontSize:13,fontWeight:700}}>I alt</span>
                            <span style={{color:C.txtD,fontSize:12,fontWeight:600}}>{sortedRows.reduce((a,[,g])=>a+g.opgaver,0)}</span>
                            <span style={{color:C.txtD,fontSize:12,fontWeight:600}}>{sortedRows.reduce((a,[,g])=>a+g.timer,0).toFixed(1)}t</span>
                            <span style={{color:C.txtD,fontSize:12}}>—</span>
                            <span style={{color:C.txtD,fontSize:12}}>—</span>
                            <span style={{color:C.acc,fontSize:13,fontWeight:700}}>{fmtKr(grandTotal)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
              )}

              {/* KAPACITETSSTANDARDER */}
              {dstTab==="kapacitet"&&(
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {/* Sub-navigation: Medarbejdere | Opgaver */}
                  <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.brd}`,marginBottom:16}}>
                    {[{id:"medarbejdere",label:"Medarbejdere"},{id:"opgaver",label:"Opgaver"}].map(s=>(
                      <button key={s.id} onClick={()=>setKapSubTab(s.id)}
                        style={{padding:"9px 20px",border:"none",background:"none",cursor:"pointer",
                          fontFamily:"inherit",fontSize:13,fontWeight:kapSubTab===s.id?700:400,
                          color:kapSubTab===s.id?C.acc:C.txtD,
                          borderBottom:kapSubTab===s.id?`2px solid ${C.acc}`:"2px solid transparent"}}>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* ── MEDARBEJDERE ── */}
                  {kapSubTab==="medarbejdere"&&(<>
                <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"20px 22px"}}>
                  <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:4}}>Kapacitetsstandarder pr. faggruppe</div>
                  <div style={{color:C.txtM,fontSize:12,marginBottom:16}}>Standardindstillinger for alle medarbejdere i faggruppen. Individuelle indstillinger under Min Profil overskrives ikke.</div>
                  {(()=>{
                    const fra=(adminData?.titler||[]).map(t=>t.navn);
                    const ibrug=[...new Set(medarbejdere.map(m=>m?.titel).filter(Boolean))];
                    return [...new Set([...fra,...ibrug])];
                  })().map(titel=>{
                    const kd=(adminData.kapDefaults||{})[titel]||{grænseType:"uge",grænseTimer:23,rullendePeriodeUger:4,rullendeMaxTimer:18};
                    const updKD=(felt,val)=>setAdminData(d=>({...d,kapDefaults:{...(d.kapDefaults||{}),[titel]:{...kd,[felt]:val}}}));
                    return(
                      <div key={titel} style={{marginBottom:14,padding:"16px 18px",background:C.s3,borderRadius:9,border:`1px solid ${C.brd}`}}>
                        <div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:12}}>{titel}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                          <FRow label="Grænse pr.">
                            <select value={kd.grænseType||"uge"} onChange={e=>updKD("grænseType",e.target.value)}
                              style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}>
                              {KAP_TYPER.map(kt=><option key={kt.id} value={kt.id}>{kt.label}</option>)}
                            </select>
                          </FRow>
                          <FRow label="Max timer">
                            <Input type="number" value={kd.grænseTimer||23} min="0" max="500" onChange={v=>updKD("grænseTimer",Number(v))}/>
                          </FRow>
                          <FRow label="Rullende vindue (uger)">
                            <Input type="number" value={kd.rullendePeriodeUger||4} min="1" max="52" onChange={v=>updKD("rullendePeriodeUger",Number(v))}/>
                          </FRow>
                          <FRow label="Max gns t/uge">
                            <Input type="number" value={kd.rullendeMaxTimer||18} min="0" max="168" onChange={v=>updKD("rullendeMaxTimer",Number(v))}/>
                          </FRow>
                        </div>
                        {kd.grænseType==="ialt"&&(
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
                            <FRow label="Fra dato">
                              <input type="date" value={kd.ialtFra||""} onChange={e=>updKD("ialtFra",e.target.value)}
                                style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                            </FRow>
                            <FRow label="Til dato">
                              <input type="date" value={kd.ialtTil||""} onChange={e=>updKD("ialtTil",e.target.value)}
                                style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                            </FRow>
                          </div>
                        )}
                        <div style={{marginTop:12,display:"flex",gap:10,alignItems:"center"}}>
                          <Btn v="subtle" onClick={()=>{}}>Anvend på alle {titel.toLowerCase()}er</Btn>
                          <span style={{color:C.txtM,fontSize:11}}>Individuelle indstillinger overskrives ikke</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Individuelle medarbejder-indstillinger */}
                <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"20px 22px",marginTop:16}}>
                  <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:4}}>Individuelle medarbejdere</div>
                  <div style={{color:C.txtM,fontSize:12,marginBottom:14}}>Justér kapacitet for den enkelte medarbejder. Overskriver faggruppe-standarden.</div>
                  {/* Søg + filter */}
                  <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                    <input placeholder="Søg medarbejder..." value={kapMedSøg||""} onChange={e=>setKapMedSøg(e.target.value)}
                      style={{flex:1,minWidth:180,padding:"7px 12px",border:`1px solid ${C.brd}`,borderRadius:8,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                    {(()=>{
                      const fra=(adminData?.titler||[]).map(t=>t.navn);
                      const ibrug=[...new Set(medarbejdere.map(m=>m?.titel).filter(Boolean))];
                      return ["alle",...new Set([...fra,...ibrug])].map(t=>(
                        <button key={t} onClick={()=>setKapMedTitel(t)}
                          style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${kapMedTitel===t?C.acc:C.brd}`,
                            background:kapMedTitel===t?C.accM:"transparent",color:kapMedTitel===t?C.acc:C.txtM,
                            fontSize:12,fontWeight:kapMedTitel===t?700:400,cursor:"pointer",fontFamily:"inherit"}}>
                          {t==="alle"?"Alle":t}
                        </button>
                      ));
                    })()}
                  </div>
                  {/* Medarbejder liste */}
                  <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:520,overflowY:"auto"}}>
                    {medarbejdere
                      .filter(m=>(kapMedTitel==="alle"||m.titel===kapMedTitel)&&
                        (!(kapMedSøg||"")||m.navn.toLowerCase().includes((kapMedSøg||"").toLowerCase())))
                      .map(m=>{
                        const kd=(adminData.kapDefaults||{})[m.titel]||{grænseType:"uge",grænseTimer:m.timer||23,rullendePeriodeUger:4,rullendeMaxTimer:Math.round((m.timer||23)*0.85)};
                        const mk=m.kapacitet||{...kd,brugerDefault:true};
                        const erDefault=mk.brugerDefault!==false;
                        const updMK=(felt,val)=>setMedarbejdere(ms=>ms.map(mm=>mm.id!==m.id?mm:{...mm,
                          kapacitet:{...(mm.kapacitet||kd),[felt]:val,brugerDefault:false}}));
                        return(
                          <div key={m.id} style={{background:erDefault?C.s3:C.accM+"33",border:`1px solid ${erDefault?C.brd:C.acc}`,
                            borderRadius:9,padding:"12px 16px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:erDefault?0:10}}>
                              <div style={{width:32,height:32,borderRadius:"50%",background:C.accM,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                color:C.acc,fontWeight:700,fontSize:13,flexShrink:0}}>
                                {m.navn[0]}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{color:C.txt,fontSize:13,fontWeight:600}}>{m.navn}</div>
                                <div style={{color:C.txtM,fontSize:11}}>{m.titel} · {erDefault?"Bruger faggruppe-standard":"Individuel indstilling"}</div>
                              </div>
                              {!erDefault&&(
                                <button onClick={()=>setMedarbejdere(ms=>ms.map(mm=>mm.id!==m.id?mm:{...mm,kapacitet:{...kd,brugerDefault:true}}))}
                                  style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${C.brd}`,background:"transparent",
                                    color:C.txtM,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                                  Nulstil til standard
                                </button>
                              )}
                              <button onClick={()=>setKapMedÅben(kapMedÅben===m.id?null:m.id)}
                                style={{padding:"4px 12px",borderRadius:6,border:`1px solid ${C.brd}`,background:"transparent",
                                  color:C.txtD,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                                {kapMedÅben===m.id?"Luk":"Rediger"}
                              </button>
                            </div>
                            {kapMedÅben===m.id&&(
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.brd}`}}>
                                <FRow label="Grænse pr.">
                                  <select value={mk.grænseType||"uge"} onChange={e=>updMK("grænseType",e.target.value)}
                                    style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}>
                                    {KAP_TYPER.map(kt=><option key={kt.id} value={kt.id}>{kt.label}</option>)}
                                  </select>
                                </FRow>
                                <FRow label="Max timer">
                                  <Input type="number" value={mk.grænseTimer||m.timer||23} min="0" max="500" onChange={v=>updMK("grænseTimer",Number(v))}/>
                                </FRow>
                                <FRow label="Rullende (uger)">
                                  <Input type="number" value={mk.rullendePeriodeUger||4} min="1" max="52" onChange={v=>updMK("rullendePeriodeUger",Number(v))}/>
                                </FRow>
                                <FRow label="Max gns t/uge">
                                  <Input type="number" value={mk.rullendeMaxTimer||Math.round((m.timer||23)*0.85)} min="0" max="168" onChange={v=>updMK("rullendeMaxTimer",Number(v))}/>
                                </FRow>
                                {(mk.grænseType||"uge")==="ialt"&&(
                                  <><FRow label="Fra dato">
                                    <input type="date" value={mk.ialtFra||""} onChange={e=>updMK("ialtFra",e.target.value)}
                                      style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                                  </FRow>
                                  <FRow label="Til dato">
                                    <input type="date" value={mk.ialtTil||""} onChange={e=>updMK("ialtTil",e.target.value)}
                                      style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.brd}`,borderRadius:6,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                                  </FRow></>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
</>)}

                  {/* ── OPGAVER ── */}
                  {kapSubTab==="opgaver"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:14}}>

                      {/* Periode + gruppering */}
                      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px 20px",display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
                        <div style={{flex:1}}>
                          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:10}}>Opgave-belastning vs. kapacitet</div>
                          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Fra</span>
                              <input type="date" value={opgKapFra} onChange={e=>setOpgKapFra(e.target.value)}
                                style={{padding:"6px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                            </div>
                            <span style={{color:C.txtD,fontSize:12}}>-</span>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span style={{color:C.txtM,fontSize:12,fontWeight:600}}>Til</span>
                              <input type="date" value={opgKapTil} onChange={e=>setOpgKapTil(e.target.value)}
                                style={{padding:"6px 10px",border:`1px solid ${C.brd}`,borderRadius:7,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit"}}/>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {[["1 uge",today(),addDays(today(),7)],["4 uger",today(),addDays(today(),28)],
                            ["3 mdr",today(),addDays(today(),90)],["Hele året",`${today().slice(0,4)}-01-01`,`${today().slice(0,4)}-12-31`]]
                            .map(([lbl,fra,til])=>{
                              const act=opgKapFra===fra&&opgKapTil===til;
                              return <button key={lbl} onClick={()=>{setOpgKapFra(fra);setOpgKapTil(til);}}
                                style={{padding:"5px 11px",borderRadius:6,border:`1px solid ${act?C.acc:C.brd}`,
                                  background:act?C.accM:"transparent",color:act?C.acc:C.txtM,
                                  fontSize:12,fontWeight:act?700:400,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>;
                            })}
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{color:C.txtM,fontSize:12}}>Gruppér på:</span>
                          {[["faggruppe","Faggruppe"],["forlob","Forløb"],["indsats","Opgave"],["lokale","Lokale"]].map(([id,lbl])=>(
                            <button key={id} onClick={()=>setOpgKapGruppe(id)}
                              style={{padding:"5px 11px",borderRadius:6,border:`1px solid ${opgKapGruppe===id?C.acc:C.brd}`,
                                background:opgKapGruppe===id?C.accM:"transparent",color:opgKapGruppe===id?C.acc:C.txtM,
                                fontSize:12,fontWeight:opgKapGruppe===id?700:400,cursor:"pointer",fontFamily:"inherit"}}>
                              {lbl}
                            </button>
                          ))}
                        {(opgKapGruppe==="forlob"||opgKapGruppe==="indsats")&&(
                          <div style={{display:"flex",gap:3,marginLeft:8,background:C.s3,borderRadius:7,padding:3,border:`1px solid ${C.brd}`}}>
                            {[["prioriteret","Min. underskud"],["proportional","Proportional"]].map(([id,lbl])=>(
                              <button key={id} onClick={()=>setAllokeringsMetode(id)}
                                style={{padding:"4px 10px",borderRadius:5,border:"none",cursor:"pointer",fontFamily:"inherit",
                                  background:allokeringsMetode===id?C.acc:"transparent",
                                  color:allokeringsMetode===id?"#fff":C.txtM,
                                  fontSize:11,fontWeight:allokeringsMetode===id?700:400,transition:"all .15s"}}>
                                {lbl}
                              </button>
                            ))}
                          </div>
                        )}
                        </div>
                      </div>

                      {/* Tabel */}
                      {(()=>{
                        const inPeriod=(o)=>o.dato&&o.dato>=opgKapFra&&o.dato<=opgKapTil;
                        const effKr=(m)=>m?.krPrTime??((adminData.taktDefaults||{})[m?.titel]?.krPrTime??0);
                        const lokKr=(lok)=>(lokMeta[lok]?.krPrTime)??((adminData.taktDefaults?.Lokale?.krPrTime)??0);

                        // Opgaver med patient-kontekst
                        const alleOpgsMedKontekst=patienter.flatMap(p=>
                          p.opgaver.filter(o=>o.status==="planlagt"&&inPeriod(o))
                            .map(o=>({...o,
                              _forlobLabel:p.forlobLabel||`Forløb nr. ${p.forlobNr||"?"}`,
                              _patNavn:p.navn
                            }))
                        );

                        // Afventende opgaver (ikke planlagt endnu) — bruges til forløb-krav
                        const afvOpgsMedKontekst=patienter.flatMap(p=>
                          p.opgaver.filter(o=>o.status==="afventer")
                            .map(o=>({...o,
                              _forlobLabel:p.forlobLabel||`Forløb nr. ${p.forlobNr||"?"}`,
                              _patNavn:p.navn
                            }))
                        );

                        // gruppeNøgle
                        const gruppeNøgle=(o)=>{
                          if(opgKapGruppe==="faggruppe"){const m=medarbejdere.find(mm=>mm.navn===o.medarbejder);return m?.titel||"Ukendt";}
                          if(opgKapGruppe==="forlob") return o._forlobLabel||"Ukendt forløb";
                          if(opgKapGruppe==="indsats") return o.opgave||"Ukendt opgave";
                          if(opgKapGruppe==="lokale") return o.lokale||"Intet lokale";
                          return "Alle";
                        };
                        const afvGruppeNøgle=(o)=>{
                          if(opgKapGruppe==="forlob") return o._forlobLabel||"Ukendt forløb";
                          if(opgKapGruppe==="indsats") return o.opgave||"Ukendt opgave";
                          return null;
                        };

                        // Byg grupper baseret på planlagte opgaver
                        const grupper={};
                        alleOpgsMedKontekst.forEach(o=>{
                          const k=gruppeNøgle(o);
                          if(!grupper[k]) grupper[k]={opgaver:0,minutterPlanlagt:0,minutterAfventer:0};
                          grupper[k].opgaver++;
                          grupper[k].minutterPlanlagt+=o.minutter||0;
                        });
                        // Tilføj afventende til forløb/indsats grupper
                        if(opgKapGruppe==="forlob"||opgKapGruppe==="indsats"){
                          afvOpgsMedKontekst.forEach(o=>{
                            const k=afvGruppeNøgle(o);
                            if(!k) return;
                            if(!grupper[k]) grupper[k]={opgaver:0,minutterPlanlagt:0,minutterAfventer:0};
                            grupper[k].minutterAfventer+=o.minutter||0;
                          });
                        }

                        // ── ALLOKERINGS-ENGINE ────────────────────────────────────
                        // Beregn ledig kapacitet pr. medarbejder
                        const medLedigH={};
                        medarbejdere.forEach(m=>{
                          const maxH=beregnMaxTimer(m.kapacitet||{grænseType:"uge",grænseTimer:m.timer||23},opgKapFra,opgKapTil);
                          const booketH=patienter.flatMap(p=>p.opgaver.filter(o=>o.medarbejder===m.navn&&o.status==="planlagt"&&inPeriod(o))).reduce((s,o)=>s+o.minutter/60,0);
                          medLedigH[m.navn]=Math.max(0,maxH-booketH);
                        });

                        // For forløb/indsats: beregn allokeret kapacitet
                        const allekeringsKap={};
                        if(opgKapGruppe==="forlob"||opgKapGruppe==="indsats"){
                          // Find hvilke medarbejdere der kan arbejde på hver gruppe
                          const grpMuligeMed={};
                          Object.keys(grupper).forEach(grp=>{
                            // Mulige medarbejdere = dem der har opgaver i gruppen ELLER er muligMed
                            const opgsIGrp=[...alleOpgsMedKontekst,...afvOpgsMedKontekst].filter(o=>
                              (opgKapGruppe==="forlob"?(o._forlobLabel||"Ukendt forløb"):o.opgave||"Ukendt opgave")===grp
                            );
                            const navne=new Set([
                              ...opgsIGrp.map(o=>o.medarbejder).filter(Boolean),
                              ...opgsIGrp.flatMap(o=>(o.muligeMed||[])),
                            ]);
                            grpMuligeMed[grp]=[...navne];
                          });

                          if(allokeringsMetode==="prioriteret"){
                            // ALGORITME 1: Minimér antal forløb i minus
                            // Sorter grupper: mindst krævet afventer → flest ressourcer til at lukke
                            const medRestH={...medLedigH};
                            const sortedGrps=Object.entries(grupper)
                              .map(([k,g])=>({k,krævetH:g.minutterAfventer/60,meds:grpMuligeMed[k]||[]}))
                              .sort((a,b)=>a.krævetH-b.krævetH); // mindst krævet først
                            sortedGrps.forEach(({k,meds})=>{
                              const tilgængelig=meds.reduce((s,navn)=>s+(medRestH[navn]||0),0);
                              const tildelt=Math.min(tilgængelig,grupper[k].minutterAfventer/60);
                              allekeringsKap[k]=tildelt;
                              // Træk proportionalt fra medarbejderne
                              if(tilgængelig>0){
                                meds.forEach(navn=>{
                                  const andel=(medRestH[navn]||0)/tilgængelig;
                                  medRestH[navn]=Math.max(0,(medRestH[navn]||0)-tildelt*andel);
                                });
                              }
                            });
                          } else {
                            // ALGORITME 2: Proportional fordeling
                            // Beregn pr. medarbejder: total krævet på tværs af alle grupper
                            const medTotalKrævetH={};
                            Object.entries(grupper).forEach(([k,g])=>{
                              const kH=g.minutterAfventer/60;
                              (grpMuligeMed[k]||[]).forEach(navn=>{
                                medTotalKrævetH[navn]=(medTotalKrævetH[navn]||0)+kH;
                              });
                            });
                            Object.entries(grupper).forEach(([k,g])=>{
                              const kH=g.minutterAfventer/60;
                              const meds=grpMuligeMed[k]||[];
                              const allok=meds.reduce((s,navn)=>{
                                const total=medTotalKrævetH[navn]||1;
                                const andel=kH/total;
                                return s+(medLedigH[navn]||0)*Math.min(andel,1);
                              },0);
                              allekeringsKap[k]=allok;
                            });
                          }
                        }

                        // kapPerGruppe for faggruppe + lokale (eksisterende logik)
                        const kapPerGruppeFagLok=(grpNavn)=>{
                          if(opgKapGruppe!=="faggruppe"&&opgKapGruppe!=="lokale") return null;
                          let relevanteMeds=[];
                          if(opgKapGruppe==="faggruppe"){
                            relevanteMeds=medarbejdere.filter(m=>m.titel===grpNavn);
                          } else {
                            const medNavne=[...new Set(alleOpgsMedKontekst.filter(o=>(o.lokale||"Intet lokale")===grpNavn).map(o=>o.medarbejder).filter(Boolean))];
                            relevanteMeds=medarbejdere.filter(m=>medNavne.includes(m.navn));
                          }
                          if(relevanteMeds.length===0) return null;
                          return relevanteMeds.reduce((a,m)=>{
                            const maxH=beregnMaxTimer(m.kapacitet||{grænseType:"uge",grænseTimer:m.timer||23},opgKapFra,opgKapTil);
                            const booketH=patienter.flatMap(p=>p.opgaver.filter(o=>o.medarbejder===m.navn&&o.status==="planlagt"&&inPeriod(o))).reduce((s,o)=>s+o.minutter/60,0);
                            return{maxH:a.maxH+maxH,booketH:a.booketH+booketH};
                          },{maxH:0,booketH:0});
                        };

                        const sortedRows=Object.entries(grupper).sort((a,b)=>b[1].minutterPlanlagt-a[1].minutterPlanlagt);
                        const erForlobIndsats=opgKapGruppe==="forlob"||opgKapGruppe==="indsats";
                        const fmtKr=(kr)=>formatBeloeb(kr,adminData?.valuta);
                        const fmtH=(h)=>typeof h==="number"&&h!==0?h.toFixed(1)+"t":"—";

                        return sortedRows.length===0?(
                          <div style={{padding:"32px",textAlign:"center",color:C.txtM,fontSize:13,background:C.s3,borderRadius:9}}>
                            Ingen planlagte opgaver i perioden
                          </div>
                        ):(
                          <>
                          <div style={{border:`1px solid ${C.brd}`,borderRadius:10,overflow:"hidden"}}>
                            <div style={{display:"grid",
                              gridTemplateColumns:erForlobIndsats?"1fr 70px 90px 90px 110px 90px":"1fr 70px 100px 110px 110px 90px",
                              padding:"9px 14px",background:C.s3,borderBottom:`1px solid ${C.brd}`}}>
                              {[
                                opgKapGruppe==="faggruppe"?"Faggruppe":opgKapGruppe==="forlob"?"Forløb":opgKapGruppe==="indsats"?"Opgave":"Lokale",
                                "Opg.",
                                erForlobIndsats?"Planlagt":"Timer krævet",
                                erForlobIndsats?"Afventer":"Max kapacitet",
                                erForlobIndsats?"Allokeret kap.":"Ledig",
                                "Balance"
                              ].map(h=>(
                                <span key={h} style={{color:C.txtM,fontSize:11,fontWeight:600}}>{h}</span>
                              ))}
                            </div>
                            {sortedRows.map(([grp,g])=>{
                              const planlagtH=g.minutterPlanlagt/60;
                              const afventerH=g.minutterAfventer/60;
                              let maxH=null,ledigH=null,balanceH=null;
                              if(erForlobIndsats){
                                const allok=allekeringsKap[grp]??null;
                                ledigH=allok;
                                balanceH=allok!==null?allok-afventerH:null;
                              } else {
                                const kap=kapPerGruppeFagLok(grp);
                                if(kap){
                                  maxH=kap.maxH;
                                  ledigH=kap.maxH-kap.booketH;
                                  balanceH=ledigH-planlagtH;
                                }
                              }
                              const over=balanceH!==null&&balanceH<0;
                              return(
                                <div key={grp} style={{display:"grid",
                                  gridTemplateColumns:erForlobIndsats?"1fr 70px 90px 90px 110px 90px":"1fr 70px 100px 110px 110px 90px",
                                  padding:"8px 14px",borderBottom:`1px solid ${C.brd}44`,
                                  background:over?C.redM+"22":C.s2}}>
                                  <span style={{color:C.txt,fontSize:13,fontWeight:500}}>{grp}</span>
                                  <span style={{color:C.txtD,fontSize:12}}>{g.opgaver}</span>
                                  <span style={{color:C.txtD,fontSize:12,fontWeight:600}}>{fmtH(planlagtH)}</span>
                                  <span style={{color:erForlobIndsats&&afventerH>0?C.amb:C.txtD,fontSize:12}}>
                                    {erForlobIndsats?fmtH(afventerH):maxH?fmtH(maxH):"—"}
                                  </span>
                                  <span style={{color:ledigH!==null&&ledigH<0?C.red:C.grn,fontSize:12}}>
                                    {ledigH!==null?fmtH(ledigH):"—"}
                                  </span>
                                  <span style={{color:over?C.red:balanceH!==null?C.grn:C.txtM,fontSize:12,fontWeight:700}}>
                                    {balanceH!==null?(balanceH>0?"+":"")+balanceH.toFixed(1)+"t":"—"}
                                  </span>
                                </div>
                              );
                            })}
                            <div style={{display:"grid",
                              gridTemplateColumns:erForlobIndsats?"1fr 70px 90px 90px 110px 90px":"1fr 70px 100px 110px 110px 90px",
                              padding:"10px 14px",background:C.s3,borderTop:`2px solid ${C.brd}`}}>
                              <span style={{color:C.txt,fontSize:13,fontWeight:700}}>I alt</span>
                              <span style={{color:C.txtD,fontSize:12,fontWeight:600}}>{sortedRows.reduce((a,[,g])=>a+g.opgaver,0)}</span>
                              <span style={{color:C.txt,fontSize:12,fontWeight:700}}>{fmtH(sortedRows.reduce((a,[,g])=>a+g.minutterPlanlagt/60,0))}</span>
                              <span style={{color:erForlobIndsats?C.amb:C.txtM,fontSize:12}}>
                                {erForlobIndsats?fmtH(sortedRows.reduce((a,[,g])=>a+g.minutterAfventer/60,0)):"—"}
                              </span>
                              <span style={{color:C.txtM,fontSize:12}}>—</span>
                              <span style={{color:C.txtM,fontSize:12}}>—</span>
                            </div>
                          </div>
                          {erForlobIndsats&&(
                            <div style={{background:C.accM,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.acc,display:"flex",gap:8,alignItems:"flex-start"}}>
                              <span style={{fontWeight:700,flexShrink:0}}>i</span>
                              <span>
                                <strong>Allokeret kapacitet</strong> beregnes ved at fordele medarbejdernes ledige timer én gang på tværs af forløb.{" "}
                                Metode: <strong>{allokeringsMetode==="prioriteret"?"Prioriteret (minimér underskud)":"Proportional (fair fordeling)"}</strong>.{" "}
                                Balance = Allokeret − Afventer (negativ = kapacitetsmangel).
                              </span>
                            </div>
                          )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
          </>
        </div>
      )}
      {tab==="indstillinger"&&(
        <IndstillingerView
          config={config} setConfig={setConfig}
          setPatienter={setPatienter} setMedarbejdere={setMedarbejdere}
          setForlob={setForlob} forlob={forlob}
          setLokTider={setLokTider} lokMeta={lokMeta} setLokMeta={setLokMeta}
          patienter={patienter} lokaler={lokaler} saveLokaler={saveLokaler}
          medarbejdere={medarbejdere} setIndsatser={setIndsatser} indsatser={indsatser}
        />
      )}
      {tab==="aktivlog"&&(
        <AktivLogView aktivLog={aktivLog} setAktivLog={setAktivLog} gemLog={gemLog} adminData={adminData}/>
      )}
      {tab==="godkendelser"&&(
        <GodkendelsesView anmodninger={anmodninger} setAnmodninger={setAnmodninger} medarbejdere={medarbejdere} setMedarbejdere={setMedarbejdere} rulNotif={rulNotif} setRulNotif={setRulNotif} patienter={patienter} setPatienter={setPatienter}/>
      )}

    </div>
  );
}

// 
// RULLEPLAN NOTIFIKATIONER - mail-log + beslutningsstyring
// 
function RulleplanNotifView({rulNotif,setRulNotif,medarbejdere=[]}){
  const [valgt,setValgt]=useState(null);
  const today=new Date().toISOString().slice(0,10);

  const afventer=rulNotif.filter(n=>n.status==="afventer-svar"||n.status==="rykket");
  const behandlet=rulNotif.filter(n=>n.status==="besluttet"||n.status==="afsluttet");

  // Hjælp: format dato pænt
  const fmtD=(iso)=>{
    if(!iso) return "—";
    const [y,m,d]=iso.split("-");
    return `${d}.${m}.${y}`;
  };

  // Status-farve
  const stC={
    "afventer-svar":{c:C.amb,bg:C.ambM,l:"Afventer svar"},
    "rykket":{c:C.blue,bg:C.blue+"22",l:"Rykker sendt"},
    "besluttet":{c:C.grn,bg:C.grnM,l:"Besluttet"},
    "afsluttet":{c:C.txtM,bg:C.s3,l:"Afsluttet"},
  };

  // Send rykker-mail til medarbejder
  const sendRykker=(id)=>{
    const tid=new Date().toISOString();
    setRulNotif(prev=>prev.map(n=>{
      if(n.id!==id) return n;
      return {...n,
        status:"rykket",
        log:[...n.log,{
          tid,
          tekst:`Rykker (Mail #2) sendt til ${n.medNavn||"medarbejder"}${n.medMail?" ("+n.medMail+")":""}. Frist fortsat ${fmtD(n.svarFrist)}.`
        }]
      };
    }));
  };

  // Send eskalering til ansvarlig for patient
  const sendEskalering=(id)=>{
    const tid=new Date().toISOString();
    setRulNotif(prev=>prev.map(n=>{
      if(n.id!==id) return n;
      return {...n,
        status:"rykket",
        log:[...n.log,{
          tid,
          tekst:`Eskalering (Mail #3) sendt til ansvarlig ${n.ansvarligNavn||"(ukendt)"}${n.ansvarligMail?" ("+n.ansvarligMail+")":""}. Opgave markeret "Afventer beslutning".`
        }]
      };
    }));
  };

  // Medarbejder træffer beslutning: forlæng eller afslut
  const træfBeslutning=(id,beslutning)=>{
    const tid=new Date().toISOString();
    setRulNotif(prev=>prev.map(n=>{
      if(n.id!==id) return n;
      const tekst=beslutning==="forlæng"
        ? `Medarbejder valgte at forlænge. Ny ${n.rullerOpgave||n.opgaveType}-opgave planlagt tidligst om ${n.rullerTidligstUger} uger, senest om ${n.rullerSenestUger} uger.`
        : `Medarbejder valgte at afslutte. Ingen ny opgave oprettes.`;
      return {...n,status:"besluttet",beslutning,log:[...n.log,{tid,tekst}]};
    }));
  };

  const overDue=(n)=>n.svarFrist<today && n.status==="afventer-svar";
  const kanRykke=(n)=>n.status==="afventer-svar" && n.rykkDato<=today;
  const kanEskalere=(n)=>n.status==="rykket" && n.svarFrist<today;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <ViewHeader titel="Rulleplan-notifikationer" undertitel="Mail-flow ved afsluttede rullende opgaver"/>

      {/* Statistik-header */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {[
          ["Afventer svar",afventer.filter(n=>n.status==="afventer-svar").length,C.amb,C.ambM],
          ["Rykker sendt",afventer.filter(n=>n.status==="rykket").length,C.blue,C.blue+"22"],
          ["Besluttet",behandlet.filter(n=>n.status==="besluttet").length,C.grn,C.grnM],
          ["Afsluttet",behandlet.filter(n=>n.status==="afsluttet").length,C.txtM,C.s3],
        ].map(([lbl,n,col,bg])=>(
          <div key={lbl} style={{background:bg,border:`1px solid ${col}33`,borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
            <div style={{color:col,fontWeight:900,fontSize:24}}>{n}</div>
            <div style={{color:col,fontSize:11,fontWeight:600,marginTop:2}}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Aktive notifikationer */}
      {afventer.length===0&&behandlet.length===0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"40px",textAlign:"center",color:C.txtM}}>
          <div style={{fontSize:32,marginBottom:8}}></div>
          <div style={{fontSize:14,fontWeight:600,color:C.txt}}>Ingen rulleplan-notifikationer endnu</div>
          <div style={{fontSize:12,marginTop:4}}>Notifikationer oprettes automatisk når en rullende opgave markeres løst</div>
        </div>
      )}

      {afventer.length>0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,background:C.ambM+"44",display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:C.amb,fontSize:14}}>...</span>
            <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Afventer beslutning ({afventer.length})</span>
          </div>
          {afventer.map((n,i)=>(
            <div key={n.id} style={{padding:"16px 18px",borderBottom:i<afventer.length-1?`1px solid ${C.brd}`:"none",
              background:valgt===n.id?C.accM+"22":"transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{flex:1}}>
                  {/* Patient + opgave info */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                    <span style={{color:C.txt,fontWeight:700,fontSize:14}}>{n.patNavn}</span>
                    <span style={{background:C.accM,color:C.acc,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{n.opgaveType}</span>
                    <span style={{...(stC[n.status]||{}),borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600,background:stC[n.status]?.bg,color:stC[n.status]?.c}}>{stC[n.status]?.l}</span>
                    {overDue(n)&&<span style={{background:C.redM||C.red+"22",color:C.red,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>OVERSKREDET</span>}
                  </div>
                  {/* Detaljer */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                    <div style={{background:C.s3,borderRadius:7,padding:"6px 10px"}}>
                      <div style={{color:C.txtM,fontSize:10,fontWeight:600}}>MEDARBEJDER</div>
                      <div style={{color:C.txt,fontSize:12,fontWeight:600,marginTop:1}}>{n.medNavn||"—"}</div>
                      <div style={{color:C.txtM,fontSize:10}}>{n.medMail||"ingen mail"}</div>
                    </div>
                    <div style={{background:C.s3,borderRadius:7,padding:"6px 10px"}}>
                      <div style={{color:C.txtM,fontSize:10,fontWeight:600}}>SVARFRIST</div>
                      <div style={{color:overDue(n)?C.red:C.txt,fontSize:12,fontWeight:600,marginTop:1}}>{fmtD(n.svarFrist)}</div>
                      <div style={{color:C.txtM,fontSize:10}}>Løst: {fmtD(n.løstDato)}</div>
                    </div>
                    <div style={{background:C.s3,borderRadius:7,padding:"6px 10px"}}>
                      <div style={{color:C.txtM,fontSize:10,fontWeight:600}}>NÆSTE OPGAVE</div>
                      <div style={{color:C.txt,fontSize:12,fontWeight:600,marginTop:1}}>{n.rullerOpgave||n.opgaveType}</div>
                      <div style={{color:C.txtM,fontSize:10}}>{n.rullerTidligstUger}–{n.rullerSenestUger} uger frem</div>
                    </div>
                  </div>
                </div>

                {/* Handlinger */}
                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,minWidth:130}}>
                  {/* Simulér svar fra medarbejder */}
                  <div style={{background:C.s3,borderRadius:8,padding:"8px 10px",border:`1px solid ${C.brd}`}}>
                    <div style={{color:C.txtM,fontSize:10,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Medarbejder svarer</div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>træfBeslutning(n.id,"forlæng")}
                        style={{flex:1,background:C.grnM,color:C.grn,border:`1px solid ${C.grn}44`,borderRadius:6,padding:"5px 4px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        ~ Forlæng
                      </button>
                      <button onClick={()=>træfBeslutning(n.id,"afslut")}
                        style={{flex:1,background:C.s1,color:C.txtM,border:`1px solid ${C.brd}`,borderRadius:6,padding:"5px 4px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                         Afslut
                      </button>
                    </div>
                  </div>
                  {/* Rykker / eskalering */}
                  {kanRykke(n)&&(
                    <button onClick={()=>sendRykker(n.id)}
                      style={{background:C.blue+"22",color:C.blue,border:`1px solid ${C.blue}44`,borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                       Send rykker
                    </button>
                  )}
                  {kanEskalere(n)&&(
                    <button onClick={()=>sendEskalering(n.id)}
                      style={{background:C.ambM,color:C.amb,border:`1px solid ${C.amb}44`,borderRadius:7,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                       Eskalér til ansvarlig
                    </button>
                  )}
                  {/* Log-toggle */}
                  <button onClick={()=>setValgt(valgt===n.id?null:n.id)}
                    style={{background:"transparent",border:`1px solid ${C.brd}`,borderRadius:7,padding:"5px 10px",fontSize:11,color:C.txtM,cursor:"pointer",fontFamily:"inherit"}}>
                    {valgt===n.id?" Skjul log":" Vis log"}
                  </button>
                </div>
              </div>

              {/* Log */}
              {valgt===n.id&&(
                <div style={{marginTop:10,background:C.s3,borderRadius:9,padding:"10px 14px",border:`1px solid ${C.brd}`}}>
                  <div style={{color:C.txt,fontWeight:700,fontSize:12,marginBottom:8}}>Hændelseslog</div>
                  {n.log.map((l,j)=>(
                    <div key={j} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:j<n.log.length-1?6:0}}>
                      <span style={{color:C.txtM,fontSize:10,whiteSpace:"nowrap",marginTop:1}}>
                        {new Date(l.tid).toLocaleDateString("da-DK",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                      </span>
                      <span style={{color:C.txtD,fontSize:12}}>{l.tekst}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Behandlet historik */}
      {behandlet.length>0&&(
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`}}>
            <span style={{color:C.txt,fontWeight:700,fontSize:14}}>Behandlet historik ({behandlet.length})</span>
          </div>
          {behandlet.map((n,i)=>(
            <div key={n.id} style={{padding:"12px 18px",borderBottom:i<behandlet.length-1?`1px solid ${C.brd}`:"none",
              display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  <span style={{color:C.txt,fontWeight:600,fontSize:13}}>{n.patNavn}</span>
                  <span style={{color:C.txtM,fontSize:11}}>·</span>
                  <span style={{color:C.txtD,fontSize:12}}>{n.opgaveType}</span>
                  <span style={{color:C.txtM,fontSize:11}}>·</span>
                  <span style={{color:C.txtM,fontSize:11}}>{fmtD(n.løstDato)}</span>
                </div>
                <div style={{color:C.txtM,fontSize:11}}>{n.medNavn} → {n.beslutning==="forlæng"?"Forlænget ~":"Afsluttet "}</div>
              </div>
              <span style={{background:n.beslutning==="forlæng"?C.grnM:C.s3,color:n.beslutning==="forlæng"?C.grn:C.txtM,
                fontSize:11,fontWeight:700,borderRadius:5,padding:"3px 10px",whiteSpace:"nowrap"}}>
                {n.beslutning==="forlæng"?"~ Forlænget":" Afsluttet"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// -- Afdelinger tab med hierarki --
function AdminAfdelingerTab({selskab,updS,medarbejdere=[]}){
  const [valgt,setValgt]=useState(null);
  const [nyNavn,setNyNavn]=useState("");
  const [nyParent,setNyParent]=useState("");
  const [redigerer,setRedigerer]=useState(false);
  const [delAfd,setDelAfd]=useState(null);



  const alleAfd=(afds,depth=0)=>{
    const res=[];
    for(const a of afds){
      res.push({...a,depth});
      if(a.children?.length) res.push(...alleAfd(a.children,depth+1));
    }
    return res;
  };
  const flat=alleAfd(selskab.afdelinger||[]);

  const opretAfd=()=>{
    if(!nyNavn.trim()) return;
    const nyId="a"+Date.now();
    const ny={
      id:nyId, navn:nyNavn.trim(), parentId:nyParent||null,
      beskrivelse:"", children:[],
      ledere:[],
      adresseVej:"", adressePostnr:"", adresseBy:"",
      telefon:"", email:"",
    };
    const indsæt=(afds)=>afds.map(a=>{
      if(a.id===nyParent) return {...a,children:[...(a.children||[]),ny]};
      if(a.children?.length) return {...a,children:indsæt(a.children)};
      return a;
    });
    if(!nyParent) updS("afdelinger",[...(selskab.afdelinger||[]),ny]);
    else updS("afdelinger",indsæt(selskab.afdelinger||[]));
    setNyNavn(""); setNyParent("");
    setValgt(nyId);
    setRedigerer(true);
  };

  const sletAfd=(id)=>{
    const fjern=(afds)=>afds.filter(a=>a.id!==id).map(a=>({...a,children:fjern(a.children||[])}));
    updS("afdelinger",fjern(selskab.afdelinger||[]));
    if(valgt===id){setValgt(null);setRedigerer(false);}
  };

  const opdaterAfd=(id,changes)=>{
    const opd=(afds)=>afds.map(a=>{
      if(a.id===id) return {...a,...changes};
      if(a.children?.length) return {...a,children:opd(a.children)};
      return a;
    });
    updS("afdelinger",opd(selskab.afdelinger||[]));
  };

  const afdMed = valgt ? medarbejdere.filter(m=>m.afdeling===valgt) : [];

  return(
    <div style={{display:"flex",gap:14}}>

      {/* Afdelingsliste */}
      <div style={{width:240,background:C.s2,border:"1px solid "+C.brd,borderRadius:12,overflow:"hidden",flexShrink:0}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid "+C.brd,color:C.txt,fontWeight:700,fontSize:13}}>
          Afdelinger ({flat.length})
        </div>
        <div style={{padding:8}}>
          {flat.map(a=>(
            <div key={a.id} onClick={()=>{setValgt(a.id);setRedigerer(false);}}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",
                borderRadius:7,cursor:"pointer",marginLeft:a.depth*14,
                background:valgt===a.id?C.accM:"transparent",
                border:"1px solid "+(valgt===a.id?C.acc:"transparent"),marginBottom:2}}>
              {a.depth>0&&<span style={{color:C.brd2,fontSize:11}}>|--</span>}
              <span style={{color:valgt===a.id?C.acc:C.txt,fontSize:13,fontWeight:valgt===a.id?700:400,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.navn}</span>
              <button onClick={e=>{e.stopPropagation();setDelAfd(a.id);}}
                style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:11,padding:"0 2px",flexShrink:0}}>X</button>
            </div>
          ))}
          {flat.length===0&&<div style={{color:C.txtM,fontSize:12,padding:"10px 8px"}}>Ingen afdelinger endnu</div>}
        </div>

        {/* Opret ny */}
        <div style={{padding:"10px 10px",borderTop:"1px solid "+C.brd}}>
          <div style={{color:C.txtM,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Ny afdeling</div>
          <Input value={nyNavn} onChange={setNyNavn} placeholder="Navn..." style={{marginBottom:6}}/>
          <Sel value={nyParent} onChange={setNyParent}
            options={[{v:"",l:"-- Toplevel --"},...flat.map(a=>({v:a.id,l:("  ".repeat(a.depth))+a.navn}))]}
            style={{width:"100%",marginBottom:8}}/>
          <Btn v="primary" small onClick={opretAfd} style={{width:"100%"}}>+ Opret</Btn>
        </div>
      </div>

      {/* Detalje/rediger panel */}
      {valgt&&(()=>{
        const afd=flat.find(a=>a.id===valgt);
        if(!afd) return null;
        const ledere=afd.ledere||[];

        const tilføjLeder=()=>{
          opdaterAfd(valgt,{ledere:[...ledere,{id:"l"+Date.now(),navn:"",mail:"",telefon:""}]});
        };
        const opdLeder=(lid,field,val)=>{
          opdaterAfd(valgt,{ledere:ledere.map(l=>l.id===lid?{...l,[field]:val}:l)});
        };
        const sletLeder=(lid)=>{
          opdaterAfd(valgt,{ledere:ledere.filter(l=>l.id!==lid)});
        };

        return(
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:12}}>

            {/* Header */}
            <div style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:C.txt,fontWeight:800,fontSize:16}}>{afd.navn}</div>
                <div style={{color:C.txtM,fontSize:11,marginTop:2}}>
                  {afd.depth===0?"Toplevel afdeling":"Underafdeling"}
                  {afd.children?.length>0?" . "+afd.children.length+" underafd.":""}
                  {" . "+afdMed.length+" medarbejdere"}
                </div>
              </div>
              <Btn v={redigerer?"primary":"outline"} small onClick={()=>setRedigerer(r=>!r)}>
                {redigerer?"Luk redigering":"Rediger"}
              </Btn>
            </div>

            {/* Stamoplysninger */}
            <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"14px 18px"}}>
              <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:12}}>Stamoplysninger</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <FRow label="Afdelingsnavn">
                  <Input value={afd.navn} onChange={v=>opdaterAfd(valgt,{navn:v})} disabled={!redigerer} placeholder="Afdelingsnavn"/>
                </FRow>
                <FRow label="Beskrivelse">
                  <Input value={afd.beskrivelse||""} onChange={v=>opdaterAfd(valgt,{beskrivelse:v})} disabled={!redigerer} placeholder="Kort beskrivelse"/>
                </FRow>
                <FRow label="Telefon">
                  <Input value={afd.telefon||""} onChange={v=>opdaterAfd(valgt,{telefon:v})} disabled={!redigerer} placeholder="f.eks. 89 49 00 00"/>
                </FRow>
                <FRow label="Email">
                  <Input value={afd.email||""} onChange={v=>opdaterAfd(valgt,{email:v})} disabled={!redigerer} placeholder="afd@hospital.dk"/>
                </FRow>
              </div>
              <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 100px 1fr",gap:10}}>
                <FRow label="Vejnavn">
                  <Input value={afd.adresseVej||""} onChange={v=>opdaterAfd(valgt,{adresseVej:v})} disabled={!redigerer} placeholder="f.eks. Nørrebrogade 44"/>
                </FRow>
                <FRow label="Postnr.">
                  <Input value={afd.adressePostnr||""} onChange={v=>opdaterAfd(valgt,{adressePostnr:v})} disabled={!redigerer} placeholder="8000"/>
                </FRow>
                <FRow label="By">
                  <Input value={afd.adresseBy||""} onChange={v=>opdaterAfd(valgt,{adresseBy:v})} disabled={!redigerer} placeholder="Aarhus C"/>
                </FRow>
              </div>
            </div>

            {/* Ledere */}
            <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"14px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{color:C.txt,fontWeight:700,fontSize:13}}>Ledere ({ledere.length})</div>
                {redigerer&&<Btn v="outline" small onClick={tilføjLeder}>+ Tilføj leder</Btn>}
              </div>
              {ledere.length===0&&(
                <div style={{color:C.txtM,fontSize:12,fontStyle:"italic"}}>
                  {redigerer?"Tryk '+ Tilføj leder' for at tilknytte en leder":"Ingen ledere registreret"}
                </div>
              )}
              {ledere.map((l,i)=>(
                <div key={l.id} style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:9,padding:"10px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{color:C.acc,fontWeight:700,fontSize:12}}>Leder {i+1}</div>
                    {redigerer&&<button onClick={()=>sletLeder(l.id)} style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>Fjern</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    <FRow label="Navn">
                      <Input value={l.navn} onChange={v=>opdLeder(l.id,"navn",v)} disabled={!redigerer} placeholder="Fulde navn"/>
                    </FRow>
                    <FRow label="Email">
                      <Input value={l.mail} onChange={v=>opdLeder(l.id,"mail",v)} disabled={!redigerer} placeholder="leder@hospital.dk"/>
                    </FRow>
                    <FRow label="Telefon">
                      <Input value={l.telefon} onChange={v=>opdLeder(l.id,"telefon",v)} disabled={!redigerer} placeholder="f.eks. 20 30 40 50"/>
                    </FRow>
                  </div>
                </div>
              ))}
            </div>

            {/* Medarbejdere i afdelingen */}
            <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.brd,color:C.txt,fontWeight:700,fontSize:13}}>
                Medarbejdere i afdelingen ({afdMed.length})
              </div>
              {afdMed.length===0?(
                <div style={{padding:"16px",color:C.txtM,fontSize:12,fontStyle:"italic"}}>
                  Ingen medarbejdere tilknyttet denne afdeling endnu. Tildel afdeling under Medarbejdere-fanen.
                </div>
              ):(
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:C.s3}}>
                      {["Navn","Titel","Telefon","Mail","Timer/uge"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",color:C.txtM,fontSize:11,textAlign:"left",borderBottom:"1px solid "+C.brd,fontWeight:600}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {afdMed.map((m,i)=>(
                      <tr key={m.id} style={{borderBottom:"1px solid "+C.brd,background:i%2===0?"transparent":C.s1+"80"}}>
                        <td style={{padding:"8px 12px",color:C.txt,fontSize:13,fontWeight:600}}>{m.navn}</td>
                        <td style={{padding:"8px 12px"}}><Pill color={TITLE_C[m.titel]||C.acc} bg={(TITLE_C[m.titel]||C.acc)+"22"} sm>{m.titel||"-"}</Pill></td>
                        <td style={{padding:"8px 12px",color:C.txtD,fontSize:12}}>{m.telefon||<span style={{color:C.txtM}}>-</span>}</td>
                        <td style={{padding:"8px 12px",color:C.txtD,fontSize:12}}>{m.mail||<span style={{color:C.txtM}}>-</span>}</td>
                        <td style={{padding:"8px 12px",color:C.txtD,fontSize:12,textAlign:"center"}}>{m.timer}t</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        );
      })()}

      {!valgt&&(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.txtM,fontSize:13,fontStyle:"italic"}}>
          Vælg en afdeling til venstre for at se detaljer
        </div>
      )}
      {delAfd&&<ConfirmDialog
        tekst={"Slet afdelingen? Dette kan ikke fortrydes."}
        onJa={()=>{sletAfd(delAfd);setDelAfd(null);}}
        onNej={()=>setDelAfd(null)}
      />}
    </div>
  );
}

// -- Brugere tab --
function AdminBrugereTab({selskab,updS}){
  const [nyBruger,setNyBruger]=useState(false);
  const [f,setF]=useState({navn:"",email:"",rolle:"planner"});
  const ROLLER=[
    {v:"ejer",       l:"Produkt Ejer",   desc:"Adgang til ejer-konsol og alle lejere"},
    {v:"superadmin", l:"Super Admin",    desc:"Fuld adgang til alt"},
    {v:"admin",      l:"Company Admin",  desc:"Administrerer selskab og afdelinger"},
    {v:"deptadmin",  l:"Dept. Admin",    desc:"Konfigurerer én afdeling"},
    {v:"planner",    l:"Planlægger",     desc:"Opretter patienter og kører planlægning"},
    {v:"viewer",     l:"Viewer",         desc:"Kan kun se egne opgaver"},
  ];
  const ROLLE_C={superadmin:C.red,admin:C.acc,deptadmin:C.blue,planner:C.grn,viewer:C.txtM};

  const opret=()=>{
    if(!f.navn.trim()||!f.email.trim()) return;
    const ny={id:"u"+Date.now(),navn:f.navn,email:f.email,rolle:f.rolle};
    updS("brugere",[...(selskab.brugere||[]),ny]);
    setF({navn:"",email:"",rolle:"planner"}); setNyBruger(false);
  };
  const slet=(id)=>updS("brugere",(selskab.brugere||[]).filter(b=>b.id!==id));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Rolleoversigt */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px 18px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:10}}>Roller & rettigheder</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
          {ROLLER.map(r=>(
            <div key={r.v} style={{background:C.s3,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.brd}`}}>
              <div style={{color:ROLLE_C[r.v]||C.acc,fontWeight:700,fontSize:12}}>{r.l}</div>
              <div style={{color:C.txtM,fontSize:11,marginTop:3}}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brugerliste */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14}}>Brugere ({(selskab.brugere||[]).length})</div>
          <Btn v="primary" small onClick={()=>setNyBruger(true)}>+ Invitér bruger</Btn>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:C.s3}}>
              {["Navn","Email","Rolle",""].map(h=>(
                <th key={h} style={{color:C.txtM,fontSize:11,textAlign:"left",padding:"8px 14px",borderBottom:`1px solid ${C.brd}`,fontWeight:600}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(selskab.brugere||[]).map((b,i)=>(
              <tr key={b.id} style={{borderBottom:`1px solid ${C.brd}`,background:i%2===0?"transparent":C.s1+"60"}}>
                <td style={{padding:"9px 14px",fontSize:13,color:C.txt,fontWeight:600}}>{b.navn}</td>
                <td style={{padding:"9px 14px",fontSize:12,color:C.txtM}}>{b.email}</td>
                <td style={{padding:"9px 14px"}}>
                  <span style={{background:(ROLLE_C[b.rolle]||C.acc)+"22",color:ROLLE_C[b.rolle]||C.acc,
                    fontSize:11,fontWeight:700,borderRadius:4,padding:"2px 8px"}}>
                    {ROLLER.find(r=>r.v===b.rolle)?.l||b.rolle}
                  </span>
                </td>
                <td style={{padding:"9px 14px",textAlign:"right"}}>
                  <button onClick={()=>slet(b.id)}
                    style={{background:"transparent",border:`1px solid ${C.brd}`,borderRadius:5,
                      color:C.red,fontSize:11,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>
                    Fjern
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nyBruger&&(
        <Modal title="Invitér ny bruger" onClose={()=>setNyBruger(false)} w={440}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <FRow label="Fuldt navn"><Input value={f.navn} onChange={v=>setF(p=>({...p,navn:v}))} placeholder="Anna Hansen"/></FRow>
            <FRow label="Email"><Input value={f.email} onChange={v=>setF(p=>({...p,email:v}))} placeholder="anna@hospital.dk" type="email"/></FRow>
            <FRow label="Rolle">
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {ROLLER.filter(r=>r.v!=="superadmin").map(r=>(
                  <label key={r.v} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                    background:f.rolle===r.v?(ROLLE_C[r.v]||C.acc)+"22":"transparent",
                    border:`1px solid ${f.rolle===r.v?ROLLE_C[r.v]||C.acc:C.brd}`,
                    borderRadius:7,padding:"7px 12px"}}>
                    <input type="radio" name="rolle" checked={f.rolle===r.v}
                      onChange={()=>setF(p=>({...p,rolle:r.v}))} style={{accentColor:ROLLE_C[r.v]||C.acc}}/>
                    <div>
                      <span style={{color:f.rolle===r.v?ROLLE_C[r.v]||C.acc:C.txt,fontWeight:600,fontSize:12}}>{r.l}</span>
                      <span style={{color:C.txtM,fontSize:11,marginLeft:8}}>{r.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </FRow>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <Btn v="ghost" onClick={()=>setNyBruger(false)}>Annuller</Btn>
              <Btn v="primary" onClick={opret}>Send invitation</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Faggrupper-tab: tilføj/redigér/slet titler ──
function FaggrupperTab({adminData,setAdminData}){
  const titler=Array.isArray(adminData?.titler)?adminData.titler:[];
  const [redigerId,setRedigerId]=useState(null);
  const [nyOpen,setNyOpen]=useState(false);
  const tomFelt={navn:"",farve:"#0050b3",defaultTimerPerUge:23,defaultKrPrTime:0};
  const [f,setF]=useState(tomFelt);

  const opdAd=(fn)=>setAdminData(d=>{
    const next=fn(d);
    return next;
  });
  const slugId=(navn)=>navn.trim();

  const opret=()=>{
    const navn=f.navn.trim();
    if(!navn) return;
    if(titler.some(t=>t.navn.toLowerCase()===navn.toLowerCase())) return;
    const id=slugId(navn);
    const nyTitel={id,navn,farve:f.farve||"#0050b3",
      defaultTimerPerUge:Number(f.defaultTimerPerUge)||0,
      defaultKrPrTime:Number(f.defaultKrPrTime)||0};
    opdAd(d=>({
      ...d,
      titler:[...(d.titler||[]),nyTitel],
      kapDefaults:{...(d.kapDefaults||{}),[id]:{
        grænseType:"uge",grænseTimer:nyTitel.defaultTimerPerUge,
        rullendePeriodeUger:4,
        rullendeMaxTimer:Math.max(0,Math.round(nyTitel.defaultTimerPerUge*0.85)),
        ialtFra:"",ialtTil:""}},
      taktDefaults:{...(d.taktDefaults||{}),[id]:{krPrTime:nyTitel.defaultKrPrTime}},
    }));
    setF(tomFelt); setNyOpen(false);
  };

  const gem=(id,patch)=>opdAd(d=>{
    const nyTitler=(d.titler||[]).map(t=>t.id===id?{...t,...patch}:t);
    const ny=nyTitler.find(t=>t.id===id);
    return {
      ...d,
      titler:nyTitler,
      kapDefaults:{...(d.kapDefaults||{}),[id]:{
        ...(d.kapDefaults?.[id]||{grænseType:"uge",rullendePeriodeUger:4,ialtFra:"",ialtTil:""}),
        grænseTimer:ny?.defaultTimerPerUge??d.kapDefaults?.[id]?.grænseTimer,
        rullendeMaxTimer:Math.max(0,Math.round((ny?.defaultTimerPerUge??0)*0.85)),
      }},
      taktDefaults:{...(d.taktDefaults||{}),[id]:{krPrTime:ny?.defaultKrPrTime??0}},
    };
  });

  const slet=(id)=>{
    if(titler.length<=1){alert("Mindst én faggruppe skal eksistere.");return;}
    if(!confirm("Slet faggruppen? Eksisterende medarbejdere med denne titel beholder deres titel-tekst, men mister gruppe-defaults."))return;
    opdAd(d=>{
      const {[id]:_a,...kapRest}=d.kapDefaults||{};
      const {[id]:_b,...takRest}=d.taktDefaults||{};
      return {...d, titler:(d.titler||[]).filter(t=>t.id!==id),
        kapDefaults:kapRest, taktDefaults:takRest};
    });
    if(redigerId===id) setRedigerId(null);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px 18px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:6}}>Faggrupper</div>
        <div style={{color:C.txtM,fontSize:12,marginBottom:14}}>
          Definér de titler/faggrupper der bruges i planlægning, kapacitetsstyring og flaskehalsanalyse.
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:10,flexWrap:"wrap"}}>
          <FRow label="Valuta">
            <select value={adminData?.valuta||"DKK"} onChange={e=>setAdminData(d=>({...d,valuta:e.target.value}))}
              style={{padding:"6px 10px",borderRadius:7,border:"1px solid "+C.brd,fontSize:12,fontFamily:"inherit",outline:"none",background:C.s1,color:C.txt}}>
              {Object.entries(VALUTAER).map(([k,v])=>(
                <option key={k} value={k}>{k} – {v.navn} ({v.symbol})</option>
              ))}
            </select>
          </FRow>
          <Btn v="primary" small onClick={()=>{setF(tomFelt);setNyOpen(true);}}>+ Ny faggruppe</Btn>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:C.s3}}>
              {["Farve","Navn","Default t/uge",`Default ${valutaSymbol(adminData?.valuta)}/time`,""].map(h=>(
                <th key={h} style={{color:C.txtM,fontSize:11,textAlign:"left",padding:"8px 12px",borderBottom:`1px solid ${C.brd}`,fontWeight:600}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {titler.length===0&&(
              <tr><td colSpan={5} style={{padding:"14px",textAlign:"center",color:C.txtM,fontSize:12,fontStyle:"italic"}}>Ingen faggrupper endnu — opret den første</td></tr>
            )}
            {titler.map((t,i)=>{
              const erRed=redigerId===t.id;
              return(
                <tr key={t.id} style={{borderBottom:`1px solid ${C.brd}`,background:i%2===0?"transparent":C.s1+"60"}}>
                  <td style={{padding:"9px 12px"}}>
                    <span style={{display:"inline-block",width:18,height:18,borderRadius:4,background:t.farve||"#0050b3",border:`1px solid ${C.brd}`}}/>
                  </td>
                  <td style={{padding:"9px 12px",fontSize:13,color:C.txt,fontWeight:600}}>
                    {erRed
                      ? <Input value={t.navn} onChange={v=>gem(t.id,{navn:v})} placeholder="Titel"/>
                      : t.navn}
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.txtD}}>
                    {erRed
                      ? <Input type="number" value={t.defaultTimerPerUge??0} onChange={v=>gem(t.id,{defaultTimerPerUge:Number(v)||0})}/>
                      : (t.defaultTimerPerUge??0)+" t"}
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12,color:C.txtD}}>
                    {erRed
                      ? <Input type="number" value={t.defaultKrPrTime??0} onChange={v=>gem(t.id,{defaultKrPrTime:Number(v)||0})}/>
                      : formatBeloeb(t.defaultKrPrTime,adminData?.valuta)}
                  </td>
                  <td style={{padding:"9px 12px",textAlign:"right",whiteSpace:"nowrap"}}>
                    {erRed&&(
                      <input type="color" value={t.farve||"#0050b3"} onChange={e=>gem(t.id,{farve:e.target.value})}
                        style={{width:28,height:24,border:`1px solid ${C.brd}`,borderRadius:4,padding:0,marginRight:6,cursor:"pointer",background:"transparent"}}/>
                    )}
                    <button onClick={()=>setRedigerId(erRed?null:t.id)}
                      style={{background:"transparent",border:`1px solid ${C.brd}`,borderRadius:5,color:C.txtD,fontSize:11,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",marginRight:6}}>
                      {erRed?"Færdig":"Rediger"}
                    </button>
                    <button onClick={()=>slet(t.id)}
                      style={{background:"transparent",border:`1px solid ${C.brd}`,borderRadius:5,color:C.red,fontSize:11,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>
                      Slet
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nyOpen&&(
        <Modal title="Ny faggruppe" onClose={()=>setNyOpen(false)} w={420}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <FRow label="Navn"><Input value={f.navn} onChange={v=>setF(p=>({...p,navn:v}))} placeholder="F.eks. Ergoterapeut"/></FRow>
            <FRow label="Farve">
              <input type="color" value={f.farve} onChange={e=>setF(p=>({...p,farve:e.target.value}))}
                style={{width:60,height:32,border:`1px solid ${C.brd}`,borderRadius:6,padding:0,cursor:"pointer",background:"transparent"}}/>
            </FRow>
            <FRow label="Default timer pr. uge"><Input type="number" value={f.defaultTimerPerUge} onChange={v=>setF(p=>({...p,defaultTimerPerUge:v}))}/></FRow>
            <FRow label={`Default ${valutaSymbol(adminData?.valuta)} pr. time`}><Input type="number" value={f.defaultKrPrTime} onChange={v=>setF(p=>({...p,defaultKrPrTime:v}))}/></FRow>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <Btn v="ghost" onClick={()=>setNyOpen(false)}>Annuller</Btn>
              <Btn v="primary" onClick={opret}>Opret</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



// ── Forløbs-skabelon admin-tab ──
function ForlobAdminTab({forlob,setForlob,forlobMeta,setForlobMeta,lokaler=[],showToast=()=>{}}){
  const [valgt,setValgt]=useState(null);
  const [galleriOpen,setGalleriOpen]=useState(false);
  const [importFejl,setImportFejl]=useState("");
  const fileInputRef=React.useRef(null);

  const ids=Object.keys(forlob).filter(k=>Array.isArray(forlob[k])).sort();
  const aktiv=valgt&&forlob[valgt]?valgt:(ids[0]||null);
  React.useEffect(()=>{if(!aktiv&&ids[0])setValgt(ids[0]);},[ids,aktiv]);
  const opgaver=aktiv?forlob[aktiv]||[]:[];
  const meta=aktiv?(forlobMeta[aktiv]||{}):{};

  const nyId=()=>{
    let n=1; while(forlob["t"+n]) n++; return "t"+n;
  };
  const opretSkabelon=()=>{
    const id=nyId();
    setForlob(p=>({...p,[id]:[]}));
    setForlobMeta(p=>({...p,[id]:{navn:"Ny skabelon",beskrivelse:""}}));
    setValgt(id);
  };
  const sletSkabelon=(id)=>{
    if(!confirm(`Slet skabelonen "${forlobMeta[id]?.navn||id}"? Dette påvirker ikke patienter der allerede har fået tildelt forløbet.`)) return;
    setForlob(p=>{const n={...p}; delete n[id]; return n;});
    setForlobMeta(p=>{const n={...p}; delete n[id]; return n;});
    if(valgt===id) setValgt(null);
  };
  const opdMeta=(id,felt,val)=>setForlobMeta(p=>({...p,[id]:{...(p[id]||{}),[felt]:val}}));

  // Opgave-CRUD inden for valgt skabelon
  const opdOpg=(idx,felt,val)=>setForlob(p=>({...p,[aktiv]:p[aktiv].map((o,i)=>i===idx?{...o,[felt]:val}:o)}));
  const togLokOpg=(idx,lok)=>setForlob(p=>({...p,[aktiv]:p[aktiv].map((o,i)=>{
    if(i!==idx) return o;
    const nu=Array.isArray(o.l)?o.l:[];
    return {...o, l:nu.includes(lok)?nu.filter(x=>x!==lok):[...nu,lok]};
  })}));
  const tilfoejOpg=()=>setForlob(p=>{
    const liste=p[aktiv]||[];
    return {...p,[aktiv]:[...liste,{o:"Ny opgave",m:30,p:false,tl:"08:00",ss:"16:00",s:liste.length+1,l:[],mm:[]}]};
  });
  const fjernOpg=(idx)=>setForlob(p=>({
    ...p,[aktiv]:(p[aktiv]||[]).filter((_,i)=>i!==idx).map((o,i)=>({...o,s:i+1}))
  }));
  const flytOpg=(idx,dir)=>setForlob(p=>{
    const arr=[...(p[aktiv]||[])]; const ni=idx+dir;
    if(ni<0||ni>=arr.length) return p;
    [arr[idx],arr[ni]]=[arr[ni],arr[idx]];
    return {...p,[aktiv]:arr.map((o,i)=>({...o,s:i+1}))};
  });

  // Eksport: download JSON med alle skabeloner (inkl. meta)
  const eksporter=()=>{
    const payload={
      version:1,
      eksporteret:new Date().toISOString(),
      skabeloner:ids.map(id=>({
        id,
        navn:forlobMeta[id]?.navn||"",
        beskrivelse:forlobMeta[id]?.beskrivelse||"",
        opgaver:forlob[id]||[],
      })),
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="planmed_forlob_skabeloner.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Skabeloner eksporteret","success");
  };

  // Import: læs JSON-fil og merge ind
  const haandterImport=(e)=>{
    setImportFejl("");
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        const liste=Array.isArray(data)?data:(Array.isArray(data.skabeloner)?data.skabeloner:null);
        if(!liste){setImportFejl("Filen indeholder ikke en gyldig skabelon-liste.");return;}
        let antal=0;
        setForlob(prev=>{
          const next={...prev};
          liste.forEach(s=>{
            if(!Array.isArray(s.opgaver)) return;
            let id=s.id||("t"+(Object.keys(next).length+1));
            // Undgå overskrivning af eksisterende skabeloner
            while(next[id]) id=id+"_"+Math.random().toString(36).slice(2,5);
            next[id]=s.opgaver.map((o,i)=>({
              o:o.o||"Opgave "+(i+1),
              m:Number(o.m)||30,
              p:!!o.p,
              tl:o.tl||"08:00",
              ss:o.ss||"16:00",
              s:Number(o.s)||(i+1),
              l:Array.isArray(o.l)?o.l:[],
              mm:Array.isArray(o.mm)?o.mm:[],
              ...(Array.isArray(o.u)?{u:o.u}:{}),
            }));
            setForlobMeta(pm=>({...pm,[id]:{navn:s.navn||id,beskrivelse:s.beskrivelse||""}}));
            antal++;
          });
          return next;
        });
        showToast(`Importerede ${antal} skabelon${antal===1?"":"er"}`,"success");
      }catch(err){
        setImportFejl("Kunne ikke læse JSON: "+err.message);
      }
    };
    reader.readAsText(file);
    // Nulstil input så samme fil kan vælges igen
    if(fileInputRef.current) fileInputRef.current.value="";
  };

  // Importér en gallerie-skabelon med ét klik
  const importerGalleri=(g)=>{
    let id=g.id;
    setForlob(prev=>{
      let endeligId=id;
      while(prev[endeligId]) endeligId=endeligId+"_"+Math.random().toString(36).slice(2,5);
      const next={...prev,[endeligId]:g.opgaver.map(o=>({...o,l:[...(o.l||[])],mm:[...(o.mm||[])]}))};
      setForlobMeta(pm=>({...pm,[endeligId]:{navn:g.navn,beskrivelse:g.beskrivelse}}));
      setValgt(endeligId);
      return next;
    });
    showToast(`Importerede "${g.navn}"`,"success");
    setGalleriOpen(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div>
          <div style={{color:C.txt,fontWeight:700,fontSize:14}}>Forløbs-skabeloner</div>
          <div style={{color:C.txtM,fontSize:12,marginTop:2}}>Byg skabeloner med opgaver, varighed og lokaler. Kan tildeles patienter under "Tildel forløb".</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn v="ghost" small onClick={()=>setGalleriOpen(true)}>Galleri</Btn>
          <Btn v="ghost" small onClick={()=>fileInputRef.current?.click()}>Import skabelon</Btn>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={haandterImport} style={{display:"none"}}/>
          <Btn v="ghost" small onClick={eksporter} disabled={ids.length===0}>Eksport skabelon</Btn>
          <Btn v="primary" small onClick={opretSkabelon}>+ Ny skabelon</Btn>
        </div>
      </div>
      {importFejl&&<div style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:8,padding:"8px 12px",fontSize:12}}>{importFejl}</div>}

      <div style={{display:"flex",gap:12,minHeight:400}}>
        {/* Sidebar: liste over skabeloner */}
        <div style={{width:240,flexShrink:0,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"10px 13px",borderBottom:`1px solid ${C.brd}`,color:C.txtM,fontSize:11,fontWeight:600}}>{ids.length} skabelon{ids.length===1?"":"er"}</div>
          <div style={{flex:1,overflowY:"auto"}}>
            {ids.length===0&&<div style={{color:C.txtM,fontSize:12,padding:14,fontStyle:"italic"}}>Ingen skabeloner — opret én eller importér fra galleriet.</div>}
            {ids.map(id=>{
              const navn=forlobMeta[id]?.navn||id;
              const antal=(forlob[id]||[]).length;
              const er=aktiv===id;
              return(
                <div key={id} onClick={()=>setValgt(id)} style={{padding:"10px 13px",cursor:"pointer",borderBottom:`1px solid ${C.brd}`,background:er?C.accM:"transparent",borderLeft:`3px solid ${er?C.acc:"transparent"}`,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.txt,fontSize:12,fontWeight:er?700:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{navn}</div>
                    <div style={{color:C.txtM,fontSize:10,marginTop:1}}>{antal} opgave{antal===1?"":"r"}</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();sletSkabelon(id);}} title="Slet skabelon"
                    style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:11,padding:"1px 5px"}}>✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor: valgt skabelon */}
        <div style={{flex:1,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:16,overflow:"auto"}}>
          {!aktiv&&(
            <div style={{color:C.txtM,fontSize:13,padding:30,textAlign:"center"}}>Vælg eller opret en skabelon for at redigere.</div>
          )}
          {aktiv&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <FRow label="Navn">
                <Input value={meta.navn||""} onChange={v=>opdMeta(aktiv,"navn",v)} placeholder="F.eks. Psykiatrisk udredning"/>
              </FRow>
              <FRow label="Beskrivelse">
                <textarea value={meta.beskrivelse||""} onChange={e=>opdMeta(aktiv,"beskrivelse",e.target.value)}
                  placeholder="Kort beskrivelse af forløbet"
                  style={{width:"100%",minHeight:60,padding:"7px 11px",borderRadius:8,border:"1px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",background:C.s1,color:C.txt,boxSizing:"border-box",resize:"vertical"}}/>
              </FRow>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                <div style={{fontWeight:700,fontSize:13,color:C.txtD}}>Opgaver i sekvens ({opgaver.length})</div>
                <Btn v="outline" small onClick={tilfoejOpg}>+ Tilføj opgave</Btn>
              </div>

              {opgaver.length===0&&<div style={{color:C.txtM,fontSize:12,padding:12,textAlign:"center",border:`1px dashed ${C.brd}`,borderRadius:8}}>Ingen opgaver endnu.</div>}

              {opgaver.map((o,i)=>(
                <div key={i} style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{display:"flex",flexDirection:"column",gap:1}}>
                      <button onClick={()=>flytOpg(i,-1)} disabled={i===0}
                        style={{background:"none",border:"none",color:i===0?C.brd:C.txtD,cursor:i===0?"default":"pointer",fontSize:10,padding:0,lineHeight:1}}>▲</button>
                      <button onClick={()=>flytOpg(i,1)} disabled={i===opgaver.length-1}
                        style={{background:"none",border:"none",color:i===opgaver.length-1?C.brd:C.txtD,cursor:i===opgaver.length-1?"default":"pointer",fontSize:10,padding:0,lineHeight:1}}>▼</button>
                    </div>
                    <span style={{width:22,height:22,borderRadius:"50%",background:C.accM,color:C.acc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
                    <input value={o.o||""} onChange={e=>opdOpg(i,"o",e.target.value)} placeholder="Opgavenavn"
                      style={{flex:1,padding:"5px 10px",borderRadius:7,border:"1px solid "+C.brd,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                    <input type="number" value={o.m||30} min="5" max="480" onChange={e=>opdOpg(i,"m",Number(e.target.value)||30)}
                      style={{width:64,padding:"5px 8px",borderRadius:7,border:"1px solid "+C.brd,background:C.s1,color:C.txt,fontSize:13,fontFamily:"inherit",textAlign:"center"}}/>
                    <span style={{color:C.txtM,fontSize:11}}>min</span>
                    <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:C.txtD,cursor:"pointer"}}>
                      <input type="checkbox" checked={!!o.p} onChange={e=>opdOpg(i,"p",e.target.checked)}/>
                      patient
                    </label>
                    <button onClick={()=>fjernOpg(i)} style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>✕</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <div>
                      <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:3}}>Tidligst start</div>
                      <input type="time" value={o.tl||"08:00"} onChange={e=>opdOpg(i,"tl",e.target.value)}
                        style={{width:"100%",padding:"4px 8px",borderRadius:6,border:"1px solid "+C.brd,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                    </div>
                    <div>
                      <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:3}}>Senest slut</div>
                      <input type="time" value={o.ss||"16:00"} onChange={e=>opdOpg(i,"ss",e.target.value)}
                        style={{width:"100%",padding:"4px 8px",borderRadius:6,border:"1px solid "+C.brd,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                    </div>
                  </div>
                  <div>
                    <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:4}}>Mulige lokaler</div>
                    {lokaler.length===0?(
                      <div style={{color:C.txtM,fontSize:11,fontStyle:"italic"}}>Ingen lokaler oprettet — tilføj under Lokaler.</div>
                    ):(
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {lokaler.map(l=>{
                          const on=Array.isArray(o.l)&&o.l.includes(l);
                          return(
                            <button key={l} onClick={()=>togLokOpg(i,l)}
                              style={{background:on?C.accM:C.s1,color:on?C.acc:C.txtM,border:`1px solid ${on?C.acc:C.brd}`,borderRadius:6,padding:"3px 9px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:on?600:400}}>{l}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {galleriOpen&&(
        <Modal title="Galleri – eksempel-skabeloner" onClose={()=>setGalleriOpen(false)} w={620}>
          <div style={{color:C.txtM,fontSize:12,marginBottom:14,lineHeight:1.5}}>
            Vælg en skabelon at importere. Importerede skabeloner kan redigeres frit. Lokaler skal tilføjes manuelt efter import — de er ikke koblet til dine lokalenavne.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {FORLOB_GALLERI.map(g=>(
              <div key={g.id} style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.txt,fontWeight:700,fontSize:13}}>{g.navn}</div>
                    <div style={{color:C.txtM,fontSize:11,marginTop:2,lineHeight:1.4}}>{g.beskrivelse}</div>
                  </div>
                  <Btn v="primary" small onClick={()=>importerGalleri(g)}>Importér</Btn>
                </div>
                <div style={{color:C.txtM,fontSize:11}}>{g.opgaver.length} opgaver · ialt {g.opgaver.reduce((a,o)=>a+(o.m||0),0)} min</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

