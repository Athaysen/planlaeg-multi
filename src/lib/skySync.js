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
