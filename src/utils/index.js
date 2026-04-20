// Pure utility functions — no React, no project-internal imports.

export const sx = (...args) => Object.assign({}, ...args.filter(Boolean));

export const uid = () => Math.random().toString(36).slice(2, 9);

export const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = (t + "").split(":").map(Number);
  return h * 60 + (m || 0);
};

export const fromMin = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const fmtDate = (d) => {
  try {
    if (!(d instanceof Date)) return d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch (e) {
    return "";
  }
};

// Timezone-sikker dato-parsing: konstruér Date med (år, måned, dag) = lokal midnat.
export const parseLocalDate = (ds) => {
  const [y, m, d] = String(ds).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (ds, n) => {
  const d = parseLocalDate(ds);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};

export const isWeekend = (ds) => {
  const day = parseLocalDate(ds).getDay();
  return day === 0 || day === 6;
};

export const nextWD = (ds) => {
  let d = ds;
  for (let i = 0; i < 10; i++) {
    if (!isWeekend(d)) return d;
    d = addDays(d, 1);
  }
  return d;
};

export const DAG_NAV = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
export const getDag = (ds) => DAG_NAV[parseLocalDate(ds).getDay()];

export const daysBetween = (a, b) =>
  Math.round((parseLocalDate(b) - parseLocalDate(a)) / 86400000);

export const today = () => fmtDate(new Date());

// Valuta-helpers + tabel over understøttede valutaer.
export const VALUTAER = {
  DKK: { symbol: "kr", locale: "da-DK", navn: "Dansk krone" },
  EUR: { symbol: "€", locale: "de-DE", navn: "Euro" },
  USD: { symbol: "$", locale: "en-US", navn: "US dollar" },
  SEK: { symbol: "kr", locale: "sv-SE", navn: "Svensk krone" },
  NOK: { symbol: "kr", locale: "nb-NO", navn: "Norsk krone" },
};
export const valutaInfo = (kode) => VALUTAER[kode] || VALUTAER.DKK;
export const valutaSymbol = (kode) => valutaInfo(kode).symbol;
// Format et beløb med locale + symbol. Returner "—" for nul/manglende beløb.
export const formatBeloeb = (beloeb, kode, suffix = "") => {
  if (beloeb == null || Number.isNaN(Number(beloeb))) return "—";
  const n = Number(beloeb);
  if (n === 0) return "—";
  const info = valutaInfo(kode);
  return `${Math.round(n).toLocaleString(info.locale)} ${info.symbol}${suffix}`;
};

// ── CPR-validering ──
// Dansk CPR: ddmmåå-xxxx (10 cifre). Returnerer:
//   gyldigtFormat — 10 cifre + gyldig fødselsdato kan udledes
//   modulus11Ok   — klassisk modulus-11-tjek (vægte 4,3,2,7,6,5,4,3,2,1)
//   dato          — parsed fødselsdato eller null
//   advarsel      — i18n-klar tekst, null hvis intet at rapportere
//
// Siden 2007 udstedes CPR-numre der IKKE er modulus-11-gyldige, så
// valideringen bruges som ADVARSEL — ikke hård fejl. Brugeren kan stadig
// gemme, men får en gul warning-box i UI'et.
//
// 7. ciffer + år-bucket bestemmer århundrede (jf. CPR-kontorets tabel):
//   7-ciffer 0-3 → 1900-1999
//   7-ciffer 4   → hvis år 00-36 så 2000-2036, ellers 1937-1999
//   7-ciffer 5-8 → hvis år 00-57 så 2000-2057, ellers 1858-1899
//   7-ciffer 9   → hvis år 00-36 så 2000-2036, ellers 1937-1999
const CPR_VAEGTE = [4, 3, 2, 7, 6, 5, 4, 3, 2, 1];

const cprUdledAarhundrede = (sevenDigit, aa) => {
  if (sevenDigit <= 3) return 1900;
  if (sevenDigit === 4 || sevenDigit === 9) return aa <= 36 ? 2000 : 1900;
  if (sevenDigit >= 5 && sevenDigit <= 8) return aa <= 57 ? 2000 : 1800;
  return 1900;
};

export const validerCPR = (cpr) => {
  const raw = (cpr == null ? "" : String(cpr)).replace(/[^0-9]/g, "");
  const result = { gyldigtFormat: false, modulus11Ok: false, dato: null, advarsel: null };

  if (raw.length === 0) {
    result.advarsel = "cpr.tom";
    return result;
  }
  if (raw.length !== 10) {
    result.advarsel = "cpr.forkertLaengde";
    return result;
  }

  const dd = Number(raw.slice(0, 2));
  const mm = Number(raw.slice(2, 4));
  const aa = Number(raw.slice(4, 6));
  const seventh = Number(raw[6]);
  const aarhundrede = cprUdledAarhundrede(seventh, aa);
  const fuldAar = aarhundrede + aa;
  const kandidat = new Date(fuldAar, mm - 1, dd);
  const datoGyldig =
    mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 &&
    kandidat.getFullYear() === fuldAar &&
    kandidat.getMonth() === mm - 1 &&
    kandidat.getDate() === dd;

  if (!datoGyldig) {
    result.advarsel = "cpr.ugyldigDato";
    return result;
  }

  result.gyldigtFormat = true;
  result.dato = kandidat;

  let sum = 0;
  for (let i = 0; i < 10; i++) sum += CPR_VAEGTE[i] * Number(raw[i]);
  result.modulus11Ok = sum % 11 === 0;

  // CPR-numre fra 2007+ kan være modulus-11-ugyldige by design (kontoret
  // opbrugte modulus-11-serien). Sæt derfor ingen advarsel for folk født
  // 2007 eller senere — for ældre CPR er modulus-11-miss mistænkelig.
  if (!result.modulus11Ok && fuldAar < 2007) {
    result.advarsel = "cpr.modulus11";
  }
  return result;
};
