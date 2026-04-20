import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../data/constants.js";
import { Input, FRow, LanguageSwitcher } from "../components/primitives.jsx";
import { hashKode } from "../utils/krypto.js";
import { validerEjerKode, beregnStyrke, styrkeGradient } from "../utils/kodeValidering.js";

// ── Ejer-opsætningsdialog (førstegangs-opstart) ──
// Ejer-koden bliver hashet med bcrypt (saltRounds=10) inden den sendes videre
// til App — den gemmes ALDRIG i klartekst i localStorage.
// Længde- og kompleksitetskrav håndhæves af validerEjerKode (min. 12 tegn,
// stort + lille bogstav + tal, ikke på top-100 fælleskoder).
export default function EjerSetupDialog({onSave}){
  const {t} = useTranslation();
  const [email,setEmail]=useState("");
  const [kode,setKode]=useState("");
  const [kode2,setKode2]=useState("");
  const [fejl,setFejl]=useState("");
  const [arbejder,setArbejder]=useState(false);

  const validering = useMemo(()=>validerEjerKode(kode),[kode]);
  const styrke = useMemo(()=>beregnStyrke(kode),[kode]);

  const submit=async ()=>{
    if(!email.trim()||!email.includes("@")){setFejl(t("auth.ownerSetup.errEmail"));return;}
    const v = validerEjerKode(kode);
    if(!v.gyldig){setFejl(v.fejl.map(k=>t(k)).join(" · "));return;}
    if(kode!==kode2){setFejl(t("auth.ownerSetup.errCodeMatch"));return;}
    setArbejder(true); setFejl("");
    try{
      const hash = await hashKode(kode);
      onSave(email.trim(), hash);
    }catch(e){
      setFejl("Kunne ikke kryptere koden: "+e.message);
      setArbejder(false);
    }
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{position:"absolute",top:18,right:22}}><LanguageSwitcher/></div>
      <div style={{maxWidth:420,width:"100%",background:C.s1,borderRadius:16,padding:32,border:"1.5px solid "+C.brd,boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:28,marginBottom:6}}>{t("common.appName")}</div>
          <div style={{fontWeight:800,fontSize:18,color:C.txt}}>{t("auth.ownerSetup.title")}</div>
          <div style={{color:C.txtM,fontSize:12,marginTop:6,lineHeight:1.5}}>
            {t("auth.ownerSetup.intro")}
          </div>
        </div>
        <FRow label={t("auth.ownerSetup.ownerEmail")}>
          <Input value={email} onChange={v=>setEmail(v)} placeholder={t("auth.emailPlaceholder")}/>
        </FRow>
        <FRow label={t("auth.ownerSetup.ownerCode")}>
          <input type="password" value={kode} onChange={e=>setKode(e.target.value)} placeholder={t("auth.ownerSetup.ownerCodePlaceholder")}
            style={{width:"100%",padding:"7px 11px",borderRadius:8,border:"1px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",background:C.s1,color:C.txt,boxSizing:"border-box"}}/>
          <StyrkeIndikator styrke={styrke} kode={kode} t={t}/>
          {kode && !validering.gyldig && (
            <ul style={{margin:"6px 0 0 0",padding:"0 0 0 16px",color:C.txtM,fontSize:11,lineHeight:1.5}}>
              {validering.fejl.map(k=>(
                <li key={k} style={{color:C.red}}>{t(k)}</li>
              ))}
            </ul>
          )}
        </FRow>
        <FRow label={t("auth.ownerSetup.repeatCode")}>
          <input type="password" value={kode2} onChange={e=>setKode2(e.target.value)} placeholder={t("auth.ownerSetup.repeatCodePlaceholder")}
            onKeyDown={e=>{if(e.key==="Enter")submit();}}
            style={{width:"100%",padding:"7px 11px",borderRadius:8,border:"1px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",background:C.s1,color:C.txt,boxSizing:"border-box"}}/>
        </FRow>
        {fejl&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{fejl}</div>}
        <div style={{marginTop:8,padding:"10px 14px",background:C.ambM,border:"1px solid "+C.amb,borderRadius:8,fontSize:11,color:C.amb,fontWeight:500,marginBottom:14}}>
          {t("auth.ownerSetup.warning")}
        </div>
        <button onClick={submit} disabled={arbejder} style={{width:"100%",padding:"10px 0",background:C.acc,color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:arbejder?"wait":"pointer",fontFamily:"inherit",opacity:arbejder?0.6:1}}>
          {arbejder?t("common.loading"):t("auth.ownerSetup.createBtn")}
        </button>
      </div>
    </div>
  );
}

// Live styrke-indikator: gradient-bar rød→grøn med markør + label.
// Progressionen udregnes som (score+1)/4 når der er en kode, ellers 0.
export function StyrkeIndikator({styrke, kode, t}){
  const pct = kode ? Math.max(8,((styrke.score+1)/4)*100) : 0;
  return (
    <div style={{marginTop:6}}>
      <div style={{position:"relative",height:6,borderRadius:4,background:"#e5e7eb",overflow:"hidden"}}>
        <div style={{
          position:"absolute",top:0,left:0,bottom:0,
          width:pct+"%",
          background:styrkeGradient(),
          transition:"width .15s ease-out",
        }}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:10,color:C.txtM}}>
        <span>{t("auth.ownerSetup.strength.label")}</span>
        <span style={{color:styrke.farve,fontWeight:700}}>{t(styrke.labelKey)}</span>
      </div>
    </div>
  );
}
