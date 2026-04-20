// Audit-log-system.
//
// Implementerer strukturerede audit-entries oven på eksisterende aktivLog
// for at opfylde journalføringsbekendtgørelsens § 6-8 krav om sporbarhed
// af dataadgang (hvem, hvad, hvornår, hvorfor).
//
// ┌─────────────────────────────────────────────────────────────────┐
// │ APPEND-ONLY KONTRAKT                                            │
// ├─────────────────────────────────────────────────────────────────┤
// │ Audit-entries må ALDRIG slettes, ændres eller omordnes          │
// │ retroaktivt. Når denne modul får en backend-database bag sig,   │
// │ skal følgende håndhæves på databaselaget:                       │
// │                                                                 │
// │   REVOKE DELETE, UPDATE ON audit_log FROM role_user, role_admin;│
// │   -- kun INSERT tilladt via stored procedure insert_audit()     │
// │   -- retention: min. 5 år (journalføringsbekendtgørelsen § 8)   │
// │   -- dagligt off-site krypteret backup                          │
// │                                                                 │
// │ I client-laget (dette modul) følges samme princip: vi bruger    │
// │ KUN [...prev, entry] — aldrig splice/filter/pop. localStorage   │
// │ er ikke tamper-proof, men client-side respekt for append-only   │
// │ sikrer at bugs ikke kan korrumpere logfilen.                    │
// └─────────────────────────────────────────────────────────────────┘
//
// Eksempel brug:
//   const { audit } = useAudit();
//   audit("opslag", "patient", patient.id, { navn: patient.navn });
//   audit("ændring", "patient", patient.id, { felt: "status", før: "aktiv", efter: "udmeldt" });
//   audit("eksport", "patient", "bulk", { antal: 42, format: "csv" });

import React, { createContext, useContext, useCallback } from "react";

// Enum-værdier — brug kun disse for handling og objekttype.
export const HANDLINGER = ["opslag", "oprettelse", "ændring", "sletning", "eksport"];
export const OBJEKTTYPER = ["patient", "opgave", "medarbejder", "lokale", "forløb"];

// Dansk beskrivelse bruges til bagudkompatibelt "tekst"-felt på entry,
// så ældre AktivLogView stadig viser noget meningsfuldt.
const beskriv = (handling, objekttype, detaljer = {}) => {
  const navn = detaljer.navn ? ` "${detaljer.navn}"` : "";
  if (handling === "opslag") return `Opslag på ${objekttype}${navn}`;
  if (handling === "oprettelse") return `Oprettede ${objekttype}${navn}`;
  if (handling === "ændring") {
    const felt = detaljer.felt ? ` · felt: ${detaljer.felt}` : "";
    return `Ændrede ${objekttype}${navn}${felt}`;
  }
  if (handling === "sletning") return `Slettede ${objekttype}${navn}`;
  if (handling === "eksport") {
    const antal = detaljer.antal ? ` (${detaljer.antal} poster)` : "";
    const format = detaljer.format ? ` · format: ${detaljer.format}` : "";
    return `Eksport af ${objekttype}${antal}${format}`;
  }
  return `${handling} ${objekttype}`;
};

// Byg en entry — pure, testbar funktion. Kaldes internt af audit(),
// men er eksporteret så tests kan verificere struktur direkte.
export function byggEntry(handling, objekttype, objektId, detaljer, bruger) {
  const now = new Date();
  return {
    // Stabilt id (monotonisk stigende timestamp-prefix + random suffix)
    id: now.getTime() + "_" + Math.random().toString(36).slice(2, 8),
    // Tidsstempel
    dato: now.toISOString().slice(0, 10),
    tid: now.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    timestamp: now.getTime(),
    // Bruger-sporbarhed — journalføringsbekendtgørelsen § 6
    bruger: bruger?.navn || bruger?.email || "Ukendt",
    brugerId: bruger?.id || "",
    rolle: bruger?.rolle || "",
    afdeling: bruger?.afdeling || "",
    // Strukturerede audit-felter
    audit: true,
    handling,
    objekttype,
    objektId: String(objektId ?? ""),
    detaljer: detaljer || {},
    // Bagudkompat-felter — AktivLogView kan stadig vise ældre ikke-audit entries
    type: handling,
    tekst: beskriv(handling, objekttype, detaljer),
  };
}

const AuditContext = createContext(null);

// AuditProvider etablerer context-værdien én gang og genbruger den via
// useCallback — så audit()-referencen er stabil og kan bruges i useEffect
// dependency arrays uden at trigger re-logging.
export function AuditProvider({ children, authData, setAktivLog, maxEntries = 5000 }) {
  const audit = useCallback((handling, objekttype, objektId, detaljer = {}) => {
    if (!HANDLINGER.includes(handling)) {
      if (import.meta.env?.DEV) console.warn("audit(): ukendt handling", handling);
      return;
    }
    if (!OBJEKTTYPER.includes(objekttype)) {
      if (import.meta.env?.DEV) console.warn("audit(): ukendt objekttype", objekttype);
      return;
    }
    const entry = byggEntry(handling, objekttype, objektId, detaljer, authData);
    setAktivLog(prev => {
      // APPEND-ONLY: kun [...prev, entry]. Slicing fra starten beholder
      // de nyeste maxEntries — ældre entries flyttes til backend/eksport
      // (se README for retention-politik).
      const ny = [...prev, entry];
      const trimmet = ny.length > maxEntries ? ny.slice(-maxEntries) : ny;
      try { localStorage.setItem("planmed_aktivlog", JSON.stringify(trimmet)); } catch (e) { /* full storage — ignorer */ }
      return trimmet;
    });
  }, [authData, setAktivLog, maxEntries]);

  return React.createElement(AuditContext.Provider, { value: { audit } }, children);
}

// useAudit — hook til komponenter. Returnerer { audit } så kaldesiden
// ligner destructure-mønstret i andre hooks (useTranslation, etc).
// Fallback no-op hvis ikke wrapped (fx i unit-tests eller isolerede
// komponenter) — det er bedre end en crash.
export function useAudit() {
  const ctx = useContext(AuditContext);
  return ctx || { audit: () => {} };
}

// Filter-helper — genbruges i AktivLogView og i patient-journal-historik.
// Alle argumenter er valgfri; tomme filtre matcher alt.
export function filterAudit(entries, { handling, objekttype, bruger, datoFra, datoTil, patientId, fritekst } = {}) {
  const hit = (e) => {
    if (handling && handling !== "alle" && e.handling !== handling && e.type !== handling) return false;
    if (objekttype && objekttype !== "alle" && e.objekttype !== objekttype) return false;
    if (bruger && !(e.bruger || "").toLowerCase().includes(bruger.toLowerCase())) return false;
    if (datoFra && (e.dato || "") < datoFra) return false;
    if (datoTil && (e.dato || "") > datoTil) return false;
    if (patientId && !(e.objekttype === "patient" && e.objektId === String(patientId))) return false;
    if (fritekst) {
      const q = fritekst.toLowerCase();
      const hay = [
        e.tekst, e.bruger, e.rolle, e.afdeling, e.objekttype, e.handling, e.objektId,
        JSON.stringify(e.detaljer || {}),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  return entries.filter(hit);
}

// CSV-eksport — semikolon-separeret så dansk Excel åbner direkte.
// UTF-8 BOM (\uFEFF) skal tilføjes af callsiden ved download.
export function eksporterAuditCSV(entries) {
  const esc = (s) => {
    const str = String(s ?? "");
    return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = ["Dato", "Tid", "Bruger", "Rolle", "Afdeling", "Handling", "Objekttype", "Objekt-ID", "Detaljer", "Beskrivelse"];
  const rows = entries.map(e => [
    e.dato || "",
    e.tid || "",
    e.bruger || "",
    e.rolle || "",
    e.afdeling || "",
    e.handling || e.type || "",
    e.objekttype || "",
    e.objektId || "",
    e.detaljer ? JSON.stringify(e.detaljer) : "",
    e.tekst || "",
  ]);
  return [header, ...rows].map(r => r.map(esc).join(";")).join("\n");
}
