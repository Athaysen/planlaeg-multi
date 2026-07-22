import { supabase } from './supabase.js'

const email = import.meta.env.VITE_TEST_EMAIL
const password = import.meta.env.VITE_TEST_PASSWORD

// MIDLERTIDIG dev-bro — erstattes af rigtig Supabase Auth senere. Kører aldrig i produktion.
let sessionPromise = null
export function sikrSession() {
  if (!supabase) return Promise.resolve(null)
  if (!import.meta.env.DEV) return Promise.resolve(null)
  if (!email || !password) return Promise.resolve(null)
  if (sessionPromise) return sessionPromise
  sessionPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return session
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { sessionPromise = null; return null }
      return data.session
    } catch (e) {
      sessionPromise = null
      return null
    }
  })()
  return sessionPromise
}

let tenantIdCache = null
async function hentTenantId() {
  if (tenantIdCache) return tenantIdCache
  const { data, error } = await supabase.from('brugere').select('tenant_id').limit(1).single()
  if (error || !data) return null
  tenantIdCache = data.tenant_id
  return tenantIdCache
}

export async function gemPatientTilSky(patient) {
  try {
    if (!supabase) return
    const session = await sikrSession()
    if (!session) return
    const tenantId = await hentTenantId()
    if (!tenantId) return

    if (!patient?.id) return
    const row = {
      tenant_id: tenantId,
      app_id: patient.id,
      navn_krypteret: patient?.navn ?? '',
      status: patient?.status ?? 'aktiv',
      forlob_nr: typeof patient?.forlobNr === 'number' ? patient.forlobNr : null,
      afdeling_id: null,
      haste: !!patient?.haste,
      henv_dato: patient?.henvDato || null,
      ekstra: patient,
    }
    const { error } = await supabase
      .from('patienter')
      .upsert(row, { onConflict: 'tenant_id,app_id' })
    if (error) console.warn('[skySync] gemPatientTilSky upsert failed:', error.message)
  } catch (e) {
    console.warn('[skySync] gemPatientTilSky exception:', e)
  }
}

// Læs tilbage: henter de patienter der er gemt i skyen for denne tenant.
// Hele patient-objektet blev gemt i kolonnen "ekstra", så vi læser bare den ud.
// Må aldrig kaste — alt fanges, og der returneres en tom liste ved fejl.
export async function hentPatienterFraSky() {
  try {
    if (!supabase) return []
    const session = await sikrSession()
    if (!session) return []
    const tenantId = await hentTenantId()
    if (!tenantId) return []

    const { data, error } = await supabase
      .from('patienter')
      .select('ekstra')
      .eq('tenant_id', tenantId)
    if (error) {
      console.warn('[skySync] hentPatienterFraSky select failed:', error.message)
      return []
    }
    return (data ?? [])
      .map(r => r?.ekstra)
      .filter(p => p && typeof p === 'object' && p.id)
  } catch (e) {
    console.warn('[skySync] hentPatienterFraSky exception:', e)
    return []
  }
}

// ══════════════════════════════════════════════════════════════════
//  Medarbejdere, lokaler og forløb — samme mønster som patienter
// ══════════════════════════════════════════════════════════════════
// localStorage/React-state er fortsat den primære kilde. Skyen er en kopi.
// Alle skrivninger er upserts på (tenant_id, app_id), så gentagne kald er
// idempotente. Hele objektet lægges i kolonnen "ekstra"; kun app_id og navn
// skrives som rigtige kolonner, så vi ikke er afhængige af kolonnetyper.

// Fælles forudsætning for al sky-adgang. Returnerer tenant_id, eller null hvis
// vi ikke skal (eller kan) tale med skyen. sikrSession() giver kun en session i
// DEV, så denne returnerer altid null i produktion — dvs. alt bliver no-op.
async function klarTilSky() {
  if (!supabase) return null
  const session = await sikrSession()
  if (!session) return null
  const tenantId = await hentTenantId()
  if (!tenantId) return null
  return tenantId
}

// Generisk upsert. Kaster aldrig; fejl ender som console.warn.
async function gemTilSky(tabel, appId, navn, ekstra, label) {
  try {
    const tenantId = await klarTilSky()
    if (!tenantId) return
    if (appId === undefined || appId === null || String(appId) === '') return
    const { error } = await supabase
      .from(tabel)
      .upsert({
        tenant_id: tenantId,
        app_id: String(appId),
        navn: navn ?? '',
        ekstra,
      }, { onConflict: 'tenant_id,app_id' })
    if (error) console.warn(`[skySync] ${label} upsert failed:`, error.message)
  } catch (e) {
    console.warn(`[skySync] ${label} exception:`, e)
  }
}

// Generisk læsning af kolonnen "ekstra". Returnerer altid et array.
async function hentFraSky(tabel, gyldig, label) {
  try {
    const tenantId = await klarTilSky()
    if (!tenantId) return []
    const { data, error } = await supabase
      .from(tabel)
      .select('ekstra')
      .eq('tenant_id', tenantId)
    if (error) {
      console.warn(`[skySync] ${label} select failed:`, error.message)
      return []
    }
    return (data ?? [])
      .map(r => r?.ekstra)
      .filter(x => x && typeof x === 'object')
      .filter(gyldig)
  } catch (e) {
    console.warn(`[skySync] ${label} exception:`, e)
    return []
  }
}

// ── Medarbejdere ──────────────────────────────────────────────────
// Nøgle: medarbejderens id.
export async function gemMedarbejderTilSky(med) {
  if (!med?.id) return
  return gemTilSky('medarbejdere', med.id, med?.navn, med, 'gemMedarbejderTilSky')
}
export async function hentMedarbejdereFraSky() {
  return hentFraSky('medarbejdere', m => !!m.id, 'hentMedarbejdereFraSky')
}

// ── Lokaler ───────────────────────────────────────────────────────
// Lokaler er i appen en liste af navne-strenge med sidecar-metadata i lokMeta.
// Nøglen er derfor selve navnet. Vi gemmer {navn, meta} samlet i "ekstra".
export async function gemLokaleTilSky(lokale) {
  const navn = typeof lokale === 'string' ? lokale : lokale?.navn
  if (!navn) return
  const nyttelast = typeof lokale === 'string' ? { navn, meta: {} } : lokale
  return gemTilSky('lokaler', navn, navn, nyttelast, 'gemLokaleTilSky')
}
export async function hentLokalerFraSky() {
  return hentFraSky('lokaler', l => typeof l.navn === 'string' && l.navn !== '', 'hentLokalerFraSky')
}

// ── Forløb ────────────────────────────────────────────────────────
// Forløb er et map { id: [opgaver] } med navn/beskrivelse i forlobMeta.
// Nøglen er map-nøglen. Vi gemmer {id, navn, beskrivelse, opgaver} i "ekstra".
export async function gemForlobTilSky(forlobItem) {
  if (!forlobItem?.id) return
  return gemTilSky('forlob_skabeloner', forlobItem.id, forlobItem?.navn, forlobItem, 'gemForlobTilSky')
}
export async function hentForlobFraSky() {
  return hentFraSky('forlob_skabeloner', f => !!f.id, 'hentForlobFraSky')
}

// ── Afdelinger ────────────────────────────────────────────────────
// Afdelinger ligger i appen som et træ under adminData.selskaber[0].afdelinger.
// Hver afdeling gemmes som sin egen række (nøgle: afdelingens id) UDEN children —
// relationen bevares i parentId, så en underafdeling ikke også ligger duplikeret
// inde i sin forælders række. Træet bygges igen ved læsning.
export async function gemAfdelingTilSky(afd) {
  if (!afd?.id) return
  return gemTilSky('afdelinger', afd.id, afd?.navn, afd, 'gemAfdelingTilSky')
}
export async function hentAfdelingerFraSky() {
  return hentFraSky('afdelinger', a => !!a.id, 'hentAfdelingerFraSky')
}

// ── Diff-hjælper ──────────────────────────────────────────────────
// Kalder gemFn(nøgle, værdi) for hvert element der er nyt eller ændret siden
// forrige snapshot. Bruges af dual-write-effekterne i App.jsx, så et enkelt
// felt-redigering ikke udløser en skrivning af hele listen.
// Ikke-blokerende og kaster aldrig.
export function synkroniserAendrede(forrige, ny, gemFn, label = 'dual-write') {
  try {
    const stabil = (v) => { try { return JSON.stringify(v) } catch { return null } }
    Object.keys(ny || {}).forEach(noegle => {
      const gammel = forrige ? forrige[noegle] : undefined
      if (gammel !== undefined && stabil(gammel) === stabil(ny[noegle])) return
      try {
        Promise.resolve(gemFn(noegle, ny[noegle]))
          .catch(e => console.warn(`[skySync] ${label} fejlede:`, e))
      } catch (e) {
        console.warn(`[skySync] ${label} fejlede:`, e)
      }
    })
  } catch (e) {
    console.warn(`[skySync] ${label} exception:`, e)
  }
}
