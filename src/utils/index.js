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
