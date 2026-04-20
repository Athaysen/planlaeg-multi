// Eksport-helpers til KapacitetsView — isolerede fra komponent-laget
// så de kan testes direkte (og genbruges af fx e-Boks/mail-flow senere).
//
// Markdown-formatet er beregnet til ledelses-oplæg: H1 titel, tabeller,
// bulleted lister. CSV-formatet er den rå udnyttelses-tabel så tal kan
// lægges i et regneark for videre analyse.

import { valutaSymbol } from "../utils/index.js";

const csvEscape = (s) => {
  const str = String(s ?? "");
  if (/[",;\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export function eksporterMarkdown(resultat, { valuta = "DKK", t } = {}) {
  const tr = typeof t === "function" ? t : (k) => k;
  const { resume, flaskehalse, scenarier, udnyttelse } = resultat;
  const lines = [];

  lines.push(`# ${tr("kapacitet.title")}`);
  lines.push("");
  lines.push(`*${tr("kapacitet.slutDato")}: ${resume.slutDato}*`);
  lines.push("");

  // Resumé
  lines.push(`## ${tr("kapacitet.resumeTitle")}`);
  lines.push("");
  lines.push(`- **${tr("kapacitet.totalOpgaver")}**: ${resume.totalOpgaver}`);
  lines.push(`- **${tr("kapacitet.planlagteAfventer")}**: ${resume.planlagte} / ${resume.totalOpgaver}`);
  lines.push(`- **${tr("kapacitet.udnyttelse")}**: ${resume.udnyttelse}%`);
  lines.push(`- **${resume.kanLadesigGøre ? tr("kapacitet.kanPlanlaegges") : tr("kapacitet.kanIkkePlanlaegges")}**`);
  if (!resume.kanLadesigGøre) {
    lines.push("");
    lines.push(`> ⚠ ${tr("kapacitet.fejletBesked", { antal: resume.fejlet })}`);
  }
  lines.push("");

  // Flaskehalse
  if (flaskehalse && flaskehalse.length > 0) {
    lines.push(`## ${tr("kapacitet.flaskehalseTitle")}`);
    lines.push("");
    flaskehalse.forEach(f => {
      const pct = resume.totalOpgaver > 0 ? Math.round((f.delta / resume.totalOpgaver) * 100) : 0;
      lines.push(`### ${f.navn} (${tr(`kapacitet.type_${f.type}`)})${f.kritisk ? " — " + tr("kapacitet.kritisk") : ""}`);
      lines.push("");
      lines.push(tr("kapacitet.manglerOpgaver", { antal: f.delta, pct }));
      if (f.dagFordeling && f.dagFordeling.some(d => d.procent != null)) {
        lines.push("");
        lines.push(`**${tr("kapacitet.dagFordelingTitle")}**`);
        lines.push("");
        lines.push("| " + f.dagFordeling.map(d => d.dag).join(" | ") + " |");
        lines.push("|" + f.dagFordeling.map(() => "---").join("|") + "|");
        lines.push("| " + f.dagFordeling.map(d => d.procent != null ? d.procent + "%" : "—").join(" | ") + " |");
      }
      lines.push("");
    });
  }

  // Scenarier
  if (scenarier && scenarier.length > 0) {
    lines.push(`## ${tr("kapacitet.scenarierTitle")}`);
    lines.push("");
    lines.push(`*${tr("kapacitet.scenarierIntro")}*`);
    lines.push("");
    lines.push(`| # | ${tr("kapacitet.resultat")} | ${tr("kapacitet.maanedligOmkostning")} | ${tr("kapacitet.scenarierTitle")} |`);
    lines.push(`|---|---|---|---|`);
    scenarier.forEach((s, i) => {
      const omk = s.månedligOmkostning > 0
        ? `${s.månedligOmkostning.toLocaleString("da-DK")} ${valutaSymbol(valuta)}`
        : tr("kapacitet.ingenOmkostning");
      lines.push(`| ${i + 1} | ${s.nyUdnyttelse}% ${tr("kapacitet.planlagt")} | ${omk} | ${s.beskrivelse.replace(/\|/g, "\\|")} |`);
    });
    lines.push("");
  }

  // Udnyttelse
  if (udnyttelse && udnyttelse.length > 0) {
    lines.push(`## ${tr("kapacitet.udnyttelseTitle")}`);
    lines.push("");
    lines.push(`| ${tr("kapacitet.navn")} | ${tr("kapacitet.type")} | ${tr("kapacitet.kapacitet")} | ${tr("kapacitet.booket")} | ${tr("kapacitet.udnyttelseKol")} |`);
    lines.push("|---|---|---|---|---|");
    udnyttelse.forEach(u => {
      lines.push(`| ${u.navn} | ${tr(`kapacitet.type_${u.type}`)} | ${Math.round(u.kapacitet / 60)} t | ${Math.round(u.bookede / 60)} t | ${u.procent}% |`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

export function eksporterCSV(resultat, { t } = {}) {
  const tr = typeof t === "function" ? t : (k) => k;
  const rows = [];
  rows.push([
    tr("kapacitet.navn"),
    tr("kapacitet.type"),
    tr("kapacitet.kapacitet") + " (t)",
    tr("kapacitet.booket") + " (t)",
    tr("kapacitet.udnyttelseKol") + " (%)",
  ]);
  (resultat.udnyttelse || []).forEach(u => {
    rows.push([
      u.navn,
      tr(`kapacitet.type_${u.type}`),
      Math.round(u.kapacitet / 60),
      Math.round(u.bookede / 60),
      u.procent,
    ]);
  });
  return rows.map(r => r.map(csvEscape).join(";")).join("\n");
}
