import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../data/constants.js";
import { LanguageSwitcher } from "../components/primitives.jsx";

// ===============================================
export default function AuthFlow({stage, setStage, data, setData}){
  const {t} = useTranslation();
  const [mode,setMode]=useState("login"); // "login"|"signup"
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [nyAfdNavn,setNyAfdNavn]=useState("");
  const _ejerKonto=(()=>{try{return JSON.parse(localStorage.getItem("planmed_ejerKonto")||"null");}catch{return null;}})();
  const _ejerEmail=_ejerKonto?.email||"";
  const [visNyAfd,setVisNyAfd]=useState(true);
  const upd=(k,v)=>setData(d=>({...d,[k]:v}));

  // Husk mig - autofyld email ved komponent mount.
  // Password gemmes IKKE i localStorage (sikkerhedsrisiko — klartekst
  // i browserens storage er tilgængelig for XSS og alle installerede extensions).
  useEffect(()=>{
    try{
      const em=localStorage.getItem("pm_email");
      if(em) setData(d=>({...d,email:em,huskMig:true}));
    }catch(ex){}
  },[]);

  const S={
    wrap:{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif"},
    card:{background:C.s1,border:`1px solid ${C.brd}`,borderRadius:16,padding:"40px 44px",width:"100%",maxWidth:440,boxShadow:"0 8px 40px rgba(0,80,179,0.10)"},
    logo:{color:C.acc,fontWeight:900,fontSize:28,letterSpacing:"-0.03em",marginBottom:4},
    sub:{color:C.txtM,fontSize:13,marginBottom:32},
    label:{color:C.txtD,fontSize:12,fontWeight:600,marginBottom:6,display:"block"},
    input:{width:"100%",background:C.s2,border:`1px solid ${C.brd}`,borderRadius:8,padding:"10px 14px",color:C.txt,fontSize:14,outline:"none",transition:"border .15s"},
    btn:{width:"100%",background:C.acc,border:"none",borderRadius:8,padding:"12px",color:C.txt,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:8,transition:"opacity .15s"},
    btnSec:{width:"100%",background:"transparent",border:`1px solid ${C.brd}`,borderRadius:8,padding:"11px",color:C.txtM,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:8,transition:"all .15s"},
    err:{color:C.red,fontSize:12,marginTop:8},
    link:{color:C.acc,cursor:"pointer",fontSize:13,textDecoration:"underline"},
    divider:{textAlign:"center",color:C.txtM,fontSize:12,margin:"20px 0",position:"relative"},
  };

  const inp=(label,key,type="text",placeholder="")=>(
    <div style={{marginBottom:16}}>
      <label style={S.label}>{label}</label>
      <input type={type} value={data[key]||""} placeholder={placeholder}
        onChange={e=>upd(key,e.target.value)}
        className="auth-input" style={S.input}/>
    </div>
  );

  const fakeLoad=(cb)=>{
    setLoading(true); setErr("");
    setTimeout(()=>{ setLoading(false); cb(); }, 600);
  };

  // -- VELKOMST --
  // -- LANDING PAGE --
  if(stage==="welcome") return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Sora','Segoe UI',sans-serif",overflowX:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .lp-pri{background:#0050b3;border:none;border-radius:10px;padding:12px 28px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s,transform .15s}
        .lp-pri:hover{background:#003d8a;transform:translateY(-1px)}
        .lp-sec{background:#fff;border:1.5px solid #0050b3;border-radius:10px;padding:11px 24px;color:#0050b3;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s}
        .lp-sec:hover{background:#eef4ff}
        .feat-card{background:#ffffff;border:1px solid #dde5f0;border-radius:16px;padding:28px;transition:transform .2s,box-shadow .2s}
        .feat-card:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,80,179,0.10)}
        .price-card{background:#ffffff;border:1.5px solid #dde5f0;border-radius:20px;padding:36px;flex:1;min-width:240px;transition:transform .2s,box-shadow .2s}
        .price-card.featured{border-color:#0050b3;box-shadow:0 8px 40px rgba(0,80,179,0.13)}
        .price-card:hover{transform:translateY(-3px)}
        .lp-nav-link{color:#3a4d63;font-size:13px;font-weight:500;text-decoration:none;transition:color .15s}
        .lp-nav-link:hover{color:#0050b3}
      `}</style>

      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(248,249,251,0.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid #dde5f0",padding:"0 5%"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{color:"#0050b3",fontWeight:900,fontSize:22,letterSpacing:"-0.03em"}}>PlanMed</div>
          <div style={{display:"flex",gap:32}}>
            {[{label:"Features",id:"features"},{label:"Priser",id:"priser"},{label:"Om os",id:"om-os"}].map(l=>(
              <a key={l.id} href={"#"+l.id} className="lp-nav-link">{l.label}</a>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="lp-sec" style={{padding:"7px 18px",fontSize:13}} onClick={()=>{setMode("login");setStage("login");}}>Log ind</button>
            <button className="lp-pri" style={{padding:"7px 18px",fontSize:13}} onClick={()=>{setMode("signup");setStage("login");}}>Prøv gratis</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{padding:"90px 5% 70px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient("+C.brd+"66 1px,transparent 1px),linear-gradient(90deg,"+C.brd+"66 1px,transparent 1px)",backgroundSize:"60px 60px",zIndex:0}}/>
        <div style={{position:"relative",zIndex:1,maxWidth:800,margin:"0 auto"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,80,179,0.07)",border:"1px solid rgba(0,80,179,0.2)",borderRadius:100,padding:"6px 16px",marginBottom:28,animation:"fadeIn .6s ease"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#0050b3",display:"inline-block"}}/>
            <span style={{color:"#0050b3",fontSize:12,fontWeight:600}}>Intelligent patientplanlægning til sundhedssektoren</span>
          </div>
          <h1 style={{fontSize:"clamp(34px,5.5vw,68px)",fontWeight:900,color:C.txt,lineHeight:1.1,letterSpacing:"-0.03em",marginBottom:24,animation:"fadeUp .7s ease"}}>
            Planlæg smartere.<br/><span style={{color:"#0050b3"}}>Behandl hurtigere.</span>
          </h1>
          <p style={{fontSize:"clamp(14px,1.8vw,18px)",color:C.txtD,lineHeight:1.7,marginBottom:40,maxWidth:560,margin:"0 auto 40px",animation:"fadeUp .8s ease"}}>
            PlanMed automatiserer den komplekse patientplanlægning på hospitaler og klinikker.
          </p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",animation:"fadeUp .9s ease"}}>
            <button className="lp-pri" style={{fontSize:15,padding:"14px 32px"}} onClick={()=>{setMode("signup");setStage("login");}}>Start gratis i dag</button>
            <button className="lp-sec" style={{fontSize:15,padding:"14px 32px"}} onClick={()=>{setMode("login");setStage("login");}}>Log ind</button>
          </div>
          <div style={{color:C.txtM,fontSize:12,marginTop:20}}>Ingen kreditkort krævet - GDPR-compliant - Dansk support</div>
        </div>
      </section>

      {/* STATS */}
      <section style={{padding:"20px 5% 60px"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",gap:0,border:"1px solid "+C.brd,borderRadius:16,overflow:"hidden",background:"#fff",flexWrap:"wrap"}}>
          {[["60%","Kortere ventetid","for patienterne"],["15 min","Opsætningstid","fra nul til kørende"],["221+","Opgaver planlagt","automatisk per kørsel"],["5 roller","RBAC adgangsstyring","klar til regionerne"]].map(([val,label,sub],i)=>(
            <div key={i} style={{flex:1,minWidth:160,padding:"28px 24px",textAlign:"center",borderRight:i<3?"1px solid "+C.brd:"none"}}>
              <div style={{color:"#0050b3",fontWeight:900,fontSize:28,letterSpacing:"-0.02em"}}>{val}</div>
              <div style={{color:C.txt,fontWeight:700,fontSize:13,marginTop:4}}>{label}</div>
              <div style={{color:C.txtM,fontSize:11,marginTop:2}}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{padding:"60px 5%",background:"#fff"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:52}}>
            <h2 style={{color:C.txt,fontWeight:900,fontSize:"clamp(26px,4vw,42px)",letterSpacing:"-0.02em",marginBottom:12}}>Alt hvad dit hospital behøver</h2>
            <p style={{color:C.txtD,fontSize:15}}>Bygget specifikt til dansk sundhedsvæsen og EPJ-integration</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
            {[
              ["Plan","Intelligent planlægningsmotor","Algoritmen optimerer automatisk tider, medarbejdere og lokaler ud fra komplekse regler og begrænsninger."],
              ["EPJ","EPJ/FHIR-integration","Kobles direkte til Sundhedsplatformen og COSMIC. Patienter og kalendere synkroniseres automatisk."],
              ["SaaS","Multi-tenant SaaS","Hvert selskab og hver afdeling har sin egen isolerede datakontekst. Fuld GDPR-compliance."],
              ["RBAC","Rollebaseret adgang","5 brugerroller fra Super Admin til Viewer. Ingen ser mere end de skal."],
              ["KPI","Realtids dashboard","Overblik over ventelister, medarbejderbelastning, deadlines og regelovertrædelser."],
              ["API","Konfigurerbar datamodel","Tilpas patientfelter, forløbstyper og planlægningsregler per afdeling."],
            ].map(([badge,title,desc])=>(
              <div key={title} className="feat-card">
                <div style={{display:"inline-block",background:"rgba(0,80,179,0.08)",color:"#0050b3",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:800,letterSpacing:".06em",marginBottom:14}}>{badge}</div>
                <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:8}}>{title}</div>
                <div style={{color:C.txtD,fontSize:13,lineHeight:1.6}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRISER */}
      <section id="priser" style={{padding:"60px 5%"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:52}}>
            <h2 style={{color:C.txt,fontWeight:900,fontSize:"clamp(26px,4vw,42px)",letterSpacing:"-0.02em",marginBottom:12}}>Simpel, gennemsigtig prissætning</h2>
            <p style={{color:C.txtD,fontSize:15}}>Skalerer med din organisation</p>
          </div>
          <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
            {[
              {navn:"Starter",pris:"0",sub:"kr/md",desc:"Perfekt til pilottest",features:["1 afdeling","Op til 5 brugere","Grundlæggende planlægning","E-mail support"],cta:"Start gratis",featured:false},
              {navn:"Professional",pris:"4.999",sub:"kr/md per afdeling",desc:"Til klinikker og hospitalsafdelinger",features:["Ubegrænsede afdelinger","Op til 50 brugere","FHIR EPJ-integration","Prioriteret support","Avancerede regler"],cta:"Prøv 30 dage gratis",featured:true},
              {navn:"Enterprise",pris:"Kontakt",sub:"os",desc:"Til regioner og store hospitaler",features:["Self-hosted option","Ubegrænsede brugere","Fuld FHIR synkronisering","SLA-garanti","On-premise deployment"],cta:"Book demo",featured:false},
            ].map(p=>(
              <div key={p.navn} className={"price-card"+(p.featured?" featured":"")}>
                {p.featured&&<div style={{color:"#0050b3",fontSize:11,fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>Mest populær</div>}
                <div style={{color:C.txt,fontWeight:800,fontSize:20,marginBottom:4}}>{p.navn}</div>
                <div style={{marginBottom:6}}>
                  <span style={{color:"#0050b3",fontWeight:900,fontSize:32}}>{p.pris}</span>
                  <span style={{color:C.txtM,fontSize:12,marginLeft:4}}>{p.sub}</span>
                </div>
                <div style={{color:C.txtD,fontSize:12,marginBottom:20}}>{p.desc}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                  {p.features.map(f=>(
                    <div key={f} style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{color:"#0050b3",fontSize:12,fontWeight:700}}>OK</span>
                      <span style={{color:C.txtD,fontSize:13}}>{f}</span>
                    </div>
                  ))}
                </div>
                <button className={p.featured?"lp-pri":"lp-sec"} style={{width:"100%"}}
                  onClick={()=>{setMode(p.navn==="Enterprise"?"login":"signup");setStage("login");}}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section style={{padding:"80px 5%",textAlign:"center",background:"#fff",borderTop:"1px solid "+C.brd}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <h2 style={{color:C.txt,fontWeight:900,fontSize:"clamp(24px,4vw,38px)",letterSpacing:"-0.02em",marginBottom:16}}>Klar til at reducere ventetider?</h2>
          <p style={{color:C.txtD,fontSize:15,marginBottom:32,lineHeight:1.7}}>Kom i gang på 15 minutter. Ingen teknisk opsætning krævet.</p>
          <button className="lp-pri" style={{fontSize:16,padding:"16px 40px"}} onClick={()=>{setMode("signup");setStage("login");}}>
            Opret gratis konto
          </button>
          <div style={{color:C.txtM,fontSize:12,marginTop:16}}>PlanMed - Dansk sundhedstech - GDPR-compliant</div>
        </div>
      </section>
    </div>
  );

  if(stage==="login") return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .auth-input:focus{border-color:#0050b3!important;outline:none}
        .lp-btn-pri{background:linear-gradient(135deg,#0050b3,#003d8a);border:none;border-radius:10px;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:transform .15s,box-shadow .15s}
        .lp-btn-pri:hover{transform:translateY(-1px);box-shadow:0 6px 24px #0050b333}
      `}</style>

      {/* Venstre - branding panel */}
      <div style={{flex:"0 0 42%",background:"linear-gradient(160deg,#e8f0fb 0%,#dceeff 100%)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 52px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"15%",right:"-10%",width:300,height:300,background:`radial-gradient(circle,${C.acc}10,transparent 70%)`,borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:"10%",left:"-5%",width:200,height:200,background:`radial-gradient(circle,${C.acc}08,transparent 70%)`,borderRadius:"50%"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{color:C.acc,fontWeight:900,fontSize:28,letterSpacing:"-0.03em",marginBottom:8}}>PlanMed</div>
          <div style={{color:"#ffffff88",fontSize:13,marginBottom:56}}>Intelligent patientplanlægning</div>
          <h2 style={{color:C.txt,fontWeight:800,fontSize:28,letterSpacing:"-0.02em",lineHeight:1.3,marginBottom:40}}>
            Ventelister<br/>under kontrol.<br/><span style={{color:C.acc}}>Altid.</span>
          </h2>
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {[["","EPJ/FHIR-integration klar","Kobles til Sundhedsplatformen og COSMIC"],["","Multi-tenant SaaS","Fuld dataisolation per afdeling"],[">","15 min opsætning","Fra nul til kørende planlægning"]].map(([ic,t,d])=>(
              <div key={t} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                <span style={{fontSize:20,marginTop:2}}>{ic}</span>
                <div>
                  <div style={{color:C.txt,fontWeight:600,fontSize:13}}>{t}</div>
                  <div style={{color:C.txtM,fontSize:12,marginTop:2}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Højre - login/signup formular */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 5%",position:"relative"}}>
        <div style={{position:"absolute",top:18,right:22}}><LanguageSwitcher/></div>
        <div style={{width:"100%",maxWidth:420,animation:"fadeUp .4s ease"}}>
          <button onClick={()=>setStage("welcome")} style={{background:"transparent",border:"none",color:C.txtM,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:32,display:"flex",alignItems:"center",gap:6}}>{t("auth.backToFront")}</button>

          <div style={{color:C.txt,fontWeight:800,fontSize:26,letterSpacing:"-0.02em",marginBottom:6}}>
            {mode==="login"?t("auth.welcomeBack"):t("auth.createAccount")}
          </div>
          <div style={{color:C.txtD,fontSize:13,marginBottom:32}}>
            {mode==="login"?t("auth.loginSubtitle"):t("auth.signupSubtitle")}
          </div>

          {mode==="signup"&&(
            <div style={{marginBottom:16}}>
              <label style={{color:C.txtM,fontSize:12,fontWeight:600,display:"block",marginBottom:6}}>{t("auth.yourName")}</label>
              <input className="auth-input" value={data.navn||""} onChange={e=>upd("navn",e.target.value)}
                placeholder={t("auth.yourNamePlaceholder")} style={{width:"100%",background:"#ffffff",border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",color:C.txt,fontSize:14,fontFamily:"inherit"}}/>
            </div>
          )}

          <div style={{marginBottom:16}}>
            <label style={{color:C.txtM,fontSize:12,fontWeight:600,display:"block",marginBottom:6}}>{t("auth.email")}</label>
            <input className="auth-input" type="email" value={data.email||""} onChange={e=>upd("email",e.target.value)}
              placeholder={t("auth.emailPlaceholder")} style={{width:"100%",background:"#ffffff",border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",color:C.txt,fontSize:14,fontFamily:"inherit"}}/>
          </div>

          <div style={{marginBottom:mode==="login"?8:16}}>
            <label style={{color:C.txtM,fontSize:12,fontWeight:600,display:"block",marginBottom:6}}>{t("auth.password")}</label>
            <input className="auth-input" type="password" value={data.password||""} onChange={e=>upd("password",e.target.value)}
              placeholder={mode==="login"?t("auth.passwordPlaceholderLogin"):t("auth.passwordPlaceholderSignup")} style={{width:"100%",background:"#ffffff",border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",color:C.txt,fontSize:14,fontFamily:"inherit"}}/>
          </div>

          {mode==="login"&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={data.huskMig||false} onChange={e=>{
                  upd("huskMig",e.target.checked);
                  // Kun email huskes — password gemmes aldrig i localStorage
                  if(e.target.checked){
                    try{localStorage.setItem("pm_email",data.email||"");}catch(ex){}
                  } else {
                    try{localStorage.removeItem("pm_email");}catch(ex){}
                  }
                }} style={{accentColor:"#0050b3"}}/>
                <span style={{color:C.txtD,fontSize:12}}>{t("auth.rememberEmail")}</span>
              </label>
              <span style={{color:C.acc,fontSize:12,cursor:"pointer"}}>{t("auth.forgotPassword")}</span>
            </div>
          )}

          {mode==="signup"&&(
            <div style={{marginBottom:16}}>
              <label style={{color:C.txtM,fontSize:12,fontWeight:600,display:"block",marginBottom:6}}>{t("auth.companyName")}</label>
              <input className="auth-input" value={data.selskab||""} onChange={e=>upd("selskab",e.target.value)}
                placeholder={t("auth.companyPlaceholder")} style={{width:"100%",background:"#ffffff",border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",color:C.txt,fontSize:14,fontFamily:"inherit"}}/>
            </div>
          )}

          {err&&<div style={{color:"#003d8a",fontSize:12,marginBottom:12,background:"#003d8a11",borderRadius:7,padding:"8px 12px"}}>! {err}</div>}

          <button className="lp-btn-pri" style={{width:"100%",marginBottom:16}}
            disabled={loading} onClick={()=>fakeLoad(()=>{
              if(!data.email||!data.password){setErr(t("auth.errFillFields"));setLoading(false);return;}
              if(mode==="signup"&&!data.selskab){setErr(t("auth.errCompany"));setLoading(false);return;}
              // Husk kun email — password gemmes aldrig i klartekst
              if(data.huskMig){try{localStorage.setItem("pm_email",data.email);}catch(ex){}}
              setStage("dept");
            })}>
            {loading?t("auth.loggingIn"):(mode==="login"?t("auth.logIn")+" >":t("auth.createAccountBtn")+" >")}
          </button>

          <div style={{textAlign:"center",fontSize:13,color:C.txtM}}>
            {mode==="login"
              ?<>{t("auth.noAccount")} <span style={{color:C.acc,cursor:"pointer"}} onClick={()=>{setMode("signup");setErr("");}}>{t("auth.createFree")}</span></>
              :<>{t("auth.haveAccount")} <span style={{color:C.acc,cursor:"pointer"}} onClick={()=>{setMode("login");setErr("");}}>{t("auth.logInLink")}</span></>
            }
          </div>

          <div style={{borderTop:"1px solid #ffffff0f",marginTop:32,paddingTop:16,display:"flex",justifyContent:"center",gap:20}}>
            {["GDPR-compliant","Dansk support","ISO 27001"].map(t=>(
              <span key={t} style={{color:C.txtD,fontSize:11}}>OK {t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // -- VÆLG AFDELING --
  if(stage==="dept"){
    const afdelinger=data.selskab
      ? []
      : [{id:"a1",navn:"Psykiatri Nord","ikon":""},{id:"a2",navn:"Børne-psykiatri","ikon":""},{id:"a3",navn:"Ungdomspsykiatri","ikon":""}];

    return(
      <div style={S.wrap}>
        <style>{`*{box-sizing:border-box}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}input:focus{border-color:${C.acc}!important}`}</style>
        <div style={{position:"absolute",top:18,right:22}}><LanguageSwitcher/></div>
        <div style={{...S.card,maxWidth:500,animation:"fadeUp .4s ease"}}>
          <div style={S.logo}>{t("common.appName")}</div>
          <div style={S.sub}>
            {data.selskab
              ? <span dangerouslySetInnerHTML={{__html:t("auth.dept.setupCompany",{selskab:data.selskab})}}/>
              : t("auth.dept.chooseDept",{name:data.navn||data.email})
            }
          </div>

          {afdelinger.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
              {afdelinger.map(af=>(
                <button key={af.id}
                  style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:10,padding:"14px 18px",
                    cursor:"pointer",display:"flex",alignItems:"center",gap:12,color:C.txt,
                    fontSize:14,fontWeight:600,transition:"all .15s",textAlign:"left",width:"100%"}}

                  onClick={()=>{upd("afdeling",af.navn);if(_ejerEmail&&data.email===_ejerEmail)upd("rolle","ejer");setStage("app");}}>
                  <span style={{fontSize:20}}>{af.ikon}</span>
                  <span>{af.navn}</span>
                </button>
              ))}
            </div>
          )}

          {/* Opret ny afdeling inline */}
          {!visNyAfd&&afdelinger.length>0&&(
            <button style={{...S.btnSec,marginTop:4}}

              onClick={()=>setVisNyAfd(true)}>
              {t("auth.dept.createNewDept")}
            </button>
          )}

          {visNyAfd&&(
            <div style={{marginTop:afdelinger.length>0?12:0}}>
              <label style={S.label}>{t("auth.dept.deptName")}</label>
              <input type="text" value={nyAfdNavn} placeholder={t("auth.dept.deptPlaceholder")}
                onChange={e=>setNyAfdNavn(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&nyAfdNavn.trim()){upd("afdeling",nyAfdNavn.trim());if(_ejerEmail&&data.email===_ejerEmail)upd("rolle","ejer");setStage("app");} }}
                className="auth-input" style={{...S.input,marginBottom:8}}/>
              <button style={{...S.btn,marginTop:0,opacity:nyAfdNavn.trim()?1:.5}}
                disabled={!nyAfdNavn.trim()}
                onClick={()=>{upd("afdeling",nyAfdNavn.trim());if(_ejerEmail&&data.email===_ejerEmail)upd("rolle","ejer");setStage("app");}}>
                {t("auth.dept.startWithDept")}
              </button>
            </div>
          )}

          <div style={{textAlign:"center",marginTop:16}}>
            <span style={{...S.link,color:C.txtM,textDecoration:"none",opacity:.7,fontSize:13,cursor:"pointer"}} onClick={()=>setStage("login")}>&lt; {t("common.back")}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
