// Planlægger + ressource-analyse. Pure JS — ingen React-afhængigheder.
import { today, daysBetween } from "../utils/index.js";
import { DEFAULT_TITLER } from "../data/constants.js";

// ── Ressource-analyse (separat fra planlægning) ──
export function analyserRessourcer(patienter=[], config={}) {
  const {medarbejdere=[],lokTider={},lokaler:lokArr,titler:titlerCfg}=config;
  const lokaler=Array.isArray(lokArr)?lokArr:[];
  const toMin=(hm)=>{if(!hm)return 0;const[h,m]=(hm||"0:0").split(":").map(Number);return h*60+(m||0);};
  const titlerBase=Array.isArray(titlerCfg)&&titlerCfg.length>0?titlerCfg:DEFAULT_TITLER;
  // Bagudkompat: medregn også titler i brug på medarbejdere men udenfor adminData.titler
  const baseNavne=new Set(titlerBase.map(t=>t.navn));
  const ekstra=[...new Set(medarbejdere.map(m=>m?.titel).filter(t=>t&&!baseNavne.has(t)))];
  const TITLER=[...titlerBase.map(t=>t.navn),...ekstra];
  const normT=t=>t==="Laege"?"Læge":t==="Paedagog"?"Pædagog":t;
  const dage=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag"];

  // Medarbejder-analyse
  const medRes=TITLER.map(t=>{
    const meds=medarbejdere.filter(m=>m.titel===t);
    const kap=meds.reduce((a,m)=>{
      const d=Object.values(m.arbejdsdage||{}).filter(d=>d.aktiv);
      return a+d.reduce((s,d)=>s+toMin(d.slut||"16:00")-toMin(d.start||"08:30"),0);
    },0);
    let eft=0;
    patienter.forEach(p=>p.opgaver.forEach(o=>{
      if(o.status==="planlagt"&&o.låst) return;
      const mm=o.muligeMed||[];
      const match=mm.find(m=>TITLER.includes(normT(m)));
      if(match&&normT(match)===t) eft+=(o.minutter||60);
      else if(!match&&o.opgave?.includes(t)) eft+=(o.minutter||60);
    }));
    const ratio=Math.round(eft/(kap||1)*100)/100;
    return{titel:t,antal:meds.length,kapacitet:kap,efterspørgsel:eft,ratio,flaskehals:false};
  });
  const maxMedRatio=Math.max(...medRes.map(r=>r.ratio));
  medRes.forEach(r=>{if(r.ratio===maxMedRatio&&r.ratio>0)r.flaskehals=true;});

  // Lokale-analyse: gruppér varianter
  const alleLok=new Set();
  Object.values(lokTider).forEach(dl=>Object.keys(dl).forEach(l=>alleLok.add(l)));
  lokaler.forEach(l=>alleLok.add(l));
  const grp={};
  alleLok.forEach(l=>{const b=l.replace(/\s*\(\d+\)$/,"");if(!grp[b])grp[b]=[];grp[b].push(l);});

  const lokRes=Object.entries(grp).map(([basis,loks])=>{
    let basisMin=0;
    dage.forEach(dag=>{
      const lt=lokTider[dag]?.[basis];
      if(lt){const å=toMin(lt.å||"00:00"),l=toMin(lt.l||"00:00");if(l>å)basisMin+=l-å;}
    });
    const kap=basisMin*loks.length;
    let eft=0;
    patienter.forEach(p=>p.opgaver.forEach(o=>{
      if(o.status==="planlagt"&&o.låst) return;
      const baser=[...new Set((o.muligeLok||[]).map(l=>l.replace(/\s*\(\d+\)$/,"")))];
      if(baser.includes(basis)) eft+=(o.minutter||60)/(baser.length||1);
    }));
    const ratio=Math.round(eft/(kap||1)*100)/100;
    return{navn:basis,antal:loks.length,kapacitet:kap,efterspørgsel:eft,ratio,flaskehals:false};
  }).filter(r=>r.efterspørgsel>0).sort((a,b)=>b.ratio-a.ratio);
  const maxLokRatio=Math.max(...lokRes.map(r=>r.ratio),0);
  lokRes.forEach(r=>{if(r.ratio===maxLokRatio&&r.ratio>0)r.flaskehals=true;});

  const primær=maxLokRatio>maxMedRatio
    ?`${lokRes.find(r=>r.flaskehals)?.navn||"?"} (lokale, ratio: ${maxLokRatio})`
    :`${medRes.find(r=>r.flaskehals)?.titel||"?"} (medarbejder, ratio: ${maxMedRatio})`;

  let anbefaling=null;
  const flask=medRes.find(r=>r.flaskehals);
  if(flask&&flask.ratio>1.5) anbefaling=`Overvej at ansætte flere ${flask.titel.toLowerCase()}er — efterspørgslen er ${Math.round(flask.ratio*100-100)}% over kapaciteten`;
  const lokFlask=lokRes.find(r=>r.flaskehals);
  if(lokFlask&&lokFlask.ratio>1.5&&(!flask||lokFlask.ratio>flask.ratio)) anbefaling=`${lokFlask.navn} er overbelastet — overvej at tilføje flere eller udvide åbningstider`;

  return{medarbejdere:medRes,lokaler:lokRes,primærFlaskehals:primær,anbefaling};
}
export function runPlanner(patienter, config={}) {
  const {
    medarbejdere=[],
    lokTider={},
    pause=5,
    minGapDays=2,
    step=5,
    maxDage=90,
    planFraDato=null,
    // Indstillinger fra Planlæg indstillinger
    maxPatVisitsPerMedPerUge=10,
    maxPatVisitsStrenged="bloed",
    maxMedPerPatient=0,
    maxMedStrenged="bloed",
    prioritering="henvDato",
    deadlineMode="henvDato",
    indsatsDato="",
    tilladOverstigLåste=false,
    maxDageForlob=0,
    titler:titlerCfg=null,
    lokMeta={},
  } = config;
  // Hjælper: tjek om et lokale har alle krævede udstyr
  const lokHarUdstyr=(lokNavn,kraevet)=>{
    if(!Array.isArray(kraevet)||kraevet.length===0) return true;
    const har=Array.isArray(lokMeta?.[lokNavn]?.udstyr)?lokMeta[lokNavn].udstyr:[];
    return kraevet.every(u=>har.includes(u));
  };
  // Hjælper: tjek patient-specifikke spacing-regler.
  // - cooldownDage: minimum dage fra en planlagt opgave til næste opgave på samme patient
  // - patInvMinDage: minimum dage mellem to patInv:true-opgaver på samme patient
  // Reglen er symmetrisk: både eksisterende og ny opgaves værdi respekteres
  // (dvs. max(eksisterende, ny) gælder).
  const spacingOk = (opg, dato, patId) => {
    if(!patId) return true;
    const pat = klonPat.find(p => p.id === patId);
    if(!pat) return true;
    const andre = pat.opgaver.filter(o => o.id !== opg.id && o.status === "planlagt" && o.dato);
    for(const a of andre) {
      const diff = Math.abs(daysBetween(a.dato, dato));
      // cooldownDage: efter den eksisterende opgave er ny-dato for tæt på
      const cdExist = Number(a.cooldownDage)||0;
      if(cdExist > 0 && dato > a.dato && diff <= cdExist) return false;
      // cooldown på ny opgave: eksisterende opgave er senere end ny + inden for nyt cooldown
      const cdNy = Number(opg.cooldownDage)||0;
      if(cdNy > 0 && a.dato > dato && diff <= cdNy) return false;
      // patInvMinDage: gælder kun hvis BÅDE er patInv
      if(opg.patInv && a.patInv) {
        const minDist = Math.max(Number(opg.patInvMinDage)||0, Number(a.patInvMinDage)||0);
        if(minDist > 0 && diff < minDist) return false;
      }
    }
    return true;
  };
  const titlerBase=Array.isArray(titlerCfg)&&titlerCfg.length>0?titlerCfg:DEFAULT_TITLER;
  // Bagudkompat: udvid med titler der faktisk findes på medarbejdere — så gamle
  // patienter/opgaver med custom-titler bevarer kapacitet og kandidat-matching.
  const titlerNavneSet=new Set(titlerBase.map(t=>t.navn));
  const ekstraTitler=[...new Set(medarbejdere.map(m=>m?.titel).filter(t=>t&&!titlerNavneSet.has(t)))]
    .map(navn=>({id:navn,navn,farve:"#0050b3",defaultTimerPerUge:23,defaultKrPrTime:0}));
  const titlerListe=ekstraTitler.length===0?titlerBase:[...titlerBase,...ekstraTitler];

  // Klon dybt så vi ikke muterer originaler
  const klonPat = structuredClone(patienter);
  let planned=0, failed=0;
  const planLog=[];
  const startDato = planFraDato || today();

  // Hjælpefunktioner
  const getDag2 = (dato) => {
    const d = new Date(dato+"T12:00:00");
    return ["Søndag","Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag"][d.getDay()];
  };
  const addDays2 = (dato,n) => { const d=new Date(dato+"T12:00:00"); d.setDate(d.getDate()+n); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; };
  const toMin2 = (hm) => { if(!hm)return 0; const[h,m]=(hm||"0:0").split(":").map(Number); return h*60+(m||0); };
  const fromMin2 = (min) => { const h=Math.floor(min/60),m=min%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; };
  // Vurdér om en dag overhovedet kan bruges til planlægning:
  // skip kun hvis ALLE lokaler er lukket OG ingen medarbejder arbejder den dag.
  // (Weekender er ikke længere automatisk udelukket — de styres af lokTider og arbejdsdage.)
  const dagBrugbar = (dato) => {
    const dag = getDag2(dato);
    const harMed = medarbejdere.some(m=>m?.arbejdsdage?.[dag]?.aktiv);
    const harLok = Object.values(lokTider?.[dag]||{}).some(t=>{
      if(!t) return false;
      const å=toMin2(t.å||t.åben||"00:00"), l=toMin2(t.l||t.lukket||"00:00");
      return l > å;
    });
    return harMed || harLok;
  };

  // Booking-register: hvad er booket pr. dag pr. medarbejder/lokale
  const medBooket = {};  // {medNavn: {dato: [{start,slut}]}}
  const lokBooket = {};  // {lokNavn: {dato: [{start,slut}]}}

  // Initialiser fra allerede planlagte opgaver
  klonPat.forEach(p => p.opgaver.forEach(o => {
    if(o.status==="planlagt" && o.dato && o.startKl && o.slutKl) {
      if(o.medarbejder) {
        if(!medBooket[o.medarbejder]) medBooket[o.medarbejder]={};
        if(!medBooket[o.medarbejder][o.dato]) medBooket[o.medarbejder][o.dato]=[];
        medBooket[o.medarbejder][o.dato].push({start:toMin2(o.startKl),slut:toMin2(o.slutKl)});
      }
      if(o.lokale) {
        if(!lokBooket[o.lokale]) lokBooket[o.lokale]={};
        if(!lokBooket[o.lokale][o.dato]) lokBooket[o.lokale][o.dato]=[];
        lokBooket[o.lokale][o.dato].push({start:toMin2(o.startKl),slut:toMin2(o.slutKl)});
      }
    }
  }));

  const harOverlap = (bookings, startMin, slutMin) =>
    (bookings||[]).some(b => startMin < b.slut && slutMin > b.start);

  // ── Tracking: besøg per medarbejder per uge (ISO-uge) ──
  const medVisitsPerUge = {}; // {medNavn: {ugeNr: antal}}
  const getUgeNr = (dato) => {
    const d=new Date(dato+"T12:00:00");
    d.setDate(d.getDate()+3-(d.getDay()+6)%7);
    const uge1=new Date(d.getFullYear(),0,4);
    return Math.round(((d-uge1)/86400000-3+(uge1.getDay()+6)%7)/7)+1;
  };
  const getUgeKey = (dato) => { const d=new Date(dato+"T00:00:00"); return d.getFullYear()+"-W"+String(getUgeNr(dato)).padStart(2,"0"); };

  // ── Tracking: antal forskellige medarbejdere per patient ──
  const patMedSet = {}; // {patId: Set<medNavn>}

  // Initialiser tracking fra allerede planlagte opgaver
  klonPat.forEach(p => {
    patMedSet[p.id] = new Set();
    p.opgaver.forEach(o => {
      if(o.status==="planlagt" && o.dato && o.medarbejder) {
        // Besøg per uge (kun patientopgaver tæller)
        if(o.patInv) {
          const uk=getUgeKey(o.dato);
          if(!medVisitsPerUge[o.medarbejder]) medVisitsPerUge[o.medarbejder]={};
          medVisitsPerUge[o.medarbejder][uk]=(medVisitsPerUge[o.medarbejder][uk]||0)+1;
        }
        patMedSet[p.id].add(o.medarbejder);
      }
    });
  });

  // ── Hjælper: tjek kapacitetsregler for en medarbejder på en dato ──
  // Returnerer: "ok" | "bloed" (advarsel men tilladt) | "blokeret" (hård afvisning)
  const kanBookes = (medNavn, dato, patId, erPatInv) => {
    let resultat = "ok";
    // Max patientbesøg per medarbejder per uge
    if(erPatInv && maxPatVisitsPerMedPerUge>0) {
      const uk=getUgeKey(dato);
      const cur=(medVisitsPerUge[medNavn]||{})[uk]||0;
      if(cur>=maxPatVisitsPerMedPerUge) {
        if(maxPatVisitsStrenged==="haard") return "blokeret";
        resultat = "bloed"; // Blød: tillad men nedprioriter
      }
    }
    // Max antal forskellige medarbejdere per patient
    if(maxMedPerPatient>0 && patId) {
      const sæt=patMedSet[patId]||new Set();
      if(!sæt.has(medNavn) && sæt.size>=maxMedPerPatient) {
        if(maxMedStrenged==="haard") return "blokeret";
        resultat = "bloed"; // Blød: tillad men nedprioriter
      }
    }
    return resultat;
  };

  // ── Hjælper: registrer en booking i tracking ──
  const registrerBooking = (medNavn, dato, patId, erPatInv) => {
    if(erPatInv) {
      const uk=getUgeKey(dato);
      if(!medVisitsPerUge[medNavn]) medVisitsPerUge[medNavn]={};
      medVisitsPerUge[medNavn][uk]=(medVisitsPerUge[medNavn][uk]||0)+1;
    }
    if(patId) {
      if(!patMedSet[patId]) patMedSet[patId]=new Set();
      patMedSet[patId].add(medNavn);
    }
  };

  // ── Hjælper: afregistrer en booking (reverse af registrerBooking) ──
  const afregistrerBooking = (medNavn, dato, patId, erPatInv) => {
    if(erPatInv && medNavn) {
      const uk=getUgeKey(dato);
      if(medVisitsPerUge[medNavn]&&medVisitsPerUge[medNavn][uk]>0)
        medVisitsPerUge[medNavn][uk]--;
    }
  };

  // ── Hjælper: fjern en booking fra alle registre, returnér saved-objekt ──
  const fjernBooking = (opg, patId) => {
    if(opg.status!=="planlagt"||!opg.dato) return null;
    const startMin=toMin2(opg.startKl);
    const slutMin=toMin2(opg.slutKl)+pause;
    if(opg.medarbejder && medBooket[opg.medarbejder]?.[opg.dato])
      medBooket[opg.medarbejder][opg.dato]=medBooket[opg.medarbejder][opg.dato].filter(b=>!(b.start===startMin&&b.slut===slutMin));
    if(opg.lokale && lokBooket[opg.lokale]?.[opg.dato])
      lokBooket[opg.lokale][opg.dato]=lokBooket[opg.lokale][opg.dato].filter(b=>!(b.start===startMin&&b.slut===slutMin));
    afregistrerBooking(opg.medarbejder, opg.dato, patId, opg.patInv);
    const saved={dato:opg.dato,startKl:opg.startKl,slutKl:opg.slutKl,medarbejder:opg.medarbejder,lokale:opg.lokale,status:opg.status};
    opg.status="afventer"; opg.dato=null; opg.startKl=null; opg.slutKl=null; opg.medarbejder=null; opg.lokale=null;
    return saved;
  };

  // ── Hjælper: gendanner en fjernet booking fra saved-objekt ──
  const genindførBooking = (opg, saved, patId) => {
    if(!saved) return;
    opg.status=saved.status; opg.dato=saved.dato; opg.startKl=saved.startKl; opg.slutKl=saved.slutKl;
    opg.medarbejder=saved.medarbejder; opg.lokale=saved.lokale;
    const startMin=toMin2(saved.startKl), slutMin=toMin2(saved.slutKl)+pause;
    if(saved.medarbejder){
      if(!medBooket[saved.medarbejder]) medBooket[saved.medarbejder]={};
      if(!medBooket[saved.medarbejder][saved.dato]) medBooket[saved.medarbejder][saved.dato]=[];
      medBooket[saved.medarbejder][saved.dato].push({start:startMin,slut:slutMin});
    }
    if(saved.lokale){
      if(!lokBooket[saved.lokale]) lokBooket[saved.lokale]={};
      if(!lokBooket[saved.lokale][saved.dato]) lokBooket[saved.lokale][saved.dato]=[];
      lokBooket[saved.lokale][saved.dato].push({start:startMin,slut:slutMin});
    }
    registrerBooking(saved.medarbejder, saved.dato, patId, opg.patInv);
  };

  // ── Hjælper: beregn deadline for patient (per-patient eller global) ──
  const beregnDeadline = (pat) => {
    const effMaxDage = pat.maxDageForlob || maxDageForlob;
    if(effMaxDage<=0) return null;
    const base = deadlineMode==="indsatsDato" && indsatsDato ? indsatsDato : (pat.henvDato||startDato);
    return addDays2(base, effMaxDage);
  };

  const findLedigTid = (medNavn, lokNavn, dato, varMin) => {
    const dag = getDag2(dato);
    if(!dagBrugbar(dato)) return null;

    // Tjek medarbejder arbejder denne dag
    const med = medarbejdere.find(m=>m.navn===medNavn);
    if(!med) return null;
    const dagInfo = med.arbejdsdage?.[dag];
    if(!dagInfo || !dagInfo.aktiv) return null;
    const medStart = toMin2(dagInfo?.start||"08:00");
    const medSlut  = toMin2(dagInfo?.slut||"16:00");

    // Tjek lokale åbent denne dag
    let lokStart=medStart, lokSlut=medSlut;
    if(lokNavn) {
      // Hvis et specifikt lokale kræves, men ingen åbningstid findes for dagen,
      // betragtes lokalet som lukket (ikke "ingen begrænsning").
      const lt = lokTider[dag]?.[lokNavn];
      if(!lt) return null;
      const ls=toMin2(lt.å||lt.åben||"08:00"), le=toMin2(lt.l||lt.lukket||"16:00");
      if(ls===0&&le===0) return null; // Lukket
      lokStart=Math.max(medStart,ls);
      lokSlut=Math.min(medSlut,le);
    }
    if(lokSlut-lokStart < varMin) return null;

    // Find første ledige slot
    const medDagBooket = medBooket[medNavn]?.[dato]||[];
    const lokDagBooket = lokBooket[lokNavn]?.[dato]||[];

    for(let t=lokStart; t+varMin<=lokSlut; t+=step) {
      const slutT = t+varMin;
      if(!harOverlap(medDagBooket,t,slutT) && !harOverlap(lokDagBooket,t,slutT)) {
        return {start:t, slut:slutT};
      }
    }
    return null;
  };

  // ══════════════════════════════════════════════════════════════
  // FLASKEHALSANALYSE — find den knappe ressource
  // ══════════════════════════════════════════════════════════════
  const TITLER_ANALYSE = titlerListe.map(t=>t.navn);
  const normTitel = t=>t==="Laege"?"Læge":t==="Paedagog"?"Pædagog":t;

  // 1. Beregn kapacitet per titel: antal medarbejdere × timer/uge × søgehorisont
  const kapPerTitel = {};
  const medPerTitel = {};
  TITLER_ANALYSE.forEach(t=>{
    const meds = medarbejdere.filter(m=>m.titel===t);
    medPerTitel[t] = meds.length;
    // Gennemsnitlig tilgængelig tid per uge per medarbejder
    const timerPerUge = meds.reduce((a,m)=>{
      const dage = Object.values(m.arbejdsdage||{}).filter(d=>d.aktiv);
      const minPerUge = dage.reduce((s,d)=>s+toMin2(d.slut||"16:00")-toMin2(d.start||"08:30"),0);
      return a + minPerUge;
    },0);
    kapPerTitel[t] = timerPerUge; // min/uge samlet for alle med denne titel
  });

  // 2. Beregn efterspørgsel per titel: sum af minutter for alle ventende opgaver
  const efterspørgselPerTitel = {};
  TITLER_ANALYSE.forEach(t=>{ efterspørgselPerTitel[t]=0; });
  klonPat.forEach(p=>p.opgaver.forEach(o=>{
    if(o.status==="planlagt"||o.låst) return;
    // Bestem hvilken titel opgaven kræver
    const mm = o.muligeMed||[];
    const titelMatch = mm.find(m=>TITLER_ANALYSE.includes(normTitel(m)));
    if(titelMatch) {
      const t = normTitel(titelMatch);
      efterspørgselPerTitel[t] = (efterspørgselPerTitel[t]||0) + (o.minutter||60);
    } else {
      // Prøv at udlede fra opgavenavn
      const found = TITLER_ANALYSE.find(t=>o.opgave?.includes(t));
      if(found) efterspørgselPerTitel[found] = (efterspørgselPerTitel[found]||0) + (o.minutter||60);
    }
  }));

  // 3. Beregn belastningsratio per titel (højere = mere presset)
  const belastning = {};
  let flaskehals = null;
  let maxRatio = 0;
  TITLER_ANALYSE.forEach(t=>{
    const kap = kapPerTitel[t]||1;
    const eft = efterspørgselPerTitel[t]||0;
    const ratio = eft/kap;
    belastning[t] = {kapacitet:kap, efterspørgsel:eft, ratio:Math.round(ratio*100)/100, medarbejdere:medPerTitel[t]};
    if(ratio>maxRatio) { maxRatio=ratio; flaskehals=t; }
  });

  // 4. Lokale-kapacitet: gruppér varianter ("Kontor", "Kontor (2)" osv.) under basisnavn
  const dagNavne2=["Mandag","Tirsdag","Onsdag","Torsdag","Fredag"];
  const alleLokNavneAnalyse = new Set();
  Object.values(lokTider).forEach(dagLok=>Object.keys(dagLok).forEach(l=>alleLokNavneAnalyse.add(l)));
  if(config.lokaler) config.lokaler.forEach(l=>alleLokNavneAnalyse.add(l));
  // Gruppér lokaler efter basisnavn
  const lokGrupper = {}; // {basisnavn: [lokale1, lokale2, ...]}
  alleLokNavneAnalyse.forEach(lok=>{
    const basis = lok.replace(/\s*\(\d+\)$/,""); // "Kontor (2)" → "Kontor"
    if(!lokGrupper[basis]) lokGrupper[basis]=[];
    lokGrupper[basis].push(lok);
  });
  const lokKap = {};
  Object.entries(lokGrupper).forEach(([basis,loks])=>{
    // Beregn kapacitet for basisnavnet og gang med antal i gruppen
    let basisMinPerUge=0;
    dagNavne2.forEach(dag=>{
      const lt=lokTider[dag]?.[basis];
      if(lt) {
        const å=toMin2(lt.å||lt.åben||"00:00"), l=toMin2(lt.l||lt.lukket||"00:00");
        if(l>å) basisMinPerUge+=l-å;
      }
      });
    // Kapacitet = basisnavnets tid × antal lokaler i gruppen
    const minPerUge = basisMinPerUge * loks.length;
    lokKap[basis]=minPerUge;
  });

  // 5. Lokale-efterspørgsel: per basisnavn
  const lokEfterspørgsel = {};
  Object.keys(lokGrupper).forEach(b=>{lokEfterspørgsel[b]=0;});
  klonPat.forEach(p=>p.opgaver.forEach(o=>{
    if(o.status==="planlagt"||o.låst) return;
    // Gruppér muligeLok under basisnavne
    const baser = [...new Set((o.muligeLok||[]).map(l=>l.replace(/\s*\(\d+\)$/,"")))];
    baser.forEach(basis=>{
      const andel=(o.minutter||60)/(baser.length||1);
      lokEfterspørgsel[basis]=(lokEfterspørgsel[basis]||0)+andel;
    });
  }));

  // 6. Find lokale-flaskehals (per basisnavn-gruppe)
  const lokBelastning = {};
  let lokFlaskehals = null;
  let lokMaxRatio = 0;
  Object.keys(lokGrupper).forEach(basis=>{
    const kap=lokKap[basis]||1;
    const eft=lokEfterspørgsel[basis]||0;
    const ratio=eft/kap;
    const antalLok=lokGrupper[basis].length;
    lokBelastning[basis]={kapacitet:kap,efterspørgsel:eft,ratio:Math.round(ratio*100)/100,antal:antalLok};
    if(ratio>lokMaxRatio){lokMaxRatio=ratio;lokFlaskehals=basis;}
  });

  // 7. Log flaskehalsanalyse
  planLog.push({type:"info",msg:`── RESSOURCE-ANALYSE: MEDARBEJDERE ──`});
  TITLER_ANALYSE.forEach(t=>{
    const b=belastning[t];
    const bar = t===flaskehals?" *** FLASKEHALS ***":"";
    planLog.push({type:t===flaskehals?"warn":"info",
      msg:`${t}: ${b.medarbejdere} medarb., ${Math.round(b.kapacitet/60)}t/uge kap., ${Math.round(b.efterspørgsel/60)}t eftersp. (ratio: ${b.ratio})${bar}`});
  });
  planLog.push({type:"info",msg:`── RESSOURCE-ANALYSE: LOKALER ──`});
  Object.keys(lokGrupper).sort((a,b)=>(lokBelastning[b]?.ratio||0)-(lokBelastning[a]?.ratio||0)).forEach(basis=>{
    const lb=lokBelastning[basis];
    if(!lb||lb.efterspørgsel===0) return;
    const bar=basis===lokFlaskehals?" *** FLASKEHALS ***":"";
    planLog.push({type:basis===lokFlaskehals?"warn":"info",
      msg:`${basis} (${lb.antal} stk): ${Math.round(lb.kapacitet/60)}t/uge kap., ${Math.round(lb.efterspørgsel/60)}t eftersp. (ratio: ${lb.ratio})${bar}`});
  });

  // Samlet flaskehals: den mest pressede ressource (medarbejder eller lokale)
  const samletFlaskehals = lokMaxRatio>maxRatio ? `Lokale: ${lokFlaskehals}` : `Titel: ${flaskehals}`;
  planLog.push({type:"warn",msg:`── Primær flaskehals: ${samletFlaskehals} ──`});

  // ── Prioritetsscore: lavere = planlægges først ──
  // Kombinerer haste-flag, deadline-urgency, flaskehals-relevans og henvisningsdato
  const beregnPrioritet = (pat) => {
    let score = 0;
    // 1. Haste-flag (dominerer)
    if(prioritering==="haste" && pat.haste) score -= 10000;
    // 2. Deadline-urgency: resterende minutter / hverdage til deadline
    const effMaxDage = pat.maxDageForlob || maxDageForlob;
    if(effMaxDage > 0) {
      const base = deadlineMode==="indsatsDato" && indsatsDato ? indsatsDato : (pat.henvDato||startDato);
      const deadlineStr = addDays2(base, effMaxDage);
      let daysLeft = 0;
      let d = startDato;
      while(d <= deadlineStr && daysLeft < 200) { if(dagBrugbar(d)) daysLeft++; d = addDays2(d,1); }
      const remainingMin = pat.opgaver.filter(o=>o.status!=="planlagt"&&!o.låst).reduce((s,o)=>s+(o.minutter||60),0);
      score -= (remainingMin / Math.max(daysLeft,1)) * 10;
    }
    // 3. Flaskehals-opgaver
    if(flaskehals) {
      score -= pat.opgaver.filter(o=>o.status!=="planlagt"&&!o.låst&&o.opgave?.includes(flaskehals)).length * 50;
    }
    // 4. Henvisningsdato (tiebreaker — tidligere = lavere score)
    if(pat.henvDato) score += Math.round((new Date(pat.henvDato)-new Date(startDato))/86400000);
    return score;
  };

  // Sorter patienter: laveste prioritetsscore først (mest kritisk)
  const sorterede = [...klonPat].sort((a,b)=>beregnPrioritet(a)-beregnPrioritet(b));

  // ── Hjælper: byg kandidatliste for en opgave ──
  const bygKandidater = (opg) => {
    const muligeMed = opg.muligeMed||[];
    const dynNavne = titlerListe.map(t=>t.navn);
    const TITLER = [...dynNavne,"Laege","Paedagog"];
    const harTitelRef = muligeMed.some(mm=>TITLER.includes(mm));
    let effKandidater;
    if(muligeMed.length===0) {
      effKandidater = medarbejdere.map(m=>m.navn);
    } else if(harTitelRef) {
      const normT=t=>t==="Laege"?"Læge":t==="Paedagog"?"Pædagog":t;
      effKandidater = medarbejdere.filter(m=>muligeMed.map(normT).includes(m.titel)).map(m=>m.navn);
    } else {
      effKandidater = muligeMed.filter(navn=>medarbejdere.some(m=>m.navn===navn));
      if(effKandidater.length===0) {
        effKandidater = medarbejdere.filter(m=>muligeMed.some(mm=>m.titel===mm)).map(m=>m.navn);
      }
    }
    const harKompetence = navn=>{
      const m = medarbejdere.find(mm=>mm.navn===navn);
      if(!m) return false;
      const komp = m.kompetencer||[];
      if(komp.length===0) return true;
      if(komp.includes(opg.opgave)) return true;
      return komp.some(k=>
        opg.opgave.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(opg.opgave.toLowerCase())
      );
    };
    // Hvis mindst én kandidat har registrerede kompetencer, så filtrér strikt
    // efter kompetencen — også hvis ingen i listen matcher (giver tom liste).
    // Falder kun tilbage til ufiltreret hvis INGEN kandidater har kompetencer
    // overhovedet (legacy-data uden kompetence-opsætning).
    const nogenHarKompetencer = effKandidater.some(navn=>{
      const m=medarbejdere.find(mm=>mm.navn===navn);
      return m && (m.kompetencer||[]).length>0;
    });
    if(nogenHarKompetencer) effKandidater = effKandidater.filter(harKompetence);
    return effKandidater;
  };

  // ── Hjælper: ekspandér lokalenavn til alle varianter ──
  // "Kontor" → ["Kontor", "Kontor (2)", "Kontor (3)", ...] osv.
  // Bygger fra BÅDE lokTider OG config.lokaler (saveLokaler-listen)
  const alleLokNavne = new Set();
  Object.values(lokTider).forEach(dagLok=>Object.keys(dagLok).forEach(l=>alleLokNavne.add(l)));
  // Tilføj lokaler fra lokaler-listen (som måske ikke har tider endnu)
  if(config.lokaler) config.lokaler.forEach(l=>alleLokNavne.add(l));

  // Sikr at varianter arver åbningstider fra basisnavnet
  alleLokNavne.forEach(lok=>{
    const basis = lok.replace(/\s*\(\d+\)$/,"");
    if(basis!==lok) {
      // Kopiér tider fra basis hvis varianten ikke har egne
      Object.keys(lokTider).forEach(dag=>{
        if(lokTider[dag][basis] && !lokTider[dag][lok]) {
          lokTider[dag][lok] = {...lokTider[dag][basis]};
        }
      });
    }
  });

  const ekspanderLokaler = (lokListe) => {
    const resultat = [];
    (lokListe||[]).forEach(lok=>{
      resultat.push(lok);
      alleLokNavne.forEach(l=>{
        if(l!==lok && l.startsWith(lok+" (")) resultat.push(l);
      });
    });
    return resultat.length>0 ? resultat : lokListe;
  };

  // Log antal tilgængelige lokaler per basisnavn
  const _lokGrpLog = {};
  alleLokNavne.forEach(l=>{const b=l.replace(/\s*\(\d+\)$/,"");_lokGrpLog[b]=(_lokGrpLog[b]||0)+1;});
  planLog.push({type:"info",msg:`── LOKALER TILGÆNGELIGE: ${alleLokNavne.size} total (${Object.entries(_lokGrpLog).map(([k,v])=>`${k}:${v}`).join(", ")}) ──`});

  // ── Hjælper: book en enkelt opgave med tidligste start-minut ──
  const bookOpgave = (opg, effKandidater, tidligstDato, tidligstMin=0, patId=null, deadline=null) => {
    const varMin = (opg.minutter||60) + pause;
    // Filtrér lokaler så kun dem med krævet udstyr kan vælges (samme regel som bookGruppe).
    // Skelnen mellem "ingen constraint" (raw tom) og "alle rum filtreret bort" (raw ikke-tom
    // men filtret resultat tomt) — i sidstnævnte tilfælde må opgaven fejle.
    const muligeLokRaw = ekspanderLokaler(opg.muligeLok||[]);
    const muligeLok = muligeLokRaw.filter(l=>lokHarUdstyr(l,opg.udstyr));
    if(muligeLokRaw.length>0 && muligeLok.length===0) return false;
    const opgSenest = opg.senest ? toMin2(opg.senest) : 0;
    const kendteSæt = patId && patMedSet[patId] ? patMedSet[patId] : new Set();
    for(let di=0; di<maxDage; di++) {
      const dato = addDays2(tidligstDato,di);
      if(!dagBrugbar(dato)) continue;
      if(deadline && dato>deadline) return false;
      // Respektér cooldownDage og patInvMinDage ift. allerede planlagte opgaver på patienten
      if(!spacingOk(opg, dato, patId)) continue;

      // tidligstMin gælder kun for tidligstDato; andre dage starter fra opgavens tidligst
      const dagMin = dato===tidligstDato ? tidligstMin : (opg.tidligst ? toMin2(opg.tidligst) : 0);

      const scored = effKandidater.map(navn=>{
        const status=kanBookes(navn,dato,patId,opg.patInv);
        const kendte=kendteSæt.has(navn)?0:1;
        const prio=status==="blokeret"?2:status==="bloed"?1:0;
        // Load-balancing: foretræk mindst-belastede medarbejder denne uge
        const uk=getUgeKey(dato);
        const ugeBelastning=(medVisitsPerUge[navn]||{})[uk]||0;
        // Dagbelastning: antal bookinger denne dag
        const dagBelastning=(medBooket[navn]?.[dato]||[]).length;
        // Score: status > kendte > ugeBelastning > dagBelastning
        return{navn,status,score:prio*1000+kendte*100+ugeBelastning*10+dagBelastning};
      }).filter(s=>s.status!=="blokeret").sort((a,b)=>a.score-b.score);

      for(const {navn:medNavn} of scored) {
        // Sortér lokaler efter mindst-belastede denne dag
        const sortLok = (muligeLok.length>0?[...muligeLok]:[""])
          .sort((a,b)=>((lokBooket[a]?.[dato]||[]).length)-((lokBooket[b]?.[dato]||[]).length));
        for(const lokNavn of sortLok) {
          const slot = findLedigTidEfter(medNavn, lokNavn||null, dato, varMin, dagMin, opgSenest);
          if(slot) {
            opg.status="planlagt";
            opg.dato=dato;
            opg.startKl=fromMin2(slot.start);
            opg.slutKl=fromMin2(slot.slut-pause);
            opg.medarbejder=medNavn;
            opg.lokale=lokNavn||null;
            if(!medBooket[medNavn]) medBooket[medNavn]={};
            if(!medBooket[medNavn][dato]) medBooket[medNavn][dato]=[];
            medBooket[medNavn][dato].push({start:slot.start,slut:slot.slut});
            if(lokNavn) {
              if(!lokBooket[lokNavn]) lokBooket[lokNavn]={};
              if(!lokBooket[lokNavn][dato]) lokBooket[lokNavn][dato]=[];
              lokBooket[lokNavn][dato].push({start:slot.start,slut:slot.slut});
            }
            registrerBooking(medNavn, dato, patId, opg.patInv);
            return true;
          }
        }
      }
    }
    return false;
  };

  // ── Hjælper: find ledig tid med tidligstMin-offset og senest-grænse ──
  const findLedigTidEfter = (medNavn, lokNavn, dato, varMin, tidligstMin=0, senestMin=0) => {
    const dag = getDag2(dato);
    if(!dagBrugbar(dato)) return null;
    const med = medarbejdere.find(m=>m.navn===medNavn);
    if(!med) return null;
    const dagInfo = med.arbejdsdage?.[dag];
    if(!dagInfo || !dagInfo.aktiv) return null;
    const medStart = toMin2(dagInfo?.start||"08:00");
    const medSlut  = toMin2(dagInfo?.slut||"16:00");
    let lokStart=medStart, lokSlut=medSlut;
    if(lokNavn) {
      // Krævet lokale uden åbningstid for dagen = lukket
      const lt = lokTider[dag]?.[lokNavn];
      if(!lt) return null;
      const ls=toMin2(lt.å||lt.åben||"08:00"), le=toMin2(lt.l||lt.lukket||"16:00");
      if(ls===0&&le===0) return null;
      lokStart=Math.max(medStart,ls);
      lokSlut=Math.min(medSlut,le);
    }
    // Respektér opgavens senest-grænse
    if(senestMin>0) lokSlut=Math.min(lokSlut,senestMin);
    if(lokSlut-lokStart < varMin) return null;
    const searchStart = Math.max(lokStart, tidligstMin);
    if(searchStart+varMin>lokSlut) return null;
    const medDagBooket = medBooket[medNavn]?.[dato]||[];
    const lokDagBooket = lokBooket[lokNavn]?.[dato]||[];
    for(let t=searchStart; t+varMin<=lokSlut; t+=step) {
      const slutT = t+varMin;
      if(!harOverlap(medDagBooket,t,slutT) && !harOverlap(lokDagBooket,t,slutT)) {
        return {start:t, slut:slutT};
      }
    }
    return null;
  };

  // ── Hjælper: book underopgaver (gruppe) med SAMME medarbejder back-to-back ──
  const bookGruppe = (opgaver, kandidater, tidligstDato, tidligstMin=0, patId=null, deadline=null) => {
    // Sortér kandidater: foretræk kendte medarbejdere
    const kendteSæt = patId && patMedSet[patId] ? patMedSet[patId] : new Set();
    const sortKand = [...kandidater].sort((a,b)=>{
      const aKendt=kendteSæt.has(a)?0:1, bKendt=kendteSæt.has(b)?0:1;
      return aKendt-bKendt;
    });
    for(let di=0; di<maxDage; di++) {
      const dato = addDays2(tidligstDato,di);
      if(!dagBrugbar(dato)) continue;
      if(deadline && dato>deadline) return false;
      // Respektér cooldownDage og patInvMinDage for hver opgave i gruppen
      // (gruppen bookes på samme dag, så check hver opgave mod allerede planlagte)
      if(!opgaver.every(o=>spacingOk(o, dato, patId))) continue;
      const startMin = dato===tidligstDato?tidligstMin:0;

      for(const medNavn of sortKand) {
        // Tjek kapacitetsregler for denne medarbejder
        const harPatInv = opgaver.some(o=>o.patInv);
        if(!kanBookes(medNavn, dato, patId, harPatInv)) continue;

        let curMin = startMin;
        let slots = [];
        let ok = true;

        for(const opg of opgaver) {
          const varMin = (opg.minutter||60) + pause;
          const muligeLokRaw = opg.muligeLok||[];
          // Filtrér lokaler så kun dem med krævet udstyr kan vælges
          const muligeLok = muligeLokRaw.filter(l=>lokHarUdstyr(l,opg.udstyr));
          let fundet = false;
          for(const lokNavn of (muligeLok.length>0?muligeLok:(muligeLokRaw.length===0?[""]:[]))) {
            const slot = findLedigTidEfter(medNavn, lokNavn||null, dato, varMin, curMin);
            if(slot) {
              slots.push({opg, lokNavn:lokNavn||null, slot});
              curMin = slot.slut;
              fundet = true;
              break;
            }
          }
          if(!fundet) { ok=false; break; }
        }

        if(ok && slots.length===opgaver.length) {
          for(const {opg, lokNavn, slot} of slots) {
            opg.status="planlagt";
            opg.dato=dato;
            opg.startKl=fromMin2(slot.start);
            opg.slutKl=fromMin2(slot.slut-pause);
            opg.medarbejder=medNavn;
            opg.lokale=lokNavn;
            if(!medBooket[medNavn]) medBooket[medNavn]={};
            if(!medBooket[medNavn][dato]) medBooket[medNavn][dato]=[];
            medBooket[medNavn][dato].push({start:slot.start,slut:slot.slut});
            if(lokNavn) {
              if(!lokBooket[lokNavn]) lokBooket[lokNavn]={};
              if(!lokBooket[lokNavn][dato]) lokBooket[lokNavn][dato]=[];
              lokBooket[lokNavn][dato].push({start:slot.start,slut:slot.slut});
            }
            registrerBooking(medNavn, dato, patId, opg.patInv);
          }
          return true;
        }
      }
    }
    return false;
  };

  // ══════════════════════════════════════════════════════════════
  // FASE 1: GRÅDIG PLANLÆGNING MED TRACKING
  // ══════════════════════════════════════════════════════════════
  const bookingEjere = [];   // [{patId, patPrioritet, opg, medNavn, lokNavn, dato}]
  const fejledePatienter = []; // [{pat, ventende}] — til fase 2
  const patPrioritetMap = {};
  sorterede.forEach(p=>{ patPrioritetMap[p.id]=beregnPrioritet(p); });

  // Hjælper: planlæg en patients ventende opgaver sekventielt
  const planlaegPatient = (pat, ventende, deadline, trackEjere=true) => {
    const planlagteIds = new Set(pat.opgaver.filter(o=>o.status==="planlagt").map(o=>o.id));
    const gruppeMed = {};
    let tidligstDato = [startDato, pat.henvDato||startDato].reduce((a,b)=>a>b?a:b);
    let tidligstMin = 0;
    let sidstePatBesøgDato = null;
    let ok_count = 0;

    for(const opg of ventende) {
      if(planlagteIds.has(opg.id)) continue;
      let kandidater = bygKandidater(opg);
      if(opg.indsatsGruppe && gruppeMed[opg.indsatsGruppe]) {
        const låstMed = gruppeMed[opg.indsatsGruppe];
        kandidater = [låstMed, ...kandidater.filter(k=>k!==låstMed)];
      }
      let effTidligstDato = tidligstDato;
      let effTidligstMinVal = tidligstMin;
      if(opg.patInv && sidstePatBesøgDato && minGapDays>0) {
        const gapDato = addDays2(sidstePatBesøgDato, minGapDays);
        if(gapDato > effTidligstDato) { effTidligstDato = gapDato; effTidligstMinVal = 0; }
      }
      const opgTidligst = opg.tidligst ? toMin2(opg.tidligst) : 0;
      const effTidligstMin = Math.max(effTidligstMinVal, opgTidligst);

      const ok = bookOpgave(opg, kandidater, effTidligstDato, effTidligstMin, pat.id, deadline);
      if(ok) {
        ok_count++;
        planlagteIds.add(opg.id);
        if(opg.indsatsGruppe && !gruppeMed[opg.indsatsGruppe]) gruppeMed[opg.indsatsGruppe] = opg.medarbejder;
        tidligstDato = opg.dato;
        tidligstMin = toMin2(opg.slutKl) + pause;
        if(opg.patInv) sidstePatBesøgDato = opg.dato;
        if(trackEjere) bookingEjere.push({patId:pat.id,patPrioritet:patPrioritetMap[pat.id],opg,medNavn:opg.medarbejder,lokNavn:opg.lokale,dato:opg.dato});
      } else {
        return {ok:false, planned:ok_count, fejlOpg:opg, effTidligstDato, effTidligstMin, kandidater};
      }
    }
    return {ok:true, planned:ok_count};
  };

  sorterede.forEach(pat => {
    const deadline = beregnDeadline(pat);
    const ventende = pat.opgaver
      .filter(o=>{
        if(o.status==="planlagt") return false;
        if(o.låst && !tilladOverstigLåste) return false;
        return true;
      })
      .sort((a,b)=>(a.sekvens||0)-(b.sekvens||0));

    const res = planlaegPatient(pat, ventende, deadline);
    planned += res.planned;

    if(res.ok) {
      // Log alle planlagte opgaver
      ventende.filter(o=>o.status==="planlagt").forEach(o=>{
        planLog.push({type:"info",msg:`[${pat.navn}] #${o.sekvens} ${o.opgave} → ${o.dato} ${o.startKl}-${o.slutKl} (${o.medarbejder})`});
      });
    } else {
      // Registrer fejl for denne opgave
      const {fejlOpg, effTidligstDato, effTidligstMin, kandidater} = res;
      failed++;
      const deadlineMsg = deadline ? ` (deadline: ${deadline})` : "";
      planLog.push({type:"error",patId:pat.id,patNavn:pat.navn,opgave:fejlOpg.opgave,
        msg:`[${pat.navn}] #${fejlOpg.sekvens} ${fejlOpg.opgave} — FEJL: ingen ledig tid${deadlineMsg} [søgte fra: ${effTidligstDato} ${fromMin2(effTidligstMin)}]`,
        fejl:`Sekvens #${fejlOpg.sekvens}: Ingen ledig tid fundet${deadlineMsg} (${(kandidater||[]).length} kandidater)`});
      // Registrer resterende som fejlede (men potentielt løsbare via bump)
      const rest = ventende.slice(ventende.indexOf(fejlOpg)+1);
      rest.forEach(r=>{
        failed++;
        planLog.push({type:"error",patId:pat.id,patNavn:pat.navn,opgave:r.opgave,
          msg:`[${pat.navn}] #${r.sekvens} ${r.opgave} — AFVENTER (kræver #${fejlOpg.sekvens})`,
          fejl:`Afventer forrige opgave`});
      });
      // Gem til fase 2: alle ventende opgaver der endnu ikke er planlagt
      const uplanlagte = ventende.filter(o=>o.status!=="planlagt");
      if(uplanlagte.length>0) fejledePatienter.push({pat, ventende:uplanlagte});
    }
  });

  // ══════════════════════════════════════════════════════════════
  // FASE 2: BUMP-OG-GENPLANLÆG — forsøg at finde plads til fejlede patienter
  // ══════════════════════════════════════════════════════════════
  const MAX_BUMP_ATTEMPTS = 3;
  const bumpedPatIds = new Set();
  let bumpSucces = 0, bumpForsøg = 0;

  if(fejledePatienter.length>0){
    planLog.push({type:"info",msg:`── FASE 2: BUMP — ${fejledePatienter.length} patienter søger omfordeling ──`});
  }

  for(const {pat:fejlPat, ventende:fejlVentende} of fejledePatienter) {
    const fejlPrioritet = patPrioritetMap[fejlPat.id];
    const deadline = beregnDeadline(fejlPat);
    const blokeretOpg = fejlVentende[0];
    const blokeretKandidater = bygKandidater(blokeretOpg);
    const blokeretLokaler = ekspanderLokaler(blokeretOpg.muligeLok||[]);

    // Find bumpable bookinger fra lavere-prioritets patienter
    const bumpKandidater = bookingEjere.filter(be=>{
      if(be.patPrioritet<=fejlPrioritet) return false;
      if(bumpedPatIds.has(be.patId)) return false;
      const sharesWorker = blokeretKandidater.includes(be.medNavn);
      const sharesLokale = blokeretLokaler.length===0 || blokeretLokaler.includes(be.lokNavn);
      return sharesWorker || sharesLokale;
    });
    // Dedupliker til unikke patient-IDs, sortér laveste prioritet først
    const seenPatIds = new Set();
    const unikkeBumpPat = bumpKandidater.filter(be=>{
      if(seenPatIds.has(be.patId)) return false;
      seenPatIds.add(be.patId); return true;
    }).sort((a,b)=>b.patPrioritet-a.patPrioritet);

    let løst = false;
    let forsøgtHer = 0;

    for(const bumpTarget of unikkeBumpPat) {
      if(forsøgtHer>=MAX_BUMP_ATTEMPTS) break;
      forsøgtHer++; bumpForsøg++;

      const bumpPat = klonPat.find(p=>p.id===bumpTarget.patId);
      if(!bumpPat) continue;

      // Gem og fjern alle bump-patientens planlagte, ulåste opgaver
      const bumpOpgaver = bumpPat.opgaver.filter(o=>o.status==="planlagt"&&!o.låst);
      if(bumpOpgaver.length===0) continue;
      const savedBookings = bumpOpgaver.map(o=>({opg:o,saved:fjernBooking(o,bumpPat.id)})).filter(x=>x.saved);

      // Forsøg at planlægge fejlPat
      const fejlRes = planlaegPatient(fejlPat, fejlVentende, deadline, false);

      if(fejlRes.ok) {
        // Forsøg at genplanlægge bumpPat
        bumpedPatIds.add(bumpTarget.patId);
        const bumpDeadline = beregnDeadline(bumpPat);
        const bumpVentende = bumpOpgaver.sort((a,b)=>(a.sekvens||0)-(b.sekvens||0));
        const bumpRes = planlaegPatient(bumpPat, bumpVentende, bumpDeadline, false);

        if(bumpRes.ok) {
          // Begge planlagt! Opdater tællere.
          const fejlAntal = fejlVentende.length;
          planned += fejlAntal;
          failed -= fejlAntal;
          bumpSucces++;
          planLog.push({type:"info",msg:`[BUMP] ${fejlPat.navn} planlagt efter omfordeling af ${bumpPat.navn}`});
          fejlVentende.filter(o=>o.status==="planlagt").forEach(o=>{
            planLog.push({type:"info",msg:`[BUMP] [${fejlPat.navn}] #${o.sekvens} ${o.opgave} → ${o.dato} ${o.startKl}-${o.slutKl} (${o.medarbejder})`});
          });
          løst = true;
          break;
        } else {
          // BumpPat kan ikke genplanlægges → fuld rollback
          // 1. Fjern fejlPats nye bookinger
          fejlVentende.filter(o=>o.status==="planlagt").forEach(o=>fjernBooking(o,fejlPat.id));
          // 2. Fjern bumpPats evt. delvise nye bookinger
          bumpVentende.filter(o=>o.status==="planlagt").forEach(o=>fjernBooking(o,bumpPat.id));
          // 3. Gendan bumpPats originale bookinger
          savedBookings.forEach(({opg,saved})=>genindførBooking(opg,saved,bumpPat.id));
          bumpedPatIds.delete(bumpTarget.patId);
        }
      } else {
        // FejlPat kan stadig ikke planlægges → rollback
        fejlVentende.filter(o=>o.status==="planlagt").forEach(o=>fjernBooking(o,fejlPat.id));
        savedBookings.forEach(({opg,saved})=>genindførBooking(opg,saved,bumpPat.id));
      }
    }

    if(!løst) {
      planLog.push({type:"warn",msg:`[BUMP] ${fejlPat.navn} — kunne ikke løses via omfordeling (${forsøgtHer} forsøg)`});
    }
  }

  if(bumpForsøg>0){
    planLog.push({type:"info",msg:`── BUMP-RESULTAT: ${bumpSucces} løst / ${bumpForsøg} forsøg ──`});
  }

  // ══════════════════════════════════════════════════════════════
  // OPSUMMERING — udnyttelsesstatistik efter planlægning
  // ══════════════════════════════════════════════════════════════
  planLog.push({type:"info",msg:`── RESULTAT ──`});
  planLog.push({type:failed>0?"warn":"info",msg:`Planlagt: ${planned} | Fejlet: ${failed} | Total: ${planned+failed}`});

  // Medarbejder-udnyttelse
  const medStats = {};
  medarbejdere.forEach(m=>{ medStats[m.navn]={titel:m.titel,minBooket:0,dage:new Set()}; });
  klonPat.forEach(p=>p.opgaver.forEach(o=>{
    if(o.status==="planlagt"&&o.medarbejder&&medStats[o.medarbejder]){
      medStats[o.medarbejder].minBooket+=(o.minutter||0);
      medStats[o.medarbejder].dage.add(o.dato);
    }
  }));
  planLog.push({type:"info",msg:`── MEDARBEJDER-UDNYTTELSE ──`});
  Object.entries(medStats).sort((a,b)=>b[1].minBooket-a[1].minBooket).forEach(([navn,s])=>{
    const timer=Math.round(s.minBooket/60*10)/10;
    const pct=s.minBooket>0?Math.round(s.minBooket/((medarbejdere.find(m=>m.navn===navn)?.timer||23)*60*Math.ceil(maxDage/7))*100):0;
    planLog.push({type:"info",msg:`  ${navn} (${s.titel}): ${timer}t booket over ${s.dage.size} dage`});
  });

  // Lokale-udnyttelse
  const lokStats = {};
  klonPat.forEach(p=>p.opgaver.forEach(o=>{
    if(o.status==="planlagt"&&o.lokale){
      if(!lokStats[o.lokale]) lokStats[o.lokale]={minBooket:0,dage:new Set()};
      lokStats[o.lokale].minBooket+=(o.minutter||0);
      lokStats[o.lokale].dage.add(o.dato);
    }
  }));
  planLog.push({type:"info",msg:`── LOKALE-UDNYTTELSE ──`});
  Object.entries(lokStats).sort((a,b)=>b[1].minBooket-a[1].minBooket).forEach(([lok,s])=>{
    planLog.push({type:"info",msg:`  ${lok}: ${Math.round(s.minBooket/60*10)/10}t booket over ${s.dage.size} dage`});
  });

  // Patienter der ikke er fuldt planlagt
  const ikkeFuldt = klonPat.filter(p=>p.opgaver.some(o=>o.status!=="planlagt"&&!o.låst));
  if(ikkeFuldt.length>0){
    planLog.push({type:"warn",msg:`── ${ikkeFuldt.length} PATIENTER IKKE FULDT PLANLAGT ──`});
  }

  // Synkroniser klonede patienter tilbage til original ordre
  const result = klonPat.map(kp => {
    const orig = patienter.find(p=>p.id===kp.id);
    return orig ? {...orig, opgaver:kp.opgaver} : kp;
  });

  return {patienter:result, planned, failed, planLog};
}
