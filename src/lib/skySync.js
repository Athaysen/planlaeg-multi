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

    const row = {
      tenant_id: tenantId,
      navn_krypteret: patient?.navn ?? '',
      status: patient?.status ?? 'aktiv',
      forlob_nr: typeof patient?.forlobNr === 'number' ? patient.forlobNr : null,
      afdeling_id: null,
      haste: !!patient?.haste,
      henv_dato: patient?.henvDato || null,
      ekstra: { ...patient, app_id: patient?.id },
    }
    const { error } = await supabase.from('patienter').insert(row)
    if (error) console.warn('[skySync] gemPatientTilSky insert failed:', error.message)
  } catch (e) {
    console.warn('[skySync] gemPatientTilSky exception:', e)
  }
}
