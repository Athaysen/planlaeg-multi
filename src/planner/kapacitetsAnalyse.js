// Kapacitetsanalyse — diagnostisk motor oven på runPlanner.
//
// Formål: givet et sæt afventende opgaver og en ønsket deadline, fortæl
// brugeren om det kan lade sig gøre — og hvis ikke, hvilke ressourcer der
// mangler, og hvad det vil koste at få dem.
//
// Algoritme:
//   1. Baseline-simulering med nuværende ressourcer.
//   2. Hvis 100% planlagt → tomt flaskehals-array; ingen scenarier behøves.
//   3. Ellers: for hver ressource-kandidat (titel, lokale, udstyr) kør én
//      hypotese-simulering hvor netop den ressource har uendelig kapacitet.
//      Delta = (planlagte_med_boost − planlagte_baseline). Ressourcer med
//      positiv delta er flaskehalse, sorteret descending.
//   4. Generér 3 basis-scenarier: udvid arbejdstid, ansæt, forlæng periode.
//      Hver simuleres også, så vi kan rapportere konkret "→ 92% planlagt".
//   5. Udnyttelses-tabel baseret på baseline-plan.
//
// Bemærk: hypotese-simulering er en ren heuristik. Spacing-regler kan
// blokere planlægning selv med uendelig kapacitet — i så fald vil delta
// være 0 og ressourcen ikke markeres som flaskehals. Det er by design:
// hvis kapacitet ikke er problemet, er det ikke en kapacitetsflaskehals.
//
// Returstruktur:
//   {
//     resume: { slutDato, totalOpgaver, planlagte, fejlet, udnyttelse, kanLadesigGøre },
//     flaskehalse: [{ type, navn, delta, beskrivelse, kritisk }],
//     scenarier: [{ id, type, beskrivelse, nyPlanlagt, nyUdnyttelse, månedligOmkostning, ekstraTimerPrUge }],
//     udnyttelse: [{ navn, type, kapacitet, bookede, procent, farve }],
//   }

import { runPlanner } from "./runPlanner.js";
import { today, daysBetween, addDays } from "../utils/index.js";
import { DEFAULT_TITLER } from "../data/constants.js";

const DAGE_UGE = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];

const toMin = (hm) => {
  if (!hm) return 0;
  const [h, m] = String(hm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Månedlig omkostning: timer/uge × krPrTime × 4.33 uger/måned.
const UGER_PR_MAANED = 4.33;

const farveForUdnyttelse = (pct) => {
  if (pct >= 95) return "#dc2626"; // rød — kritisk
  if (pct >= 80) return "#f59e0b"; // gul — høj
  if (pct >= 50) return "#65a30d"; // grøn — sund
  return "#9ca3af";                // grå — lav
};

// Filtrér patienter + medarbejdere efter afdeling. "current" betyder behold
// alle; ellers kun dem der matcher listen.
const filtrerAfdelinger = (patienter, medarbejdere, afdelinger) => {
  if (!Array.isArray(afdelinger) || afdelinger.length === 0) {
    return { patienter, medarbejdere };
  }
  const set = new Set(afdelinger);
  return {
    patienter: patienter.filter(p => set.has(p.afdeling)),
    medarbejdere: medarbejdere.filter(m => set.has(m.afdeling)),
  };
};

// Find alle titler der er i brug — base + extras fra medarbejder-data.
const findTitler = (medarbejdere, titlerCfg) => {
  const base = Array.isArray(titlerCfg) && titlerCfg.length > 0 ? titlerCfg : DEFAULT_TITLER;
  const baseNavne = new Set(base.map(t => t.navn));
  const extras = [...new Set(medarbejdere.map(m => m?.titel).filter(t => t && !baseNavne.has(t)))]
    .map(navn => ({ navn, defaultKrPrTime: 0, defaultTimerPerUge: 23 }));
  return [...base, ...extras];
};

// Find krPrTime for en titel — medarbejder-override > taktDefaults > titler-default.
const krPrTimeForTitel = (titelNavn, medarbejdere, taktDefaults, titler) => {
  const medMedTitel = medarbejdere.filter(m => m.titel === titelNavn && m.krPrTime);
  if (medMedTitel.length > 0) {
    return medMedTitel.reduce((a, m) => a + Number(m.krPrTime), 0) / medMedTitel.length;
  }
  const td = taktDefaults?.[titelNavn]?.krPrTime;
  if (td) return Number(td);
  const t = titler.find(x => x.navn === titelNavn);
  return Number(t?.defaultKrPrTime) || 0;
};

// Byg et config-objekt til runPlanner baseret på analyse-indstillinger.
// maxDageOverride giver mulighed for at forlænge horisonten i forlæng-scenariet.
const byggConfig = (base, override = {}) => ({
  medarbejdere: override.medarbejdere || base.medarbejdere,
  lokTider: override.lokTider || base.lokTider,
  lokMeta: override.lokMeta || base.lokMeta,
  lokaler: override.lokaler || base.lokaler,
  titler: base.titler,
  maxDage: override.maxDage ?? base.maxDage,
  planFraDato: base.planFraDato,
  pause: base.pause ?? 5,
  minGapDays: base.minGapDays ?? 2,
  step: base.step ?? 5,
  maxPatVisitsPerMedPerUge: base.maxPatVisitsPerMedPerUge ?? 10,
  maxPatVisitsStrenged: base.maxPatVisitsStrenged ?? "bloed",
  maxMedPerPatient: base.maxMedPerPatient ?? 0,
  maxMedStrenged: base.maxMedStrenged ?? "bloed",
  prioritering: base.prioritering ?? "henvDato",
  deadlineMode: base.deadlineMode ?? "henvDato",
  maxDageForlob: base.maxDageForlob ?? 0,
  cooldownDage: base.cooldownDage ?? 0,
  patInvMinDage: base.patInvMinDage ?? 0,
  tilladOverstigLåste: base.tilladOverstigLåste ?? false,
});

// Tæl afventende opgaver (status !== "planlagt" og ikke låst).
const afventendeOpgaver = (patienter) => {
  let n = 0;
  for (const p of patienter) {
    for (const o of (p.opgaver || [])) {
      if (o.status !== "planlagt" && !o.låst) n++;
    }
  }
  return n;
};

// Tæl planlagte opgaver i et resultat.
const tælPlanlagte = (patienter) => {
  let n = 0;
  for (const p of patienter) {
    for (const o of (p.opgaver || [])) {
      if (o.status === "planlagt") n++;
    }
  }
  return n;
};

// Hypotese: uendelig kapacitet på én titel.
// Tilføj 5 "buffer"-medarbejdere med alle kompetencer og bred arbejdstid.
const boostTitel = (medarbejdere, titelNavn) => {
  const bredArbejdsdage = Object.fromEntries(
    DAGE_UGE.map(d => [d, { aktiv: true, start: "07:00", slut: "19:00" }])
  );
  // Saml alle kompetencer fra eksisterende medarbejdere for at garantere match
  const alleKompetencer = [...new Set(medarbejdere.flatMap(m => m.kompetencer || []))];
  const buffer = Array.from({ length: 5 }, (_, i) => ({
    id: `__buffer_${titelNavn}_${i}`,
    navn: `__buffer ${titelNavn} ${i + 1}`,
    titel: titelNavn,
    timer: 60,
    kompetencer: alleKompetencer,
    certifikater: [],
    arbejdsdage: bredArbejdsdage,
    afdeling: medarbejdere[0]?.afdeling || "current",
    kapacitet: { grænseType: "uge", grænseTimer: 60, brugerDefault: false },
  }));
  return [...medarbejdere, ...buffer];
};

// Hypotese: uendelig kapacitet på ét lokale (duplikér 5x via "(N)"-suffix).
const boostLokale = (lokTider, lokaler, lokMeta, lokNavn) => {
  const nyLokTider = {};
  for (const dag of DAGE_UGE) {
    nyLokTider[dag] = { ...(lokTider[dag] || {}) };
    const eks = lokTider[dag]?.[lokNavn];
    // Åbn lokalet hele arbejdsdagen i alle 5 dage, uanset nuværende tider.
    const bred = { å: "07:00", l: "19:00" };
    for (let i = 2; i <= 6; i++) {
      nyLokTider[dag][`${lokNavn} (${i})`] = eks || bred;
    }
    // Udvid også original hvis den var smallere.
    if (!eks) nyLokTider[dag][lokNavn] = bred;
  }
  const nyLokaler = [...(lokaler || [])];
  const nyLokMeta = { ...(lokMeta || {}) };
  for (let i = 2; i <= 6; i++) {
    const kopi = `${lokNavn} (${i})`;
    if (!nyLokaler.includes(kopi)) nyLokaler.push(kopi);
    nyLokMeta[kopi] = { ...(lokMeta?.[lokNavn] || {}) };
  }
  return { lokTider: nyLokTider, lokaler: nyLokaler, lokMeta: nyLokMeta };
};

// Hypotese: udstyr U tilgængeligt i alle lokaler.
const boostUdstyr = (lokMeta, lokaler, udstyr) => {
  const ny = { ...(lokMeta || {}) };
  for (const l of (lokaler || [])) {
    ny[l] = { ...(ny[l] || {}), udstyr: [...new Set([...(ny[l]?.udstyr || []), udstyr])] };
  }
  return ny;
};

// Saml alle lokaler der er i brug (lokTider + lokaler + muligeLok på opgaver).
const findAlleLokaler = (lokTider, lokaler, patienter) => {
  const s = new Set();
  Object.values(lokTider || {}).forEach(dl => Object.keys(dl || {}).forEach(l => s.add(l)));
  (lokaler || []).forEach(l => s.add(l));
  (patienter || []).forEach(p => (p.opgaver || []).forEach(o => (o.muligeLok || []).forEach(l => s.add(l))));
  // Gruppér til basis-navne (strip "(N)").
  const basis = [...s].map(l => l.replace(/\s*\(\d+\)$/, ""));
  return [...new Set(basis)];
};

// Saml alle udstyr-kandidater (fra kraevetUdstyr på opgaver + eksisterende lokMeta).
const findAlleUdstyr = (patienter, lokMeta) => {
  const s = new Set();
  (patienter || []).forEach(p => (p.opgaver || []).forEach(o => (o.kraevetUdstyr || []).forEach(u => s.add(u))));
  Object.values(lokMeta || {}).forEach(m => (m?.udstyr || []).forEach(u => s.add(u)));
  return [...s];
};

// Byg udnyttelses-tabel fra baseline-plan.
// Kapacitet normaliseres til hele perioden: kap/uge × antal_uger.
// Det giver en meningsfuld procent selv for flerugers perioder.
const byggUdnyttelse = (baselinePatienter, medarbejdere, lokTider, maxDage = 7) => {
  const antalUger = Math.max(1, maxDage / 7);
  // Medarbejder-udnyttelse
  const medMin = {}; // navn → bookede minutter (hele perioden)
  const medKap = {}; // navn → kapacitet i minutter (hele perioden)
  medarbejdere.forEach(m => {
    if (m.navn.startsWith("__buffer")) return;
    const prUge = Object.values(m.arbejdsdage || {}).reduce((s, d) => {
      if (!d?.aktiv) return s;
      return s + Math.max(0, toMin(d.slut) - toMin(d.start));
    }, 0);
    medKap[m.navn] = prUge * antalUger;
    medMin[m.navn] = 0;
  });
  baselinePatienter.forEach(p => (p.opgaver || []).forEach(o => {
    if (o.status === "planlagt" && o.medarbejder && medMin[o.medarbejder] != null) {
      medMin[o.medarbejder] += o.minutter || 60;
    }
  }));

  const medRows = Object.keys(medMin).map(navn => {
    const kap = medKap[navn] || 0;
    const pct = kap > 0 ? Math.round((medMin[navn] / kap) * 100) : 0;
    return { navn, type: "medarbejder", kapacitet: kap, bookede: medMin[navn], procent: pct, farve: farveForUdnyttelse(pct) };
  });

  // Lokale-udnyttelse (grupperet på basis-navn)
  const lokMin = {};
  const lokKap = {};
  const basisLokaler = new Set();
  Object.values(lokTider || {}).forEach(dl => Object.keys(dl || {}).forEach(l => basisLokaler.add(l.replace(/\s*\(\d+\)$/, ""))));
  for (const basis of basisLokaler) {
    lokMin[basis] = 0;
    let prUge = 0;
    for (const dag of DAGE_UGE) {
      const lt = lokTider?.[dag]?.[basis];
      if (lt) prUge += Math.max(0, toMin(lt.l) - toMin(lt.å));
    }
    lokKap[basis] = prUge * antalUger;
  }
  baselinePatienter.forEach(p => (p.opgaver || []).forEach(o => {
    if (o.status === "planlagt" && o.lokale) {
      const basis = o.lokale.replace(/\s*\(\d+\)$/, "");
      if (lokMin[basis] != null) lokMin[basis] += o.minutter || 60;
    }
  }));
  const lokRows = Object.keys(lokMin).map(navn => {
    const kap = lokKap[navn] || 0;
    const pct = kap > 0 ? Math.round((lokMin[navn] / kap) * 100) : 0;
    return { navn, type: "lokale", kapacitet: kap, bookede: lokMin[navn], procent: pct, farve: farveForUdnyttelse(pct) };
  });

  return [...medRows, ...lokRows].sort((a, b) => b.procent - a.procent);
};

// Ugedag-navn for en ISO-dato (lokal time).
const ugedagForDato = (ds) => {
  const d = new Date(ds + "T12:00:00");
  return ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"][d.getDay()];
};

// Byg dagfordeling: for en given ressource-flaskehals, returnér minutter
// booket per ugedag på tværs af baseline-planen. Bruges til at rapportere
// "tirsdage er mest belastet" under hver flaskehals i UI'et.
const byggDagFordeling = (baselinePatienter, flaskehals, medarbejdere, lokTider, maxDage) => {
  const bookMin = { Mandag: 0, Tirsdag: 0, Onsdag: 0, Torsdag: 0, Fredag: 0 };
  const kapMin = { Mandag: 0, Tirsdag: 0, Onsdag: 0, Torsdag: 0, Fredag: 0 };
  const antalUger = Math.max(1, maxDage / 7);

  if (flaskehals.type === "medarbejder") {
    // Sum minutter for alle planlagte opgaver hvor medarbejderen har flaskehals-titlen.
    const medsIdxTitel = new Set(medarbejdere.filter(m => m.titel === flaskehals.navn).map(m => m.navn));
    baselinePatienter.forEach(p => (p.opgaver || []).forEach(o => {
      if (o.status === "planlagt" && o.dato && medsIdxTitel.has(o.medarbejder)) {
        const dag = ugedagForDato(o.dato);
        if (bookMin[dag] != null) bookMin[dag] += o.minutter || 60;
      }
    }));
    // Kapacitet per ugedag for titlen: sum af alle medarbejderes arbejdsdag-længde, × antalUger.
    for (const dag of DAGE_UGE) {
      let prUge = 0;
      for (const m of medarbejdere) {
        if (m.titel !== flaskehals.navn) continue;
        const d = m.arbejdsdage?.[dag];
        if (d?.aktiv) prUge += Math.max(0, toMin(d.slut) - toMin(d.start));
      }
      kapMin[dag] = prUge * antalUger;
    }
  } else if (flaskehals.type === "lokale") {
    baselinePatienter.forEach(p => (p.opgaver || []).forEach(o => {
      if (o.status === "planlagt" && o.dato && o.lokale) {
        const basis = o.lokale.replace(/\s*\(\d+\)$/, "");
        if (basis === flaskehals.navn) {
          const dag = ugedagForDato(o.dato);
          if (bookMin[dag] != null) bookMin[dag] += o.minutter || 60;
        }
      }
    }));
    for (const dag of DAGE_UGE) {
      const lt = lokTider?.[dag]?.[flaskehals.navn];
      const prUge = lt ? Math.max(0, toMin(lt.l) - toMin(lt.å)) : 0;
      kapMin[dag] = prUge * antalUger;
    }
  } else if (flaskehals.type === "udstyr") {
    // Udstyr-dagfordeling er kun tilnærmelse: opgaver der kræver udstyret
    baselinePatienter.forEach(p => (p.opgaver || []).forEach(o => {
      if (o.status === "planlagt" && o.dato && (o.kraevetUdstyr || []).includes(flaskehals.navn)) {
        const dag = ugedagForDato(o.dato);
        if (bookMin[dag] != null) bookMin[dag] += o.minutter || 60;
      }
    }));
    // Kapacitet for udstyr er ikke meningsfuld uden lokMeta-kontekst — lad være med at rapportere.
  }

  return DAGE_UGE.map(dag => {
    const b = bookMin[dag];
    const k = kapMin[dag];
    const pct = k > 0 ? Math.round((b / k) * 100) : null;
    return { dag, booketMin: b, kapacitetMin: k, procent: pct };
  });
};

// ── Hoved-API ──
// indstillinger:
//   slutDato:       "YYYY-MM-DD" (obligatorisk)
//   afdelinger:     string[] — tomt = alle
//   planFraDato:    "YYYY-MM-DD" — default today()
//   maxUgeTimerOverride: Number — override arbejdstimer pr uge per medarbejder
//   titlerCfg:      adminData.titler
//   taktDefaults:   adminData.taktDefaults
//   plannerConfig:  øvrige runPlanner-parametre (minGapDays, pause, osv.)
export function analyserKapacitet(patienter = [], medarbejdere = [], lokaler = [], lokTider = {}, indstillinger = {}) {
  const {
    slutDato,
    afdelinger = [],
    planFraDato = today(),
    maxUgeTimerOverride = null,
    titlerCfg = null,
    taktDefaults = {},
    lokMeta = {},
    plannerConfig = {},
  } = indstillinger;

  if (!slutDato) throw new Error("kapacitetsAnalyse: slutDato er påkrævet");

  const maxDage = Math.max(1, daysBetween(planFraDato, slutDato));

  // Filtrér efter afdeling
  const { patienter: patF, medarbejdere: medF } = filtrerAfdelinger(patienter, medarbejdere, afdelinger);

  // Anvend maks-ugentlige-timer override hvis sat
  const medEff = maxUgeTimerOverride != null
    ? medF.map(m => ({ ...m, timer: Math.min(m.timer || 23, Number(maxUgeTimerOverride)) }))
    : medF;

  const titler = findTitler(medEff, titlerCfg);

  const base = {
    medarbejdere: medEff,
    lokTider,
    lokMeta,
    lokaler,
    titler,
    maxDage,
    planFraDato,
    ...plannerConfig,
  };

  const total = afventendeOpgaver(patF);
  if (total === 0) {
    return {
      resume: { slutDato, totalOpgaver: 0, planlagte: 0, fejlet: 0, udnyttelse: 0, kanLadesigGøre: true, maxDage },
      flaskehalse: [],
      scenarier: [],
      udnyttelse: byggUdnyttelse(patF, medEff, lokTider, maxDage),
    };
  }

  // 1. Baseline
  const baseline = runPlanner(patF, byggConfig(base));
  const basePlan = tælPlanlagte(baseline.patienter) - (tælPlanlagte(patF) - afventendeOpgaver(patF));
  // Hvis patienter havde eksisterende planlagte opgaver skal disse trækkes fra.
  // Vi måler delta kun på afventende, så:
  const basePlanDelta = baseline.planned;
  const baseFailed = baseline.failed;
  const baseUdnyttelse = total > 0 ? Math.round((basePlanDelta / total) * 100) : 100;
  void basePlan;

  const resume = {
    slutDato,
    planFraDato,
    maxDage,
    totalOpgaver: total,
    planlagte: basePlanDelta,
    fejlet: baseFailed,
    udnyttelse: baseUdnyttelse,
    kanLadesigGøre: baseFailed === 0,
  };

  const udnyttelse = byggUdnyttelse(baseline.patienter, medEff, lokTider, maxDage);

  // 2. Hvis alt kan planlægges, ingen flaskehalse/scenarier at foreslå
  if (baseFailed === 0) {
    return { resume, flaskehalse: [], scenarier: [], udnyttelse };
  }

  // 3. Flaskehalse via hypotese-simulering
  const flaskehalse = [];

  // Titler
  for (const t of titler) {
    const medBoostet = boostTitel(medEff, t.navn);
    const res = runPlanner(patF, byggConfig(base, { medarbejdere: medBoostet }));
    const delta = res.planned - basePlanDelta;
    if (delta > 0) {
      flaskehalse.push({
        type: "medarbejder",
        navn: t.navn,
        delta,
        beskrivelse: `${t.navn}-titel: ${delta} flere opgaver kan planlægges med mere kapacitet`,
        kritisk: delta >= total * 0.5,
      });
    }
  }

  // Lokaler
  const basisLokaler = findAlleLokaler(lokTider, lokaler, patF);
  for (const l of basisLokaler) {
    const boostet = boostLokale(lokTider, lokaler, lokMeta, l);
    const res = runPlanner(patF, byggConfig(base, boostet));
    const delta = res.planned - basePlanDelta;
    if (delta > 0) {
      flaskehalse.push({
        type: "lokale",
        navn: l,
        delta,
        beskrivelse: `Lokale "${l}": ${delta} flere opgaver kan planlægges med ekstra kapacitet`,
        kritisk: delta >= total * 0.5,
      });
    }
  }

  // Udstyr
  const alleUdstyr = findAlleUdstyr(patF, lokMeta);
  for (const u of alleUdstyr) {
    const boostet = boostUdstyr(lokMeta, basisLokaler, u);
    const res = runPlanner(patF, byggConfig(base, { lokMeta: boostet }));
    const delta = res.planned - basePlanDelta;
    if (delta > 0) {
      flaskehalse.push({
        type: "udstyr",
        navn: u,
        delta,
        beskrivelse: `Udstyr "${u}": ${delta} flere opgaver kan planlægges hvis tilgængeligt i flere lokaler`,
        kritisk: delta >= total * 0.5,
      });
    }
  }

  flaskehalse.sort((a, b) => b.delta - a.delta);

  // 3b. Berig top-flaskehals med dag-fordeling så UI kan vise
  //     "tirsdage er 95% booket" per flaskehals (kun top-3 for at spare UI-plads).
  flaskehalse.slice(0, 3).forEach(f => {
    f.dagFordeling = byggDagFordeling(baseline.patienter, f, medEff, lokTider, maxDage);
  });

  // 4. Scenarier — 3 basis-typer + 1 kombi, sorteret efter omkostning ascending
  const scenarier = genererScenarier({
    patienter: patF,
    medarbejdere: medEff,
    lokaler,
    lokTider,
    lokMeta,
    titler,
    taktDefaults,
    base,
    total,
    basePlanDelta,
    flaskehalse,
    slutDato,
  });

  return { resume, flaskehalse, scenarier, udnyttelse };
}

// ── Scenarie-generator ──
// Producerer tre scenarier hvis muligt:
//   A) "Udvid arbejdstid +5 t/uge" for top-flaskehals-titel
//   B) "Ansæt 1 ny (20 t/uge)" for top-flaskehals-titel
//   C) "Forlæng periode" — find mindste +uger hvor alt planlægges (cap 12)
// Hver simuleres med runPlanner så vi kan vise konkret nyUdnyttelse.
function genererScenarier({ patienter, medarbejdere, lokaler, lokTider, lokMeta, titler, taktDefaults, base, total, basePlanDelta, flaskehalse, slutDato }) {
  const out = [];
  void basePlanDelta;
  void slutDato;

  // Find top-flaskehals-titel (hvis nogen)
  const topTitel = flaskehalse.find(f => f.type === "medarbejder")?.navn
    || titler.find(t => medarbejdere.some(m => m.titel === t.navn))?.navn;

  if (topTitel) {
    const krPrTime = krPrTimeForTitel(topTitel, medarbejdere, taktDefaults, titler);

    // A) Udvid arbejdstid +5 t/uge for alle i titlen
    const ekstraTimerA = 5;
    const antalMed = medarbejdere.filter(m => m.titel === topTitel).length;
    const medA = medarbejdere.map(m => {
      if (m.titel !== topTitel) return m;
      // Udvid slut-tid med ~1 t/dag = 5 t/uge totalt
      const nyDage = Object.fromEntries(Object.entries(m.arbejdsdage || {}).map(([dag, d]) => {
        if (!d?.aktiv) return [dag, d];
        const slutM = toMin(d.slut) + 60;
        const hh = String(Math.floor(slutM / 60)).padStart(2, "0");
        const mm = String(slutM % 60).padStart(2, "0");
        return [dag, { ...d, slut: `${hh}:${mm}` }];
      }));
      return { ...m, arbejdsdage: nyDage };
    });
    const resA = runPlanner(patienter, byggConfig(base, { medarbejdere: medA }));
    out.push({
      id: "udvid",
      type: "udvid-arbejdstid",
      titel: topTitel,
      beskrivelse: `Udvid alle ${topTitel.toLowerCase()}ers arbejdstid med ${ekstraTimerA} t/uge`,
      ekstraTimerPrUge: ekstraTimerA * antalMed,
      nyPlanlagt: resA.planned,
      nyUdnyttelse: total > 0 ? Math.round((resA.planned / total) * 100) : 100,
      månedligOmkostning: Math.round(ekstraTimerA * antalMed * krPrTime * UGER_PR_MAANED),
    });

    // B) Ansæt 1 ny (20 t/uge)
    const ekstraTimerB = 20;
    const bredArbejdsdage = Object.fromEntries(
      DAGE_UGE.map(d => [d, { aktiv: true, start: "08:00", slut: "12:00" }])
    );
    const alleKompetencer = [...new Set(medarbejdere.flatMap(m => m.kompetencer || []))];
    const medB = [...medarbejdere, {
      id: `__ny_${topTitel}`,
      navn: `Ny ${topTitel.toLowerCase()}`,
      titel: topTitel,
      timer: ekstraTimerB,
      kompetencer: alleKompetencer,
      certifikater: [],
      arbejdsdage: bredArbejdsdage,
      afdeling: medarbejdere[0]?.afdeling || "current",
      kapacitet: { grænseType: "uge", grænseTimer: ekstraTimerB, brugerDefault: false },
    }];
    const resB = runPlanner(patienter, byggConfig(base, { medarbejdere: medB }));
    out.push({
      id: "ansaet",
      type: "ansaet-medarbejder",
      titel: topTitel,
      beskrivelse: `Ansæt 1 ny ${topTitel.toLowerCase()} (${ekstraTimerB} t/uge)`,
      ekstraTimerPrUge: ekstraTimerB,
      nyPlanlagt: resB.planned,
      nyUdnyttelse: total > 0 ? Math.round((resB.planned / total) * 100) : 100,
      månedligOmkostning: Math.round(ekstraTimerB * krPrTime * UGER_PR_MAANED),
    });
  }
  void lokaler; void lokTider; void lokMeta;

  // C) Forlæng periode — stepvis +7 dage, find min hvor alt planlægges.
  // Cap: 12 uger ekstra (84 dage). Hvis ikke nået, rapportér max-tried.
  const startMaxDage = base.maxDage;
  let bedsteForlaengelse = null;
  for (let ekstraUger = 1; ekstraUger <= 12; ekstraUger++) {
    const nyMax = startMaxDage + ekstraUger * 7;
    const res = runPlanner(patienter, byggConfig(base, { maxDage: nyMax }));
    if (res.failed === 0) {
      bedsteForlaengelse = { uger: ekstraUger, planned: res.planned, maxDage: nyMax };
      break;
    }
  }
  if (bedsteForlaengelse) {
    out.push({
      id: "forlaeng",
      type: "forlaeng-periode",
      titel: null,
      beskrivelse: `Forlæng perioden med ${bedsteForlaengelse.uger} uge${bedsteForlaengelse.uger === 1 ? "" : "r"} (ny slutdato: ${addDays(today(), bedsteForlaengelse.maxDage)})`,
      ekstraTimerPrUge: 0,
      nyPlanlagt: bedsteForlaengelse.planned,
      nyUdnyttelse: 100,
      månedligOmkostning: 0,
    });
  }

  // D) Kombi-scenarie — mindre udvidelse (+2 t/uge for alle i titlen) + deltids-
  //    ansættelse (10 t/uge). Ofte mere realistisk end et fuldt ansat-scenarie.
  if (topTitel) {
    const krPrTime = krPrTimeForTitel(topTitel, medarbejdere, taktDefaults, titler);
    const ekstraPerMed = 2;
    const deltidTimer = 10;
    const antalMed = medarbejdere.filter(m => m.titel === topTitel).length;
    const medD = medarbejdere.map(m => {
      if (m.titel !== topTitel) return m;
      const nyDage = Object.fromEntries(Object.entries(m.arbejdsdage || {}).map(([dag, d]) => {
        if (!d?.aktiv) return [dag, d];
        const slutM = toMin(d.slut) + Math.round(ekstraPerMed * 60 / 5); // ~24 min/dag ≈ 2 t/uge
        const hh = String(Math.floor(slutM / 60)).padStart(2, "0");
        const mm = String(slutM % 60).padStart(2, "0");
        return [dag, { ...d, slut: `${hh}:${mm}` }];
      }));
      return { ...m, arbejdsdage: nyDage };
    });
    const alleKompetencer = [...new Set(medarbejdere.flatMap(m => m.kompetencer || []))];
    const deltidArbejdsdage = Object.fromEntries(
      DAGE_UGE.map(d => [d, { aktiv: true, start: "08:00", slut: "10:00" }])
    );
    const medAllerede = [...medD, {
      id: `__deltid_${topTitel}`,
      navn: `Deltids ${topTitel.toLowerCase()}`,
      titel: topTitel,
      timer: deltidTimer,
      kompetencer: alleKompetencer,
      certifikater: [],
      arbejdsdage: deltidArbejdsdage,
      afdeling: medarbejdere[0]?.afdeling || "current",
      kapacitet: { grænseType: "uge", grænseTimer: deltidTimer, brugerDefault: false },
    }];
    const resD = runPlanner(patienter, byggConfig(base, { medarbejdere: medAllerede }));
    const totalEkstraTimer = ekstraPerMed * antalMed + deltidTimer;
    out.push({
      id: "kombi",
      type: "kombination",
      titel: topTitel,
      beskrivelse: `Kombi: udvid alle ${topTitel.toLowerCase()}ers tid ${ekstraPerMed} t/uge + ansæt deltids-${topTitel.toLowerCase()} (${deltidTimer} t/uge)`,
      ekstraTimerPrUge: totalEkstraTimer,
      nyPlanlagt: resD.planned,
      nyUdnyttelse: total > 0 ? Math.round((resD.planned / total) * 100) : 100,
      månedligOmkostning: Math.round(totalEkstraTimer * krPrTime * UGER_PR_MAANED),
    });
  }

  // Sortér efter månedlig omkostning ascending (billigste først).
  out.sort((a, b) => a.månedligOmkostning - b.månedligOmkostning);
  return out;
}
