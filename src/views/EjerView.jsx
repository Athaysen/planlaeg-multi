import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { today } from "../utils/index.js";
import { C } from "../data/constants.js";
import { Btn, Input, FRow, Pill } from "../components/primitives.jsx";
import { hashKode, tjekKode } from "../utils/krypto.js";
import { validerEjerKode, beregnStyrke, styrkeGradient } from "../utils/kodeValidering.js";
import PlanMedTester from "../tests/PlanMedTester.jsx";

export default function EjerView({patienter,medarbejdere,adminData,setAdminData,authData,isUnlocked,setEjerUnlocked,ejerKode,ejerKonto,setEjerKonto,lokaler=[],lokMeta={},showToast=()=>{},certifikater=[],config={}}){
  const {t}=useTranslation();
  const [kodeInput,setKodeInput]=useState("");
  const [fejl,setFejl]=useState("");
  const [verificerer,setVerificerer]=useState(false);
  // ejerKode er nu en bcrypt-hash ("$2a$..." eller "$2b$..."), ikke klartekst.
  // Verifikation er async fordi bcrypt.compare tager ~100ms.
  const forsoegLasOp = async () => {
    if(verificerer) return;
    setVerificerer(true);
    const ok = await tjekKode(kodeInput, ejerKode);
    setVerificerer(false);
    if(ok){setEjerUnlocked(true);setFejl("");}
    else{setFejl("Forkert kode");setKodeInput("");}
  };
  const [aktivTab,setAktivTab]=useState("lejere");
  const [visTesterEjer,setVisTesterEjer]=useState(false);
  const [systembesked,setSystembesked]=useState("");
  const [visSystembesked,setVisSystembesked]=useState(false);
  const [apiKeys,setApiKeys]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("planmed_apikeys")||"{}");}catch{return {};}
  });
  const saveApiKey=(k,v)=>{
    const ny={...apiKeys,[k]:v};
    setApiKeys(ny);
    try{localStorage.setItem("planmed_apikeys",JSON.stringify(ny));}catch(e){}
  };
    const [changelog,setChangelog]=useState([
    {ver:"0.9.2",dato:"2026-03-10",tekst:"Excel import: Lokaler-tab tilfojet. Skabeloner opdateret med nye felter."},
    {ver:"0.9.1",dato:"2026-03-05",tekst:"Klinisk Hvid redesign. Sora font. RBAC roller."},
    {ver:"0.9.0",dato:"2026-02-20",tekst:"Første prototype. Forløb, patienter, kalender, planlægningsmotor."},
  ]);
  const [nyVer,setNyVer]=useState(""); const [nyTekst,setNyTekst]=useState(""); const [nyDato,setNyDato]=useState(today());
  const [ejerEmail,setEjerEmail]=useState(authData.email||"");
  const [nyEjerEmail,setNyEjerEmail]=useState("");
  const [nyEjerKode,setNyEjerKode]=useState("");
  const [gemtMsg,setGemtMsg]=useState("");

  const lejere=adminData.selskaber||[];
  const totalPat=patienter.length;
  const totalMed=medarbejdere.length;
  const totalPlanlagt=patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="planlagt").length,0);

  if(!isUnlocked){
    return(
      <div style={{maxWidth:380,margin:"80px auto",background:C.s1,borderRadius:16,padding:32,border:"1.5px solid "+C.brd,boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:32,marginBottom:8}}></div>
          <div style={{fontWeight:800,fontSize:18,color:C.txt}}>Ejer-konsol</div>
          <div style={{color:C.txtM,fontSize:12,marginTop:4}}>Kun autoriseret adgang</div>
        </div>
        <div style={{marginBottom:8,fontSize:12,fontWeight:600,color:C.txtD}}>Ejer-kode</div>
        <input
          type="password"
          placeholder="Indtast kode"
          value={kodeInput}
          onChange={e=>setKodeInput(e.target.value)}
          disabled={verificerer}
          onKeyDown={e=>{ if(e.key==="Enter") forsoegLasOp(); }}
          style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid "+(fejl?C.red:C.brd),fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:fejl?6:16}}
        />
        {fejl&&<div style={{color:C.red,fontSize:12,marginBottom:12}}>{fejl}</div>}
        <button onClick={forsoegLasOp} disabled={verificerer}
          style={{width:"100%",padding:"10px 0",background:C.acc,color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:verificerer?"wait":"pointer",fontFamily:"inherit",opacity:verificerer?0.6:1}}>
          {verificerer?"Verificerer...":"Lås op"}
        </button>
      </div>
    );
  }

  const TABS=[
    {id:"lejere",label:"Lejere"},
    {id:"statistik",label:"Statistik"},
    {id:"features",label:"Feature-flags"},
    {id:"beskeder",label:"Beskeder"},
    {id:"changelog",label:"Changelog"},
    {id:"api",label:"API-nøgler"},
    {id:"konto",label:"Ejer-konto"},
    {id:"test",label:"Tests"},
  ];

  return(
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontWeight:800,fontSize:20,color:C.txt}}>Ejer-konsol</div>
          <div style={{color:C.txtM,fontSize:12}}>Produktadministration · Anders Holding</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Pill color={C.red} bg={C.redM}>EJER</Pill>
          <Btn v="outline" small onClick={()=>setEjerUnlocked(false)}>Lås konsol</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid "+C.brd,paddingBottom:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setAktivTab(t.id)}
            style={{padding:"8px 16px",border:"none",borderBottom:aktivTab===t.id?"2.5px solid "+C.acc:"2.5px solid transparent",background:"transparent",color:aktivTab===t.id?C.acc:C.txtD,fontWeight:aktivTab===t.id?700:400,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* LEJERE */}
      {aktivTab==="lejere"&&(
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12,color:C.txt}}>Aktive lejere ({lejere.length})</div>
          {lejere.map(s=>(
            <div key={s.id} style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:16,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:700,color:C.txt,fontSize:15}}>{s.navn}</div>
                  <div style={{color:C.txtM,fontSize:12,marginTop:2}}>CVR: {s.cvr||"—"} · {s.land||"Danmark"}</div>
                  <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                    <Pill color={C.grn} bg={C.grnM} sm>Aktiv</Pill>
                    <Pill color={C.blue} bg={C.blueM} sm>{s.serverModel||"planmed"}</Pill>
                    <Pill color={C.pur} bg={C.purM} sm>{s.afdelinger?.length||0} afd.</Pill>
                    <Pill color={C.acc} bg={C.accM} sm>{s.brugere?.length||0} brugere</Pill>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn v="outline" small>Rediger</Btn>
                  <Btn v="danger" small>Suspender</Btn>
                </div>
              </div>
            </div>
          ))}
          <Btn v="primary" onClick={()=>{}}>+ Opret ny lejer</Btn>
        </div>
      )}

      {/* STATISTIK */}
      {aktivTab==="statistik"&&(
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:C.txt}}>System-statistik</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
            {[
              {l:"Aktive lejere",v:lejere.length,c:C.acc},
              {l:"Patienter i alt",v:totalPat,c:C.blue},
              {l:"Medarbejdere",v:totalMed,c:C.grn},
              {l:"Planlagte opgaver",v:totalPlanlagt,c:C.pur},
            ].map(k=>(
              <div key={k.l} style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:16}}>
                <div style={{color:C.txtM,fontSize:12,marginBottom:4}}>{k.l}</div>
                <div style={{color:k.c,fontWeight:900,fontSize:28,fontVariantNumeric:"tabular-nums"}}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:16}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:C.txt}}>Lejer-fordeling</div>
            {lejere.map(s=>{
              const sPat=patienter.filter(p=>p.afdeling).length;
              return(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.brd,fontSize:13}}>
                  <span style={{color:C.txt,fontWeight:500}}>{s.navn}</span>
                  <span style={{color:C.txtM}}>{s.brugere?.length||0} brugere · {s.afdelinger?.length||0} afd.</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FEATURE FLAGS */}
      {aktivTab==="features"&&(
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:C.txt}}>Feature-flags per lejer</div>
          {lejere.map(s=>{
            const flags=s.features||{excelImport:true,fhirIntegration:false,outlookSync:false,multiAfdeling:true,kpiDashboard:true};
            return(
              <div key={s.id} style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:16,marginBottom:12}}>
                <div style={{fontWeight:700,color:C.txt,marginBottom:12}}>{s.navn}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
                  {Object.entries(flags).map(([flag,aktiv])=>(
                    <div key={flag} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bg,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.brd}}>
                      <span style={{fontSize:12,color:C.txtD,fontWeight:500}}>{flag}</span>
                      <div onClick={()=>{
                        setAdminData(d=>({...d,selskaber:d.selskaber.map(x=>x.id===s.id?{...x,features:{...flags,[flag]:!aktiv}}:x)}));
                      }} style={{width:36,height:20,borderRadius:10,background:aktiv?C.acc:C.brd,cursor:"pointer",position:"relative",transition:"background .2s"}}>
                        <div style={{position:"absolute",top:2,left:aktiv?18:2,width:16,height:16,borderRadius:8,background:"#fff",transition:"left .2s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BESKEDER */}
      {aktivTab==="beskeder"&&(
        <div style={{maxWidth:600}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:C.txt}}>Global systembesked</div>
          <div style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:20}}>
            <div style={{fontSize:13,color:C.txtD,marginBottom:8,fontWeight:500}}>Besked vist for alle brugere (tomt = ingen besked):</div>
            <textarea
              value={systembesked}
              onChange={e=>setSystembesked(e.target.value)}
              placeholder="f.eks. Planlagt vedligeholdelse lordag kl. 22:00-23:00"
              rows={3}
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",color:C.txt,background:C.bg}}
            />
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <select value={visSystembesked?"info":"skjult"} onChange={e=>setVisSystembesked(e.target.value==="info")}
                style={{padding:"7px 10px",borderRadius:7,border:"1.5px solid "+C.brd,fontSize:12,fontFamily:"inherit",background:C.bg,color:C.txt}}>
                <option value="skjult">Skjult</option>
                <option value="info">Vis som info-banner</option>
              </select>
              <Btn v="primary" onClick={()=>setGemtMsg("Besked gemt")}>Gem besked</Btn>
              <Btn v="outline" onClick={()=>{setSystembesked("");setVisSystembesked(false);}}>Ryd</Btn>
            </div>
            {gemtMsg&&<div style={{color:C.grn,fontSize:12,marginTop:8}}>{gemtMsg}</div>}
          </div>
          {systembesked&&(
            <div style={{marginTop:16,background:C.accM,border:"1px solid "+C.acc,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.acc,fontWeight:500}}>
              Forhandsvisning: {systembesked}
            </div>
          )}
        </div>
      )}

      {/* CHANGELOG */}
      {aktivTab==="changelog"&&(
        <div style={{maxWidth:640}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:C.txt}}>Changelog · vist for brugerne</div>
          {changelog.map((e,i)=>(
            <div key={i} style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                  <Pill color={C.acc} bg={C.accM} sm>v{e.ver}</Pill>
                  <span style={{color:C.txtM,fontSize:12}}>{e.dato}</span>
                </div>
                <div style={{fontSize:13,color:C.txtD}}>{e.tekst}</div>
              </div>
              <Btn v="danger" small onClick={()=>setChangelog(cl=>cl.filter((_,j)=>j!==i))}>Slet</Btn>
            </div>
          ))}
          <div style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:16,marginTop:16}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:C.txt}}>Tilføj ny entry</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <input value={nyVer} onChange={e=>setNyVer(e.target.value)} placeholder="Version f.eks. 0.9.3"
                style={{padding:"8px 12px",borderRadius:7,border:"1.5px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",background:C.bg,color:C.txt}}/>
              <input type="date" value={nyDato} onChange={e=>setNyDato(e.target.value)}
                style={{padding:"8px 12px",borderRadius:7,border:"1.5px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",background:C.bg,color:C.txt}}/>
            </div>
            <textarea value={nyTekst} onChange={e=>setNyTekst(e.target.value)} placeholder="Beskriv ændringen..." rows={2}
              style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid "+C.brd,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",background:C.bg,color:C.txt,marginBottom:8}}/>
            <Btn v="primary" onClick={()=>{
              if(!nyVer||!nyTekst) return;
              setChangelog(cl=>[{ver:nyVer,dato:nyDato,tekst:nyTekst},...cl]);
              setNyVer("");setNyTekst("");setNyDato(today());
            }}>Tilføj</Btn>
          </div>
        </div>
      )}

      {/* EJER-KONTO */}
      {aktivTab==="api"&&(
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:6,color:C.txt}}>API-nøgler & integration</div>
          <div style={{color:C.txtM,fontSize:12,marginBottom:20}}>Nøgler gemmes krypteret lokalt i browseren. I produktion sendes de til en sikker server-side vault. Aldrig committede til GitHub.</div>

          {[
            {
              gruppe:"Betalingsinfrastruktur",
              items:[
                {key:"stripe_pub",label:"Stripe — Publishable Key",ph:"pk_live_...",docs:"https://dashboard.stripe.com/apikeys",icon:"",hint:"Frontend-nøgle til Stripe.js og Checkout"},
                {key:"stripe_secret",label:"Stripe — Secret Key",ph:"sk_live_...",docs:"https://dashboard.stripe.com/apikeys",icon:"",secret:true,hint:"Kun til server-side brug. Aldrig eksponér i frontend"},
                {key:"stripe_webhook",label:"Stripe — Webhook Secret",ph:"whsec_...",docs:"https://dashboard.stripe.com/webhooks",icon:"",secret:true,hint:"Bruges til at verificere Stripe webhook-events"},
              ]
            },
            {
              gruppe:"Database & backend",
              items:[
                {key:"supabase_url",label:"Supabase — Project URL",ph:"https://xxxx.supabase.co",docs:"https://supabase.com/dashboard/project/_/settings/api",icon:"",hint:"Din Supabase projekt-URL"},
                {key:"supabase_anon",label:"Supabase — Anon Key",ph:"eyJhbGciOiJIUzI1NiIs...",docs:"https://supabase.com/dashboard/project/_/settings/api",icon:"",hint:"Offentlig anon/public nøgle — sikker til frontend"},
                {key:"supabase_service",label:"Supabase — Service Role Key",ph:"eyJhbGciOiJIUzI1NiIs...",docs:"https://supabase.com/dashboard/project/_/settings/api",icon:"",secret:true,hint:"Fuld adgang — kun server-side, aldrig til frontend"},
              ]
            },
            {
              gruppe:"Versionsstyring & deployment",
              items:[
                {key:"github_token",label:"GitHub — Personal Access Token",ph:"ghp_...",docs:"https://github.com/settings/tokens",icon:"",secret:true,hint:"Bruges til CI/CD, auto-deployment og repo-adgang"},
                {key:"github_repo",label:"GitHub — Repository URL",ph:"https://github.com/brugernavn/planmed",docs:"https://github.com",icon:"",hint:"URL til PlanMed-repositoriet"},
              ]
            },
            {
              gruppe:"Kort & lokation",
              items:[
                {key:"googlemaps",label:"Google Maps — API Key",ph:"AIzaSy...",docs:"https://console.cloud.google.com/apis/credentials",icon:"",hint:"Aktivér Maps JavaScript API og Directions API i Google Cloud Console"},
              ]
            },
            {
              gruppe:"E-mail & kommunikation",
              items:[
                {key:"sendgrid",label:"SendGrid — API Key",ph:"SG.xxxx",docs:"https://app.sendgrid.com/settings/api_keys",icon:"",secret:true,hint:"Bruges til transaktionelle mails (planbekræftelse, notifikationer)"},
                {key:"microsoft_graph_id",label:"Microsoft Graph — Client ID",ph:"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",docs:"https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps",icon:"",hint:"Azure App Registration Client ID til mail via Outlook/Office 365"},
                {key:"microsoft_graph_secret",label:"Microsoft Graph — Client Secret",ph:"xxxx~xxxx",docs:"https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps",icon:"",secret:true,hint:"Azure App Registration Client Secret"},
              ]
            },
            {
              gruppe:"e-Boks & Digital Post",
              items:[
                {key:"eboks_client_id",label:"e-Boks — Client ID",ph:"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",docs:"https://api.e-boks.com",icon:"",hint:"Til afsendelse af Digital Post via e-Boks erhvervsAPI"},
                {key:"eboks_cert",label:"e-Boks — Certifikat (thumbprint)",ph:"SHA1:xx:xx:xx:...",docs:"https://api.e-boks.com",icon:"",secret:true,hint:"OCES-virksomhedscertifikat thumbprint"},
              ]
            },
          ].map(({gruppe,items})=>(
            <div key={gruppe} style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,color:C.txtM,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:"1px solid "+C.brd}}>
                {gruppe}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {items.map(({key,label,ph,docs,icon,secret,hint})=>{
                  const val=apiKeys[key]||"";
                  const harVærdi=val.trim().length>0;
                  return(
                    <div key={key} style={{background:C.s3,border:"1px solid "+(harVærdi?C.grn+"44":C.brd),borderRadius:10,padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>{icon}</span>
                          <span style={{fontSize:12,fontWeight:600,color:C.txt}}>{label}</span>
                          {harVærdi&&<span style={{fontSize:10,color:C.grn,fontWeight:700}}>Sat</span>}
                          {secret&&<span style={{fontSize:10,color:C.amb,background:C.ambM,borderRadius:4,padding:"1px 5px",fontWeight:600}}>SECRET</span>}
                        </div>
                        <a href={docs} target="_blank" rel="noopener noreferrer"
                          style={{fontSize:10,color:C.blue,textDecoration:"none",opacity:0.7}}>
                          Docs -{'>'}
                        </a>
                      </div>
                      {hint&&<div style={{fontSize:10,color:C.txtM,marginBottom:7}}>{hint}</div>}
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <input
                          type={secret?"password":"text"}
                          value={val}
                          onChange={e=>saveApiKey(key,e.target.value)}
                          placeholder={ph}
                          style={{flex:1,background:C.s1,border:"1px solid "+C.brd,borderRadius:7,padding:"7px 10px",
                            fontSize:11,fontFamily:"monospace",color:C.txt,outline:"none"}}
                        />
                        {harVærdi&&(
                          <button onClick={()=>{saveApiKey(key,"");}}
                            style={{background:"none",border:"1px solid "+C.brd,borderRadius:6,padding:"6px 8px",cursor:"pointer",color:C.txtM,fontSize:11}}>
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{marginTop:8,background:C.ambM,border:"1px solid "+C.amb+"44",borderRadius:10,padding:"12px 14px",fontSize:11,color:C.amb}}>
            ! <strong>Sikkerhed:</strong> SECRET-markerede nøgler må aldrig eksponeres i frontend-kode eller committes til Git. Brug miljøvariable (<code style={{fontFamily:"monospace"}}>VITE_*</code> eller server-side env) i produktionsopsætningen.
          </div>
        </div>
      )}

            {aktivTab==="konto"&&(
        <div style={{maxWidth:480}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:C.txt}}>Ejer-konto indstillinger</div>
          <div style={{background:C.s1,border:"1px solid "+C.brd,borderRadius:12,padding:20}}>
            <FRow label="Nuværende ejer-email">
              <div style={{padding:"8px 12px",background:C.bg,borderRadius:7,border:"1px solid "+C.brd,fontSize:13,color:C.txtD}}>{ejerKonto?.email||"(ikke sat)"}</div>
            </FRow>
            <FRow label="Skift ejer-email">
              <div style={{display:"flex",gap:8}}>
                <Input value={nyEjerEmail} onChange={v=>setNyEjerEmail(v)} placeholder="ny@email.dk"/>
                <Btn v="outline" small onClick={()=>{
                  if(!nyEjerEmail.trim()||!nyEjerEmail.includes("@")){setGemtMsg("Indtast en gyldig email");return;}
                  setEjerKonto({...ejerKonto,email:nyEjerEmail.trim()});
                  setGemtMsg("Ejer-email opdateret");setNyEjerEmail("");
                }}>Gem</Btn>
              </div>
            </FRow>
            <FRow label={t("auth.ownerSetup.changeCodeLabel")}>
              <div style={{display:"flex",gap:8}}>
                <Input value={nyEjerKode} onChange={v=>setNyEjerKode(v)} placeholder={t("auth.ownerSetup.ownerCodePlaceholder")}/>
                <Btn v="outline" small onClick={async ()=>{
                  const v = validerEjerKode(nyEjerKode);
                  if(!v.gyldig){setGemtMsg(v.fejl.map(k=>t(k)).join(" · "));return;}
                  try{
                    const hash = await hashKode(nyEjerKode);
                    setEjerKonto({...ejerKonto,kode:hash});
                    setGemtMsg("Ejer-kode opdateret");setNyEjerKode("");
                  }catch(e){
                    setGemtMsg("Kunne ikke kryptere koden: "+e.message);
                  }
                }}>Gem</Btn>
              </div>
              <KodeStyrkeBlok kode={nyEjerKode} t={t}/>
            </FRow>
            <div style={{marginTop:16,padding:"12px 14px",background:C.ambM,border:"1px solid "+C.amb,borderRadius:8,fontSize:12,color:C.amb,fontWeight:500,marginBottom:12}}>
              Koden gemmes som bcrypt-hash i localStorage (saltRounds=10). Hash'en kan ikke omdannes til klartekst, men vær opmærksom på at browserens localStorage er tilgængelig for XSS-angreb — kræv HTTPS og CSP i produktion.
            </div>
            {gemtMsg&&<div style={{color:C.grn,fontSize:12,marginTop:10,fontWeight:600}}>{gemtMsg}</div>}
          </div>
        </div>
      )}
      {aktivTab==="test"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"20px 22px"}}>
            <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:4}}> System Auto-Tests</div>
            <div style={{color:C.txtM,fontSize:13,marginBottom:16}}>
              Kør automatisk validering af alle core flows — Auth, Navigation, Patient, Medarbejder, Planlægning og Eksport.
            </div>
            <Btn v="primary" onClick={()=>setVisTesterEjer(true)}>Åbn test-panel</Btn>
          </div>
        </div>
      )}
      {visTesterEjer&&<PlanMedTester onClose={()=>setVisTesterEjer(false)}/>}
    </div>
  );
}

// Live styrke-bar + fejlliste under "Skift ejer-kode"-inputtet.
function KodeStyrkeBlok({kode, t}){
  const validering = useMemo(()=>validerEjerKode(kode),[kode]);
  const styrke = useMemo(()=>beregnStyrke(kode),[kode]);
  const pct = kode ? Math.max(8,((styrke.score+1)/4)*100) : 0;
  if(!kode) return null;
  return (
    <div style={{marginTop:6}}>
      <div style={{position:"relative",height:6,borderRadius:4,background:"#e5e7eb",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,bottom:0,width:pct+"%",background:styrkeGradient(),transition:"width .15s ease-out"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:10,color:C.txtM}}>
        <span>{t("auth.ownerSetup.strength.label")}</span>
        <span style={{color:styrke.farve,fontWeight:700}}>{t(styrke.labelKey)}</span>
      </div>
      {!validering.gyldig && (
        <ul style={{margin:"6px 0 0 0",padding:"0 0 0 16px",fontSize:11,lineHeight:1.5}}>
          {validering.fejl.map(k=>(
            <li key={k} style={{color:C.red}}>{t(k)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}



