// ══════════════════════════════════════════════════════════════════════════
//  SIKKERHED: INGEN HARDKODEDE IDENTITETER MÅ COMMITTES
// ══════════════════════════════════════════════════════════════════════════
//  - authData, ejer-email, selskabsnavn og lignende skal ALTID starte tomme.
//  - Demo-data som startpatienter, start-medarbejdere og lign. må kun loades
//    når import.meta.env.DEV er true (lokal udvikling). I production-builds
//    skal appen starte helt rent og tvinge brugeren gennem wizard.
//  - Hvis du har brug for at teste med sample-data, brug "Indlæs demo-data"-
//    knappen i Indstillinger i stedet for at committe defaults.
// ══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n, { SPROG } from "./i18n.js";

// Data og utilities flyttet til /src/data + /src/utils i april 2026-refaktoreringen.
import {
  sx, uid, toMin, fromMin, fmtDate, parseLocalDate, addDays, isWeekend, nextWD,
  DAG_NAV, getDag, daysBetween, today,
  VALUTAER, valutaInfo, valutaSymbol, formatBeloeb,
} from "./utils/index.js";
import {
  C, TITLE_C, PAT_STATUS, STATUS, sC, sB, sL,
  ALLE_LOK, DEFAULT_LOK_TIDER, STANDARD_AABNINGSTIDER, LOK_TIDER,
  DEFAULT_TITLER, LK, PK, PD, ALLE_K, ensureKompetencer,
  BASE_MED, INIT_PATIENTER_RAW, FORLOB, INIT_CERTIFIKATER,
  NAV_ITEMS, KAP_TYPER, FORLOB_GALLERI, buildPatient,
} from "./data/constants.js";
import {
  StatusBadge, ProgressRing, Pill, Btn, Input, Sel, Modal, FRow,
  LanguageSwitcher, Toast, KpiDrillModal, PatientDrillModal, ScopeModal,
  PeriodeVaelger, ViewHeader, ErrorBoundary,
  beregnMaxTimer, beregnRullendeGns, beregnKapStatus,
} from "./components/primitives.jsx";
import { runPlanner, analyserRessourcer } from "./planner/runPlanner.js";
import { hashKode, erBcryptHash } from "./utils/krypto.js";
import { useInaktivitetsTimer } from "./hooks/useInaktivitetsTimer.js";
import PlanMedTester from "./tests/PlanMedTester.jsx";
import AuthFlow from "./auth/AuthFlow.jsx";
import EjerSetupDialog from "./auth/EjerSetupDialog.jsx";
import SelskabSetupWizard from "./auth/SelskabSetupWizard.jsx";
import AdminView from "./admin/AdminView.jsx";
import Dashboard from "./views/Dashboard.jsx";
import KalenderView from "./views/KalenderView.jsx";
import PlanLogView from "./views/PlanLogView.jsx";
import EjerView from "./views/EjerView.jsx";
import IndstillingerView from "./views/IndstillingerView.jsx";
import PatientKalenderView from "./views/PatientKalenderView.jsx";
import LokalerView, { IndsatsForm } from "./views/LokalerView.jsx";
import ForlobView from "./views/ForlobView.jsx";
import MinProfilPanel from "./modals/MinProfilPanel.jsx";
import MedarbejderView from "./views/MedarbejderView.jsx";
import { GodkendelsesView, OmfordelingView, AktivLogView } from "./views/admin-subviews.jsx";
import { ConfirmDialog, GlobalSearch } from "./components/dialogs.jsx";
import {
  eksporterPatientlisteExcel, eksporterMedarbejdereExcel,
  eksporterOpgaveplanExcel, eksporterUgeplanExcel,
  eksporterOpgaveplanPDF, eksporterUgeplanPDF,
} from "./utils/eksport.js";


// ===============================================
export default function App(){
  const {t} = useTranslation();
  // Engangs-oprydning: fjern tidligere gemt password fra localStorage.
  // "pm_pw" blev tidligere gemt i klartekst under "Husk mig" — det er
  // fjernet af sikkerhedshensyn. Denne linje sikrer eksisterende brugere
  // ikke bærer rundt på et gammelt lagret password efter opdateringen.
  try{localStorage.removeItem("pm_pw");}catch(e){}
  // Start altid på welcome — ingen auto-login med gemt data.
  // authStage skiftes til "app" først når brugeren har gennemført login-flow.
  const [authStage,setAuthStage]=useState("welcome");
  // Ingen hardkodede identiteter. Brugerens oplysninger udfyldes gennem
  // AuthFlow (login/dept-steps).
  const [authData,setAuthData]=useState({email:"",password:"",navn:"",selskab:"",afdeling:"",rolle:""});
  const isAdmin = authData.rolle==="admin" || authData.rolle==="superadmin" || authData.rolle==="ejer";
  // Ejer-konto fra localStorage (oprettes ved førstegangs-opstart)
  const [ejerKonto,setEjerKontoState]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("planmed_ejerKonto")||"null");}catch{return null;}
  });
  const setEjerKonto=(v)=>{setEjerKontoState(v);try{localStorage.setItem("planmed_ejerKonto",JSON.stringify(v));}catch(e){}};
  // Migration: ældre installationer har kode gemt i klartekst. Hvis den eksisterer
  // men ikke ser ud som en bcrypt-hash, hash den automatisk ved app-start — så
  // eksisterende brugere ikke låses ude af opdateringen.
  useEffect(()=>{
    if(!ejerKonto||!ejerKonto.kode) return;
    if(erBcryptHash(ejerKonto.kode)) return;
    // Klartekst-kode detekteret — hash og gem igen
    hashKode(ejerKonto.kode).then(hash=>{
      setEjerKonto({...ejerKonto,kode:hash});
    }).catch(()=>{});
    // Kør kun når ejerKonto faktisk ændres; ESLint-regel er slået fra globalt
  },[ejerKonto?.kode]);
  const EJER_EMAIL=ejerKonto?.email||"";
  const EJER_KODE=ejerKonto?.kode||"";
  const [ejerUnlocked,setEjerUnlocked]=useState(false);
  const isEjer = (ejerKonto && (authData.email===EJER_EMAIL || authData.rolle==="ejer")) && ejerUnlocked;
  const [visTester,setVisTester]=useState(false);
  const [aktivLog,setAktivLog]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("planmed_aktivlog")||"[]");}catch{return [];}
  });
  const gemAktivLog=(entries)=>{try{localStorage.setItem("planmed_aktivlog",JSON.stringify(entries));}catch(e){}};
  const logEntry=useCallback((type,tekst)=>{
    const entry={
      id:Date.now()+"_"+Math.random().toString(36).slice(2,6),
      dato:today(),
      tid:new Date().toLocaleTimeString("da-DK",{hour:"2-digit",minute:"2-digit"}),
      bruger:authData?.navn||authData?.email||"Ukendt",
      type,tekst
    };
    setAktivLog(prev=>{
      const ny=[...prev,entry].slice(-2000); // max 2000 i hukommelsen
      gemAktivLog(ny);
      return ny;
    });
  },[authData]);
  const [view,setView]=useState("dashboard");
  const [gsOpen,setGsOpen]=useState(false);
  const [gsQuery,setGsQuery]=useState("");
  // Demo-data (patienter, medarbejdere) loades KUN i DEV-mode.
  // I production-builds starter alle lister tomme — brugeren skal tilføje
  // egne data eller importere via Indstillinger.
  const [patienter,setPatienter]=useState(()=>{
    if(!import.meta.env.DEV) return [];
    try{return INIT_PATIENTER_RAW.map(r=>buildPatient(r));}catch(e){return [];}
  });
  const [medarbejdere,setMedarbejdereRaw]=useState(()=>{
    if(!import.meta.env.DEV) return [];
    return [...BASE_MED].map(ensureKompetencer);
  });
  const setMedarbejdere=React.useCallback((valOrFn)=>{
    setMedarbejdereRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      return ny.map(ensureKompetencer);
    });
  },[]);
  const [forlob,setForlobRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_forlob"); if(s) return JSON.parse(s);}catch(e){}
    try{return structuredClone(FORLOB);}catch(e){return {};}
  });
  const setForlob=React.useCallback((valOrFn)=>{
    setForlobRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_forlob",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  // Sidecar: navn + beskrivelse per forløbs-skabelon-id
  const [forlobMeta,setForlobMetaRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_forlobMeta"); if(s) return JSON.parse(s);}catch(e){}
    return {};
  });
  const setForlobMeta=React.useCallback((valOrFn)=>{
    setForlobMetaRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_forlobMeta",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  const [indsatser,setIndsatser]=useState([]);
  const [lokTider,setLokTiderRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_lokTider"); if(s) return JSON.parse(s);}catch(e){}
    return structuredClone(DEFAULT_LOK_TIDER);
  });
  const setLokTider=React.useCallback((valOrFn)=>{
    setLokTiderRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_lokTider",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  const ADMIN_DEFAULTS={
    titler:DEFAULT_TITLER.map(t=>({...t})),
    kapDefaults:{
      "Læge":    {grænseType:"uge",grænseTimer:30,rullendePeriodeUger:4,rullendeMaxTimer:25,ialtFra:"",ialtTil:""},
      "Psykolog":{grænseType:"uge",grænseTimer:23,rullendePeriodeUger:4,rullendeMaxTimer:20,ialtFra:"",ialtTil:""},
      "Pædagog": {grænseType:"uge",grænseTimer:23,rullendePeriodeUger:4,rullendeMaxTimer:18,ialtFra:"",ialtTil:""},
    },
    // Default-priser er 0 — wizarden eller admin sætter selv priser per faggruppe.
    taktDefaults:{
      "Læge":    {krPrTime:0},
      "Psykolog":{krPrTime:0},
      "Pædagog": {krPrTime:0},
      "Lokale":  {krPrTime:0},
    },
    valuta:"DKK",
    // Sikkerhedsindstillinger (Admin → Sikkerhed)
    sikkerhed:{
      inaktivitetTimeoutMin:30, // min 5, max 120 — styres i Admin → Sikkerhed
    },
    selskaber:[],
  };
  const [adminData,setAdminDataRaw]=useState(()=>{
    try{
      const s=localStorage.getItem("planmed_adminData");
      if(s){
        const parsed=JSON.parse(s);
        // Migration: hvis gammel data uden titler-liste, start med defaults
        if(!Array.isArray(parsed.titler)) parsed.titler=[];
        if(parsed.titler.length===0){
          parsed.titler=DEFAULT_TITLER.map(t=>({...t}));
        }
        // Bagudkompatibilitet: bevar custom-titler fra tidligere versioner
        // ved at aflede manglende titler-entries fra eksisterende kapDefaults/taktDefaults-keys
        const kendteNavne=new Set(parsed.titler.map(t=>t.navn));
        const ekstraNavne=new Set();
        Object.keys(parsed.kapDefaults||{}).forEach(k=>{if(k&&k!=="Lokale"&&!kendteNavne.has(k)) ekstraNavne.add(k);});
        Object.keys(parsed.taktDefaults||{}).forEach(k=>{if(k&&k!=="Lokale"&&!kendteNavne.has(k)) ekstraNavne.add(k);});
        ekstraNavne.forEach(navn=>{
          const kd=parsed.kapDefaults?.[navn]||{};
          const td=parsed.taktDefaults?.[navn]||{};
          parsed.titler.push({
            id:navn, navn,
            farve:"#0050b3",
            defaultTimerPerUge:Number(kd.grænseTimer)||23,
            defaultKrPrTime:Number(td.krPrTime)||0,
          });
        });
        // Migration: gammel data uden valuta antages at være DKK (Danish kroner)
        if(!parsed.valuta||!VALUTAER[parsed.valuta]) parsed.valuta="DKK";
        // Migration: gammel data uden sikkerhedsindstillinger får defaults
        if(!parsed.sikkerhed||typeof parsed.sikkerhed!=="object") parsed.sikkerhed={};
        if(typeof parsed.sikkerhed.inaktivitetTimeoutMin!=="number"){
          parsed.sikkerhed.inaktivitetTimeoutMin=30;
        }
        return {...ADMIN_DEFAULTS,...parsed};
      }
    }catch(e){}
    return ADMIN_DEFAULTS;
  });
  const setAdminData=React.useCallback((valOrFn)=>{
    setAdminDataRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_adminData",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  const [lokaler,setLokaler]=useState(()=>{
    try{const s=localStorage.getItem("planmed_lokaler"); if(s) return JSON.parse(s);}catch(e){}
    return [...ALLE_LOK];
  });
  const saveLokaler=(ny)=>{setLokaler(ny);try{localStorage.setItem("planmed_lokaler",JSON.stringify(ny));}catch(e){}};
  const [lokMeta,setLokMetaRaw]=useState(()=>{
    try{const s=localStorage.getItem("planmed_lokMeta"); if(s) return JSON.parse(s);}catch(e){}
    return {};
  });
  const setLokMeta=React.useCallback((valOrFn)=>{
    setLokMetaRaw(prev=>{
      const ny=typeof valOrFn==="function"?valOrFn(prev):valOrFn;
      try{localStorage.setItem("planmed_lokMeta",JSON.stringify(ny));}catch(e){}
      return ny;
    });
  },[]);
  // Udstyr: kategorier med items, og pakker
  const [udstyrsKat,setUdstyrsKat]=useState(()=>{try{const s=localStorage.getItem("planmed_udstyrsKat");return s?JSON.parse(s):[];}catch(e){return[];}});
  const [udstyrsPakker,setUdstyrsPakker]=useState(()=>{try{const s=localStorage.getItem("planmed_udstyrsPakker");return s?JSON.parse(s):[];}catch(e){return[];}});
  const saveUdstyrsKat=(v)=>{setUdstyrsKat(v);try{localStorage.setItem("planmed_udstyrsKat",JSON.stringify(v));}catch(e){}};
  const saveUdstyrsPakker=(v)=>{setUdstyrsPakker(v);try{localStorage.setItem("planmed_udstyrsPakker",JSON.stringify(v));}catch(e){}};
  const [certifikater,setCertifikater]=useState(()=>structuredClone(INIT_CERTIFIKATER));
  const [anmodninger,setAnmodninger]=useState([]); // {id,medId,medNavn,medEmail,lederNavn,lederEmail,
  const [rulNotif,setRulNotif]=useState([]); // rulleplan-notifikationer: {id,patId,patNavn,opgaveId,opgaveType,medNavn,medMail,ansvarligNavn,ansvarligMail,oprettet,deadline,rykkerdato,status,log:[]}tidspunkt,felt,fra,til,status:"afventer"|"godkendt"|"afvist",kommentar:""}
  const [planFraDato,setPlanFraDato]=useState(today());
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState(null);
  const [planLog,setPlanLog]=useState([]);
  const [planDebug,setPlanDebug]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3200);};

  // ── Auto-logout ved inaktivitet ─────────────────────────────────
  // Timeout hentes fra adminData.sikkerhed.inaktivitetTimeoutMin (default 30).
  // Hooken aktiveres KUN når authStage === "app" (dvs. efter login).
  // Ved timeout: log i aktivLog, nulstil password i memory, vis toast,
  // send brugeren tilbage til welcome-skærmen.
  // TEST-OVERRIDE: ?testInaktiv=1 giver 6-sek timeout + 3-sek advarsel (9 sek total):
  // modal dukker op efter 3 sek inaktivitet, logout efter 6 sek yderligere.
  // Skal fjernes efter verifikation.
  const _testInaktiv = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testInaktiv") === "1";
  const inaktivitetTimeoutMin = _testInaktiv ? 0.15 : (adminData?.sikkerhed?.inaktivitetTimeoutMin ?? 30);
  const inaktivitetAdvarselMin = _testInaktiv ? 0.05 : 2; // 3 sek i test, 2 min i prod
  const handleInaktivTimeout = useCallback(() => {
    logEntry("sikkerhed","Auto-logout ved inaktivitet");
    try{localStorage.removeItem("pm_pw");}catch(e){}
    setAuthData(d=>({...d,password:""}));
    setAuthStage("welcome");
    showToast("Du blev logget ud pga. inaktivitet","warn");
  },[logEntry]);
  const {nulstil:nulstilInaktivitet, advarselAktiv:visInaktivAdvarsel} = useInaktivitetsTimer(
    inaktivitetTimeoutMin,
    handleInaktivTimeout,
    { advarselMin: inaktivitetAdvarselMin, enabled: authStage === "app" }
  );

  //  Rulleplan: marker opgave løst + send notifikation
  const handleMarkerLøst=(pat,opg)=>{
    const dato=new Date().toISOString().slice(0,10);
    // 1. Marker opgaven som løst
    setPatienter(ps=>ps.map(p=>p.id!==pat.id?p:{
      ...p,
      opgaver:p.opgaver.map(o=>o.id!==opg.id?o:{...o,status:"godkendt",løstDato:dato,låst:false})
    }));

    // 2. Opret rulNotif hvis opgaven har rulleplan
    if(opg.ruller){
      const medNavn   = opg.medarbejder||"";
      const medObj    = medarbejdere.find(m=>m.navn===medNavn);
      const medMail   = medObj?.mail||"";
      const ansvarlig = medarbejdere.find(m=>m.navn===pat.ansvarligMed);
      const svarFrist = new Date(Date.now()+7*24*3600*1000).toISOString().slice(0,10); // 7 dage
      const rykkDato  = new Date(Date.now()+5*24*3600*1000).toISOString().slice(0,10); // rykker dag 5
      const notif = {
        id:"rn"+Date.now(),
        patId:pat.id, patNavn:pat.navn, cpr:pat.cpr,
        opgaveId:opg.id, opgaveType:opg.opgave,
        rullerOpgave:opg.rullerOpgave||opg.opgave,
        rullerTidligstUger:opg.rullerTidligstUger||4,
        rullerSenestUger:opg.rullerSenestUger||6,
        rullerLåsUger:opg.rullerLåsUger||2,
        løstDato:dato,
        medNavn, medMail,
        ansvarligNavn:ansvarlig?.navn||pat.ansvarligMed||"",
        ansvarligMail:ansvarlig?.mail||"",
        svarFrist, rykkDato,
        status:"afventer-svar", // afventer-svar | rykket | besluttet | afsluttet
        beslutning:null, // "forlæng" | "afslut"
        log:[
          {tid:new Date().toISOString(),tekst:`Opgave "${opg.opgave}" markeret løst. Mail #1 sendt til ${medNavn||"(ingen medarbejder)"}${medMail?" ("+medMail+")":""}.`},
        ],
      };
      setRulNotif(prev=>[...prev,notif]);
      showToast(`Løst — rulleplan-notifikation sendt til ${medNavn||"medarbejder"}`,"success");
    } else {
      showToast("Opgave markeret løst v","success");
    }
  };

  const [visScope,setVisScope]=useState(false);

  // GLOBALT AFDELINGSSCOPE
  // Byg afdelinger dynamisk fra adminData
  const alleAfdelinger = useMemo(()=>{
    const fromAdmin = (adminData?.selskaber?.[0]?.afdelinger || []).map(a=>({id:a.id, navn:a.navn}));
    // Tilføj afdelinger fra importerede patienter og medarbejdere
    const dataAfds = new Set([
      ...patienter.map(p=>p.afdeling||"current"),
      ...medarbejdere.map(m=>m.afdeling||"current"),
    ]);
    const adminIds = new Set(fromAdmin.map(a=>a.id));
    const extra = [...dataAfds].filter(id=>!adminIds.has(id)).map(id=>({id, navn:id==="current"?(authData?.afdeling||"Min afdeling"):id}));
    const result = [...fromAdmin, ...extra];
    if(result.length > 0) return result;
    return [{id:"current", navn: authData?.afdeling||"Min afdeling"}];
  },[adminData, authData, patienter, medarbejdere]);
  const [afdScope, setAfdScope] = useState(()=>{
    // Initialisér scope — alle afdelinger aktive som standard
    const afdIds = (adminData?.selskaber?.[0]?.afdelinger||[]).map(a=>a.id);
    const defaultIds = afdIds.length>0 ? afdIds : ["current","a1","a2","a3"];
    return Object.fromEntries(defaultIds.map(id=>[id,{aktiv:true,med:true,lok:true,pat:true}]));
  });
  // Sync afdScope når adminData afdelinger ændrer sig
  useEffect(()=>{
    const afdIds=(adminData?.selskaber?.[0]?.afdelinger||[]).map(a=>a.id);
    if(afdIds.length===0) return;
    setAfdScope(prev=>{
      const next={...prev};
      afdIds.forEach(id=>{if(!next[id]) next[id]={aktiv:true,med:true,lok:true,pat:true};});
      return next;
    });
  },[adminData]);

  // Sync afdScope med afdelinger fra importerede patienter og medarbejdere
  useEffect(()=>{
    const patAfds=new Set(patienter.map(p=>p.afdeling||"current"));
    const medAfds=new Set(medarbejdere.map(m=>m.afdeling||"current"));
    const alleAfds=new Set([...patAfds,...medAfds]);
    setAfdScope(prev=>{
      let changed=false;
      const next={...prev};
      alleAfds.forEach(id=>{if(!next[id]){next[id]={aktiv:true,med:true,lok:true,pat:true};changed=true;}});
      return changed?next:prev;
    });
  },[patienter,medarbejdere]);

  // Bagudkompatibilitet: auto-tilføj titler fundet på medarbejdere/opgaver
  // hvis de ikke allerede findes i adminData.titler. Sikrer at gammel data
  // (fx importeret fra Excel med custom titler som "Sygeplejerske") forbliver
  // synlig i UI og brugbar i runPlanner.
  useEffect(()=>{
    const kendte=new Set((adminData?.titler||[]).map(t=>t.navn));
    const fundne=new Set();
    medarbejdere.forEach(m=>{if(m?.titel&&!kendte.has(m.titel)) fundne.add(m.titel);});
    patienter.forEach(p=>(p.opgaver||[]).forEach(o=>{
      (o.muligeMed||[]).forEach(mm=>{
        // kun hvis det ligner en titel (matcher en eksisterende medarbejder.titel) og ikke en navn
        if(mm&&!kendte.has(mm)&&medarbejdere.some(m=>m.titel===mm)) fundne.add(mm);
      });
    }));
    if(fundne.size===0) return;
    setAdminData(d=>({
      ...d,
      titler:[...(d.titler||[]),...[...fundne].map(navn=>({
        id:navn, navn, farve:"#0050b3", defaultTimerPerUge:23, defaultKrPrTime:0,
      }))],
    }));
  },[medarbejdere,patienter]); // adminData bevidst udeladt: forhindrer loop, opdateres kun ved ændringer i kilderne

  const toggleAktiv = (id) => setAfdScope(prev=>{
    const aktive=Object.entries(prev).filter(([,v])=>v.aktiv).length;
    if(prev[id]?.aktiv&&aktive<=1) return prev;
    return {...prev,[id]:{...(prev[id]||{med:true,lok:true,pat:true}),aktiv:!prev[id]?.aktiv}};
  });
  const toggleRes = (afdId,res) => setAfdScope(prev=>({
    ...prev,[afdId]:{...prev[afdId],[res]:!prev[afdId][res]}
  }));

  const [config,setConfig]=useState({
    pause:5, minGapDays:2, step:5, maxDage:90,
    // Besøgsgrænse per medarbejder per uge
    maxPatVisitsPerMedPerUge: 10,
    maxPatVisitsStrenged: "bloed",
    // Max antal forskellige medarbejdere per patient
    maxMedPerPatient: 0,
    maxMedStrenged: "bloed",
    // Prioritering af patienter
    prioritering: "henvDato",
    // Deadline-beregning
    deadlineMode: "henvDato",   // "henvDato" | "indsatsDato"
    indsatsDato: "",            // bruges kun hvis deadlineMode==="indsatsDato"
    // Låste opgaver
    tilladOverstigLåste: false,
    tilladOverstigLåsteStrenged: "bloed",
    // Max dage fra henvisning til afsluttet forløb
    maxDageForlob: 0,
    maxDageForlobStrenged: "bloed",
  });

  // SCOPE-FILTREREDE DATA — opdateres automatisk når afdScope ændres
  const scopedMed = useMemo(()=>{
    const aktive = Object.entries(afdScope).filter(([,v])=>v.aktiv&&v.med).map(([id])=>id);
    if(aktive.length===0) return medarbejdere;
    return medarbejdere.filter(m=>{
      const afd = m.afdeling||"current";
      return aktive.includes(afd);
    });
  },[medarbejdere,afdScope]);

  const scopedPatienter = useMemo(()=>{
    const aktivePat = Object.entries(afdScope).filter(([,v])=>v.aktiv&&v.pat).map(([id])=>id);
    if(aktivePat.length===0) return patienter;
    return patienter.filter(p=>{
      const afd = p.afdeling||"current";
      // Vis patient hvis afdeling matcher ELLER hvis current er aktiv og ingen afdeling sat
      return aktivePat.includes(afd) || (afd==="current"&&aktivePat.includes("current"));
    });
  },[patienter,afdScope]);

  // fejl-listen beregnes aldrig i øjeblikket (regel-validering er ikke implementeret endnu)
  const fejl=useMemo(()=>[],[scopedPatienter,lokTider]);

  const handlePlan=useCallback(async ()=>{
    if(running)return;
    setRunning(true);
    // Nulstil alle ikke-låste opgaver før planlægning
    const nulstillet=patienter.map(p=>({
      ...p,
      opgaver:p.opgaver.map(o=>o.låst?o:{...o,status:"afventer",dato:null,startKl:null,slutKl:null,lokale:null,medarbejder:null})
    }));
    const total=nulstillet.reduce((a,p)=>a+p.opgaver.filter(o=>!o.låst).length,0);
    setProgress({done:0,total});
    await new Promise(r=>setTimeout(r,80));
    const planConfig={
      ...config,lokTider,planFraDato:planFraDato||null,
      medarbejdere,lokaler,transportKmHt:config.transportKmHt||40,
      afdPostnr:config.afdPostnr||"",
      googleMapsKey:config.googleMapsKey||"",transportCache:config.transportCache||{},
      titler:adminData?.titler,
      lokMeta,
    };
    let res;
    try {
      res=runPlanner(nulstillet,planConfig);
    } catch(e) {
      setRunning(false); setProgress(null);
      setToast({msg:"Fejl i planlægger: "+e.message,type:"error"});
      return;
    }
    setProgress({done:res.planned+res.failed,total});
    await new Promise(r=>setTimeout(r,50));
    setPatienter(res.patienter);
    setPlanLog(res.planLog||[]);
    setRunning(false);
    setProgress(null);
    logEntry("planlægning","Auto: "+res.planned+" planlagt, "+res.failed+" ikke fundet");
    const type=res.planned===0&&total>0?"warn":res.failed>0?"warn":"success";
    setToast({msg:"Planlagt: "+res.planned+" | Ikke fundet: "+res.failed+" | Total: "+total,type});
  },[patienter,medarbejdere,running,config,lokTider,planFraDato]);

  const afventer=patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="afventer").length,0);
  const errors=fejl.filter(f=>f.type==="Fejl").length;

  useEffect(()=>{
    const handler=(e)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();setGsOpen(o=>!o);setGsQuery("");}
      if(e.key==="Escape") setGsOpen(false);
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  if(authStage !== "app") return <ErrorBoundary><AuthFlow stage={authStage} setStage={setAuthStage} data={authData} setData={setAuthData}/></ErrorBoundary>;

  // Førstegangs-opstart: vis ejer-opsætning hvis ingen ejerKonto er gemt
  if(!ejerKonto){
    return(
      <EjerSetupDialog onSave={(email,kode)=>{
        setEjerKonto({email,kode});
      }}/>
    );
  }

  // Førstegangs-opstart 2: vis selskabs-wizard hvis ingen selskaber er oprettet
  if(!adminData.selskaber || adminData.selskaber.length===0){
    return(
      <SelskabSetupWizard onSave={({selskab,lokaler:lokListe,lokTider:lokTiderMap,valuta,taktDefaults})=>{
        setAdminData(d=>({
          ...d,
          selskaber:[selskab],
          valuta:valuta||d.valuta||"DKK",
          taktDefaults:{...(d.taktDefaults||{}),...(taktDefaults||{})},
        }));
        if(Array.isArray(lokListe)&&lokListe.length>0){
          saveLokaler(lokListe);
          setLokTider(lokTiderMap);
        }
      }}/>
    );
  }

  return(
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.txt}}>
      <style>{`
        *{box-sizing:border-box}
        body{font-family:'DM Sans','Segoe UI',system-ui,sans-serif}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.brd};border-radius:3px}
        input[type=checkbox]{width:14px;height:14px;cursor:pointer}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
        .pm-btn-hover:hover{filter:brightness(1.12)}
        .pm-tr-hover:hover{background:rgba(0,80,179,0.05)!important}
        .pm-nav-hover:hover{background:rgba(0,80,179,0.05)!important}
        .auth-input:focus{border-color:#0050b3!important;outline:none}
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
      `}</style>

      {/* Global Search Overlay */}
      {gsOpen&&<GlobalSearch
        patienter={patienter}
        medarbejdere={medarbejdere}
        onClose={()=>{setGsOpen(false);setGsQuery("");}}
        onNavigate={(r)=>setView(r.nav)}
      />}

      {/* Sidebar */}
      <div style={{width:220,flexShrink:0,background:C.s1,borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.brd}`}}>
          <div style={{color:C.acc,fontWeight:900,fontSize:22,letterSpacing:"-0.02em"}}>{t("common.appName")}</div>
          <div style={{color:C.txtM,fontSize:11,marginTop:2}}>{t("nav.subtitle")}</div>
        </div>
        <div style={{padding:"8px 10px",borderBottom:`1px solid ${C.brd}`}}>
          <button onClick={()=>{setGsOpen(true);setGsQuery("");}}
            style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",color:C.txtM,fontFamily:"inherit",fontSize:12,transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.acc}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.brd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{flex:1,textAlign:"left"}}>{t("nav.searchHint")}</span>
            <kbd style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:4,padding:"1px 5px",fontSize:10}}>Ctrl+K</kbd>
          </button>
        </div>

        <nav style={{flex:1,padding:"8px 8px",overflowY:"auto"}}>
          {NAV_ITEMS.map((item,i)=>{
            if(item.sep) return <div key={`sep${i}`} style={{height:1,background:C.brd,margin:"6px 8px",opacity:.5}}/>;
            if(item.adminOnly && !isAdmin) return null;
            if(item.ejOnly && authData.email!==EJER_EMAIL && authData.rolle!=="ejer") return null;
            const act=view===item.id;
            const rulNotifCount=rulNotif.filter(n=>n.status==="afventer-svar"||n.status==="rykket").length;
      const badge=item.id==="planlog"?planLog.length||null:item.id==="dashboard"&&errors>0?errors:item.id==="admin"?(anmodninger.filter(a=>a.status==="afventer").length+rulNotifCount)||null:null;
            return(
              <button key={item.id} onClick={()=>setView(item.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,border:"none",background:act?C.accM:"transparent",color:act?C.acc:C.txtD,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:act?700:400,marginBottom:2,textAlign:"left",transition:"background .12s,color .12s",position:"relative"}}
                className={act?"":"pm-nav-hover"}>
                <span style={{flex:1}}>{t(item.label)}</span>
                {badge&&<span style={{background:act?C.acc:C.red,color:act?C.bg:"#fff",borderRadius:10,fontSize:10,fontWeight:700,padding:"1px 6px",minWidth:18,textAlign:"center"}}>{badge}</span>}
                {/* Aktiv indikator - Fitts: tydelig markering */}
                {act&&<div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:3,height:18,background:C.acc,borderRadius:"0 2px 2px 0"}}/>}
              </button>
            );
          })}
        </nav>

        <div style={{padding:"12px 12px",borderTop:"1px solid "+C.brd}}>
          <div style={{background:C.accM,borderRadius:8,padding:"10px 12px"}}>
            <div style={{color:C.acc,fontSize:12,fontWeight:700,marginBottom:4}}>{t("nav.afventer")}</div>
            <div style={{color:C.txt,fontSize:20,fontWeight:900,fontVariantNumeric:"tabular-nums"}}>{afventer}</div>
            <div style={{color:C.txtM,fontSize:11}}>{t("nav.afventerTasks")}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.s1,flexShrink:0}}>
          <div>
            <div style={{color:C.txt,fontWeight:800,fontSize:18}}>{(()=>{const it=NAV_ITEMS.find(n=>n.id===view);return it?t(it.label):"";})()}</div>
            {/* Aktive afdelinger i header */}
            {(()=>{
              const aktiveAfd=alleAfdelinger.filter(af=>afdScope[af.id]?.aktiv);
              const harScope=aktiveAfd.length>0&&aktiveAfd.length<alleAfdelinger.length;
              return(
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:3}}>
                  {harScope?(
                    <>
                      <span style={{color:C.txtM,fontSize:11,fontWeight:500}}>{t("nav.viewing")}</span>
                      {aktiveAfd.map(af=>(
                        <span key={af.id} style={{background:C.accM,color:C.acc,fontSize:11,fontWeight:700,borderRadius:5,padding:"2px 8px",display:"inline-flex",alignItems:"center",gap:4,border:"1px solid "+C.acc+"44"}}>
                          {af.navn}
                        </span>
                      ))}
                      <span style={{color:C.txtM,fontSize:11,marginLeft:2}}>
                        · {scopedPatienter.length} {t("nav.patients")} · {scopedMed.length} {t("nav.employees")}
                      </span>
                    </>
                  ):(
                    <span style={{color:C.txtM,fontSize:11}}>
                      {t("nav.allDepartments")} · {alleAfdelinger.length} {t("nav.departments")} · {scopedPatienter.length} {t("nav.patients")} · {scopedMed.length} {t("nav.employees")}
                    </span>
                  )}
                </div>
              );
            })()}
            {isAdmin&&view!=="admin"&&<span style={{background:C.accM,color:C.acc,fontSize:10,borderRadius:4,padding:"2px 7px",fontWeight:700,marginLeft:6}}>ADMIN</span>}
            {isEjer&&<span style={{background:C.redM,color:C.red,fontSize:10,borderRadius:4,padding:"2px 7px",fontWeight:700,marginLeft:6}}>EJER</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <LanguageSwitcher/>
            {errors>0&&<Pill color={C.red} bg={C.redM}>{errors} regelfejl</Pill>}
            <Pill color={C.acc} bg={C.accM}>{patienter.reduce((a,p)=>a+p.opgaver.filter(o=>o.status==="planlagt").length,0)} planlagt</Pill>
            <button onClick={()=>setVisScope(true)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",
                borderRadius:7,border:"1.5px solid "+C.acc,background:C.accM,
                color:C.acc,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                transition:"background .12s"}}>
              <span style={{fontSize:11}}>⊞</span>
              {(()=>{const n=Object.values(afdScope).filter(v=>v.aktiv).length;return n===0||n===alleAfdelinger.length?"Vælg afdeling":n+" afd. valgt";})()}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <ErrorBoundary key={view}>
          {view==="dashboard"&&<ErrorBoundary><Dashboard patienter={scopedPatienter} medarbejdere={scopedMed} fejl={fejl} onLogout={()=>{
            // Ryd password fra memory + localStorage ved logout (belt-and-braces:
            // vi skriver ikke længere pm_pw, men sikrer mod gammel data og
            // in-memory-restancer).
            try{localStorage.removeItem("pm_pw");}catch(e){}
            setAuthData(d=>({...d,password:""}));
            setAuthStage("welcome");
          }} alleAfdelinger={alleAfdelinger} afdScope={afdScope}/></ErrorBoundary>}
          {view==="patienter"&&<ErrorBoundary><PatientKalenderView patienter={scopedPatienter} medarbejdere={scopedMed} setPatienter={setPatienter} forlob={forlob} showToast={showToast} onMarkerLøst={handleMarkerLøst} lokMeta={lokMeta} setAnmodninger={setAnmodninger} adminData={adminData} lokaler={lokaler}/></ErrorBoundary>}
          {view==="kalender"&&<ErrorBoundary><KalenderView patienter={scopedPatienter} medarbejdere={scopedMed} lokaler={lokaler}/></ErrorBoundary>}
          {view==="medarbejdere"&&<ErrorBoundary><MedarbejderView medarbejdere={scopedMed} setMedarbejdere={setMedarbejdere} patienter={scopedPatienter} setPatienter={setPatienter} anmodninger={anmodninger} setAnmodninger={setAnmodninger} isAdmin={isAdmin} certifikater={certifikater} showToast={showToast} adminData={adminData}/></ErrorBoundary>}
          {view==="lokaler"&&<ErrorBoundary><LokalerView patienter={patienter} lokTider={lokTider} setLokTider={setLokTider} lokMeta={lokMeta} setLokMeta={setLokMeta} lokaler={lokaler} saveLokaler={saveLokaler} adminData={adminData} udstyrsKat={udstyrsKat} saveUdstyrsKat={saveUdstyrsKat} udstyrsPakker={udstyrsPakker} saveUdstyrsPakker={saveUdstyrsPakker}/></ErrorBoundary>}
          {view==="forlob"&&<ErrorBoundary><ForlobView forlob={forlob} setForlob={setForlob} medarbejdere={scopedMed} setMedarbejdere={setMedarbejdere} indsatser={indsatser} setIndsatser={setIndsatser} certifikater={certifikater} setCertifikater={setCertifikater} lokaler={lokaler} setPatienter={setPatienter} adminData={adminData}/></ErrorBoundary>}
          {view==="planlog"&&<ErrorBoundary><PlanLogView patienter={scopedPatienter} planLog={planLog} medarbejdere={scopedMed} setPatienter={setPatienter} setMedarbejdere={setMedarbejdere} onPlan={handlePlan} running={running} progress={progress} planFraDato={planFraDato} setPlanFraDato={setPlanFraDato} afdScope={afdScope} alleAfdelinger={alleAfdelinger} toggleAktiv={toggleAktiv} toggleRes={toggleRes} lokaler={lokaler} certifikater={certifikater} planDebug={planDebug} config={config} setConfig={setConfig} setForlob={setForlob} forlob={forlob} lokTider={lokTider} setLokTider={setLokTider} lokMeta={lokMeta} setLokMeta={setLokMeta} saveLokaler={saveLokaler} setIndsatser={setIndsatser} indsatser={indsatser} adminData={adminData}/></ErrorBoundary>}
          {view==="admin"&&isAdmin&&<ErrorBoundary><AdminView adminData={adminData} setAdminData={setAdminData} authData={authData} anmodninger={anmodninger} setAnmodninger={setAnmodninger} medarbejdere={medarbejdere} setMedarbejdere={setMedarbejdere} rulNotif={rulNotif} setRulNotif={setRulNotif} patienter={patienter} setPatienter={setPatienter} aktivLog={aktivLog} setAktivLog={setAktivLog} gemLog={gemAktivLog} lokMeta={lokMeta} config={config} setConfig={setConfig} setForlob={setForlob} forlob={forlob} forlobMeta={forlobMeta} setForlobMeta={setForlobMeta} setLokTider={setLokTider} setLokMeta={setLokMeta} lokaler={lokaler} saveLokaler={saveLokaler} indsatser={indsatser} setIndsatser={setIndsatser} showToast={showToast}/></ErrorBoundary>}
          {view==="ejer"&&(authData.email===EJER_EMAIL||authData.rolle==="ejer")&&<ErrorBoundary><EjerView patienter={patienter} medarbejdere={medarbejdere} adminData={adminData} setAdminData={setAdminData} authData={authData} isUnlocked={isEjer} setEjerUnlocked={setEjerUnlocked} ejerKode={EJER_KODE} ejerKonto={ejerKonto} setEjerKonto={setEjerKonto} lokaler={lokaler} lokMeta={lokMeta} showToast={showToast} certifikater={certifikater} config={config}/></ErrorBoundary>}
          </ErrorBoundary>
        </div>
      </div>

      {visScope&&<ScopeModal alleAfdelinger={alleAfdelinger} afdScope={afdScope} toggleAktiv={toggleAktiv} toggleRes={toggleRes} onClose={()=>setVisScope(false)}/>}
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {visTester&&<PlanMedTester onClose={()=>setVisTester(false)}/>}

      {/* Inaktivitets-advarsel: vises 2 min før auto-logout.
          Enhver aktivitet (mus, tastatur, klik) nulstiller automatisk
          timeren og skjuler modalen. */}
      {visInaktivAdvarsel&&(
        <div onClick={nulstilInaktivitet}
          style={{position:"fixed",inset:0,background:"rgba(15,25,35,0.55)",backdropFilter:"blur(6px)",
            display:"flex",alignItems:"center",justifyContent:"center",zIndex:10000,padding:16}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:C.s1,border:`2px solid ${C.amb}`,borderRadius:14,padding:"28px 32px",
              maxWidth:440,width:"100%",boxShadow:"0 12px 48px rgba(0,0,0,0.25)"}}>
            <div style={{color:C.amb,fontWeight:800,fontSize:16,marginBottom:10}}>
              Du logges ud om 2 minutter
            </div>
            <div style={{color:C.txtD,fontSize:13,lineHeight:1.5,marginBottom:20}}>
              Du har været inaktiv længe. For din sikkerhed logges du automatisk
              ud om 2 minutter. Klik nedenfor for at forblive logget ind.
            </div>
            <button onClick={nulstilInaktivitet}
              style={{width:"100%",padding:"10px 0",background:C.acc,color:"#fff",border:"none",
                borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
              Jeg er her — forbliv logget ind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ── EKSPORT FUNKTIONER ──────────────────────────────────




