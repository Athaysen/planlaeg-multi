// Bcrypt-wrappers til hashning og verifikation af ejer-kode.
// bcryptjs virker i browseren uden backend — hash beregnes client-side.
// saltRounds=10 giver ~100ms på moderne hardware: stærk nok mod brute-force
// ved localStorage-lækage uden at blokere UI mærkbart.
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Async: hash en klartekst-kode med bcrypt.
// Returnerer hash af formen "$2a$10$..." eller "$2b$10$...".
export async function hashKode(plainKode) {
  if (typeof plainKode !== "string" || plainKode.length === 0) {
    throw new Error("hashKode: plainKode skal være en ikke-tom streng");
  }
  return bcrypt.hash(plainKode, SALT_ROUNDS);
}

// Async: verificer en klartekst-kode mod en bcrypt-hash.
// Returnerer true/false. Fanger fejl så en ugyldig hash (fx klartekst-
// migreret data der endnu ikke er re-hashet) ikke crasher UI'et.
export async function tjekKode(plainKode, hash) {
  if (typeof plainKode !== "string" || typeof hash !== "string") return false;
  try {
    return await bcrypt.compare(plainKode, hash);
  } catch (e) {
    return false;
  }
}

// Helper: er strengen allerede en bcrypt-hash?
// Bruges til migration — en gammel klartekst-kode identificeres ved at den
// ikke starter med "$2a$", "$2b$" eller "$2y$" (bcrypt-prefixes).
export function erBcryptHash(s) {
  return typeof s === "string" && /^\$2[aby]\$/.test(s);
}
