// Kapacitetsanalyse-visning.
// UI-laget oven på analyserKapacitet() — bruger selv scroller analysen
// via dato-input + afdelings-filter. Mens motoren arbejder vises en
// spinner (analysen kan tage flere sekunder ved store datasæt, fordi
// den kører runPlanner flere gange for hypotese-simulering).
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { today, addDays, valutaSymbol } from "../utils/index.js";
import { C } from "../data/constants.js";
import { Btn, FRow, Input, ViewHeader, Pill, ErrorBoundary } from "../components/primitives.jsx";
import { analyserKapacitet } from "../planner/kapacitetsAnalyse.js";
import { eksporterMarkdown, eksporterCSV } from "./kapacitetsEksport.js";

// Udregn dato ud fra "om X uger" — bruges når brugeren indtaster ugetal.
const datoOmXUger = (x) => addDays(today(), Math.max(1, Math.min(52, Number(x) || 4)) * 7);

// Trigger download af en tekst-fil med givet indhold + filnavn.
const triggerDownload = (tekst, filnavn, mime) => {
  const blob = new Blob(["\uFEFF" + tekst], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filnavn; a.click();
  URL.revokeObjectURL(url);
};

export default function KapacitetsView({ patienter = [], medarbejdere = [], lokaler = [], lokTider = {}, lokMeta = {}, adminData = {}, config = {} }) {
  const { t, i18n } = useTranslation();
  const valuta = config?.valuta || "DKK";

  // ── Input-state ──
  const [mode, setMode] = useState("uger");        // "uger" | "dato"
  const [antalUger, setAntalUger] = useState(4);
  const [slutDato, setSlutDato] = useState(addDays(today(), 28));
  const [afdelinger, setAfdelinger] = useState([]); // tomt = alle
  const [maxTimer, setMaxTimer] = useState("");

  // ── Analyse-state ──
  const [resultat, setResultat] = useState(null);
  const [arbejder, setArbejder] = useState(false);
  const [fejl, setFejl] = useState("");

  // Afdelinger fra adminData + fallback til unikke på patienter/medarbejdere
  const alleAfdelinger = useMemo(() => {
    const fraAdmin = (adminData?.selskaber?.[0]?.afdelinger || [])
      .filter(a => !a.children || a.children.length === 0);
    if (fraAdmin.length > 0) return fraAdmin.map(a => ({ id: a.id, navn: a.navn }));
    const s = new Set();
    patienter.forEach(p => p.afdeling && s.add(p.afdeling));
    medarbejdere.forEach(m => m.afdeling && s.add(m.afdeling));
    return [...s].map(id => ({ id, navn: id }));
  }, [adminData, patienter, medarbejdere]);

  const toggleAfdeling = (id) => setAfdelinger(a =>
    a.includes(id) ? a.filter(x => x !== id) : [...a, id]
  );

  const effektivSlutDato = mode === "uger" ? datoOmXUger(antalUger) : slutDato;

  const køranalyse = () => {
    setArbejder(true); setFejl(""); setResultat(null);
    // Giv React tid til at male spinner-state før vi blokerer event-loopet.
    setTimeout(() => {
      try {
        const r = analyserKapacitet(patienter, medarbejdere, lokaler, lokTider, {
          slutDato: effektivSlutDato,
          afdelinger,
          maxUgeTimerOverride: maxTimer ? Number(maxTimer) : null,
          titlerCfg: adminData?.titler,
          taktDefaults: adminData?.taktDefaults,
          lokMeta,
          plannerConfig: {
            pause: config?.pause,
            minGapDays: config?.minGapDays,
            step: config?.step,
            maxDageForlob: config?.maxDageForlob,
            cooldownDage: config?.cooldownDage,
            patInvMinDage: config?.patInvMinDage,
            deadlineMode: config?.deadlineMode,
            prioritering: config?.prioritering,
          },
        });
        setResultat(r);
      } catch (e) {
        setFejl(e.message || String(e));
      } finally {
        setArbejder(false);
      }
    }, 30);
  };

  return (
    <div>
      <ViewHeader
        titel={t("kapacitet.title")}
        undertitel={t("kapacitet.subtitle")}
      />

      <ErrorBoundary>
        <InputPanel
          t={t} mode={mode} setMode={setMode}
          antalUger={antalUger} setAntalUger={setAntalUger}
          slutDato={slutDato} setSlutDato={setSlutDato}
          afdelinger={afdelinger} toggleAfdeling={toggleAfdeling} alleAfdelinger={alleAfdelinger}
          maxTimer={maxTimer} setMaxTimer={setMaxTimer}
          effektivSlutDato={effektivSlutDato}
          arbejder={arbejder} onKør={køranalyse}
        />

        {fejl && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.redM, border: "1px solid " + C.red, borderRadius: 8, color: C.red, fontSize: 12 }}>
            {fejl}
          </div>
        )}

        {arbejder && (
          <div style={{ marginTop: 24, textAlign: "center", color: C.txtM, fontSize: 13 }}>
            {t("kapacitet.working")}
          </div>
        )}

        {resultat && !arbejder && (
          <>
            <EksportBar t={t} resultat={resultat} valuta={valuta} />
            <ResumeKort t={t} resume={resultat.resume} />
            <FlaskehalseSektion t={t} flaskehalse={resultat.flaskehalse} total={resultat.resume.totalOpgaver} />
            <ScenarieSektion t={t} scenarier={resultat.scenarier} valuta={valuta} lang={i18n.language} />
            <UdnyttelseTabel t={t} udnyttelse={resultat.udnyttelse} />
          </>
        )}
      </ErrorBoundary>
    </div>
  );
}

// ── INPUT-PANEL ──
function InputPanel({ t, mode, setMode, antalUger, setAntalUger, slutDato, setSlutDato, afdelinger, toggleAfdeling, alleAfdelinger, maxTimer, setMaxTimer, effektivSlutDato, arbejder, onKør }) {
  return (
    <div style={{ background: C.s2, border: `1px solid ${C.brd}`, borderRadius: 12, padding: "18px 20px", marginTop: 16 }}>
      <div style={{ color: C.txt, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{t("kapacitet.inputTitle")}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <FRow label={t("kapacitet.periode")}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button onClick={() => setMode("uger")} style={{
              background: mode === "uger" ? C.acc : "transparent", color: mode === "uger" ? "#fff" : C.txtM,
              border: `1px solid ${mode === "uger" ? C.acc : C.brd}`, borderRadius: 6, padding: "4px 10px",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: mode === "uger" ? 700 : 400,
            }}>{t("kapacitet.modeUger")}</button>
            <button onClick={() => setMode("dato")} style={{
              background: mode === "dato" ? C.acc : "transparent", color: mode === "dato" ? "#fff" : C.txtM,
              border: `1px solid ${mode === "dato" ? C.acc : C.brd}`, borderRadius: 6, padding: "4px 10px",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: mode === "dato" ? 700 : 400,
            }}>{t("kapacitet.modeDato")}</button>
          </div>
          {mode === "uger" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input type="number" min="1" max="52" value={antalUger} onChange={v => setAntalUger(v)} style={{ width: 90 }} />
              <span style={{ color: C.txtM, fontSize: 12 }}>{t("kapacitet.uger")}</span>
              <span style={{ color: C.txtM, fontSize: 11, marginLeft: 6 }}>→ {effektivSlutDato}</span>
            </div>
          ) : (
            <Input type="date" value={slutDato} onChange={v => setSlutDato(v)} />
          )}
        </FRow>

        <FRow label={t("kapacitet.maxTimerLabel")} hint={t("kapacitet.maxTimerHint")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input type="number" min="1" max="60" value={maxTimer} onChange={v => setMaxTimer(v)} placeholder={t("kapacitet.brugStandard")} style={{ width: 110 }} />
            <span style={{ color: C.txtM, fontSize: 12 }}>{t("kapacitet.tPrUge")}</span>
          </div>
        </FRow>
      </div>

      {alleAfdelinger.length > 0 && (
        <FRow label={t("kapacitet.afdelinger")} hint={t("kapacitet.afdelingerHint")}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {alleAfdelinger.map(a => {
              const aktiv = afdelinger.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleAfdeling(a.id)} style={{
                  background: aktiv ? C.accM : "transparent",
                  color: aktiv ? C.acc : C.txtD,
                  border: `1px solid ${aktiv ? C.acc : C.brd}`,
                  borderRadius: 16, padding: "3px 12px", fontSize: 11,
                  cursor: "pointer", fontFamily: "inherit",
                  fontWeight: aktiv ? 700 : 400,
                }}>
                  {aktiv ? "✓ " : ""}{a.navn}
                </button>
              );
            })}
          </div>
        </FRow>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Btn v="primary" onClick={onKør} disabled={arbejder}>
          {arbejder ? t("kapacitet.arbejder") : t("kapacitet.analyserKnap")}
        </Btn>
      </div>
    </div>
  );
}

// ── EKSPORT-BAR ──
// To knapper: Markdown (ledelses-oplæg) + CSV (regneark).
// Filnavn stempel bruger YYYY-MM-DD så ældre eksporter kan sorteres.
function EksportBar({ t, resultat, valuta }) {
  const stempel = today();
  const mdKlik = () => {
    const md = eksporterMarkdown(resultat, { valuta, t });
    triggerDownload(md, `kapacitetsanalyse_${stempel}.md`, "text/markdown");
  };
  const csvKlik = () => {
    const csv = eksporterCSV(resultat, { t });
    triggerDownload(csv, `kapacitetsanalyse_${stempel}.csv`, "text/csv");
  };
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, marginBottom: -4 }}>
      <Btn v="outline" small onClick={mdKlik}>{t("kapacitet.eksportMarkdown")}</Btn>
      <Btn v="outline" small onClick={csvKlik}>{t("kapacitet.eksportCSV")}</Btn>
    </div>
  );
}

// ── SEKTION 1: RESUMÉ ──
function ResumeKort({ t, resume }) {
  const ok = resume.kanLadesigGøre;
  return (
    <div style={{
      marginTop: 16, background: C.s1, border: `1.5px solid ${ok ? C.grn : C.amb}`,
      borderRadius: 12, padding: "18px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.txt }}>
          {t("kapacitet.resumeTitle")}
        </div>
        <Pill color={ok ? C.grn : C.amb} bg={ok ? C.grnM : C.ambM}>
          {ok ? t("kapacitet.kanPlanlaegges") : t("kapacitet.kanIkkePlanlaegges")}
        </Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatKort label={t("kapacitet.slutDato")} værdi={resume.slutDato} />
        <StatKort label={t("kapacitet.totalOpgaver")} værdi={resume.totalOpgaver} />
        <StatKort label={t("kapacitet.planlagteAfventer")} værdi={`${resume.planlagte} / ${resume.totalOpgaver}`} />
        <StatKort label={t("kapacitet.udnyttelse")} værdi={`${resume.udnyttelse}%`} farve={resume.udnyttelse >= 90 ? C.amb : resume.udnyttelse >= 60 ? C.grn : C.txtM} />
      </div>
      {!ok && (
        <div style={{ marginTop: 14, padding: "9px 12px", background: C.ambM, border: `1px solid ${C.amb}`, borderRadius: 8, fontSize: 12, color: C.amb, lineHeight: 1.5 }}>
          ⚠ {t("kapacitet.fejletBesked", { antal: resume.fejlet })}
        </div>
      )}
    </div>
  );
}

function StatKort({ label, værdi, farve }) {
  return (
    <div style={{ background: C.s3, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.brd}` }}>
      <div style={{ color: C.txtM, fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div style={{ color: farve || C.txt, fontWeight: 800, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{værdi}</div>
    </div>
  );
}

// ── SEKTION 2: FLASKEHALSE ──
function FlaskehalseSektion({ t, flaskehalse, total }) {
  if (!flaskehalse || flaskehalse.length === 0) return null;
  const ikonFor = (type) => type === "medarbejder" ? "👤" : type === "lokale" ? "🏠" : "🔧";
  return (
    <div style={{ marginTop: 16, background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 12, padding: "18px 22px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, marginBottom: 4 }}>
        {t("kapacitet.flaskehalseTitle")}
      </div>
      <div style={{ color: C.txtM, fontSize: 12, marginBottom: 14 }}>
        {t("kapacitet.flaskehalseIntro")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flaskehalse.map((f, i) => {
          const pct = total > 0 ? Math.round((f.delta / total) * 100) : 0;
          return (
            <div key={`${f.type}-${f.navn}-${i}`} style={{
              background: f.kritisk ? C.redM : C.s3,
              border: `1px solid ${f.kritisk ? C.red : C.brd}`,
              borderRadius: 9, padding: "11px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 22 }}>{ikonFor(f.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, marginBottom: 2 }}>
                    {f.navn} <span style={{ color: C.txtM, fontWeight: 400, fontSize: 11 }}>({t(`kapacitet.type_${f.type}`)})</span>
                  </div>
                  <div style={{ color: C.txtM, fontSize: 12 }}>
                    {t("kapacitet.manglerOpgaver", { antal: f.delta, pct })}
                  </div>
                </div>
                {f.kritisk && <Pill color={C.red} bg={C.redM} sm>{t("kapacitet.kritisk")}</Pill>}
              </div>
              {f.dagFordeling && <DagFordelingBar t={t} fordeling={f.dagFordeling} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Per-ugedag udnyttelse under en flaskehals. Hjælper brugeren se at
// "tirsdage er 95% booket" når samlet udnyttelse skjuler asymmetri.
function DagFordelingBar({ t, fordeling }) {
  const nogenProcent = fordeling.some(d => d.procent != null);
  if (!nogenProcent) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.brd}` }}>
      <div style={{ fontSize: 10, color: C.txtM, fontWeight: 600, marginBottom: 4 }}>
        {t("kapacitet.dagFordelingTitle")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {fordeling.map(d => {
          const p = d.procent;
          const farve = p == null ? "#d1d5db" : p >= 95 ? "#dc2626" : p >= 80 ? "#f59e0b" : p >= 50 ? "#65a30d" : "#9ca3af";
          return (
            <div key={d.dag} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.txtM, marginBottom: 2 }}>{d.dag.slice(0, 3)}</div>
              <div style={{ height: 4, borderRadius: 2, background: C.brd, overflow: "hidden", marginBottom: 2 }}>
                <div style={{ width: (p != null ? Math.min(100, p) : 0) + "%", height: "100%", background: farve }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: farve }}>
                {p != null ? p + "%" : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SEKTION 3: SCENARIER ──
function ScenarieSektion({ t, scenarier, valuta, lang }) {
  if (!scenarier || scenarier.length === 0) return null;
  return (
    <div style={{ marginTop: 16, background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 12, padding: "18px 22px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, marginBottom: 4 }}>
        {t("kapacitet.scenarierTitle")}
      </div>
      <div style={{ color: C.txtM, fontSize: 12, marginBottom: 14 }}>
        {t("kapacitet.scenarierIntro")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {scenarier.map((s, i) => (
          <div key={s.id} style={{
            background: C.s3, border: `1.5px solid ${i === 0 ? C.grn : C.brd}`,
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Pill color={i === 0 ? C.grn : C.txtM} bg={i === 0 ? C.grnM : "transparent"} sm>
                #{i + 1} {i === 0 ? t("kapacitet.billigst") : ""}
              </Pill>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, marginBottom: 10, lineHeight: 1.4 }}>
              {s.beskrivelse}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.txtM, marginBottom: 3 }}>
                <span>{t("kapacitet.resultat")}</span>
                <span style={{ fontWeight: 700, color: s.nyUdnyttelse >= 100 ? C.grn : s.nyUdnyttelse >= 90 ? C.amb : C.red }}>
                  {s.nyUdnyttelse}% {t("kapacitet.planlagt")}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: C.brd, overflow: "hidden" }}>
                <div style={{
                  width: Math.min(100, s.nyUdnyttelse) + "%", height: "100%",
                  background: s.nyUdnyttelse >= 100 ? C.grn : s.nyUdnyttelse >= 90 ? C.amb : C.red,
                  transition: "width .3s",
                }} />
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.brd}`, paddingTop: 8, fontSize: 11, color: C.txtM }}>
              {s.månedligOmkostning > 0 ? (
                <>
                  <span>{t("kapacitet.maanedligOmkostning")}: </span>
                  <span style={{ color: C.txt, fontWeight: 700 }}>
                    {s.månedligOmkostning.toLocaleString(lang === "en" ? "en-US" : "da-DK")} {valutaSymbol(valuta)}
                  </span>
                </>
              ) : (
                <span style={{ color: C.grn, fontWeight: 600 }}>{t("kapacitet.ingenOmkostning")}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SEKTION 4: RESSOURCE-UDNYTTELSE ──
function UdnyttelseTabel({ t, udnyttelse }) {
  if (!udnyttelse || udnyttelse.length === 0) return null;
  return (
    <div style={{ marginTop: 16, background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, marginBottom: 14 }}>
        {t("kapacitet.udnyttelseTitle")}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.s2 }}>
            <th style={{ textAlign: "left", padding: "6px 10px", color: C.txtM, borderBottom: `1px solid ${C.brd}`, fontWeight: 600 }}>{t("kapacitet.navn")}</th>
            <th style={{ textAlign: "left", padding: "6px 10px", color: C.txtM, borderBottom: `1px solid ${C.brd}`, fontWeight: 600 }}>{t("kapacitet.type")}</th>
            <th style={{ textAlign: "right", padding: "6px 10px", color: C.txtM, borderBottom: `1px solid ${C.brd}`, fontWeight: 600 }}>{t("kapacitet.kapacitet")}</th>
            <th style={{ textAlign: "right", padding: "6px 10px", color: C.txtM, borderBottom: `1px solid ${C.brd}`, fontWeight: 600 }}>{t("kapacitet.booket")}</th>
            <th style={{ textAlign: "left", padding: "6px 10px", color: C.txtM, borderBottom: `1px solid ${C.brd}`, fontWeight: 600, width: 180 }}>{t("kapacitet.udnyttelseKol")}</th>
          </tr>
        </thead>
        <tbody>
          {udnyttelse.map((u, i) => (
            <tr key={`${u.type}-${u.navn}-${i}`} style={{ borderBottom: `1px solid ${C.brd}` }}>
              <td style={{ padding: "6px 10px", color: C.txt, fontWeight: 500 }}>{u.navn}</td>
              <td style={{ padding: "6px 10px", color: C.txtM }}>{t(`kapacitet.type_${u.type}`)}</td>
              <td style={{ padding: "6px 10px", color: C.txtM, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(u.kapacitet / 60)} t
              </td>
              <td style={{ padding: "6px 10px", color: C.txt, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(u.bookede / 60)} t
              </td>
              <td style={{ padding: "6px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.brd, overflow: "hidden" }}>
                    <div style={{
                      width: Math.min(100, u.procent) + "%", height: "100%",
                      background: u.farve, transition: "width .3s",
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: u.farve, minWidth: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {u.procent}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
