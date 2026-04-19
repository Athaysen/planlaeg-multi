// Data constants + buildPatient-fabrik. Ingen React-afhængigheder.
import { uid } from "../utils/index.js";

// ── Design tokens ─────────────────────────────────────────────────
export const C = {
  bg: "#f0f4fa", s1: "#ffffff", s2: "#f5f8fd", s3: "#e8eef7", s4: "#dce4f0",
  brd: "#ccd6e6", brd2: "#b0c0d8",
  acc: "#0050b3", accD: "#003d8a", accM: "rgba(0,80,179,0.08)",
  blue: "#003d8a", blueM: "rgba(0,61,138,0.08)",
  pur: "#1a5fb4", purM: "rgba(26,95,180,0.08)",
  amb: "#0050b3", ambM: "rgba(0,80,179,0.08)",
  red: "#003d8a", redM: "rgba(0,61,138,0.08)",
  grn: "#0050b3", grnM: "rgba(0,80,179,0.08)",
  txt: "#0f1923", txtD: "#3a4d63", txtM: "#6b84a0",
};

export const TITLE_C = { Læge: C.acc, Psykolog: C.blue, Pædagog: "#1a5fb4", Laege: C.acc, Paedagog: "#1a5fb4" };

// Patientstatus (fra domæne-data; kommer før det interne STATUS-system)
export const PAT_STATUS = {
  aktiv:      { label: "Aktiv",      col: "#0050b3", bg: "rgba(0,80,179,0.10)" },
  venteliste: { label: "Venteliste", col: "#1a5fb4", bg: "rgba(26,95,180,0.10)" },
  afsluttet:  { label: "Afsluttet",  col: "#003d8a", bg: "rgba(0,61,138,0.10)" },
  udmeldt:    { label: "Udmeldt",    col: "#2c3e6b", bg: "rgba(44,62,107,0.10)" },
};

// Centralt status-system for opgave-status og UI-meddelelser.
// Bruges af StatusBadge + overalt hvor status rendereres.
export const STATUS = {
  planlagt:        { color: C.grn, bg: C.grnM, ikon: "OK", label: "Planlagt" },
  afventer:        { color: C.amb, bg: C.ambM, ikon: "",   label: "Afventer" },
  "ikke-planlagt": { color: C.red, bg: C.redM, ikon: "X",  label: "Ikke fundet" },
  fejl:            { color: C.red, bg: C.redM, ikon: "!",  label: "Fejl" },
  advarsel:        { color: C.amb, bg: C.ambM, ikon: "^",  label: "Advarsel" },
  info:            { color: C.blue, bg: C.blueM, ikon: "i", label: "Info" },
  ok:              { color: C.grn, bg: C.grnM, ikon: "OK", label: "OK" },
};

// Globale status-hjælpere
export const sC = (s) => STATUS[s]?.color || C.amb;
export const sB = (s) => STATUS[s]?.bg    || C.ambM;
export const sL = (s) => (STATUS[s] ? `${STATUS[s].ikon} ${STATUS[s].label}` : "Afventer");

// ── Lokaler og åbningstider ───────────────────────────────────────
// Lokaler oprettes via opsætnings-wizard ved første opstart eller i Admin → Lokaler.
export const ALLE_LOK = [];

// Tom åbningstidsstruktur — wizard og UI fylder lokaler ind under hver dag.
export const DEFAULT_LOK_TIDER = {
  Mandag: {}, Tirsdag: {}, Onsdag: {}, Torsdag: {}, Fredag: {}, Lørdag: {}, Søndag: {},
};
// Standard-åbningstider per ugedag for et nyt lokale: 08:00-16:00 Man-Fre, weekend lukket.
export const STANDARD_AABNINGSTIDER = {
  Mandag:  { å: "08:00", l: "16:00" }, Tirsdag: { å: "08:00", l: "16:00" },
  Onsdag:  { å: "08:00", l: "16:00" }, Torsdag: { å: "08:00", l: "16:00" },
  Fredag:  { å: "08:00", l: "16:00" },
  Lørdag:  { å: "00:00", l: "00:00" }, Søndag: { å: "00:00", l: "00:00" },
};
// LOK_TIDER bruges kun i runPlanner som fallback — sendes via config.lokTider fra App state
export const LOK_TIDER = DEFAULT_LOK_TIDER;

// ── Faggrupper ────────────────────────────────────────────────────
// Default-faggrupper bruges som migration-værdi for brugere uden adminData.titler
// og som fallback i runPlanner/analyserRessourcer hvis ingen titler-liste sendes.
// Default-priser er 0 — wizarden eller admin sætter selv priser per titel.
export const DEFAULT_TITLER = [
  { id: "Psykolog", navn: "Psykolog", farve: "#0050b3", defaultTimerPerUge: 23, defaultKrPrTime: 0 },
  { id: "Læge",     navn: "Læge",     farve: "#d97706", defaultTimerPerUge: 30, defaultKrPrTime: 0 },
  { id: "Pædagog",  navn: "Pædagog",  farve: "#7c3aed", defaultTimerPerUge: 23, defaultKrPrTime: 0 },
];

// ── Kompetencepresets per titel ──────────────────────────────────
export const LK = ["ANAMNESE  Forberedelse Læge","ANAMNESE  Patient Læge","ANAMNESE  Efterbehandling Læge","FNU S  Forberedelse Læge","FNU S  Patient Læge","FNU S  Efterbehandling Læge","AKS  Forberedelse Læge","AKS  Patient Læge","AKS  Efterbehandling Læge","MED S  Forberedelse Læge","MED S   Patient Læge","MED S  Efterbehandling Læge","MED H  Forberedelse Læge","MED H   Patient Læge","MED H  Efterbehandling Læge","Familie Terapi  Forberedelse Læge","Familie Terapi   Patient Læge","Familie Terapi  Efterbehandling Læge","KONFERENCE Læge"];
export const PK = ["ANAMNESE  Forberedelse Psykolog","ANAMNESE  Patient Psykolog","ANAMNESE  Efterbehandling Psykolog","TEST 1  Forberedelse Psykolog","TEST 1  Patient Psykolog","TEST 1  Efterbehandling Psykolog","TEST 2  Forberedelse Psykolog","TEST 2  Patient Psykolog","TEST 2  Efterbehandling Psykolog","FAMILIESAMTALE  Forberedelse Psykolog","FAMILIESAMTALE  Patient Psykolog","FAMILIESAMTALE  Efterbehandling Psykolog","AKS  Forberedelse Psykolog","AKS  Patient Psykolog","AKS  Efterbehandling Psykolog","SSAP  Forberedelse Psykolog","SSAP  Patient Psykolog","SSAP  Efterbehandling Psykolog","MIM  Forberedelse Psykolog","MIM  Patient Psykolog","MIM  Efterbehandling Psykolog","ADOS 1  Forberedelse Psykolog","ADOS 1  Patient Psykolog","ADOS 1  Efterbehandling Psykolog","ADOS 2  Forberedelse Psykolog","ADOS 2  Patient Psykolog","ADOS 2  Efterbehandling Psykolog","ADOS 3  Forberedelse Psykolog","ADOS 3  Patient Psykolog","ADOS 3  Efterbehandling Psykolog","ADOS 4  Forberedelse Psykolog","ADOS 4  Patient Psykolog","ADOS 4  Efterbehandling Psykolog"];
export const PD = ["MILJØOBS  Forberedelse Pædagog","MILJØOBS  Patient Pædagog","MILJØOBS  Efterbehandling Pædagog","Vejledning  Forberedelse Pædagog","Vejledning  Patient Pædagog","Vejledning  Efterbehandling Pædagog","AKS  Forberedelse Pædagog","AKS  Patient Pædagog","AKS  Efterbehandling Pædagog","NNFP  Forberedelse Pædagog","NNFP  Patient Pædagog","NNFP  Efterbehandling Pædagog","PACK  Forberedelse Pædagog","PACK  Patient Pædagog","PACK  Efterbehandling Pædagog","MK  Forberedelse Pædagog","MK  Patient Pædagog","MK  Efterbehandling Pædagog"];
export const ALLE_K = [...PK, ...PD, ...LK];

// Sikrer at medarbejdere med tomt kompetencer-array får default for deres titel
export const ensureKompetencer = (m) => {
  if (m.kompetencer && m.kompetencer.length > 0) return m;
  const t = m.titel || "Psykolog";
  return { ...m, kompetencer: t === "Læge" ? [...LK] : t === "Pædagog" ? [...PD] : [...PK] };
};

// ── Start-data ────────────────────────────────────────────────────
export const BASE_MED = [];
export const INIT_PATIENTER_RAW = [];

// Forløbs-skabeloner oprettes via Admin → Forløb (eller importeres fra galleri/JSON).
// Default er tom: hver bruger bygger sine egne skabeloner.
export const FORLOB = {};

export const INIT_CERTIFIKATER = [
  { id: "c1", navn: "ADOS-2", beskrivelse: "Autisme diagnostisk observationsplan" },
  { id: "c2", navn: "ADI-R",  beskrivelse: "Autisme diagnostisk interview" },
  { id: "c3", navn: "AKS",    beskrivelse: "Akut krisesamtale" },
];

// ── Navigation ────────────────────────────────────────────────────
// label-feltet er en i18n-nøgle. Brug t(item.label) ved rendering.
export const NAV_ITEMS = [
  { id: "dashboard",    label: "nav.dashboard" },
  { id: "patienter",    label: "nav.patienter" },
  { id: "kalender",     label: "nav.kalender" },
  { id: "medarbejdere", label: "nav.medarbejdere" },
  { id: "lokaler",      label: "nav.lokaler" },
  { id: "forlob",       label: "nav.forlob" },
  { sep: true },
  { id: "planlog",      label: "nav.planlog" },
  { sep: true },
  { id: "admin",        label: "nav.admin", adminOnly: true },
  { id: "ejer",         label: "nav.ejer",  ejOnly: true },
];

// Kapacitetstyper
export const KAP_TYPER = [
  { id: "dag",     label: "Pr. dag" },
  { id: "uge",     label: "Pr. uge" },
  { id: "mdr",     label: "Pr. måned" },
  { id: "kvartal", label: "Pr. kvartal" },
  { id: "halvaar", label: "Pr. halvår" },
  { id: "år",      label: "Pr. år" },
  { id: "ialt",    label: "I alt (periode)" },
];

// ── Galleri af eksempel-forløb (kan importeres frivilligt af admin) ──
export const FORLOB_GALLERI = [
  {
    id: "psyk_udredning_barn",
    navn: "Psykiatrisk udredning – barn",
    beskrivelse: "Standardforløb for udredning af børn 6-12 år: anamnese, observation, test og diagnostisk konference.",
    opgaver: [
      { o: "Forældreanamnese",        m: 60, p: true,  tl: "08:00", ss: "16:00", s: 1, l: [], mm: ["Psykolog"] },
      { o: "Legeobservation",         m: 60, p: true,  tl: "09:00", ss: "15:00", s: 2, l: [], mm: ["Psykolog", "Pædagog"] },
      { o: "ADOS-2",                  m: 60, p: true,  tl: "08:00", ss: "16:00", s: 3, l: [], mm: ["Psykolog"] },
      { o: "Kognitiv test (WISC-V)",  m: 90, p: true,  tl: "09:00", ss: "15:00", s: 4, l: [], mm: ["Psykolog"] },
      { o: "Lægeundersøgelse",        m: 45, p: true,  tl: "08:00", ss: "16:00", s: 5, l: [], mm: ["Læge"] },
      { o: "Diagnostisk konference",  m: 60, p: false, tl: "08:00", ss: "16:00", s: 6, l: [], mm: ["Psykolog", "Læge"] },
      { o: "Tilbagemelding forældre", m: 60, p: true,  tl: "08:00", ss: "16:00", s: 7, l: [], mm: ["Psykolog"] },
    ],
  },
  {
    id: "almen_rutine",
    navn: "Almen praksis – rutinekonsultation",
    beskrivelse: "Kort konsultationsforløb til årligt tjek hos egen læge.",
    opgaver: [
      { o: "Forberedelse",  m: 10, p: false, tl: "08:00", ss: "16:00", s: 1, l: [], mm: ["Læge"] },
      { o: "Konsultation",  m: 20, p: true,  tl: "08:00", ss: "16:00", s: 2, l: [], mm: ["Læge"] },
      { o: "Journalføring", m: 10, p: false, tl: "08:00", ss: "16:00", s: 3, l: [], mm: ["Læge"] },
    ],
  },
  {
    id: "privat_psykolog",
    navn: "Privat psykologpraksis",
    beskrivelse: "Klassisk samtaleforløb: indledende samtale, behandlingsplan og 8 sessioner.",
    opgaver: [
      { o: "Indledende samtale",    m: 60, p: true,  tl: "08:00", ss: "17:00", s: 1,  l: [], mm: ["Psykolog"] },
      { o: "Behandlingsplan",       m: 30, p: false, tl: "08:00", ss: "17:00", s: 2,  l: [], mm: ["Psykolog"] },
      { o: "Session 1",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 3,  l: [], mm: ["Psykolog"] },
      { o: "Session 2",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 4,  l: [], mm: ["Psykolog"] },
      { o: "Session 3",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 5,  l: [], mm: ["Psykolog"] },
      { o: "Session 4",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 6,  l: [], mm: ["Psykolog"] },
      { o: "Session 5",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 7,  l: [], mm: ["Psykolog"] },
      { o: "Session 6",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 8,  l: [], mm: ["Psykolog"] },
      { o: "Session 7",             m: 50, p: true,  tl: "08:00", ss: "17:00", s: 9,  l: [], mm: ["Psykolog"] },
      { o: "Session 8 (afslutning)", m: 60, p: true, tl: "08:00", ss: "17:00", s: 10, l: [], mm: ["Psykolog"] },
    ],
  },
];

// ── Byg en patient fra rå række + forløbs-skabeloner + medarbejderliste ──
export function buildPatient(raw, forlobDict, medListe) {
  const dict = forlobDict || FORLOB;
  const medSrc = medListe || BASE_MED;
  const fl = dict[raw.forlobNr] || [];

  const getStamord = (navn) => {
    const m = navn.match(/^(.+?)\s{2}(Forberedelse|Patient|Efterbehandling)\s/);
    return m ? m[1].trim() : null;
  };
  const stamordCount = {};
  const grpMap = {};
  for (const f of fl) {
    const st = getStamord(f.o);
    if (!st) continue;
    if (!stamordCount[st]) stamordCount[st] = 0;
    grpMap[f.s] = `${raw.cpr}_${st}_${stamordCount[st]}`;
  }
  const stamordSeqs = {};
  for (const f of fl) {
    const st = getStamord(f.o);
    if (!st) continue;
    if (!stamordSeqs[st]) stamordSeqs[st] = [];
    stamordSeqs[st].push(f.s);
  }
  const finalGrpMap = {};
  let grpCounter = 0;
  for (const [, seqs] of Object.entries(stamordSeqs)) {
    const grpId = `${raw.cpr || "x"}_grp_${grpCounter++}`;
    for (const seq of seqs) finalGrpMap[seq] = grpId;
  }

  const opgaver = fl.map((f, j) => ({
    id: `${raw.cpr || uid()}_${j}`,
    sekvens: f.s, opgave: f.o, minutter: f.m, patInv: f.p,
    tidligst: f.tl, senest: f.ss,
    muligeLok: [...f.l],
    udstyr: Array.isArray(f.u) ? [...f.u] : [],
    muligeMed: (() => {
      if (f.mm && f.mm.length > 0) {
        const normTitel = (t) => (t === "Laege" ? "Læge" : t === "Paedagog" ? "Pædagog" : t);
        const byTitel = medSrc.filter((m) => f.mm.map(normTitel).includes(m.titel)).map((m) => m.navn);
        if (byTitel.length > 0) return byTitel;
      }
      const byKomp = medSrc.filter((m) => m.kompetencer.includes(f.o)).map((m) => m.navn);
      if (byKomp.length > 0) return byKomp;
      if (f.mm && f.mm.length > 0) {
        const byTitelNavn = medSrc.filter((m) => f.mm.some((t) => m.titel.toLowerCase().includes(t.toLowerCase()))).map((m) => m.navn);
        if (byTitelNavn.length > 0) return byTitelNavn;
        return f.mm;
      }
      return medSrc.length > 0 ? medSrc.map((m) => m.navn) : ["Psykolog", "Læge", "Pædagog"];
    })(),
    låst: false, status: "afventer",
    dato: null, startKl: null, slutKl: null,
    lokale: null, medarbejder: null, med1: null, med2: null,
    indsatsGruppe: finalGrpMap[f.s] || null,
  }));
  return {
    id: raw.id || `pat_${uid()}`,
    navn: raw.navn, cpr: raw.cpr,
    henvDato: raw.henvDato, forlobNr: Number(raw.forlobNr),
    forlobLabel: `Forløb nr. ${raw.forlobNr}`,
    status: raw.status || "aktiv", statusHistorik: raw.statusHistorik || [], opgaver, haste: raw.haste || false,
    patientNr: raw.patientNr || "",
    foraeldreCpr: raw.foraeldreCpr || "",
    foraeldreNavn: raw.foraeldreNavn || "",
    foraeldreTlf: raw.foraeldreTlf || "",
    foraeldreId: raw.foraeldreId || "",
    foraeldreEboks: raw.foraeldreEboks || "",
    foraeldreVej: raw.foraeldreVej || "",
    foraeldrePostnr: raw.foraeldrePostnr || "",
    foraeldreBy: raw.foraeldreBy || "",
    myndighedshaver: raw.myndighedshaver || false,
    ansvarligMed: raw.ansvarligMed || "",
    afdeling: raw.afdeling || "",
    tidStart: raw.tidStart || "08:00",
    tidSlut: raw.tidSlut || "17:00",
    adresser: raw.adresser || [],
  };
}
