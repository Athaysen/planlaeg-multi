import React, { useState } from "react";
import { VALUTAER, valutaSymbol } from "../utils/index.js";
import { C, DEFAULT_TITLER, STANDARD_AABNINGSTIDER } from "../data/constants.js";
import { Btn, Input, FRow } from "../components/primitives.jsx";

// ── Selskabs-opsætningswizard (førstegangs-opstart, efter ejer-konto) ──
export default function SelskabSetupWizard({onSave}){
  const [selskabNavn,setSelskabNavn]=useState("");
  const [cvr,setCvr]=useState("");
  const [valuta,setValuta]=useState("DKK");
  // Initiel pris-tabel afspejler DEFAULT_TITLER plus "Lokale" — admin kan ændre per faggruppe
  const [priser,setPriser]=useState(()=>{
    const init={Lokale:0};
    DEFAULT_TITLER.forEach(t=>{init[t.navn]=0;});
    return init;
  });
  const nyAfd=()=>({navn:"",adresseVej:"",adressePostnr:"",adresseBy:"",telefon:"",email:""});
  const [afdelinger,setAfdelinger]=useState([nyAfd()]);
  const UGEDAGE=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"];
  const nytLok=()=>({
    navn:"",
    aabningstider:UGEDAGE.reduce((acc,dag)=>{acc[dag]={...STANDARD_AABNINGSTIDER[dag]};return acc;},{}),
    aabent:false, // toggle for at vise tider
  });
  const [lokaler,setLokaler]=useState([nytLok()]);
  const [fejl,setFejl]=useState("");
  const opdAfd=(i,felt,val)=>setAfdelinger(prev=>prev.map((a,idx)=>idx===i?{...a,[felt]:val}:a));
  const tilfoejAfd=()=>setAfdelinger(prev=>[...prev,nyAfd()]);
  const fjernAfd=(i)=>setAfdelinger(prev=>prev.length>1?prev.filter((_,idx)=>idx!==i):prev);

  const opdLok=(i,felt,val)=>setLokaler(prev=>prev.map((l,idx)=>idx===i?{...l,[felt]:val}:l));
  const opdLokTid=(i,dag,felt,val)=>setLokaler(prev=>prev.map((l,idx)=>idx===i?{
    ...l, aabningstider:{...l.aabningstider, [dag]:{...l.aabningstider[dag], [felt]:val}}
  }:l));
  const tilfoejLok=()=>setLokaler(prev=>[...prev,nytLok()]);
  const fjernLok=(i)=>setLokaler(prev=>prev.length>1?prev.filter((_,idx)=>idx!==i):prev);

  const submit=()=>{
    if(!selskabNavn.trim()){setFejl("Indtast selskabsnavn");return;}
    const første=afdelinger[0];
    if(!første?.navn?.trim()){setFejl("Den første afdeling skal have et navn");return;}
    const førsteLok=lokaler[0];
    if(!førsteLok?.navn?.trim()){setFejl("Det første lokale skal have et navn");return;}
    // Duplikat-tjek på lokalenavne
    const lokNavne=lokaler.map(l=>l.navn.trim()).filter(Boolean);
    if(new Set(lokNavne.map(n=>n.toLowerCase())).size!==lokNavne.length){
      setFejl("To lokaler må ikke have samme navn");return;
    }

    const renseAfd=afdelinger.filter(a=>a.navn.trim()).map((a,i)=>({
      id:"a"+(i+1)+"_"+Date.now().toString(36),
      navn:a.navn.trim(),
      parentId:null,
      beskrivelse:"",
      ledere:[],
      adresseVej:a.adresseVej.trim(),
      adressePostnr:a.adressePostnr.trim(),
      adresseBy:"",
      telefon:a.telefon.trim(),
      email:a.email.trim(),
      children:[],
    }));
    const selskab={
      id:"s"+Date.now().toString(36),
      navn:selskabNavn.trim(),
      cvr:cvr.trim(),
      land:"Danmark",
      fhirEndpoint:"",fhirClientId:"",fhirClientSecret:"",
      fhirNiveau:"1",
      serverModel:"planmed",
      googleMapsKey:"",
      selfhostedUrl:"",
      afdelinger:renseAfd,
      brugere:[],
    };
    // Byg lokaler-liste og lokTider-map
    const renseLok=lokaler.filter(l=>l.navn.trim()).map(l=>({navn:l.navn.trim(),tider:l.aabningstider}));
    const lokalerListe=renseLok.map(l=>l.navn);
    const lokTiderMap=UGEDAGE.reduce((acc,dag)=>{
      acc[dag]={};
      renseLok.forEach(l=>{acc[dag][l.navn]=l.tider[dag];});
      return acc;
    },{});
    // Byg taktDefaults-map (krPrTime per titel + Lokale)
    const taktDefaults={};
    Object.entries(priser).forEach(([navn,pris])=>{
      taktDefaults[navn]={krPrTime:Number(pris)||0};
    });
    onSave({selskab,lokaler:lokalerListe,lokTider:lokTiderMap,valuta,taktDefaults});
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"flex-start",justifyContent:"center",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",padding:"40px 16px"}}>
      <div style={{maxWidth:640,width:"100%",background:C.s1,borderRadius:16,padding:32,border:"1.5px solid "+C.brd,boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:28,marginBottom:6}}>PlanMed</div>
          <div style={{fontWeight:800,fontSize:18,color:C.txt}}>Opsæt dit selskab</div>
          <div style={{color:C.txtM,fontSize:12,marginTop:6,lineHeight:1.5}}>
            Indtast oplysninger om selskab, afdelinger og lokaler. Alt kan ændres senere under Admin.
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:13,color:C.txtD,marginBottom:10}}>Selskab</div>
        <FRow label="Selskabsnavn">
          <Input value={selskabNavn} onChange={setSelskabNavn} placeholder="F.eks. Min Klinik ApS"/>
        </FRow>
        <FRow label="CVR (valgfrit)">
          <Input value={cvr} onChange={setCvr} placeholder="8 cifre"/>
        </FRow>
        <div style={{height:1,background:C.brd,margin:"18px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:13,color:C.txtD}}>Afdelinger</div>
          <Btn v="outline" small onClick={tilfoejAfd}>+ Tilføj afdeling</Btn>
        </div>
        {afdelinger.map((a,i)=>(
          <div key={i} style={{border:"1px solid "+C.brd,borderRadius:10,padding:14,marginBottom:12,background:C.s2}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:700,fontSize:12,color:C.txt}}>Afdeling {i+1}{i===0?" (skal udfyldes)":""}</div>
              {afdelinger.length>1&&<button onClick={()=>fjernAfd(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Fjern</button>}
            </div>
            <FRow label="Navn">
              <Input value={a.navn} onChange={v=>opdAfd(i,"navn",v)} placeholder="F.eks. Hovedafdeling"/>
            </FRow>
            <FRow label="Adresse">
              <Input value={a.adresseVej} onChange={v=>opdAfd(i,"adresseVej",v)} placeholder="Vej og nummer"/>
            </FRow>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <FRow label="Telefon">
                <Input value={a.telefon} onChange={v=>opdAfd(i,"telefon",v)} placeholder="Telefonnummer"/>
              </FRow>
              <FRow label="Email">
                <Input value={a.email} onChange={v=>opdAfd(i,"email",v)} placeholder="kontakt@..."/>
              </FRow>
            </div>
          </div>
        ))}

        <div style={{height:1,background:C.brd,margin:"18px 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontWeight:700,fontSize:13,color:C.txtD}}>Lokaler</div>
          <Btn v="outline" small onClick={tilfoejLok}>+ Tilføj lokale</Btn>
        </div>
        <div style={{color:C.txtM,fontSize:11,marginBottom:10,lineHeight:1.5}}>
          Standard-åbningstider: 08:00–16:00 mandag–fredag, weekend lukket. Tryk på "Vis åbningstider" for at justere per ugedag.
        </div>
        {lokaler.map((l,i)=>(
          <div key={i} style={{border:"1px solid "+C.brd,borderRadius:10,padding:14,marginBottom:12,background:C.s2}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:700,fontSize:12,color:C.txt}}>Lokale {i+1}{i===0?" (skal udfyldes)":""}</div>
              {lokaler.length>1&&<button onClick={()=>fjernLok(i)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Fjern</button>}
            </div>
            <FRow label="Navn">
              <Input value={l.navn} onChange={v=>opdLok(i,"navn",v)} placeholder="Lokalenavn"/>
            </FRow>
            <button onClick={()=>opdLok(i,"aabent",!l.aabent)}
              style={{background:"transparent",border:"1px solid "+C.brd,borderRadius:6,color:C.txtD,fontSize:11,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>
              {l.aabent?"Skjul åbningstider":"Vis åbningstider"}
            </button>
            {l.aabent&&(
              <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
                {UGEDAGE.map(dag=>{
                  const t=l.aabningstider[dag];
                  const lukket=t.å==="00:00"&&t.l==="00:00";
                  return(
                    <div key={dag} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 80px",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.txtD}}>{dag}</span>
                      <input type="time" value={t.å} onChange={e=>opdLokTid(i,dag,"å",e.target.value)}
                        disabled={lukket}
                        style={{padding:"5px 8px",border:"1px solid "+C.brd,borderRadius:6,fontSize:12,fontFamily:"inherit",background:lukket?C.s3:C.s1,color:C.txt}}/>
                      <input type="time" value={t.l} onChange={e=>opdLokTid(i,dag,"l",e.target.value)}
                        disabled={lukket}
                        style={{padding:"5px 8px",border:"1px solid "+C.brd,borderRadius:6,fontSize:12,fontFamily:"inherit",background:lukket?C.s3:C.s1,color:C.txt}}/>
                      <button onClick={()=>{
                        if(lukket){opdLokTid(i,dag,"å","08:00");opdLokTid(i,dag,"l","16:00");}
                        else{opdLokTid(i,dag,"å","00:00");opdLokTid(i,dag,"l","00:00");}
                      }} style={{background:"transparent",border:"1px solid "+C.brd,borderRadius:5,color:lukket?C.txtM:C.red,fontSize:11,padding:"3px 6px",cursor:"pointer",fontFamily:"inherit"}}>
                        {lukket?"Åbn":"Luk"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div style={{height:1,background:C.brd,margin:"18px 0"}}/>
        <div style={{fontWeight:700,fontSize:13,color:C.txtD,marginBottom:6}}>Valuta og priser</div>
        <div style={{color:C.txtM,fontSize:11,marginBottom:10,lineHeight:1.5}}>
          Vælg valuta og standard-timepris per faggruppe. Priser er pr. time og kan altid justeres senere under Admin → Faggrupper. Lad være med at sætte priser hvis du ikke ønsker omkostnings-beregning.
        </div>
        <FRow label="Valuta">
          <select value={valuta} onChange={e=>setValuta(e.target.value)}
            style={{width:"100%",padding:"7px 11px",borderRadius:8,border:"1px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",background:C.s1,color:C.txt,boxSizing:"border-box"}}>
            {Object.entries(VALUTAER).map(([k,v])=>(
              <option key={k} value={k}>{k} – {v.navn} ({v.symbol})</option>
            ))}
          </select>
        </FRow>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {Object.keys(priser).map(navn=>(
            <FRow key={navn} label={`${navn} (${valutaSymbol(valuta)}/t)`}>
              <Input type="number" value={priser[navn]} onChange={v=>setPriser(p=>({...p,[navn]:Number(v)||0}))}/>
            </FRow>
          ))}
        </div>

        {fejl&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{fejl}</div>}
        <button onClick={submit} style={{width:"100%",padding:"10px 0",marginTop:6,background:C.acc,color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
          Gem opsætning og fortsæt
        </button>
      </div>
    </div>
  );
}
