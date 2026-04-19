// Forløb/Opgaver-klynge: ForlobView + tilknyttede sub-komponenter.
// IndsatsForm deles med Lokaler-siden og importeres derfra.
import React, { useState, useMemo } from "react";
import { uid } from "../utils/index.js";
import { C, ALLE_K, BASE_MED, LK, PK, PD, TITLE_C, buildPatient } from "../data/constants.js";
import { Btn, Input, Sel, Modal, FRow, Pill, ViewHeader } from "../components/primitives.jsx";
import { IndsatsForm, UdstyrPanel } from "./LokalerView.jsx";
import { MedForm } from "./MedarbejderView.jsx";

function CertifikaterTab({certifikater=[],setCertifikater}){
  const certs=certifikater;
  const setCerts=setCertifikater||(()=>{});
  const [nytNavn, setNytNavn] = React.useState("");
  const [nytBeskrivelse, setNytBeskrivelse] = React.useState("");
  const [nytKategori, setNytKategori] = React.useState("");
  const [fejl, setFejl] = React.useState("");
  const [redigerer, setRedigerer] = React.useState(null);
  const [nyKatNavn, setNyKatNavn] = React.useState("");
  const [editKatId, setEditKatId] = React.useState(null);
  const [editKatNavn, setEditKatNavn] = React.useState("");

  // Kategorier: udled fra certifikater + evt. tomme kategorier gemt i _certKategorier
  const [extraKats, setExtraKats] = React.useState(()=>{try{const s=localStorage.getItem("planmed_certKategorier");return s?JSON.parse(s):[];}catch(e){return[];}});
  const saveExtraKats=(v)=>{setExtraKats(v);try{localStorage.setItem("planmed_certKategorier",JSON.stringify(v));}catch(e){}};

  // Alle kategorier: fra certifikater + ekstra
  const kategorier=React.useMemo(()=>{
    const fraKat=[...new Set(certs.map(c=>c.kategori).filter(Boolean))];
    const ekstra=extraKats.filter(k=>!fraKat.includes(k));
    return[...fraKat,...ekstra].sort();
  },[certs,extraKats]);

  const addKat=()=>{
    const n=nyKatNavn.trim();
    if(!n||kategorier.includes(n))return;
    saveExtraKats([...extraKats,n]);
    setNyKatNavn("");
  };
  const delKat=(kat)=>{
    // Fjern kategori fra alle certifikater i den + fjern fra ekstra
    setCerts(p=>p.map(c=>c.kategori===kat?{...c,kategori:""}:c));
    saveExtraKats(extraKats.filter(k=>k!==kat));
  };
  const renameKat=(oldName,newName)=>{
    const n=newName.trim();if(!n||n===oldName)return;
    setCerts(p=>p.map(c=>c.kategori===oldName?{...c,kategori:n}:c));
    saveExtraKats(extraKats.map(k=>k===oldName?n:k));
    if(nytKategori===oldName) setNytKategori(n);
  };

  const tilfoej = () => {
    if(!nytNavn.trim()){setFejl("Certifikatnavn er paakraevet");return;}
    if(certs.find(cc=>cc.navn.toLowerCase()===nytNavn.trim().toLowerCase())){setFejl("Et certifikat med dette navn findes allerede");return;}
    setCerts(prev=>[...prev,{id:"c"+Date.now(),navn:nytNavn.trim(),beskrivelse:nytBeskrivelse.trim(),kategori:nytKategori}]);
    setNytNavn(""); setNytBeskrivelse(""); setFejl("");
  };

  const slet = (id) => setCerts(prev=>prev.filter(cc=>cc.id!==id));

  // Gruppér certifikater efter kategori
  const udenKat=certs.filter(c=>!c.kategori);
  const medKat=kategorier.map(k=>({kat:k,certs:certs.filter(c=>c.kategori===k)}));

  const CertKort=({cc})=>(
    <div key={cc.id} style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
      {redigerer===cc.id ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
          <Input value={cc.navn} onChange={v=>setCerts(p=>p.map(x=>x.id===cc.id?{...x,navn:v}:x))} placeholder="Certifikatnavn"/>
          <Input value={cc.beskrivelse||""} onChange={v=>setCerts(p=>p.map(x=>x.id===cc.id?{...x,beskrivelse:v}:x))} placeholder="Beskrivelse (valgfri)"/>
          <Sel value={cc.kategori||""} onChange={v=>setCerts(p=>p.map(x=>x.id===cc.id?{...x,kategori:v}:x))}
            options={[{v:"",l:"Ingen kategori"},...kategorier.map(k=>({v:k,l:k}))]}/>
          <Btn v="primary" small onClick={()=>setRedigerer(null)}>Gem</Btn>
        </div>
      ) : (
        <div style={{flex:1}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:14}}>{cc.navn}</div>
          {cc.beskrivelse&&<div style={{color:C.txtM,fontSize:12,marginTop:2}}>{cc.beskrivelse}</div>}
        </div>
      )}
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        <Btn v="outline" small onClick={()=>setRedigerer(redigerer===cc.id?null:cc.id)}>~ Rediger</Btn>
        <Btn v="danger" small onClick={()=>slet(cc.id)}>X</Btn>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:700}}>
      <div style={{color:C.txtM,fontSize:12}}>
        Certifikater defineres her og kan tildeles medarbejdere under fanen <strong style={{color:C.txt}}>Medarbejdere</strong>.
        Brug kategorier til at organisere certifikater.
      </div>

      {/* Kategorier administration */}
      <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"14px 16px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:10}}>Kategorier</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {kategorier.map(kat=>(
            <div key={kat} style={{display:"flex",alignItems:"center",gap:4,background:C.accM,border:`1px solid ${C.acc}44`,borderRadius:7,padding:"4px 10px"}}>
              {editKatId===kat?(
                <div style={{display:"flex",gap:4}}>
                  <input value={editKatNavn} onChange={e=>setEditKatNavn(e.target.value)} autoFocus
                    onKeyDown={e=>{if(e.key==="Enter"){renameKat(kat,editKatNavn);setEditKatId(null);}if(e.key==="Escape")setEditKatId(null);}}
                    style={{width:100,padding:"2px 4px",borderRadius:4,border:`1px solid ${C.brd}`,background:C.s1,color:C.txt,fontSize:12,fontFamily:"inherit"}}/>
                  <button onClick={()=>{renameKat(kat,editKatNavn);setEditKatId(null);}}
                    style={{background:"none",border:"none",color:C.acc,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>OK</button>
                </div>
              ):(
                <span style={{color:C.acc,fontSize:12,fontWeight:600,cursor:"pointer"}}
                  onClick={()=>{setEditKatId(kat);setEditKatNavn(kat);}}>{kat}</span>
              )}
              <span style={{color:C.txtM,fontSize:10}}>({certs.filter(c=>c.kategori===kat).length})</span>
              <button onClick={()=>delKat(kat)}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:0,lineHeight:1,fontFamily:"inherit"}}>x</button>
            </div>
          ))}
          {kategorier.length===0&&<span style={{color:C.txtM,fontSize:12}}>Ingen kategorier oprettet</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={nyKatNavn} onChange={e=>setNyKatNavn(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addKat();}}
            placeholder="Ny kategori..."
            style={{flex:1,padding:"6px 10px",borderRadius:7,border:`1px solid ${C.brd}`,background:C.s3,color:C.txt,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={addKat}
            style={{padding:"6px 14px",borderRadius:7,border:"none",background:C.acc,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            + Kategori
          </button>
        </div>
      </div>

      {/* Certifikater grupperet efter kategori */}
      {medKat.map(({kat,certs:kCerts})=>kCerts.length>0&&(
        <div key={kat}>
          <div style={{color:C.acc,fontWeight:700,fontSize:13,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
            {kat} <Pill color={C.txtM} bg={C.s3} sm>{kCerts.length}</Pill>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {kCerts.map(cc=><CertKort key={cc.id} cc={cc}/>)}
          </div>
        </div>
      ))}

      {/* Uden kategori */}
      {udenKat.length>0&&(
        <div>
          {kategorier.length>0&&<div style={{color:C.txtM,fontWeight:700,fontSize:13,marginBottom:6}}>Uden kategori</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {udenKat.map(cc=><CertKort key={cc.id} cc={cc}/>)}
          </div>
        </div>
      )}

      {certs.length===0&&(
        <div style={{color:C.txtM,textAlign:"center",padding:32,border:"2px dashed "+C.brd,borderRadius:12}}>
          Ingen certifikater oprettet endnu
        </div>
      )}

      {/* Opret nyt */}
      <div style={{background:C.s2,border:"1px solid "+C.brd,borderRadius:12,padding:"16px 18px"}}>
        <div style={{color:C.txt,fontWeight:700,fontSize:14,marginBottom:12}}>+ Opret nyt certifikat</div>
        <FRow label="Certifikatnavn">
          <Input value={nytNavn} onChange={v=>{setNytNavn(v);setFejl("");}} placeholder="f.eks. ADOS-2"/>
        </FRow>
        <FRow label="Beskrivelse (valgfri)">
          <Input value={nytBeskrivelse} onChange={setNytBeskrivelse} placeholder="Kort beskrivelse af certifikatet"/>
        </FRow>
        {kategorier.length>0&&(
          <FRow label="Kategori">
            <Sel value={nytKategori} onChange={setNytKategori}
              options={[{v:"",l:"Ingen kategori"},...kategorier.map(k=>({v:k,l:k}))]}/>
          </FRow>
        )}
        {fejl&&<div style={{color:C.red,fontSize:12,marginBottom:8}}>{fejl}</div>}
        <Btn v="primary" onClick={tilfoej}>Tilfoej certifikat</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// IndsatsPanelModal — oversigt over alle indsatser med stilling
// og masse-tildeling til medarbejdere
// ══════════════════════════════════════════════════════════════
function IndsatsPanelModal({indsatser=[], medarbejdere=[], setIndsatser, setMedarbejdere, onClose, onNy}) {
  const [søg, setSøg] = React.useState("");
  const [valgtTitel, setValgtTitel] = React.useState(null); // til masse-tildeling
  const [tildelStatus, setTildelStatus] = React.useState(null);

  // Gruppér indsatser efter muligeMedarbejdere titler
  const titler = ["Psykolog","Læge","Pædagog"];
  const TITEL_FARVE = {Psykolog:C.acc, Læge:C.grn, Pædagog:C.pur};
  const TITEL_BG    = {Psykolog:C.accM, Læge:C.grnM, Pædagog:C.purM};

  const getTitler = (ind) => {
    const mm = ind.muligeMed||[];
    const fundet = titler.filter(t=>mm.includes(t));
    return fundet.length>0 ? fundet : ["Alle"];
  };

  const filtreret = indsatser.filter(ind=>{
    const match = søg===""||
      (ind.opgave||ind.navn||"").toLowerCase().includes(søg.toLowerCase())||
      getTitler(ind).some(t=>t.toLowerCase().includes(søg.toLowerCase()));
    return match;
  });

  // Masse-tildeling: giv alle medarbejdere med given titel
  // alle indsatser der matcher titlen som kompetence
  const masseTildel = (titel) => {
    const relevante = indsatser.filter(ind=>getTitler(ind).includes(titel));
    const kompNavne = relevante.map(ind=>ind.opgave||ind.navn||"").filter(Boolean);
    if(kompNavne.length===0){setTildelStatus(`Ingen opgaver fundet for ${titel}`);return;}
    let antal=0;
    setMedarbejdere(prev=>prev.map(m=>{
      if(m.titel!==titel) return m;
      const nye=[...new Set([...(m.kompetencer||[]),...kompNavne])];
      if(nye.length!==(m.kompetencer||[]).length) antal++;
      return {...m,kompetencer:nye};
    }));
    setTildelStatus(`OK ${kompNavne.length} opgaver tildelt alle ${titel.toLowerCase()}r (${medarbejdere.filter(m=>m.titel===titel).length} medarbejdere opdateret)`);
    setTimeout(()=>setTildelStatus(null),4000);
  };

  return(
    <Modal title="Opgaveoversigt" onClose={onClose} w={760}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Søg + tilføj */}
        <div style={{display:"flex",gap:8}}>
          <input value={søg} onChange={e=>setSøg(e.target.value)} placeholder="Søg opgave eller stilling..."
            style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.brd}`,
              background:C.s3,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          <Btn v="primary" onClick={onNy}>+ Ny opgave</Btn>
        </div>

        {/* Masse-tildeling sektion */}
        <div style={{background:C.s3,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.brd}`}}>
          <div style={{fontSize:12,fontWeight:600,color:C.txt,marginBottom:8}}>
            Tildel alle opgaver til stilling
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {titler.map(t=>{
              const antal=indsatser.filter(ind=>getTitler(ind).includes(t)).length;
              const medAntal=medarbejdere.filter(m=>m.titel===t).length;
              return(
                <button key={t} onClick={()=>masseTildel(t)}
                  style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${TITEL_FARVE[t]||C.acc}`,
                    background:TITEL_BG[t]||C.accM,color:TITEL_FARVE[t]||C.acc,
                    fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                    display:"flex",alignItems:"center",gap:6}}>
                  <span>{t}</span>
                  <span style={{opacity:0.7,fontSize:11}}>{antal} opgaver · {medAntal} med.</span>
                </button>
              );
            })}
          </div>
          {tildelStatus&&(
            <div style={{marginTop:8,fontSize:12,color:C.grn,fontWeight:500}}>{tildelStatus}</div>
          )}
        </div>

        {/* Indsats liste grupperet efter stilling */}
        <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:420,overflowY:"auto"}}>
          {filtreret.length===0&&(
            <div style={{color:C.txtM,fontSize:13,textAlign:"center",padding:32}}>
              Ingen opgaver matcher søgningen
            </div>
          )}
          {filtreret.map(ind=>{
            const stilTitler = getTitler(ind);
            const navn = ind.opgave||ind.navn||"Uden navn";
            const min = ind.minutter||60;
            const grp = ind.indsatsGruppe||ind.certifikat||"";
            return(
              <div key={ind.id} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 12px",borderRadius:8,background:C.s2,
                border:`1px solid ${C.brd}44`}}>
                {/* Stilling badges */}
                <div style={{display:"flex",gap:4,flexShrink:0,minWidth:160}}>
                  {stilTitler.map(t=>(
                    <span key={t} style={{padding:"2px 8px",borderRadius:12,fontSize:10,fontWeight:700,
                      background:TITEL_BG[t]||C.s3,color:TITEL_FARVE[t]||C.txtM,
                      border:`1px solid ${TITEL_FARVE[t]||C.brd}44`}}>
                      {t}
                    </span>
                  ))}
                </div>
                {/* Navn */}
                <div style={{flex:1,fontSize:13,fontWeight:500,color:C.txt}}>{navn}</div>
                {/* Varighed */}
                <div style={{fontSize:11,color:C.txtM,flexShrink:0}}>{min} min</div>
                {/* Gruppe/certifikat */}
                {grp&&<div style={{fontSize:10,color:C.txtM,background:C.s3,padding:"2px 8px",
                  borderRadius:10,border:`1px solid ${C.brd}`,flexShrink:0}}>{grp}</div>}
                {/* Lokaler */}
                <div style={{fontSize:10,color:C.txtM,flexShrink:0,maxWidth:120,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {(ind.muligeLok||[]).join(", ")||"—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bundlinje */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          borderTop:`1px solid ${C.brd}`,paddingTop:10}}>
          <span style={{fontSize:12,color:C.txtM}}>
            {filtreret.length} af {indsatser.length} opgaver
          </span>
          <Btn v="ghost" onClick={onClose}>Luk</Btn>
        </div>
      </div>
    </Modal>
  );
}


export default function ForlobView({forlob,setForlob,medarbejdere,setMedarbejdere,indsatser,setIndsatser,certifikater=[],setCertifikater,lokaler=[],setPatienter,adminData={}}){
  const [tab,setTab]=useState("indsatser"); // "indsatser" | "forlob" | "certifikater"

  // -- Indsats state --
  const [editIns, setEditIns]  = useState(null);  // indsats-objekt |
  const [visIndsatsPanel, setVisIndsatsPanel] = useState(false);
  const [tildelTitel, setTildelTitel] = useState(null); // til masse-tildeling "ny"
  const [delIns,  setDelIns]   = useState(null);

  const saveIns = (data) => {
    if(data.id && indsatser.find(x=>x.id===data.id)) {
      setIndsatser(ps=>ps.map(x=>x.id===data.id?data:x));
    } else {
      setIndsatser(ps=>[...ps,{...data,id:`ins_${uid()}`}]);
    }
    setEditIns(null);
  };
  const sletIns = (id) => { setIndsatser(ps=>ps.filter(x=>x.id!==id)); setDelIns(null); };

  // -- Forløb state --
  const [selId,setSelId]=useState(Object.keys(forlob)[0]||"1");
  const [editOpg,setEditOpg]=useState(null);
  const [nytForlob,setNytForlob]=useState(false);
  const [delForlob,setDelForlob]=useState(null);
  const fl=forlob[selId]||[];
  // Filtrer forløb der har mindst ét element ud
const ids=Object.keys(forlob).filter(k=>(forlob[k]||[]).length>0).sort((a,b)=>Number(a)-Number(b));

  // ── Synkroniser forløbsændringer til patienter ──
  // Gen-bygger opgaver fra forløbet og bevarer status/dato fra eksisterende
  const syncForlobTilPatienter = (forlobNr, nyeForlobOpgaver) => {
    setPatienter(ps=>ps.map(p=>{
      if(String(p.forlobNr)!==String(forlobNr)) return p;
      // Byg nye opgaver fra det opdaterede forløb
      const nyBuild = buildPatient({...p, forlobNr}, {[forlobNr]:nyeForlobOpgaver}).opgaver;
      // Bevar planlagt-status fra eksisterende opgaver (match på opgavenavn)
      const merged = nyBuild.map(ny=>{
        const eksist = p.opgaver.find(e=>e.opgave===ny.opgave);
        if(eksist) {
          // Bevar dato/tid/medarbejder/status, men tag ny sekvens
          return {...eksist, sekvens:ny.sekvens, indsatsGruppe:ny.indsatsGruppe};
        }
        return ny;
      });
      // Tilføj manuelt tilføjede opgaver (sekvens >= 999)
      const manuelle = p.opgaver.filter(o=>o.sekvens>=999);
      return {...p, opgaver:[...merged,...manuelle]};
    }));
  };

  const saveOpg=(idx,data)=>{
    let nyeOpgaver;
    setForlob(prev=>{
      nyeOpgaver=[...(prev[selId]||[])];
      if(idx==="ny") nyeOpgaver.push({...data,s:nyeOpgaver.length+1});
      else nyeOpgaver[idx]={...data,s:idx+1};
      return {...prev,[selId]:nyeOpgaver};
    });
    setEditOpg(null);
    // Sync sekvens til patienter
    setTimeout(()=>{if(nyeOpgaver) syncForlobTilPatienter(selId, nyeOpgaver);},0);
  };
  const deleteOpg=(idx)=>{
    let nyeOpgaver;
    setForlob(prev=>{
      nyeOpgaver=(prev[selId]||[]).filter((_,i)=>i!==idx).map((o,i)=>({...o,s:i+1}));
      return {...prev,[selId]:nyeOpgaver};
    });
    setTimeout(()=>{if(nyeOpgaver) syncForlobTilPatienter(selId, nyeOpgaver);},0);
  };
  const moveOpg=(idx,dir)=>{
    let nyeOpgaver;
    setForlob(prev=>{
      nyeOpgaver=[...(prev[selId]||[])];
      const ni=idx+dir;
      if(ni<0||ni>=nyeOpgaver.length) return prev;
      [nyeOpgaver[idx],nyeOpgaver[ni]]=[nyeOpgaver[ni],nyeOpgaver[idx]];
      nyeOpgaver=nyeOpgaver.map((o,i)=>({...o,s:i+1}));
      return {...prev,[selId]:nyeOpgaver};
    });
    setTimeout(()=>{if(nyeOpgaver) syncForlobTilPatienter(selId, nyeOpgaver);},0);
  };
  const opretForlob=()=>{
    const nk=String(Math.max(0,...Object.keys(forlob).map(Number))+1);
    setForlob(prev=>({...prev,[nk]:[]}));
    setSelId(nk);
    setNytForlob(false);
  };
  const sletForlob=(id)=>{
    // Fjern forløb-tilknytning fra patienter der bruger dette forløb
    setPatienter(ps=>ps.map(p=>p.forlobNr==id?{...p,forlobNr:null,forlobLabel:null,opgaver:p.opgaver.filter(o=>o.fraForlob!==id)}:p));
    setForlob(prev=>{const n={...prev};delete n[id];return n;});
    setSelId(ids.find(i=>i!==id)||ids[0]||"1");
    setDelForlob(null);
  };

  // -- Medarbejder CRUD (Certifikater-tab) --
  const [medSøg,setMedSøg]=useState("");
  const [medFilt,setMedFilt]=useState("alle");
  const [editMed,setEditMed]=useState(null);
  const [delMed,setDelMed]=useState(null);
  const filtMed=medarbejdere.filter(m=>{
    if(medFilt!=="alle"&&m.titel!==medFilt) return false;
    if(medSøg&&!m.navn.toLowerCase().includes(medSøg.toLowerCase())) return false;
    return true;
  });
  const saveMed=(data)=>{
    if(data.id){ setMedarbejdere(ms=>ms.map(m=>m.id===data.id?{...m,...data}:m)); }
    else { setMedarbejdere(ms=>[...ms,{...data,id:`m_${uid()}`}]); }
    setEditMed(null);
  };
  const sletMed=(id)=>{ setMedarbejdere(ms=>ms.filter(m=>m.id!==id)); setDelMed(null); };

  // -- Tab bar --
  const TABS = [
    {id:"indsatser",   label:" Opgaver"},
    {id:"forlob",      label:" Forløb"},
    {id:"certifikater",label:"* Certifikater"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 140px)",gap:0}}>
      <ViewHeader titel="Opgaver" undertitel="Forløbstyper og opgaveskabeloner"/>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:tab===t.id?C.accM:"transparent",color:tab===t.id?C.acc:C.txtD,border:`1px solid ${tab===t.id?C.acc:C.brd}`,borderRadius:8,padding:"7px 16px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===t.id?700:400}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* -- TAB: INDSATSER -- */}
      {tab==="indsatser"&&(
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <div style={{display:"flex",gap:6}}>
              <Btn v="outline" onClick={()=>setVisIndsatsPanel(true)}>Opgaveoversigt</Btn>
              <Btn v="primary" onClick={()=>setEditIns("ny")}>+ Ny opgave</Btn>
            </div>
          </div>

          {indsatser.length===0&&(
            <div style={{color:C.txtM,textAlign:"center",padding:40,border:`2px dashed ${C.brd}`,borderRadius:12}}>
              Ingen opgaver endnu - klik + Ny opgave
            </div>
          )}

          {indsatser.map(ins=>{
            // Understøt både gammelt format (elementer) og nyt fladt format (fra Excel)
            const isFlad = !ins.elementer && (ins.opgave||ins.muligeMed);
            const els = isFlad
              ? [{id:ins.id,opgave:ins.opgave||ins.navn||"",minutter:ins.minutter||60,
                  muligeMed:ins.muligeMed||[],muligeLok:ins.muligeLok||[],
                  certifikat:ins.certifikat||"",samMed:false,patInv:ins.patInv||false,
                  tidligst:ins.tidligst||"08:00",senest:ins.senest||"17:00",sekvens:ins.sekvens||1}]
              : (ins.elementer||[]);
            const insNavn = ins.indsatsGruppe||ins.navn||ins.opgave||"(uden navn)";
            const samMedCount = els.filter(e=>e.samMed).length;
            const certCount   = els.filter(e=>e.certifikat).length;
            const totalMin    = isFlad ? (ins.minutter||60) : els.reduce((a,e)=>a+e.minutter,0);
            return(
              <div key={ins.id} style={{background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1}}>
                    {/* Gruppenavn + totaltid */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{color:C.txt,fontWeight:800,fontSize:15}}>{insNavn}</div>
                      <Pill color={C.acc} bg={C.accM} sm>{els.length} elementer</Pill>
                      <Pill color={C.txtD} bg={C.s3} sm>{totalMin} min total</Pill>
                      {certCount>0&&<Pill color={C.amb} bg={C.ambM} sm>* {certCount} cert.krav</Pill>}
                    </div>
                    {/* Sekvensvisning */}
                    {els.length>0&&(
                      <div style={{background:C.s3,borderRadius:8,padding:"8px 12px"}}>
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {els.map((el,i)=>{
                            const erFørste = i===0;
                            const numC = erFørste ? C.acc : C.pur;
                            return(
                              <div key={el.id} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
                                <div style={{width:20,height:20,borderRadius:"50%",background:`${numC}22`,color:numC,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{i+1}</div>
                                <span style={{color:C.txt,fontWeight:600,minWidth:110}}>{el.opgave||el.navn||"(uden navn)"}</span>
                                <Pill color={C.acc} bg={C.accM} sm>{el.minutter} min</Pill>
                                {el.patInv&&<Pill color={C.grn} bg={C.grnM} sm> Patient</Pill>}
                                {!erFørste&&el.samMed&&<Pill color={C.acc} bg={C.accM} sm>= med.</Pill>}
                                {erFørste&&<Pill color={C.txtD} bg={C.s1} sm>sætter med.</Pill>}
                                {el.certifikat&&<Pill color={C.amb} bg={C.ambM} sm>* {el.certifikat.split("  ")[0]}</Pill>}
                                {(el.lokaler||[]).slice(0,3).map(l=><Pill key={l} color={C.blue} bg={C.blueM} sm>{l}</Pill>)}
                                {(el.lokaler||[]).length>3&&<span style={{color:C.txtM,fontSize:10}}>+{el.lokaler.length-3}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>setEditIns(ins)} style={{background:C.s1,color:C.txtD,border:`1px solid ${C.brd}`,borderRadius:7,padding:"4px 11px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>~ Rediger</button>
                    <button onClick={()=>setDelIns(ins)} style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>X</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- TAB: FORLØB -- */}
      {tab==="forlob"&&(
        <div style={{display:"flex",gap:12,flex:1,overflow:"hidden"}}>
          <div style={{width:190,flexShrink:0,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.txt,fontWeight:700,fontSize:13}}>Forløb</span>
              <button onClick={()=>setNytForlob(true)} style={{background:C.accM,color:C.acc,border:`1px solid ${C.acc}44`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700}}>+ Ny</button>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {ids.map(k=>{
                const act=selId===k;
                return(
                  <div key={k} onClick={()=>setSelId(k)} style={{padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.brd}`,background:act?C.accM:"transparent",borderLeft:`3px solid ${act?C.acc:"transparent"}`,display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.txt,fontSize:12,fontWeight:act?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Forløb nr. {k}</div>
                      <div style={{color:C.txtM,fontSize:10,marginTop:1}}>{forlob[k]?.length||0} opgaver</div>
                    </div>
                    {act&&<button onClick={e=>{e.stopPropagation();setDelForlob(k)}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:11,padding:"1px 3px",flexShrink:0}}>X</button>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{flex:1,background:C.s2,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:C.txt,fontWeight:800,fontSize:16}}>Forløb nr. {selId}</div>
                <div style={{color:C.txtM,fontSize:12}}>{fl.length} opgaver . {fl.filter(x=>x.p).length} med patient . {fl.reduce((a,x)=>a+x.m,0)} min total</div>
              </div>
              <Btn v="primary" onClick={()=>setEditOpg({idx:"ny",data:{o:ALLE_K[0],m:45,p:false,tl:"08:00",ss:"17:00",l:["Kontor"]}})} small>+ Ny opgave</Btn>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:10}}>
              {fl.length===0&&<div style={{color:C.txtM,padding:24,textAlign:"center"}}>Ingen opgaver endnu. Tilføj en opgave ovenfor.</div>}
              {fl.map((f,i)=>{
                const isLæge=f.o.includes("Læge"),isPsy=f.o.includes("Psykolog"),isPæd=f.o.includes("Pædagog");
                const c=isLæge?C.acc:isPsy?C.blue:isPæd?C.pur:C.txtD;
                const kompMed=BASE_MED.filter(m=>m.kompetencer.includes(f.o)).length;
                return(
                  <div key={i} style={{background:C.s3,borderRadius:9,padding:"10px 13px",marginBottom:6,border:`1px solid ${C.brd}`,display:"flex",gap:9,alignItems:"flex-start"}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:`${c}22`,color:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{f.s}</div>
                      <button onClick={()=>moveOpg(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?C.txtM:C.txtD,cursor:i===0?"default":"pointer",fontSize:10,padding:0,lineHeight:1}}>^</button>
                      <button onClick={()=>moveOpg(i,1)} disabled={i===fl.length-1} style={{background:"none",border:"none",color:i===fl.length-1?C.txtM:C.txtD,cursor:i===fl.length-1?"default":"pointer",fontSize:10,padding:0,lineHeight:1}}>v</button>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.txt,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.o}</div>
                      <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                        <Pill color={c} bg={`${c}18`} sm>{f.m} min</Pill>
                        {f.p&&<Pill color={C.grn} bg={C.grnM} sm> Patient</Pill>}
                        <Pill color={C.txtD} bg={C.s1} sm>{f.tl}-{f.ss}</Pill>
                        <Pill color={C.pur} bg={C.purM} sm>{kompMed} medarbej.</Pill>
                        {f.l.map(l=><Pill key={l} color={C.blue} bg={C.blueM} sm>{l}</Pill>)}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:5,flexShrink:0}}>
                      <button onClick={()=>setEditOpg({idx:i,data:{...f}})} style={{background:C.s1,color:C.txtD,border:`1px solid ${C.brd}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>~ Rediger</button>
                      <button onClick={()=>deleteOpg(i)} style={{background:C.redM,color:C.red,border:`1px solid ${C.red}44`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>X</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -- TAB: CERTIFIKATER -- */}
      {tab==="certifikater"&&(
        <CertifikaterTab certifikater={certifikater} setCertifikater={setCertifikater}/>
      )}

      {/* -- Modals: Indsats -- */}
      {visIndsatsPanel&&<IndsatsPanelModal indsatser={indsatser} medarbejdere={medarbejdere} setIndsatser={setIndsatser} setMedarbejdere={setMedarbejdere} onClose={()=>setVisIndsatsPanel(false)} onNy={()=>{setVisIndsatsPanel(false);setEditIns("ny");}}/>}
      {editIns&&(
        <Modal title={editIns==="ny"?"Ny opgave":`Rediger: ${editIns.navn||"opgave"}`} onClose={()=>setEditIns(null)} w={680}>
          <IndsatsForm indsats={editIns==="ny"?null:editIns} onSave={saveIns} onClose={()=>setEditIns(null)} lokaler={lokaler}/>
        </Modal>
      )}
      {delIns&&(
        <Modal title="Slet opgave?" onClose={()=>setDelIns(null)} w={400}>
          <div style={{color:C.txtD,marginBottom:16,lineHeight:1.6}}>
            Slet <strong style={{color:C.txt}}>{delIns.navn}</strong> med {delIns.elementer?.length||0} elementer?
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelIns(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>sletIns(delIns.id)}>Slet permanent</Btn>
          </div>
        </Modal>
      )}

      {/* -- Modals: Forløb -- */}
      {editOpg&&(
        <Modal title={editOpg.idx==="ny"?"Ny opgave":"Rediger opgave"} onClose={()=>setEditOpg(null)} w={600}>
          <OpgaveForm data={editOpg.data} onSave={d=>saveOpg(editOpg.idx,d)} onClose={()=>setEditOpg(null)} lokaler={lokaler}/>
        </Modal>
      )}
      {nytForlob&&(
        <Modal title="Nyt forløb" onClose={()=>setNytForlob(false)} w={400}>
          <div style={{color:C.txtD,marginBottom:12,fontSize:13}}>Et nyt tomt forløb oprettes som nr. {Math.max(0,...Object.keys(forlob).map(Number))+1}.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setNytForlob(false)}>Annuller</Btn>
            <Btn v="primary" onClick={()=>opretForlob()}>Opret forløb</Btn>
          </div>
        </Modal>
      )}
      {delForlob&&(
        <Modal title="Slet forløb?" onClose={()=>setDelForlob(null)} w={400}>
          <div style={{color:C.txtD,marginBottom:16,lineHeight:1.6}}>Slet <strong style={{color:C.txt}}>Forløb nr. {delForlob}</strong> med {forlob[delForlob]?.length||0} opgaver?</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelForlob(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>sletForlob(delForlob)}>Slet permanent</Btn>
          </div>
        </Modal>
      )}

      {/* -- Modals: Medarbejder -- */}
      {editMed&&(
        <Modal title={editMed==="ny"?"Ny medarbejder":`Rediger: ${editMed.navn}`} onClose={()=>setEditMed(null)} w={680}>
          <MedForm med={editMed==="ny"?null:editMed} onSave={saveMed} onClose={()=>setEditMed(null)} adminData={adminData}/>
        </Modal>
      )}
      {delMed&&(
        <Modal title="Slet medarbejder?" onClose={()=>setDelMed(null)} w={380}>
          <div style={{color:C.txtD,marginBottom:14}}>Slet <strong style={{color:C.txt}}>{delMed.navn}</strong>?</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setDelMed(null)}>Annuller</Btn>
            <Btn v="danger" onClick={()=>sletMed(delMed.id)}>Slet</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// -- OpgaveForm (bruges i Forløb-tab) ----------------------------
function OpgaveForm({data,onSave,onClose,lokaler=[]}){
  const [grpFejl,setGrpFejl]=useState("");
  const [f,setF]=useState({o:data?.o||ALLE_K[0],m:data?.m||45,p:data?.p||false,tl:data?.tl||"08:00",ss:data?.ss||"17:00",l:data?.l||[],udstyr:Array.isArray(data?.udstyr)?[...data.udstyr]:[]});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const togLok=(l)=>setF(p=>({...p,l:p.l.includes(l)?p.l.filter(x=>x!==l):[...p.l,l]}));
  const kompMed=BASE_MED.filter(m=>m.kompetencer.includes(f.o));
  const grps=[{label:"Psykolog",c:C.blue,ks:PK},{label:"Pædagog",c:C.pur,ks:PD},{label:"Læge",c:C.acc,ks:LK}];
  return(
    <div>
      <FRow label="Opgavetype">
        <Sel value={f.o} onChange={v=>s("o",v)} style={{width:"100%"}} options={grps.flatMap(g=>[{v:`__${g.label}__`,l:`-- ${g.label} --`,disabled:true},...g.ks.map(k=>({v:k,l:k}))])}/>
        <div style={{color:C.txtM,fontSize:11,marginTop:4}}>{kompMed.length} medarbejdere har denne kompetence</div>
      </FRow>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <FRow label="Varighed (min)"><Input type="number" value={f.m} onChange={v=>s("m",Number(v))}/></FRow>
        <FRow label="Tidligst start"><Input type="time" value={f.tl} onChange={v=>s("tl",v)}/></FRow>
        <FRow label="Senest slut"><Input type="time" value={f.ss} onChange={v=>s("ss",v)}/></FRow>
      </div>
      <FRow label="Patientdeltagelse">
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <input type="checkbox" checked={f.p} onChange={e=>s("p",e.target.checked)}/>
          <span style={{color:C.txt,fontSize:13}}>Patient er til stede</span>
        </label>
      </FRow>
      <FRow label="Mulige lokaler">
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {lokaler.map(l=>{const on=f.l.includes(l);return(
            <button key={l} onClick={()=>togLok(l)} style={{background:on?C.blueM:"transparent",color:on?C.blue:C.txtM,border:`1px solid ${on?C.blue:C.brd}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:on?700:400}}>{l}</button>
          );})}
        </div>
        {f.l.length===0&&<div style={{color:C.red,fontSize:11,marginTop:4}}>Mindst ét lokale skal vælges</div>}
      </FRow>
      <FRow label="Udstyr" hint="Planlæggeren foreslår kun lokaler, der har alle valgte udstyr">
        <UdstyrPanel udstyr={f.udstyr} onChange={v=>s("udstyr",v)}/>
      </FRow>
      <div style={{background:C.s3,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:C.txtD}}>
        <span style={{color:C.txt,fontWeight:600}}>Kompetente medarbejdere: </span>
        {kompMed.length===0?"Ingen":kompMed.slice(0,8).map(m=><span key={m.id} style={{marginRight:4,color:TITLE_C[m.titel]||C.acc}}>{m.navn}</span>)}
        {kompMed.length>8&&<span style={{color:C.txtM}}>+{kompMed.length-8} flere</span>}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>Annuller</Btn>
        <div style={{flex:1}}>{f.l.length===0&&<span style={{color:C.red,fontSize:12}}>Vælg mindst ét lokale</span>}</div>
        <Btn v="primary" onClick={()=>{if(f.l.length===0)return;onSave(f);}}>Gem opgave</Btn>
      </div>
    </div>
  );
}

// StrenghedToggle flyttet til /src/components/primitives.jsx (generisk blød/hård-toggle)

// ── Planlægningsindstillinger (genbruges i Planlæg-fanen) ──
