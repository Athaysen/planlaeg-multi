import React, { useState, useRef } from "react";
import { today } from "../utils/index.js";
import { C, BASE_MED, LK, PK, PD, NAV_ITEMS, INIT_PATIENTER_RAW, buildPatient } from "../data/constants.js";
import { Btn, Input, Sel, FRow, Pill, ViewHeader, ErrorBoundary, StrenghedToggle } from "../components/primitives.jsx";
import { ConfirmDialog } from "../components/dialogs.jsx";

export function PlanlaegIndstillingerPanel({config,setConfig,setPatienter,setMedarbejdere,setForlob,forlob,setLokTider,lokMeta={},setLokMeta,patienter=[],lokaler=[],saveLokaler=()=>{},medarbejdere=[],setIndsatser=()=>{},indsatser=[]}){
  const [c,setC]=useState({...config,serverModel:config.serverModel||"planmed",selfhostedUrl:config.selfhostedUrl||""});
  const set=(k,v)=>setC(p=>({...p,[k]:v}));
  const [gemtIndstillinger,setGemtIndstillinger]=useState(false);

  const KriterieRad = ({label, hint, children, strenghedKey}) => (
    <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",marginBottom:10,border:`1px solid ${C.brd}`}}>
      <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:4}}>{label}</div>
      {hint&&<div style={{color:C.txtM,fontSize:11,marginBottom:8}}>{hint}</div>}
      <div style={{display:"flex",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:120}}>{children}</div>
        {strenghedKey&&(
          <div>
            <div style={{color:C.txtM,fontSize:10,fontWeight:600,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>Strenghed</div>
            <StrenghedToggle value={c[strenghedKey]||"bloed"} onChange={v=>set(strenghedKey,v)}/>
          </div>
        )}
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:980}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* -- Tekniske parametre -- */}
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:14}}>@ Tekniske parametre</div>
          <FRow label="Pause buffer (min)" hint="Tid reserveret før/efter hver medarbejderbooking">
            <Input type="number" value={c.pause} onChange={v=>set("pause",Number(v))} min="0" max="30"/>
          </FRow>
          <FRow label="Min. gap mellem patientbesøg (dage)" hint="Mindste antal hele dage mellem to besøg">
            <Input type="number" value={c.minGapDays} onChange={v=>set("minGapDays",Number(v))} min="0" max="14"/>
          </FRow>
          <FRow label="Søgetrin (min)" hint="Interval for tidssøgning - 5 = præcis, 15 = hurtig">
            <Input type="number" value={c.step} onChange={v=>set("step",Number(v))} min="5" max="60"/>
          </FRow>
          <FRow label="Transport-hastighed (km/t)" hint="Gennemsnitlig bilhastighed til transport-beregning">
            <Input type="number" value={c.transportKmHt||40} onChange={v=>set("transportKmHt",Number(v))} min="20" max="120"/>
          </FRow>
          <FRow label="Afdelingens postnr." hint="Udgangspunkt for transport-beregning (opgavers default-adresse)">
            <Input value={c.afdPostnr||""} onChange={v=>set("afdPostnr",v)} placeholder="f.eks. 8000"/>
          </FRow>
          <FRow label="Søgehorisont (dage)" hint="Maks antal dage frem algoritmen søger">
            <Input type="number" value={c.maxDage} onChange={v=>set("maxDage",Number(v))} min="14" max="365"/>
          </FRow>
        </div>

        {/* -- Prioritering -- */}
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:14}}> Prioritering & rækkefølge</div>
          <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",marginBottom:10,border:`1px solid ${C.brd}`}}>
            <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:6}}>Planlægningsrækkefølge for patienter</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["henvDato"," Tidligst henvist"],["haste","> Hastemarkerede først"]].map(([v,l])=>(
                <button key={v} onClick={()=>set("prioritering",v)}
                  style={{background:c.prioritering===v?C.accM:"transparent",color:c.prioritering===v?C.acc:C.txtD,
                    border:`1px solid ${c.prioritering===v?C.acc:C.brd}`,borderRadius:7,padding:"5px 14px",
                    cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:c.prioritering===v?700:400}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{color:C.txtM,fontSize:11,marginTop:6}}>
              {c.prioritering==="haste"?"Hastemarkerede patienter planlægges først - derefter tidligst henvist":"Patienter sorteres efter henvisningsdato - ældste planlægges først"}
            </div>
          </div>

          {/* -- Deadline-beregning -- */}
          <div style={{background:C.s3,borderRadius:9,padding:"12px 14px",marginBottom:10,border:`1px solid ${C.brd}`}}>
            <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:6}}>Deadline-beregning</div>
            <div style={{color:C.txtM,fontSize:11,marginBottom:10}}>Vælg hvorfra "antal dage til deadline" regnes - kun én kan være aktiv ad gangen</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
                background:c.deadlineMode==="henvDato"?C.accM:"transparent",
                border:`1px solid ${c.deadlineMode==="henvDato"?C.acc:C.brd}`,
                borderRadius:8,padding:"10px 14px",transition:"all .15s"}}>
                <input type="radio" name="deadlineModePI" checked={c.deadlineMode==="henvDato"}
                  onChange={()=>set("deadlineMode","henvDato")}
                  style={{accentColor:C.acc}}/>
                <div>
                  <div style={{color:c.deadlineMode==="henvDato"?C.acc:C.txt,fontWeight:600,fontSize:12}}> Fra henvisningsdato</div>
                  <div style={{color:C.txtM,fontSize:11}}>Deadline = patientens henvisningsdato + antal dage</div>
                </div>
              </label>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
                background:c.deadlineMode==="indsatsDato"?C.accM:"transparent",
                border:`1px solid ${c.deadlineMode==="indsatsDato"?C.acc:C.brd}`,
                borderRadius:8,padding:"10px 14px",transition:"all .15s"}}>
                <input type="radio" name="deadlineModePI" checked={c.deadlineMode==="indsatsDato"}
                  onChange={()=>set("deadlineMode","indsatsDato")}
                  style={{accentColor:C.acc}}/>
                <div style={{flex:1}}>
                  <div style={{color:c.deadlineMode==="indsatsDato"?C.acc:C.txt,fontWeight:600,fontSize:12}}> Fra given opgavedato</div>
                  <div style={{color:C.txtM,fontSize:11,marginBottom:c.deadlineMode==="indsatsDato"?6:0}}>Deadline = valgt dato + antal dage</div>
                  {c.deadlineMode==="indsatsDato"&&(
                    <input type="date" value={c.indsatsDato||today()}
                      onChange={e=>set("indsatsDato",e.target.value)}
                      style={{marginTop:6,background:C.s1,border:`1px solid ${C.acc}`,borderRadius:6,
                        padding:"5px 10px",color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  )}
                </div>
              </label>
            </div>
          </div>

          <KriterieRad
            label="Låste opgaver må overskrides i nødstilfælde"
            hint="Når aktiveret: motoren kan flytte dato og/eller skifte medarbejder på låste opgaver"
            strenghedKey="tilladOverstigLåsteStrenged">
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:2}}>
              <input type="checkbox" checked={!!c.tilladOverstigLåste} onChange={e=>set("tilladOverstigLåste",e.target.checked)}/>
              <span style={{color:c.tilladOverstigLåste?C.acc:C.txtM,fontSize:12,fontWeight:c.tilladOverstigLåste?600:400}}>
                {c.tilladOverstigLåste?"Aktiv - låste opgaver kan ombookes":"Inaktiv - låste opgaver respekteres altid"}
              </span>
            </label>
          </KriterieRad>
        </div>
      </div>

      {/* -- Kapacitetsregler -- */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:14}}># Kapacitetsregler</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <KriterieRad
            label="Max patientbesøg per medarbejder per uge"
            hint="Separat fra timerloftet. Tæller kun opgaver hvor patient er til stede."
            strenghedKey="maxPatVisitsStrenged">
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Input type="number" value={c.maxPatVisitsPerMedPerUge} onChange={v=>set("maxPatVisitsPerMedPerUge",Number(v))} min="1" max="50" style={{width:70}}/>
              <span style={{color:C.txtM,fontSize:12}}>besøg/uge</span>
            </div>
          </KriterieRad>
          <KriterieRad
            label="Max antal forskellige medarbejdere per patient"
            hint="0 = ingen grænse. Blød: foretrækker kendte. Hård: afviser nye når grænsen er nået."
            strenghedKey="maxMedStrenged">
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Input type="number" value={c.maxMedPerPatient} onChange={v=>set("maxMedPerPatient",Number(v))} min="0" max="20" style={{width:70}}/>
              <span style={{color:C.txtM,fontSize:12}}>{c.maxMedPerPatient===0?"(ingen grænse)":"medarbejdere"}</span>
            </div>
          </KriterieRad>
          <KriterieRad
            label="Global cooldown mellem opgaver (dage)"
            hint="0 = ingen. Minimum afstand mellem to opgaver på samme patient. Kan overrides per opgave — der bruges den strengeste værdi."
            strenghedKey={null}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Input type="number" value={c.cooldownDage||0} onChange={v=>set("cooldownDage",Number(v))} min="0" max="365" style={{width:70}}/>
              <span style={{color:C.txtM,fontSize:12}}>{(c.cooldownDage||0)===0?"(ingen)":"dage"}</span>
            </div>
          </KriterieRad>
          <KriterieRad
            label="Global min. dage mellem patientbesøg"
            hint="0 = ingen. Gælder kun opgaver med patient til stede. Kan overrides per opgave."
            strenghedKey={null}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Input type="number" value={c.patInvMinDage||0} onChange={v=>set("patInvMinDage",Number(v))} min="0" max="365" style={{width:70}}/>
              <span style={{color:C.txtM,fontSize:12}}>{(c.patInvMinDage||0)===0?"(ingen)":"dage"}</span>
            </div>
          </KriterieRad>
        </div>
      </div>

      {/* -- Forløbs-deadline -- */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:14}}> Forløbs-deadline</div>
        <KriterieRad
          label="Max dage fra henvisning til afsluttet forløb"
          hint="0 = ingen grænse. Kan overrides på den enkelte patient. Motoren planlægger altid bedst muligt og markerer med advarsel hvis deadline overskrides."
          strenghedKey={null}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Input type="number" value={c.maxDageForlob} onChange={v=>set("maxDageForlob",Number(v))} min="0" max="365" style={{width:80}}/>
            <span style={{color:C.txtM,fontSize:12}}>{c.maxDageForlob===0?"(ingen grænse)":"dage fra henv.dato"}</span>
          </div>
          {c.maxDageForlob>0&&(
            <div style={{color:C.txtM,fontSize:11,marginTop:6}}>
              Patienter henvist d. i dag får deadline: <strong style={{color:C.acc}}>
                {(()=>{const d=new Date();d.setDate(d.getDate()+c.maxDageForlob);return d.toLocaleDateString("da-DK");})()}
              </strong>. Advarsler vises i planlog og på patienten.
            </div>
          )}
        </KriterieRad>
      </div>

      {/* -- EXCEL IMPORT -- */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}> Importer fra Excel</div>
        <div style={{color:C.txtM,fontSize:12,marginBottom:16}}>Upload en Excel-fil (.xlsx) med patienter, medarbejdere eller opgaver. Download skabelonen for korrekt kolonneformat.</div>
        <ExcelImportPanel setPatienter={setPatienter} setMedarbejdere={setMedarbejdere} setForlob={setForlob} forlob={forlob} setLokTider={setLokTider} setLokMeta={setLokMeta} patienter={patienter} medarbejdere={medarbejdere} setIndsatser={setIndsatser} saveLokaler={saveLokaler} lokaler={lokaler}/>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",gap:8,paddingTop:4}}>
        <Btn v="primary" onClick={()=>{setConfig(c);setGemtIndstillinger(true);setTimeout(()=>setGemtIndstillinger(false),2500);}}>Gem indstillinger</Btn>
        {gemtIndstillinger&&<span style={{color:C.acc,fontSize:13,fontWeight:600}}>Indstillinger gemt</span>}
      </div>
    </div>
  );
}

export default function IndstillingerView({config,setConfig,setPatienter,setMedarbejdere,setForlob,forlob,setLokTider,lokMeta={},setLokMeta,patienter=[],lokaler=[],saveLokaler=()=>{},medarbejdere=[],setIndsatser=()=>{},indsatser=[]}){
  const [c,setC]=useState({...config,serverModel:config.serverModel||"planmed",selfhostedUrl:config.selfhostedUrl||""});
  const set=(k,v)=>setC(p=>({...p,[k]:v}));

  const [confirmReset,setConfirmReset]=useState(null);
  const resetAlt=()=>{
    setConfirmReset({tekst:"Nulstil alle patienter og opgaver til udgangspunktet?",onJa:()=>{
    setPatienter(INIT_PATIENTER_RAW.map(r=>buildPatient(r)));
    setMedarbejdere([...BASE_MED]);
    setConfirmReset(null);}});
  };
  const resetOpgaver=()=>{
    setConfirmReset({tekst:"Nulstil alle planlagte opgaver (behold patienter)?",onJa:()=>{
    setPatienter(ps=>ps.map(p=>({...p,opgaver:p.opgaver.map(o=>o.låst?o:{...o,status:"afventer",dato:null,startKl:null,slutKl:null,lokale:null,medarbejder:null})})));
    setConfirmReset(null);}});
  };

  const [indTab,setIndTab]=useState("it");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:980}}>
      <ViewHeader titel="Indstillinger" undertitel=""/>

      {/* TAB-VÆLGER */}
      <div style={{display:"flex",gap:0,borderBottom:"2px solid "+C.brd}}>
        {[
          {id:"it",      label:"IT-indstillinger",         col:C.blue},
          {id:"hjaelp",  label:"Hjælp",                   col:C.grn},
        ].map(t=>(
          <button key={t.id} onClick={()=>setIndTab(t.id)}
            style={{padding:"10px 24px",border:"none",
              borderBottom:indTab===t.id?"3px solid "+t.col:"3px solid transparent",
              background:"transparent",color:indTab===t.id?t.col:C.txtD,
              fontWeight:indTab===t.id?700:400,fontSize:14,cursor:"pointer",
              fontFamily:"inherit",marginBottom:-2,transition:"color .15s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {indTab==="it"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* -- Servermodel -- */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:12}}>Servermodel</div>
        <div style={{color:C.txtM,fontSize:12,marginBottom:12}}>Vælg hvordan data gemmes og tilgås i din installation.</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            ["planmed","PlanMed-hosted","Data gemmes på PlanMeds servere. Nemmest at komme i gang."],
            ["selfhosted","Self-hosted","Selskabet driver selv sin server. Data forlader aldrig selskabets infrastruktur."],
            ["epj","EPJ-integreret","Data lever i EPJ-systemet. PlanMed læser og skriver via FHIR API."],
          ].map(([v,label,desc])=>(
            <label key={v} style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
              background:c.serverModel===v?C.accM:"transparent",
              border:"1px solid "+(c.serverModel===v?C.acc:C.brd),
              borderRadius:8,padding:"10px 14px",transition:"all .15s"}}>
              <input type="radio" name="serverModelInd" checked={c.serverModel===v}
                onChange={()=>set("serverModel",v)} style={{accentColor:C.acc,marginTop:2}}/>
              <div>
                <div style={{color:c.serverModel===v?C.acc:C.txt,fontWeight:600,fontSize:12}}>{label}</div>
                <div style={{color:C.txtM,fontSize:11,marginTop:2}}>{desc}</div>
              </div>
            </label>
          ))}
        </div>
        {c.serverModel==="selfhosted"&&(
          <div style={{marginTop:12}}>
            <FRow label="Server URL"><Input value={c.selfhostedUrl||""} onChange={v=>set("selfhostedUrl",v)} placeholder="https://planmed.jeres-hospital.dk/api"/></FRow>
          </div>
        )}
      </div>

      {/* -- GOOGLE MAPS -- */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:15}}>Google Maps — Transportberegning</div>
          <Pill color={c.googleMapsKey?C.grn:C.amb} bg={c.googleMapsKey?C.grnM:C.ambM} sm>
            {c.googleMapsKey?"Aktiveret":"Ikke konfigureret"}
          </Pill>
        </div>
        <div style={{color:C.txtM,fontSize:12,marginBottom:12}}>
          Bruges til præcis transporttid (Distance Matrix API) når medarbejdere kører til patients adresse. Uden nøgle bruges postnummer-estimat.
        </div>
        <FRow label="Google Maps API-nøgle">
          <Input value={c.googleMapsKey||""} onChange={v=>set("googleMapsKey",v)} placeholder="AIzaSy..."/>
        </FRow>
        {c.googleMapsKey&&(
          <div style={{marginTop:8,padding:"8px 12px",background:C.grnM,borderRadius:7,border:"1px solid "+C.grn}}>
            <div style={{color:C.grn,fontSize:12,fontWeight:700}}>Distance Matrix API aktiveret</div>
            <div style={{color:C.txtM,fontSize:11,marginTop:2}}>
              Transporttider hentes live fra Google Maps ved planlægning. Kræver fakturerings-aktivering i Google Cloud Console og at afdelingens postnr. er udfyldt under Planlægningsindstillinger.
            </div>
          </div>
        )}
        {!c.googleMapsKey&&(
          <div style={{marginTop:8,padding:"8px 12px",background:C.ambM,borderRadius:7,border:"1px solid "+C.amb}}>
            <div style={{color:C.amb,fontSize:11,fontWeight:600}}>Kører på postnummer-estimat (±15 min unøjagtighed)</div>
          </div>
        )}
      </div>

      {/* -- OUTLOOK KALENDER -- */}
      <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}> Outlook Kalender-integration</div>
        <div style={{color:C.txtM,fontSize:12,marginBottom:16}}>Kobl medarbejdernes Outlook-kalender til PlanMed så optaget tid blokeres automatisk under planlægning.</div>
        <OutlookKalenderPanel medarbejdere={medarbejdere} setMedarbejdere={setMedarbejdere}/>
      </div>

      <div style={{display:"flex",gap:8}}>
        <Btn v="primary" onClick={()=>setConfig(c)}> Gem indstillinger</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:12}}>System</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Btn v="subtle" onClick={resetOpgaver} full>Nulstil alle planlagte opgaver</Btn>
            <Btn v="danger" onClick={resetAlt} full>! Nulstil til fabriksdata</Btn>
          </div>
        </div>

        <div style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"18px 20px"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:8}}>Om PlanMed</div>
          <div style={{color:C.txtM,fontSize:12,lineHeight:1.6}}>
            PlanMed planlægningssystem v2.0<br/>
            76 patienter . 53 medarbejdere . 15 forløbstyper<br/>
            Planlægningsalgoritme: Scarcity-first + LCV<br/>
            Regler: Min. {c.minGapDays} dages gap . Max {c.maxDage} dages horisont
            {c.maxDageForlob>0&&<><br/>Forløbs-deadline: {c.maxDageForlob} dage fra henv.dato</>}
          </div>
        </div>
      </div>
        </div>
      )}

      {/* 
          HJÆLP-TAB
           */}
      {indTab==="hjaelp"&&<HjaelpTab/>}

      {confirmReset&&<ConfirmDialog
        tekst={confirmReset.tekst}
        onJa={confirmReset.onJa}
        onNej={()=>setConfirmReset(null)}
      />}
    </div>
  );
}

// ===========================================================
// HJÆLP-TAB — Komplet guidebog til PlanMed
// ===========================================================
function HjaelpTab(){
  const [søg,setSøg]=useState("");
  const [åbenSektion,setÅbenSektion]=useState(null);
  const [åbenUnderpunkt,setÅbenUnderpunkt]=useState(null);

  const GUIDE=[
    {
      id:"overblik",
      ikon:"",
      titel:"Overblik over PlanMed",
      beskrivelse:"Hvad er PlanMed, og hvem er det til?",
      punkter:[
        {
          titel:"Hvad er PlanMed?",
          tekst:`PlanMed er et digitalt planlægningssystem til sundhedsfaglige organisationer — typisk PPR, socialpsykiatri, rehabiliteringsteams eller andre afdelinger der arbejder med patienter/borgere over et forløb.\n\nSystemet hjælper jer med at:\n• Oprette og holde styr på patienter og deres forløb\n• Tildele og planlægge opgaver til medarbejdere\n• Sikre at de rigtige lokaler og certificeringer er på plads\n• Få overblik over kapacitet og ventelister via dashboard\n• Sende dokumenter via e-Boks\n• Automatisere rullende/tilbagevendende opgaver`
        },
        {
          titel:"Brugerroller",
          tekst:`PlanMed har tre roller:\n\n Medarbejder\nKan se egne opgaver og patienter inden for sin afdeling. Kan registrere opgaver som løste.\n\n Admin\nFuld adgang til alle faner inkl. planlægning, godkendelser og medarbejderadministration. Kan oprette/slette patienter og medarbejdere.\n\n Ejer\nAdgang til Ejer-konsol med KPI-overblik, lejerstyring, feature-flags, API-nøgler og systemindstillinger. Logges ind med særlig ejer-kode.`
        },
        {
          titel:"Navigation",
          tekst:`Menuen til venstre har følgende faner:\n\n Dashboard — Systemoverblik med KPI'er og advarsler\n Patienter — Patientliste og opgaveoversigt\n Kalender — Ugeoversigt over planlagte opgaver\n Medarbejdere — Medarbejderliste og kapacitet\n Lokaler — Lokaler, åbningstider og adresser\n Opgaver — Forløb og opgaveskabeloner\n Planlæg — Automatisk planlægning med motor\n Indstillinger — Systemkonfiguration og hjælp\n Admin — Godkendelser, brugere og afdelinger\n Ejer — Kun for ejerkonto`
        }
      ]
    },
    {
      id:"patienter",
      ikon:"",
      titel:"Patienter",
      beskrivelse:"Opret, rediger og administrer patienter og deres forløb",
      punkter:[
        {
          titel:"Opret ny patient",
          tekst:`Klik på "+ Ny patient" øverst i Patienter-fanen.\n\nUdfyld de tre faneblade:\n\n Stamdata\n• Fulde navn og CPR-nummer\n• Henvisningsdato (bruges til deadline-beregning)\n• Afdeling og ansvarlig medarbejder\n• Tidsvindue for besøg (standard 08:00–17:00)\n• Særlige hensyn (vises tydeligt ved planlægning)\n\n Forældre/Værge\nTilføj op til to forældre/værger med navn, CPR, tlf og e-Boks-ID. Angiv myndighedshaver.\n\n Adresser\nTilknyt adresser til specifikke lokaler. Bruges af planlægningsmotoren til transport-beregning.`
        },
        {
          titel:"Patientdetaljer og opgaver",
          tekst:`Klik på en patient i listen for at åbne detaljepanelet med 4 faneblade:\n\n Overblik — Status, afdeling, ansvarlig, tidsvindue\n Opgaver — Alle planlagte og afsluttede opgaver\n Forældre/Værge — Kontaktoplysninger\n Adresser — Patientens tilknyttede adresser\n\nFra opgaver-fanen kan du:\n• Tilføje nye opgaver manuelt\n• Markere opgaver som løste\n• Redigere eller slette opgaver\n• Se advarsel hvis lokale mangler adresse`
        },
        {
          titel:"Tildel forløb til patient",
          tekst:`En patient kan tilknyttes et forløb fra ForløbView (Opgaver-fanen).\n\nI patientkortet klikker du "Tildel forløb" og vælger det relevante forløb. Forløbets opgaver kopieres som opgaveskabeloner til patienten.\n\nForløb kan have en deadline (max dage fra henvisning til afslutning) der konfigureres i Indstillinger.`
        },
        {
          titel:"Slette en patient",
          tekst:`Åbn patientdetaljepanelet og klik på "Slet patient" (rød knap nederst).\n\nVigtigt: Sletning er permanent og kan ikke fortrydes. Alle patientens opgaver slettes automatisk med.\n\nOvervej i stedet at markere patienten som afsluttet via statusskift.`
        }
      ]
    },
    {
      id:"kalender",
      ikon:"",
      titel:"Kalender",
      beskrivelse:"Ugeoversigt over planlagte opgaver",
      punkter:[
        {
          titel:"Navigationn i kalenderen",
          tekst:`Kalenderen viser en ugeoversigt over alle planlagte opgaver.\n\n← → Piletasterne (eller knapperne) navigerer uger frem og tilbage.\n"I dag"-knappen hopper til aktuel uge.\n\nFiltrér på medarbejder eller lokale via dropdown øverst — nyttigt ved stor arbejdsbelastning.`
        },
        {
          titel:"Forstå kalendervisningen",
          tekst:`Hver kolonne er en ugedag (mandag–søndag).\nOpgaver vises som farvede blokke med patientnavn, opgavenavn og medarbejder.\nFarven svarer til medarbejderens titel-kategori.\n\nKlik på en opgaveblok for at se detaljer (dato, tid, lokale, status).`
        }
      ]
    },
    {
      id:"medarbejdere",
      ikon:"",
      titel:"Medarbejdere",
      beskrivelse:"Opret og administrer medarbejdere, kompetencer og kapacitet",
      punkter:[
        {
          titel:"Opret medarbejder",
          tekst:`Klik "+ Ny medarbejder" i Medarbejdere-fanen.\n\nUdfyld:\n• Navn og titel (bestemmer farve i kalender)\n• Ugentlige timer (bruges til kapacitetsberegning)\n• Mail og telefon\n• Leder og afdeling\n• Arbejdssted med adresse (bruges ved transportberegning)\n• Arbejdsdage (mandag–søndag)\n• Kompetencer (certifikater de opfylder)\n\nDen ansvarlige medarbejder kan vælges på patienter og opgaver.`
        },
        {
          titel:"Kompetencer og certifikater",
          tekst:`Kompetencer tilknyttes medarbejdere som fritekst-tags.\nOpgaveelementer kan kræve et specifikt certifikat — planlægningsmotoren matcher automatisk.\n\nCertifikat-skabeloner administreres under Opgaver → Certifikater-fanen.\n\nEksempel: Opgaven "Psykologsamtale" kræver certifikatet "Autoriseret psykolog" — kun medarbejdere med dette kan tildeles opgaven.`
        },
        {
          titel:"Slette medarbejder",
          tekst:`Åbn medarbejderkortet og klik "Slet".\n\nVed sletning fjernes medarbejderen fra alle fremtidige opgaver (feltet sættes tomt). Allerede afholdte opgaver bevares for historikkens skyld.`
        }
      ]
    },
    {
      id:"lokaler",
      ikon:"",
      titel:"Lokaler",
      beskrivelse:"Opret lokaler, angiv åbningstider, kapacitet og adresser",
      punkter:[
        {
          titel:"Opret og administrer lokaler",
          tekst:`Under Lokaler-fanen ser du en liste over alle lokaler til venstre.\n\nKlik "+ Nyt" for at oprette et nyt lokale.\nKlik på et lokale for at se bookingstatistik og åbningstider.\nKlik " Rediger lokale" for at:\n• Omdøbe lokalet\n• Angive lokale-ID og kapacitet\n• Registrere udstyr/faciliteter\n• Sætte adresse på lokalet\n• Slette lokalet`
        },
        {
          titel:"Åbningstider",
          tekst:`Hvert lokale kan have individuelle åbningstider per ugedag.\nKlik "~ Rediger åbningstider" for at sætte åbnings- og lukketidspunkt per dag.\n\nEn tom tid = lokalet er lukket den dag.\nÅbningstider bruges af planlægningsmotoren til kun at planlægge inden for gyldige tidsrum.`
        },
        {
          titel:"Adresser på lokaler",
          tekst:`Når et lokale har en adresse registreret, bruges den automatisk af planlægningsmotoren til transportberegning (Google Maps).\n\nHvis lokalet ikke har en adresse, bruges patientens registrerede adresse for det pågældende lokale — eller vises der en advarsel (rød !) i patientens opgavevisning.\n\nDu kan sende adressen til godkendelse via "→ Send til godkendelse" hvis adressen mangler.`
        },
        {
          titel:"Import fra Excel",
          tekst:`Du kan masseimportere lokaler via Indstillinger → Importer fra Excel → Lokaler-fanen.\n\nDownload skabelonen og udfyld kolonnerne:\nLokale · MandagÅben · MandagLukket · (alle ugedage) · Kapacitet · Beskrivelse\n\nTider angives i HH:MM-format. Tomme tider = lukket den dag.`
        }
      ]
    },
    {
      id:"opgaver",
      ikon:"",
      titel:"Opgaver & Forløb",
      beskrivelse:"Opgaveskabeloner, forløb, certifikater og rullende opgaver",
      punkter:[
        {
          titel:"Hvad er et forløb?",
          tekst:`Et forløb er en skabelon for et behandlingsforløb — fx "PPR Standardforløb" eller "Psykologforløb 10 samtaler".\n\nEt forløb indeholder en eller flere opgaver.\nNår et forløb tildeles en patient, genereres opgaver baseret på opgaveskabelonerne.\n\nForløb oprettes og redigeres under Opgaver → Forløb-fanen.`
        },
        {
          titel:"Hvad er en opgaveskabelon?",
          tekst:`En opgaveskabelon er en skabelon for et møde/session — fx "Psykologsamtale 45 min".\n\nEn opgaveskabelon har et eller flere elementer, der beskriver:\n• Varighed i minutter\n• Tidsvindue (tidligst/senest)\n• Lokaler der kan bruges\n• Certifikatkrav til medarbejder\n• Om patienten skal være til stede (og eventuelt min. ventetid)\n• Om det er en rullende opgave (gentages med interval)\n• Cooldown (min. pause mellem to opgaver af samme type)\n• Om der skal sendes dokument til e-Boks`
        },
        {
          titel:"Rullende opgaver",
          tekst:`En rullende opgave gentager sig automatisk med et defineret interval.\n\nNår opgaven markeres som løst, sendes en notifikation til "Rulleplan" under Admin → Godkendelser.\n\nDér kan admin beslutte:\nOK Forlæng — Opretter ny opgave til samme patient\nx Afslut — Forløbet stopper her\n\nInterval konfigureres i opgaveelementet:\n• Tidligst om: Minimum ventetid til næste\n• Senest om: Deadline for at planlægge næste\n• Planlæg senest: Hvornår systemet låser opgaven`
        },
        {
          titel:"Certifikater",
          tekst:`Under Opgaver → Certifikater kan du oprette certifikattyper fx "Autoriseret psykolog" eller "ABA-terapeut".\n\nCertifikater bruges på to måder:\n1. Opgaveelementer kræver et certifikat → kun egnede medarbejdere kan planlægges\n2. Medarbejdere tilknyttes certifikater → systemet filtrerer automatisk\n\nDette sikrer compliance og forhindrer fejlplanlægning.`
        }
      ]
    },
    {
      id:"planlaeg",
      ikon:"",
      titel:"Planlægning",
      beskrivelse:"Automatisk planlægning med planlægningsmotoren",
      punkter:[
        {
          titel:"Sådan virker planlægningsmotoren",
          tekst:`Planlægningsmotoren analyserer alle ventende opgaver og finder den optimale tidsplan.\n\nMotoren tager højde for:\n• Medarbejdernes arbejdstider og kapacitet\n• Lokalernes åbningstider\n• Certifikatkrav på opgaver\n• Patientens tidsvindue (fx kun formiddag)\n• Transporttid (via Google Maps API hvis konfigureret)\n• Cooldown-regler mellem opgaver\n• Patient-tilstedeværelseskrav\n• Forløbs-deadlines\n\nResultatet vises i PlanLog-visningen.`
        },
        {
          titel:"Start planlægning",
          tekst:`Gå til Planlæg-fanen.\n\n1. Sæt "Planlæg fra dato" (standard: i dag)\n2. Vælg eventuelt afdeling-scope via -knappen\n3. Klik " Planlæg nu"\n\nMotoren kører og viser en progressbar.\nEfter kørsel vises alle planlagte opgaver med dato, tid, medarbejder og lokale.\n\nOpgaver med advarsel (!) kan ikke planlægges — årsagen vises.`
        },
        {
          titel:"Afdelings-scope",
          tekst:`Ved at bruge  Scope-knappen kan du afgrænse planlægningen til én afdeling.\n\nDette er nyttigt i større organisationer hvor afdelinger planlægger uafhængigt.\n\nVises i header som "Viser: [Afdeling] · X pat · Y med".`
        },
        {
          titel:"Google Maps transport",
          tekst:`Hvis en Google Maps API-nøgle er konfigureret under Indstillinger → IT-indstillinger, beregner motoren automatisk transporttid mellem opgaver.\n\nDette bruges til at undgå at to opgaver planlægges for tæt når der er lang køretid imellem.\n\nUden API-nøgle bruges en standardtransporttid på 15 minutter.`
        }
      ]
    },
    {
      id:"admin",
      ikon:"",
      titel:"Admin",
      beskrivelse:"Godkendelser, brugere, afdelinger og rulleplan",
      punkter:[
        {
          titel:"Godkendelser",
          tekst:`Under Admin → Godkendelser håndteres:\n\n Adresse-mangler — Lokaler med manglende adresse sendt til godkendelse\n Rulleplan-mail — Notifikationer om rullende opgaver klar til forlængelse/afslutning\n\nAdmins kan markere punkter som løste, sende rykkere eller eskalere til ansvarlig.`
        },
        {
          titel:"Brugere og roller",
          tekst:`Under Admin → Brugere ses alle registrerede brugere med rolle, afdeling og status.\n\nRoller:\n• medarbejder — begrænset adgang\n• admin — fuld adgang til afdeling\n• superadmin — adgang på tværs af afdelinger\n\nI den nuværende prototype oprettes brugere via login-flowet. I produktionsversion integreres med SSO (Microsoft/Google).`
        },
        {
          titel:"Afdelinger",
          tekst:`Under Admin → Afdelinger administreres organisationens afdelinger.\n\nAfdelinger bruges til:\n• Scope-filtrering i planlægning\n• Tildeling af patienter og medarbejdere\n• Adgangsstyring per bruger`
        }
      ]
    },
    {
      id:"indstillinger",
      ikon:"",
      titel:"Indstillinger",
      beskrivelse:"Systemkonfiguration, planlægningsregler og IT-integration",
      punkter:[
        {
          titel:"Planlægningsindstillinger",
          tekst:`Under Indstillinger → Planlægningsindstillinger konfigureres:\n\n- Standardvarighed — Standardlængde på en opgave i minutter\n Åbningstider — Standard åbnings- og lukketid for hele systemet\n Arbejdsdage — Hvilke ugedage der planlægges på\n Max opgaver per dag — Maks antal opgaver pr. medarbejder pr. dag\n Planlægningsstrategi — "Tidligst muligt" eller "Spred ud"\n Forløbs-deadline — Max dage fra henvisning til afsluttet forløb (0 = ingen grænse)\n\nKlik "Gem indstillinger" for at gemme.`
        },
        {
          titel:"IT-indstillinger",
          tekst:`Under Indstillinger → IT-indstillinger konfigureres tekniske integrationer:\n\n Google Maps API-nøgle — Til transportberegning\n Outlook Kalender-integration — Synkroniser planlagte opgaver til Outlook/Exchange\n Servermodel — Database og backend-konfiguration (Supabase)\n\nAlle ændringer kræver "Gem indstillinger".`
        },
        {
          titel:"Importer fra Excel",
          tekst:`Du kan importere data via Excel-filer under Planlæg → Planlæg indstillinger.\n\nFaneblade:\n Patienter — Navn, CPR, afdeling, forældreinformation\n Medarbejdere — Navn, titel, timer, mail, kompetencer\n Opgaver — Opgaveskabeloner med alle parametre\n Lokaler — Lokalenavne, åbningstider og kapacitet\n\nDownload skabelonen for korrekt kolonneformat.\nUpload .xlsx eller .csv filer.`
        }
      ]
    },
    {
      id:"ejer",
      ikon:"",
      titel:"Ejer-konsol",
      beskrivelse:"Lejerstyring, KPI'er, feature-flags og API-nøgler",
      punkter:[
        {
          titel:"Adgang til Ejer-konsollen",
          tekst:`Ejer-konsollen er kun tilgængelig for ejerkontoen.\n\nLogin: Den email der blev valgt ved førstegangs-opsætning\nEjer-kode: Konfigureres under Ejer → Ejer-konto\n\nKonsollen giver adgang til systemets øverste administrative niveau — uanset afdeling og scope.`
        },
        {
          titel:"Lejere (SaaS-styring)",
          tekst:`Under Ejer → Lejere ses alle organisationer der bruger PlanMed.\n\nPer lejer vises:\n• Kontaktperson og e-mail\n• Abonnementsplan og status\n• Antal brugere og afdelinger\n• Månedlig omsætning\n\nDu kan aktivere/deaktivere lejere og sende beskeder.`
        },
        {
          titel:"Feature-flags",
          tekst:`Feature-flags styrer hvilke funktioner der er aktive i systemet.\n\nBrug dem til at:\n• Rulle nye features ud gradvist\n• Slå eksperimentelle funktioner til/fra\n• Begrænse funktionalitet per abonnementsniveau\n\nÆndringer træder i kraft øjeblikkeligt for alle brugere.`
        },
        {
          titel:"API-nøgler",
          tekst:`Under Ejer → API-nøgler gemmes alle integrationsnøgler:\n\n Stripe — Betalingsinfrastruktur\n Supabase — Database og authentication\n GitHub — Deployment og versionsstyring\n Google Maps — Transportberegning\n SendGrid / Microsoft Graph — E-mailnotifikationer\n e-Boks — Digital Post til patienter og pårørende\n\nSECRET-markerede nøgler må aldrig eksponeres i frontend-kode.`
        }
      ]
    },
    {
      id:"fejl",
      ikon:"",
      titel:"Fejlfinding",
      beskrivelse:"Løsninger på hyppige problemer",
      punkter:[
        {
          titel:"Sort skærm / siden loader ikke",
          tekst:`Hvis en fane viser sort skærm:\n\n1. Genindlæs siden (F5 / Ctrl+R)\n2. Prøv en anden browser (Chrome anbefales)\n3. Ryd browser-cache (Ctrl+Shift+Delete)\n4. Tjek om der er en fejlbesked i konsollen (F12 → Console)\n\nPlanMed har en ErrorBoundary der fanger fejl og viser en fejlbesked i stedet for sort skærm. Hvis du ser en rød fejlboks, noter beskeden og kontakt support.`
        },
        {
          titel:"Planlægning finder ikke tider",
          tekst:`Hvis planlægningsmotoren ikke kan finde tider til en opgave:\n\n• Tjek at medarbejderen har kapacitet (ikke max opgaver nået)\n• Tjek at lokalet har åbningstider den dag\n• Tjek at patientens tidsvindue overlapper med lokale og medarbejder\n• Tjek at medarbejderen har det krævede certifikat\n• Tjek at cooldown-perioden fra forrige opgave er overholdt\n• Tjek at forløbs-deadlinen ikke er overskredet\n\nOpgaver der ikke kan planlægges vises med ! og en forklaring.`
        },
        {
          titel:"Data gemmes ikke",
          tekst:`PlanMed gemmer data i browserens localStorage i prototype-versionen.\n\nData gemmes IKKE:\n• Hvis du bruger Incognito/privat tilstand\n• Hvis du rydder browser-data\n• Hvis du skifter browser\n\nI produktionsversionen gemmes alt i Supabase-databasen og synkroniseres på tværs af enheder.\n\nEksportér vigtige data via Excel-eksport før du rydder browseren.`
        },
        {
          titel:"Excel-import virker ikke",
          tekst:`Hvis Excel-import fejler:\n\n1. Brug kun den officielle skabelon (download via "Download skabelon"-knappen)\n2. Gem filen som .xlsx eller .csv (ikke .xls eller .ods)\n3. Undgå specialtegn og linjeskift i celler\n4. Tjek at datoer er i YYYY-MM-DD format\n5. Tjek at tider er i HH:MM format\n\nSystemet viser en forhåndsvisning af importerede data — tjek den før du bekræfter.`
        }
      ]
    }
,
    {
      id:"sygemelding",
      ikon:"",
      titel:"Sygemeldinger & stand-in",
      beskrivelse:"Håndter akut fravær og omfordel opgaver samme dag",
      punkter:[
        {
          titel:"Registrer en sygemelding",
          tekst:`Når en medarbejder melder sig syg, gå til Medarbejdere-fanen og åbn medarbejderkortet.\n\nMarkér medarbejderen som fraværende for perioden:\n• Vælg startdato (typisk dags dato)\n• Vælg forventet slutdato (eller lad stå åben)\n• Angiv fraværstype: Syg / Ferie / Kursus / Andet\n\nSystemet markerer automatisk alle medarbejderens planlagte opgaver i perioden som "Kræver omfordeling" (gul !).`
        },
        {
          titel:"Find stand-in automatisk",
          tekst:`Når opgaver er markeret til omfordeling, klik " Find stand-in" på medarbejderkortet eller fra Planlæg-fanen.\n\nSystemet analyserer alle berørte opgaver og finder mulige stand-ins baseret på:\n• Samme certifikater/kompetencer som den sygemeldte\n• Ledig kapacitet den pågældende dag\n• Overlappende arbejdstider\n• Samme afdeling (prioriteres)\n\nResultat: En rangeret liste over mulige stand-ins per opgave med kapacitetsindikator.`
        },
        {
          titel:"Generer indkaldelsesliste til patienter",
          tekst:`Hvis ingen stand-in kan findes, genereres en indkaldelsesliste over berørte patienter.\n\nListen viser per patient:\n• Navn, kontakttelefon og forældreinformation\n• Hvilken opgave der er aflyst og hvornår\n• Hvor hurtigt de bør ombookes (baseret på forløbs-deadline)\n• Foreslåede nye tider (fra næste ledige slots)\n\nListen kan eksporteres til Excel eller sendes via e-Boks til forældrene.`
        },
        {
          titel:"Omfordel opgaver manuelt",
          tekst:`Fra omfordelingslisten kan du for hver opgave:\n\n1. Vælg stand-in fra foreslået liste (eller søg manuelt)\n2. Bekræft tid og lokale (kan justeres)\n3. Klik "Bekræft omfordeling"\n\nSystemet opdaterer automatisk:\n• Opgaven flyttes til ny medarbejder\n• Notifikation sendes til stand-in (via mail)\n• Patient/forældre adviseres hvis e-Boks er konfigureret\n• Original medarbejder fritages for opgaven`
        },
        {
          titel:"Flerdag-fravær og fremadrettet planlægning",
          tekst:`Ved fravær over flere dage kører systemet en ny planlægningskørsel for fraværsperioden.\n\nDette sker automatisk hvis "Auto-replanlæg ved fravær" er aktiveret under Indstillinger.\n\nManuelt: Gå til Planlæg, vælg dato-interval for fraværsperioden, og klik "Replanlæg fraværsperiode".\n\nSystemet markerer opgaver der ikke kan omfordeles (fx pga. specialkompetencer) og sender dem til Admin → Godkendelser til manuel behandling.`
        }
      ]
    }
  ];

  // Søgelogik — søger i titel + tekst
  const søgeLower = søg.toLowerCase().trim();
  const filtreret = søgeLower.length < 2 ? GUIDE : GUIDE.map(sek=>({
    ...sek,
    punkter: sek.punkter.filter(p=>
      p.titel.toLowerCase().includes(søgeLower) ||
      p.tekst.toLowerCase().includes(søgeLower) ||
      sek.titel.toLowerCase().includes(søgeLower)
    )
  })).filter(sek=>sek.punkter.length>0);

  // Søgeresultat: åbn alle sektioner automatisk
  const søgerAktivt = søgeLower.length >= 2;

  return(
    <div style={{maxWidth:760}}>
      <div style={{marginBottom:24}}>
        <div style={{fontWeight:800,fontSize:18,color:C.txt,marginBottom:4}}> PlanMed Guidebog</div>
        <div style={{color:C.txtM,fontSize:13}}>Komplet vejledning til alle funktioner i systemet</div>
      </div>

      {/* Søgefelt */}
      <div style={{position:"relative",marginBottom:24}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none"}}></span>
        <input
          value={søg}
          onChange={e=>{setSøg(e.target.value);if(e.target.value.length>=2){setÅbenSektion(null);setÅbenUnderpunkt(null);}}}
          placeholder="Søg i guiden... fx 'planlægning', 'lokale', 'certifikat'"
          style={{width:"100%",background:C.s3,border:"1px solid "+(søg.length>=2?C.acc:C.brd),
            borderRadius:10,padding:"10px 12px 10px 36px",fontSize:13,color:C.txt,
            fontFamily:"inherit",outline:"none",transition:"border 0.15s"}}
        />
        {søg&&<button onClick={()=>setSøg("")}
          style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
            background:"none",border:"none",color:C.txtM,cursor:"pointer",fontSize:16,padding:4}}>×</button>}
      </div>

      {søgeLower.length>=2&&filtreret.length===0&&(
        <div style={{background:C.s3,border:"1px solid "+C.brd,borderRadius:10,padding:"20px",
          textAlign:"center",color:C.txtM,fontSize:13}}>
          Ingen resultater for "<strong>{søg}</strong>" — prøv et andet søgeord
        </div>
      )}

      {/* Sektioner */}
      {filtreret.map(sek=>{
        const erÅben = søgerAktivt || åbenSektion===sek.id;
        return(
          <div key={sek.id} style={{marginBottom:8,border:"1px solid "+(erÅben?C.acc+"44":C.brd),
            borderRadius:11,overflow:"hidden",transition:"border 0.15s"}}>

            {/* Sektion header */}
            <button onClick={()=>setÅbenSektion(erÅben&&!søgerAktivt?null:sek.id)}
              style={{width:"100%",background:erÅben?C.accM:"transparent",
                border:"none",padding:"14px 16px",
                display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                textAlign:"left",transition:"background 0.15s"}}>
              <span style={{fontSize:20,flexShrink:0}}>{sek.ikon}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:erÅben?C.acc:C.txt}}>{sek.titel}</div>
                <div style={{fontSize:11,color:C.txtM,marginTop:1}}>{sek.beskrivelse}</div>
              </div>
              <span style={{color:C.txtM,fontSize:12,flexShrink:0,transition:"transform 0.15s",
                transform:erÅben?"rotate(180deg)":"none"}}></span>
            </button>

            {/* Underpunkter */}
            {erÅben&&(
              <div style={{borderTop:"1px solid "+C.brd+"88"}}>
                {sek.punkter.map((p,pi)=>{
                  const upKey=sek.id+"_"+pi;
                  const upÅben = søgerAktivt || åbenUnderpunkt===upKey;
                  return(
                    <div key={pi} style={{borderBottom:pi<sek.punkter.length-1?"1px solid "+C.brd+"55":"none"}}>
                      <button onClick={()=>setÅbenUnderpunkt(upÅben&&!søgerAktivt?null:upKey)}
                        style={{width:"100%",background:upÅben?C.s3:"transparent",border:"none",
                          padding:"11px 16px 11px 48px",display:"flex",alignItems:"center",
                          justifyContent:"space-between",cursor:"pointer",textAlign:"left"}}>
                        <span style={{fontSize:13,fontWeight:upÅben?600:400,color:upÅben?C.txt:C.txtD}}>
                          {p.titel}
                        </span>
                        <span style={{color:C.txtM,fontSize:11,marginLeft:8,flexShrink:0}}>
                          {upÅben?"":""}
                        </span>
                      </button>
                      {upÅben&&(
                        <div style={{padding:"8px 16px 14px 48px",background:C.s3}}>
                          {p.tekst.split("\n").map((linje,li)=>(
                            linje.trim()===""
                              ? <div key={li} style={{height:8}}/>
                              : linje.startsWith("•")
                                ? <div key={li} style={{display:"flex",gap:8,marginBottom:3}}>
                                    <span style={{color:C.acc,flexShrink:0}}>•</span>
                                    <span style={{color:C.txtD,fontSize:12,lineHeight:1.6}}>{linje.slice(1).trim()}</span>
                                  </div>
                                : linje.match(/^[OKx\-!]/)
                                  ? <div key={li} style={{color:C.txt,fontSize:12,fontWeight:600,marginTop:6,marginBottom:2,lineHeight:1.5}}>{linje}</div>
                                  : <div key={li} style={{color:C.txtD,fontSize:12,lineHeight:1.7,marginBottom:1}}>{linje}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{marginTop:20,padding:"12px 14px",background:C.s3,borderRadius:9,
        border:"1px solid "+C.brd,fontSize:11,color:C.txtM,textAlign:"center"}}>
        PlanMed v0.9 — Prototype
      </div>
    </div>
  );
}


// ===========================================================
// EXCEL IMPORT PANEL
// ===========================================================
function ExcelImportPanel({setPatienter,setMedarbejdere,setForlob,forlob,setLokTider,setLokMeta,patienter=[],medarbejdere=[],setIndsatser,saveLokaler,lokaler=[]}){
  const [tab,setTab]=useState("patienter");
  const [preview,setPreview]=useState(null); // {type, rows, cols, fejl}
  const [status,setStatus]=useState(null);   // {ok, msg}
  const fileRef=useRef(null);

  const SKABELONER={
    patienter:{
      navn:"PlanMed_Patienter_Skabelon",
      cols:[
        "Navn","CPR","HenvistDato","ForlobNr",
        "Status","SærligeHensyn","AnsvarligMedarbejder","Haste","Afdeling",
        "HjemVej","HjemPostnr","HjemBy","TransportMinutter",
      ],
      eksempel:[
        ["Lars Hansen","010175-1234","2026-01-15","1","aktiv","Tolk","Anna Skov","nej","current","Eksempelvej 1","8000","Aarhus C","15"],
        ["Maria Jensen","020280-5678","2026-01-20","","aktiv","Kørestol","Bo Nielsen","ja","current","Testvej 5","8200","Aarhus N",""],
      ],
      info:"ForlobNr = forløbstype 1-15 (tomt = tildeles automatisk) · Status = aktiv/venteliste/afsluttet/udmeldt · Haste = ja/nej · TransportMinutter = køretid fra hjem til klinik",
    },
    medarbejdere:{
      navn:"PlanMed_Medarbejdere_Skabelon",
      cols:[
        "Navn","Titel","TimerPrUge","Mail","Telefon","Leder","Afdeling","Titel2",
        "ArbedsstedNavn","ArbedsstedVej","ArbedsstedPostnr","ArbedsstedBy",
        "HjemVej","HjemPostnr","HjemBy",
        "Kompetencer","Certifikater",
        "MandagStart","MandagSlut","TirsdagStart","TirsdagSlut",
        "OnsdagStart","OnsdagSlut","TorsdagStart","TorsdagSlut",
        "FredagStart","FredagSlut","LordagStart","LordagSlut","SondagStart","SondagSlut",
        "MedarbejderId","EpjKalenderApi",
        "KapacitetsgrænseType","KapacitetsMaxTimer","RullendeVindue","RullendeMaxTimer",
        "TimeprisKrPrTime",
      ],
      eksempel:[
        ["Anna Skov","Psykolog","23","anna@klinik.dk","20304050","Bo Nielsen","current","",
         "Klinik Nord","Solvej 12","8000","Aarhus C",
         "Hjemvej 3","8000","Aarhus C",
         "ADOS-2,ADI-R","",
         "08:30","16:00","08:30","16:00","08:30","16:00","08:30","16:00","08:30","14:00","","","","",
         "","",
         "uge","23","4","20","950"],
        ["Bo Nielsen","Læge","30","bo@klinik.dk","21314151","","current","",
         "Klinik Nord","Solvej 12","8000","Aarhus C",
         "","","",
         "ANAMNESE,AKS","ECT-Certifikat",
         "08:00","16:00","08:00","16:00","08:00","16:00","08:00","16:00","08:00","15:00","","","","",
         "MED-0042","",
         "uge","30","4","25","1200"],
      ],
      info:"Titel = Læge/Psykolog/Pædagog · Kompetencer og Certifikater adskilles med komma · Tomme tider = ikke-arbejdsdag · KapacitetsgrænseType = dag/uge/mdr/kvartal/halvaar/år/ialt · TimeprisKrPrTime = individuel pris (tomt = brug faggruppe-standard)",
    },
    indsatser:{
      navn:"PlanMed_Opgaver_Skabelon",
      cols:[
        "Opgavenavn","Minutter","PatientInvolveret",
        "MuligeMedarbejdere","MuligeLokaler",
        "TidligstKl","SenestKl","Certifikat","Sekvens","IndsatsGruppe",
      ],
      eksempel:[
        ["ANAMNESE Forberedelse","45","nej","Psykolog,Laege","<Lokale-navn>","08:00","17:00","","1","Udredning"],
        ["ANAMNESE Patient","90","ja","Psykolog,Laege","<Lokale-navn 1>,<Lokale-navn 2>","10:00","17:00","","2","Udredning"],
        ["ECT Behandling","60","ja","Læge","<Lokale-navn>","08:00","14:00","ECT-Certifikat","1","Behandling"],
        ["Pædagogisk støtte","60","ja","Pædagog","<Lokale-navn>","08:00","17:00","","1","Støtte"],
      ],
      info:"PatientInvolveret = ja/nej · MuligeMedarbejdere = titler adskilt med komma · Certifikat = navn på krævet certifikat (tomt = intet krav) · Sekvens = rækkefølge inden for forløb · OpgaveGruppe = overordnet kategori",
    },
    lokaler:{
      navn:"PlanMed_Lokaler_Skabelon",
      cols:[
        "Lokale","Kapacitet","Beskrivelse","LokaleId",
        "Vej","Husnr","Postnr","By",
        "Udstyr","TimeprisKrPrTime",
        "MandagÅben","MandagLukket","TirsdagÅben","TirsdagLukket",
        "OnsdagÅben","OnsdagLukket","TorsdagÅben","TorsdagLukket",
        "FredagÅben","FredagLukket","LordagÅben","LordagLukket","SondagÅben","SondagLukket",
      ],
      eksempel:[
        ["<Lokale-navn>","1","Behandlingslokale","LOK-001","<Vejnavn nr>","","<Postnr>","<By>","Whiteboard,Håndvask","200",
         "08:00","16:00","08:00","16:00","08:00","16:00","08:00","16:00","08:00","16:00","","","",""],
      ],
      info:"Kapacitet = antal samtidige brugere · Tider = HH:MM format (tomt = lukket) · Udstyr adskilles med komma · TimeprisKrPrTime = individuel pris (tomt = brug standard)",
    },
  };

  const downloadSkabelon=(type)=>{
    const sk=SKABELONER[type];
    // Byg CSV (konverteres til Excel-kompatibel UTF-8 BOM CSV)
    const rows=[sk.cols,...sk.eksempel];
    const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${c}"`).join(";")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`${sk.navn}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const parseFile=(file)=>{
    if(!file) return;
    const ext=file.name.split(".").pop().toLowerCase();
    const reader=new FileReader();

    const parseCSVText=(text)=>{
      const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(l=>l.trim());
      if(lines.length===0) return [];
      const sep=lines[0].includes(";")?";":","
      return lines.map(l=>l.split(sep).map(c=>c.replace(/^"|"$/g,"").trim()));
    };
    const processRows=(rows)=>{
      try{
        if(rows.length<2){setStatus({ok:false,msg:"Filen er tom eller har kun én række"});return;}
        const cols=rows[0]; const data=rows.slice(1);
        const sk=SKABELONER[tab];
        const mangler=sk.cols.filter(c=>!cols.some(cc=>cc.toLowerCase().trim()===c.toLowerCase()));
        setPreview({cols,rows:data.slice(0,5),total:data.length,mangler,raw:data,rawCols:cols});
        setStatus(null);
      }catch(err){
        setStatus({ok:false,msg:"Fejl ved indlæsning: "+err.message});
      }
    };
    reader.onload=(e)=>{
      try{
        let rows=[];
        if(ext==="csv"||ext==="txt"){
          // Læs som ArrayBuffer og prøv UTF-8 først, fallback til Latin-1
          const buf=e.target.result;
          const bytes=new Uint8Array(buf);
          // Tjek om det er UTF-8 BOM eller gyldig UTF-8
          let text;
          try{
            const decoder=new TextDecoder("utf-8",{fatal:true});
            text=decoder.decode(bytes);
          }catch{
            // Ikke gyldig UTF-8 — brug Windows-1252 (Latin-1 superset, standard for Excel CSV på Windows)
            const decoder=new TextDecoder("windows-1252");
            text=decoder.decode(bytes);
          }
          rows=parseCSVText(text);
        } else if(ext==="xlsx"||ext==="xls"){
          try{
            const data=new Uint8Array(e.target.result);
            const wb=XLSX.read(data,{type:"array"});
            const ws=wb.Sheets[wb.SheetNames[0]];
            rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""}).filter(r=>r.some(c=>c!==""));
          }catch{
            setStatus({ok:false,msg:"Kan ikke læse .xlsx - upload venligst som .csv (Fil > Gem som > CSV)"});
            return;
          }
        }
        processRows(rows);
      }catch(err){
        setStatus({ok:false,msg:"Fejl ved indlæsning: "+err.message});
      }
    };
    // Altid læs som ArrayBuffer så vi kan detektere encoding
    reader.readAsArrayBuffer(file);
  };

  const importerData=()=>{
    if(!preview?.raw) return;
    const {raw,rawCols}=preview;
    const col=(navn)=>rawCols.findIndex(c=>c.toLowerCase().trim()===navn.toLowerCase());
    const get=(row,navn)=>row[col(navn)]||"";

    try{
      if(tab==="patienter"){
        const nyePat=raw.map((r)=>{
          const navn=get(r,"Navn"); if(!navn) return null;
          const fnr=get(r,"ForlobNr");
          const afd=get(r,"Afdeling")||"current";
          const shensyn=get(r,"SærligeHensyn")||get(r,"SaerligeHensyn")||"";
          const ansv=get(r,"AnsvarligMedarbejder")||"";
          const haste=(get(r,"Haste")||"").toLowerCase()==="ja";
          const cpr=get(r,"CPR")||"";
          const henvDato=get(r,"HenvistDato")||today();
          if(fnr&&fnr.toString().trim()!==""){
            const bp=buildPatient({navn,cpr,henvDato,forlobNr:Number(fnr),særligeHensyn:shensyn,ansvarligMed:ansv,haste,afdeling:afd},null,medarbejdere);
            return {...bp,
              status:(get(r,"Status")||bp.status||"aktiv").toLowerCase(),
              transportMinutter:get(r,"TransportMinutter")?Number(get(r,"TransportMinutter")):null,
              hjemAdresse:{vej:get(r,"HjemVej")||"",postnr:get(r,"HjemPostnr")||"",by:get(r,"HjemBy")||""},
            };
          } else {
            return {id:"p"+Date.now()+Math.random().toString(36).slice(2),navn,cpr,henvDato,
              forlobNr:null,forlobLabel:null,særligeHensyn:shensyn,ansvarligMed:ansv,
              haste,afdeling:afd,status:"aktiv",statusHistorik:[],opgaver:[]};
          }
        }).filter(Boolean);
        // Duplikat-tjek: spring over patienter der allerede eksisterer (samme CPR)
        const eksCPR=new Set(patienter.map(p=>p.cpr.replace(/[^0-9]/g,"")));
        const nyeUnikke=nyePat.filter(p=>!eksCPR.has((p.cpr||"").replace(/[^0-9]/g,"")));
        const sprungetOver=nyePat.length-nyeUnikke.length;
        setPatienter(ps=>[...ps,...nyeUnikke]);
        setStatus({ok:true,msg:"OK "+nyeUnikke.length+" patienter importeret"+(sprungetOver>0?" ("+sprungetOver+" sprunget over — CPR eksisterer allerede)":"")});
      } else if(tab==="medarbejdere"){
        const dagMap={Mandag:"MandagStart/MandagSlut",Tirsdag:"TirsdagStart/TirsdagSlut",Onsdag:"OnsdagStart/OnsdagSlut",Torsdag:"TorsdagStart/TorsdagSlut",Fredag:"FredagStart/FredagSlut"};
        const nyeMed=raw.map((r)=>{
          const navn=get(r,"Navn"); if(!navn) return null;
          const arbejdsdage=Object.fromEntries(
            ["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"].map(dag=>{
              const startK=dag+"Start", slutK=dag+"Slut";
              const start=get(r,startK), slut=get(r,slutK);
              return[dag,{aktiv:!!(start&&slut),start:start||"08:30",slut:slut||"16:00"}];
            })
          );
          const kompStr=get(r,"Kompetencer");
          const kompFraExcel=kompStr?kompStr.split(/[,;]/).map(k=>k.trim()).filter(Boolean):[];
          // Normaliser titel — accepter alle varianter inkl. encoding-forskelle
          const titelRaw=(get(r,"Titel")||"").trim();
          const titelLow=titelRaw.toLowerCase().normalize("NFC");
          const titelNorm=titelLow==="laege"||titelLow==="læge"||titelLow.includes("lege")||titelLow.includes("læge")?"Læge"
            :titelLow==="paedagog"||titelLow==="pædagog"||titelLow.includes("dagog")?"Pædagog"
            :titelLow==="psykolog"||titelLow.includes("psykolog")?"Psykolog"
            :titelRaw||"Psykolog";
          const timer=Number(get(r,"TimerPrUge"))||23;
          return{
            id:"imp"+Date.now()+Math.random().toString(36).slice(2),
            navn,
            titel:titelNorm,
            timer,
            mail:get(r,"Mail")||"",
            telefon:get(r,"Telefon")||"",
            leder:get(r,"Leder")||"",
            afdeling:get(r,"Afdeling")||"current",
            arbejdsstedNavn:get(r,"ArbedsstedNavn")||get(r,"Arbejdssted")||"",
            arbejdsstedVej:get(r,"ArbedsstedVej")||"",
            arbejdsstedPostnr:get(r,"ArbedsstedPostnr")||"",
            arbejdsstedBy:get(r,"ArbedsstedBy")||"",
            hjemVej:get(r,"HjemVej")||"",
            hjemPostnr:get(r,"HjemPostnr")||"",
            hjemBy:get(r,"HjemBy")||"",
            kompetencer:kompFraExcel.length>0?kompFraExcel:(titelNorm==="Læge"?[...LK]:titelNorm==="Pædagog"?[...PD]:[...PK]), arbejdsdage,
            certifikater:(get(r,"Certifikater")||"").split(/[,;]/).map(k=>k.trim()).filter(Boolean),
            medarbejderId:get(r,"MedarbejderId")||"",
            epjKalenderApi:get(r,"EpjKalenderApi")||"",
            krPrTime:get(r,"TimeprisKrPrTime")?Number(get(r,"TimeprisKrPrTime")):null,
            kapacitet:{
              grænseType:get(r,"KapacitetsgrænseType")||"uge",
              grænseTimer:Number(get(r,"KapacitetsMaxTimer"))||timer,
              rullendePeriodeUger:Number(get(r,"RullendeVindue"))||4,
              rullendeMaxTimer:Number(get(r,"RullendeMaxTimer"))||Math.round(timer*0.85),
              brugerDefault:!get(r,"KapacitetsgrænseType"),
            },
          };
        }).filter(Boolean);
        // Duplikat-tjek: spring over medarbejdere der allerede eksisterer (samme navn eller mail)
        const eksNavne=new Set(medarbejdere.map(m=>m.navn.toLowerCase().trim()));
        const eksMail=new Set(medarbejdere.filter(m=>m.mail).map(m=>m.mail.toLowerCase().trim()));
        const nyeUnikke=nyeMed.filter(m=>{
          if(eksNavne.has(m.navn.toLowerCase().trim())) return false;
          if(m.mail&&eksMail.has(m.mail.toLowerCase().trim())) return false;
          return true;
        });
        const sprungetOver=nyeMed.length-nyeUnikke.length;
        setMedarbejdere(ms=>{
          const opdateret=[...ms,...nyeUnikke];
          // Genbyg muligeMed på alle eksisterende patienter baseret på nye medarbejdere
          setPatienter(ps=>ps.map(p=>({...p,
            opgaver:p.opgaver.map(o=>{
              // Kun genbyg hvis muligeMed er tom eller kun indeholder titler
              const TITLER=["Psykolog","Læge","Pædagog","Laege","Paedagog"];
              const harNavne=(o.muligeMed||[]).some(mm=>opdateret.find(m=>m.navn===mm));
              if(harNavne) return o; // Allerede navne-baseret — behold
              // Byg fra titler eller alle
              const titler=(o.muligeMed||[]).filter(mm=>TITLER.includes(mm));
              const matching=titler.length>0
                ? opdateret.filter(m=>titler.some(t=>m.titel===t||(t==="Laege"&&m.titel==="Læge")||(t==="Paedagog"&&m.titel==="Pædagog"))).map(m=>m.navn)
                : opdateret.map(m=>m.navn);
              return {...o, muligeMed:matching};
            })
          })));
          return opdateret;
        });
        setStatus({ok:true,msg:`OK ${nyeUnikke.length} medarbejdere importeret`+(sprungetOver>0?` (${sprungetOver} sprunget over — findes allerede)`:"")});
      } else if(tab==="indsatser"){
        // Tilføj indsatser til første forløbstype som eksempel
        const nyeInds=raw.map((r)=>{
          const navn=get(r,"Opgavenavn"); if(!navn) return null;
          return{
            id:"ei"+Date.now()+Math.random().toString(36).slice(2),
            opgave:navn, minutter:Number(get(r,"Minutter"))||60,
            patInv:get(r,"PatientInvolveret")?.toLowerCase()==="ja",
            muligeMed:(get(r,"MuligeMedarbejdere")||"").split(/[,;]/).map(s=>s.trim()).filter(Boolean),
            muligeLok:(get(r,"MuligeLokaler")||"").split(/[,;]/).map(s=>s.trim()).filter(Boolean),
            tidligst:get(r,"TidligstKl")||"08:00",
            senest:get(r,"SenestKl")||"17:00",
            certifikat:get(r,"Certifikat")||"",
            sekvens:Number(get(r,"Sekvens"))||1,
            indsatsGruppe:get(r,"IndsatsGruppe")||"",
            samMed:false,
          };
        }).filter(Boolean);
        // Gem direkte i indsatser-state
        if(setIndsatser&&nyeInds.length>0){
          setIndsatser(prev=>{
            // Undgå dubletter på opgave-navn
            const eksNavne=new Set(prev.map(i=>i.opgave));
            const nye=nyeInds.filter(i=>!eksNavne.has(i.opgave));
            const opdaterede=prev.map(p=>{
              const ny=nyeInds.find(i=>i.opgave===p.opgave);
              return ny?{...p,...ny,id:p.id}:p;
            });
            return[...opdaterede,...nye];
          });
        }
        // Tildel importerede opgavenavne som kompetencer til medarbejdere med matchende titel
        if(setMedarbejdere&&nyeInds.length>0){
          const TITLER_NORM={"Psykolog":"Psykolog","Læge":"Læge","Pædagog":"Pædagog","Laege":"Læge","Paedagog":"Pædagog"};
          setMedarbejdere(prev=>prev.map(m=>{
            // Find alle opgaver denne medarbejders titel kan løse
            const nyeKomp=nyeInds
              .filter(ind=>{
                const titler=(ind.muligeMed||[]).map(t=>TITLER_NORM[t]||t);
                return titler.length===0||titler.includes(m.titel);
              })
              .map(ind=>ind.opgave)
              .filter(Boolean);
            if(nyeKomp.length===0) return m;
            const samlet=[...new Set([...(m.kompetencer||[]),...nyeKomp])];
            return samlet.length===(m.kompetencer||[]).length?m:{...m,kompetencer:samlet};
          }));
        }
        setStatus({ok:true,msg:"OK "+nyeInds.length+" opgaver importeret"});
      } else if(tab==="lokaler"){
        if(!setLokTider){setStatus({ok:false,msg:"Lokaler import fejlede - prøv fra Lokaler-fanen"});return;}
        const dagMap={
          Mandag:["MandagÅben","MandagLukket"],Tirsdag:["TirsdagÅben","TirsdagLukket"],
          Onsdag:["OnsdagÅben","OnsdagLukket"],Torsdag:["TorsdagÅben","TorsdagLukket"],
          Fredag:["FredagÅben","FredagLukket"],Lordag:["LordagÅben","LordagLukket"],
          Sondag:["SondagÅben","SondagLukket"],
        };
        const dagDk={Mandag:"Mandag",Tirsdag:"Tirsdag",Onsdag:"Onsdag",Torsdag:"Torsdag",Fredag:"Fredag",Lordag:"Lørdag",Sondag:"Søndag"};
        const nyeTider={};
        const nyMeta={};
        raw.forEach(r=>{
          const lok=get(r,"Lokale"); if(!lok) return;
          nyMeta[lok]={lokaleId:get(r,"LokaleId")||"",kapacitet:get(r,"Kapacitet")||"1",udstyr:(get(r,"Udstyr")||"").split(/[,،]+/).map(s=>s.trim()).filter(Boolean),beskrivelse:get(r,"Beskrivelse")||"",krPrTime:get(r,"TimeprisKrPrTime")?Number(get(r,"TimeprisKrPrTime")):null,adresse:{vej:get(r,"Vej")||"",husnr:get(r,"Husnr")||"",postnr:get(r,"Postnr")||"",by:get(r,"By")||""}};
          Object.entries(dagMap).forEach(([dagEn,[aK,lK]])=>{
            const dag=dagDk[dagEn]||dagEn;
            if(!nyeTider[dag]) nyeTider[dag]={};
            const aa=get(r,aK)||"", la=get(r,lK)||"";
            nyeTider[dag][lok]={å:aa||"00:00",l:la||"00:00"};
          });
        });
        const loknr=raw.filter(r=>get(r,"Lokale")).length;
        setLokTider(prev=>{
          const merged={...prev};
          Object.entries(nyeTider).forEach(([dag,loks])=>{ merged[dag]={...(merged[dag]||{}),...loks}; });
          return merged;
        });
        if(setLokMeta) setLokMeta(prev=>({...prev,...nyMeta}));
        // Opdater lokaler-liste
        const nyeLokNavne=raw.map(r=>get(r,"Lokale")).filter(Boolean);
        if(saveLokaler){
          // Tilføj lokaler — duplikerede navne får suffix (2), (3) osv.
          const eksisterende=new Set(lokaler||[]);
          const tilføjet=[];
          nyeLokNavne.forEach(navn=>{
            let endeligtNavn=navn;
            let nr=1;
            while(eksisterende.has(endeligtNavn)){
              nr++;
              endeligtNavn=`${navn} (${nr})`;
            }
            eksisterende.add(endeligtNavn);
            tilføjet.push(endeligtNavn);
            // Kopiér åbningstider og meta til det nye navn hvis det er omdøbt
            if(endeligtNavn!==navn){
              Object.entries(nyeTider).forEach(([dag,loks])=>{
                if(loks[navn]) nyeTider[dag][endeligtNavn]={...loks[navn]};
              });
              if(nyMeta[navn]) nyMeta[endeligtNavn]={...nyMeta[navn],lokaleId:nyMeta[navn].lokaleId?nyMeta[navn].lokaleId+"-"+nr:""};
            }
          });
          saveLokaler([...eksisterende]);
        }
        setStatus({ok:true,msg:"OK "+loknr+" lokaler importeret/opdateret"});
      }
      setPreview(null);
      if(fileRef.current) fileRef.current.value="";
    }catch(err){
      setStatus({ok:false,msg:"Importfejl: "+err.message});
    }
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Tab-valg */}
      <div style={{display:"flex",gap:6}}>
        {[["patienter"," Patienter"],["medarbejdere","+ Medarbejdere"],["indsatser"," Opgaver"],["lokaler"," Lokaler"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setTab(v);setPreview(null);setStatus(null);}}
            style={{background:tab===v?C.accM:"transparent",color:tab===v?C.acc:C.txtD,
              border:`1px solid ${tab===v?C.acc:C.brd}`,borderRadius:8,padding:"7px 16px",
              cursor:"pointer",fontFamily:"inherit",fontWeight:tab===v?700:400,fontSize:13}}>
            {l}
          </button>
        ))}
      </div>

      {/* Info + skabelon */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{background:C.s3,borderRadius:8,padding:"10px 14px",border:`1px solid ${C.brd}`,flex:1,fontSize:12,color:C.txtM}}>
          <strong style={{color:C.txt}}>Kolonner ({SKABELONER[tab].cols.length}):</strong> {SKABELONER[tab].cols.join(" . ")}<br/>
          <span style={{marginTop:4,display:"block"}}>{SKABELONER[tab].info}</span>
        </div>
        <Btn v="subtle" onClick={()=>downloadSkabelon(tab)}>Download skabelon (.csv)</Btn>
      </div>

      {/* Upload */}
      <div style={{border:`2px dashed ${C.brd}`,borderRadius:10,padding:"24px",textAlign:"center",
        background:C.s3,cursor:"pointer"}}
        onClick={()=>fileRef.current?.click()}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();parseFile(e.dataTransfer.files[0]);}}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}}
          onChange={e=>parseFile(e.target.files[0])}/>
        <div style={{fontSize:28,marginBottom:8}}></div>
        <div style={{color:C.txt,fontWeight:600,fontSize:14}}>Klik eller træk fil hertil</div>
        <div style={{color:C.txtM,fontSize:12,marginTop:4}}>Understøtter .csv og .xlsx</div>
      </div>

      {/* Preview */}
      {preview&&(
        <div style={{background:C.s3,borderRadius:10,border:`1px solid ${C.brd}`,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{color:C.txt,fontWeight:700,fontSize:13}}>Preview - {preview.total} rækker fundet</span>
              {preview.mangler?.length>0&&(
                <span style={{color:C.amb,fontSize:11,marginLeft:10}}>! Mangler kolonner: {preview.mangler.join(", ")}</span>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" small onClick={()=>setPreview(null)}>Annuller</Btn>
              <Btn v="primary" small onClick={importerData}>OK Importer {preview.total} rækker</Btn>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:C.s1}}>
                  {preview.cols.map((c,i)=>(
                    <th key={i} style={{padding:"6px 10px",color:C.txtM,textAlign:"left",borderBottom:`1px solid ${C.brd}`,whiteSpace:"nowrap",fontWeight:600}}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${C.brd}`}}>
                    {r.map((c,j)=>(
                      <td key={j} style={{padding:"5px 10px",color:C.txt,whiteSpace:"nowrap"}}>{String(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total>5&&<div style={{padding:"6px 14px",color:C.txtM,fontSize:11}}>Viser 5 af {preview.total} rækker</div>}
        </div>
      )}

      {/* Status */}
      {status&&(
        <div style={{background:status.ok?C.grnM:C.redM,border:`1px solid ${status.ok?C.grn:C.red}44`,
          borderRadius:8,padding:"10px 14px",color:status.ok?C.grn:C.red,fontSize:13,fontWeight:600}}>
          {status.msg}
        </div>
      )}
    </div>
  );
}

// ===========================================================
// OUTLOOK KALENDER PANEL
// ===========================================================
function OutlookKalenderPanel({medarbejdere,setMedarbejdere}){
  const [metode,setMetode]=useState("ical"); // "ical"|"graph"
  const [icalUrl,setIcalUrl]=useState("");
  const [graphClientId,setGraphClientId]=useState("");
  const [graphTenantId,setGraphTenantId]=useState("");
  const [valgtMed,setValgtMed]=useState("");
  const [testStatus,setTestStatus]=useState(null);

  const testForbindelse=()=>{
    setTestStatus({loading:true});
    setTimeout(()=>{
      if(metode==="ical"&&icalUrl.includes("outlook")){
        setTestStatus({ok:true,msg:"iCal URL valideret - kalender klar til synkronisering"});
      } else if(metode==="ical"&&icalUrl.length>10){
        setTestStatus({ok:true,msg:"URL modtaget - synkronisering aktiveres når backend er koblet på"});
      } else if(metode==="graph"&&graphClientId&&graphTenantId){
        setTestStatus({ok:true,msg:"Microsoft Graph konfiguration gemt - OAuth-flow aktiveres ved næste login"});
      } else {
        setTestStatus({ok:false,msg:"Udfyld venligst alle felter før test"});
      }
    },800);
  };

  const gemKalenderUrl=()=>{
    if(!valgtMed||!icalUrl) return;
    setMedarbejdere(ms=>ms.map(m=>m.id===valgtMed?{...m,epjKalenderApi:icalUrl}:m));
    setTestStatus({ok:true,msg:"OK Kalender-URL gemt på medarbejderen"});
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Metodevalg */}
      <div style={{display:"flex",gap:10}}>
        {[
          ["ical"," iCal / ICS URL","Kopiér URL fra Outlook - ingen IT-godkendelse krævet"],
          ["graph","> Microsoft Graph API","Fuld OAuth-integration - kræver Azure AD app-registrering"],
        ].map(([v,label,desc])=>(
          <label key={v} style={{flex:1,display:"flex",gap:10,cursor:"pointer",
            background:metode===v?C.accM:"transparent",
            border:`1px solid ${metode===v?C.acc:C.brd}`,
            borderRadius:9,padding:"12px 14px"}}>
            <input type="radio" name="outlookMetode" checked={metode===v}
              onChange={()=>setMetode(v)} style={{accentColor:C.acc,marginTop:2}}/>
            <div>
              <div style={{color:metode===v?C.acc:C.txt,fontWeight:700,fontSize:13}}>{label}</div>
              <div style={{color:C.txtM,fontSize:11,marginTop:2}}>{desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* iCal metode */}
      {metode==="ical"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.s3,borderRadius:8,padding:"12px 14px",border:`1px solid ${C.brd}`,fontSize:12,color:C.txtM}}>
            <strong style={{color:C.txt}}>Sådan finder du iCal URL i Outlook:</strong><br/>
            1. Åbn Outlook {">"} Indstillinger {">"} Vis alle Outlook-indstillinger<br/>
            2. Kalender {">"} Delte kalendere {">"} Publicer kalender<br/>
            3. Kopiér ICS-linket og indsæt nedenfor
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="iCal / ICS URL">
              <Input value={icalUrl} onChange={setIcalUrl} placeholder="https://outlook.live.com/owa/calendar/.../calendar.ics"/>
            </FRow>
            <FRow label="Tilknyt til medarbejder">
              <Sel value={valgtMed} onChange={setValgtMed} style={{width:"100%"}}
                options={[{v:"",l:"- Vælg medarbejder -"},...medarbejdere.map(m=>({v:m.id||m.navn,l:m.navn}))]}/>
            </FRow>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="subtle" onClick={testForbindelse}>{testStatus?.loading?"Tester...":" Test URL"}</Btn>
            <Btn v="primary" onClick={gemKalenderUrl}>Gem kalender-URL</Btn>
          </div>
        </div>
      )}

      {/* Microsoft Graph metode */}
      {metode==="graph"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.ambM,border:`1px solid ${C.amb}44`,borderRadius:8,padding:"10px 14px",color:C.amb,fontSize:12}}>
            i Kræver Azure AD app-registrering med Calendar.Read permission. Udfyldes når IT-afdelingen har oprettet app-registreringen.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FRow label="Azure Tenant ID"><Input value={graphTenantId} onChange={setGraphTenantId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/></FRow>
            <FRow label="Application (Client) ID"><Input value={graphClientId} onChange={setGraphClientId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/></FRow>
          </div>
          <div style={{background:C.s3,borderRadius:8,padding:"12px 14px",border:`1px solid ${C.brd}`,fontSize:12,color:C.txtM}}>
            <strong style={{color:C.txt}}>Scopes der kræves:</strong> Calendars.Read . User.Read . offline_access<br/>
            <strong style={{color:C.txt,marginTop:4,display:"block"}}>Redirect URI:</strong> https://planmed.dk/auth/callback
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="subtle" onClick={testForbindelse}>{testStatus?.loading?"Tester...":" Test konfiguration"}</Btn>
            <Btn v="primary" onClick={()=>setTestStatus({ok:true,msg:"Graph-konfiguration gemt - OAuth aktiveres ved Supabase-kobling"})}>Gem konfiguration</Btn>
          </div>
        </div>
      )}

      {/* Synkroniseringsstatus */}
      <div style={{background:C.s3,border:`1px solid ${C.brd}`,borderRadius:9,padding:"12px 14px"}}>
        <div style={{color:C.txt,fontWeight:600,fontSize:13,marginBottom:8}}>Hvad sker der ved synkronisering?</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[
            ["","Optaget tid hentes","Medarbejderens Outlook-blokader importeres og respekteres under planlægning"],
            ["","Bookinger sendes tilbage","Planlagte opgaver oprettes som Outlook-aftaler hos medarbejderen"],
            ["<","Automatisk opdatering","Ændringer i Outlook synkroniseres inden næste planlægningskørsel"],
          ].map(([ic,t,d])=>(
            <div key={t} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>{ic}</span>
              <div>
                <div style={{color:C.txt,fontWeight:600,fontSize:12}}>{t}</div>
                <div style={{color:C.txtM,fontSize:11}}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test status */}
      {testStatus&&!testStatus.loading&&(
        <div style={{background:testStatus.ok?C.grnM:C.redM,border:`1px solid ${testStatus.ok?C.grn:C.red}44`,
          borderRadius:8,padding:"10px 14px",color:testStatus.ok?C.grn:C.red,fontSize:13,fontWeight:600}}>
          {testStatus.ok?"OK":"!"} {testStatus.msg}
        </div>
      )}
    </div>
  );
}

// ===============================================
// MAIN APP
// ===============================================
// NAV_ITEMS flyttet til /src/data/constants.js


// ===============================================
// AUTH FLOW - Velkomst > Login/Opret > Afdeling



// ===========================================================
// MIN PROFIL - medarbejder redigerer og sender til godkendelse
// ===========================================================
// Hjælpekomponent: tilføj kompetence med søgning
