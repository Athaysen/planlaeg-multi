import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../data/constants.js";
import { Input, FRow, LanguageSwitcher } from "../components/primitives.jsx";

// ── Ejer-opsætningsdialog (førstegangs-opstart) ──
export default function EjerSetupDialog({onSave}){
  const {t} = useTranslation();
  const [email,setEmail]=useState("");
  const [kode,setKode]=useState("");
  const [kode2,setKode2]=useState("");
  const [fejl,setFejl]=useState("");
  const submit=()=>{
    if(!email.trim()||!email.includes("@")){setFejl(t("auth.ownerSetup.errEmail"));return;}
    if(kode.length<4){setFejl(t("auth.ownerSetup.errCodeShort"));return;}
    if(kode!==kode2){setFejl(t("auth.ownerSetup.errCodeMatch"));return;}
    onSave(email.trim(),kode);
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
        <button onClick={submit} style={{width:"100%",padding:"10px 0",background:C.acc,color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
          {t("auth.ownerSetup.createBtn")}
        </button>
      </div>
    </div>
  );
}
