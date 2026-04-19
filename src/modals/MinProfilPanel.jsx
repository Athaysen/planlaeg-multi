// MinProfilPanel + KompetenceTilfoej — medarbejderens "min profil"-modal.
// Bruges af MedarbejderView.
import React, { useState } from "react";
import { valutaSymbol } from "../utils/index.js";
import { C, LK, PK, PD, KAP_TYPER, TITLE_C } from "../data/constants.js";
import { Btn, Input, Modal, FRow } from "../components/primitives.jsx";
import { ConfirmDialog } from "../components/dialogs.jsx";

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

export default function MinProfilPanel({med, medarbejdere, certifikater=[], onSave=()=>{}, onSendAnmodning, onDelete=null, isAdmin=false, adminData={}}){
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

