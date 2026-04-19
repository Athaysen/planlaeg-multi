// Excel-/PDF-eksport-helpers. Genererer tekstbaserede CSV/PDF-filer via browser-download.
import { today } from "./index.js";
import { PAT_STATUS } from "../data/constants.js";

export function eksporterPatientlisteExcel(patienter){
  const rows=patienter.map(p=>({
    Navn:p.navn,
    CPR:p.cpr,
    "Pat.nr":p.patientNr||"",
    "Henvist dato":p.henvDato||"",
    Forløb:p.forlobLabel||"",
    Status:(PAT_STATUS[p.status]||PAT_STATUS.aktiv).label,
    "Opgaver i alt":p.opgaver.length,
    "Planlagt":p.opgaver.filter(o=>o.status==="planlagt").length,
    "Afventer":p.opgaver.filter(o=>o.status==="afventer").length,
    Afdeling:p.afdeling||"",
    "Ansvarlig":p.ansvarligMed||"",
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:22},{wch:14},{wch:10},{wch:14},{wch:14},{wch:12},{wch:14},{wch:10},{wch:10},{wch:20},{wch:20}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Patienter");
  XLSX.writeFile(wb,`Patientliste_${today()}.xlsx`);
}

export function eksporterMedarbejdereExcel(medarbejdere){
  const rows=medarbejdere.map(m=>({
    Navn:m.navn,
    Stilling:m.stilling||m.titel||"",
    Afdeling:m.afdeling||"",
    Mail:m.mail||m.email||"",
    "Timer/uge":m.timerPrUge||"",
    Certifikater:(m.certifikater||[]).join(", "),
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:22},{wch:20},{wch:20},{wch:28},{wch:10},{wch:30}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Medarbejdere");
  XLSX.writeFile(wb,`Medarbejdere_${today()}.xlsx`);
}

export function eksporterOpgaveplanExcel(pat){
  const rows=(pat.opgaver||[]).map(o=>({
    Opgave:o.titel||o.navn||o.opgave||"",
    Status:o.status==="planlagt"?"Planlagt":o.status==="afventer"?"Afventer":"Fejl",
    Dato:o.dato||"",
    "Start kl.":o.startKl||"",
    "Slut kl.":o.slutKl||"",
    Medarbejder:o.medarbejder||"",
    Lokale:o.lokale||"",
    Låst:o.låst?"Ja":"Nej",
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:30},{wch:12},{wch:12},{wch:10},{wch:10},{wch:22},{wch:18},{wch:8}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,pat.navn.slice(0,31));
  XLSX.writeFile(wb,`Opgaveplan_${pat.navn.replace(/\s+/g,"_")}_${today()}.xlsx`);
}

export function eksporterUgeplanExcel(patienter){
  // Samler alle planlagte opgaver med dato, grupperet på ugenummer
  const rows=patienter.flatMap(p=>
    p.opgaver.filter(o=>o.status==="planlagt"&&o.dato).map(o=>({
      Uge:getUge(o.dato),
      Dato:o.dato,
      "Start kl.":o.startKl||"",
      "Slut kl.":o.slutKl||"",
      Patient:p.navn,
      CPR:p.cpr,
      Opgave:o.titel||o.navn||o.opgave||"",
      Medarbejder:o.medarbejder||"",
      Lokale:o.lokale||"",
    }))
  ).sort((a,b)=>a.Dato.localeCompare(b.Dato));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:6},{wch:12},{wch:10},{wch:10},{wch:22},{wch:14},{wch:28},{wch:22},{wch:18}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Ugeplan");
  XLSX.writeFile(wb,`Ugeplan_${today()}.xlsx`);
}

export function getUge(datoStr){
  const d=new Date(datoStr);
  const jan4=new Date(d.getFullYear(),0,4);
  const start=new Date(jan4);
  start.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
  return Math.ceil(((d-start)/86400000+1)/7);
}

export function eksporterOpgaveplanPDF(pat){
  const lines=[];
  lines.push(`OPGAVEPLAN — ${pat.navn}`);
  lines.push(`CPR: ${pat.cpr}  |  ${pat.forlobLabel||""}  |  Status: ${(PAT_STATUS[pat.status]||PAT_STATUS.aktiv).label}`);
  lines.push(`Udskrevet: ${today()}`);
  lines.push("");
  lines.push("Opgave                           Dato        Tid         Medarbejder           Lokale        Status");
  lines.push("─".repeat(100));
  (pat.opgaver||[]).forEach(o=>{
    const navn=(o.titel||o.navn||o.opgave||"").padEnd(32).slice(0,32);
    const dato=(o.dato||"–").padEnd(11);
    const tid=o.startKl?(o.startKl+(o.slutKl?"–"+o.slutKl:"")).padEnd(11):"–".padEnd(11);
    const med=(o.medarbejder||"–").padEnd(21).slice(0,21);
    const lok=(o.lokale||"–").padEnd(13).slice(0,13);
    const st=o.status==="planlagt"?"Planlagt":o.status==="afventer"?"Afventer":"Fejl";
    lines.push(`${navn} ${dato} ${tid} ${med} ${lok} ${st}`);
  });
  lines.push("");
  lines.push(`Planlagt: ${pat.opgaver.filter(o=>o.status==="planlagt").length}  |  Afventer: ${pat.opgaver.filter(o=>o.status==="afventer").length}  |  I alt: ${pat.opgaver.length}`);
  genererTekstPDF(lines,`Opgaveplan_${pat.navn.replace(/\s+/g,"_")}_${today()}.html`);
}

export function eksporterUgeplanPDF(patienter){
  const planlagt=patienter.flatMap(p=>
    p.opgaver.filter(o=>o.status==="planlagt"&&o.dato).map(o=>({...o,pNavn:p.navn,pCpr:p.cpr}))
  ).sort((a,b)=>a.dato.localeCompare(b.dato));

  // Grupper på uge
  const uger={};
  planlagt.forEach(o=>{
    const uge=getUge(o.dato);
    if(!uger[uge]) uger[uge]=[];
    uger[uge].push(o);
  });

  const lines=[];
  lines.push("UGEPLAN — ALLE PATIENTER");
  lines.push(`Udskrevet: ${today()}`);
  lines.push("");

  Object.entries(uger).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([uge,ops])=>{
    lines.push(`UGE ${uge}`);
    lines.push("─".repeat(90));
    ops.forEach(o=>{
      const dato=o.dato.padEnd(12);
      const tid=o.startKl?(o.startKl+(o.slutKl?"–"+o.slutKl:"")).padEnd(12):"".padEnd(12);
      const patient=o.pNavn.padEnd(22).slice(0,22);
      const opgave=(o.titel||o.navn||o.opgave||"").padEnd(28).slice(0,28);
      const med=(o.medarbejder||"–").padEnd(20).slice(0,20);
      lines.push(`  ${dato} ${tid} ${patient} ${opgave} ${med}`);
    });
    lines.push("");
  });
  genererTekstPDF(lines,`Ugeplan_${today()}.html`);
}

export function genererTekstPDF(lines, filnavn){
  // Genererer HTML-fil der printer som PDF
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filnavn}</title>
<style>
  body{font-family:"Courier New",monospace;font-size:11px;line-height:1.5;padding:20mm;color:#111}
  @page{size:A4 landscape;margin:15mm}
  @media print{body{padding:0}}
  h1{font-size:14px;margin-bottom:4px}
  pre{white-space:pre-wrap;word-break:break-all}
</style>
<script>window.onload=()=>{window.print();}<\/script>
</head><body><pre>${lines.map(l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")).join("\n")}</pre></body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filnavn;
  a.click();
  URL.revokeObjectURL(a.href);
}
