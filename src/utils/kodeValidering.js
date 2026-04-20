// Ejer-kode validering.
// Regler: min. 12 tegn, lille bogstav, stort bogstav, tal, ikke på top-100
// fælleskoder-listen. Returnerer strukturerede fejl-nøgler (i18n-venligt)
// så UI kan oversætte hver fejl via i18next.
//
// Fejl-nøglerne er stabile — tilføj nye i stedet for at omdøbe, så
// oversættelserne ikke falder ud af synk.

// Top-100 mest almindelige passwords (baseret på offentlige breach-lister
// som NordPass "Most Common Passwords" og SecLists/rockyou). Matches er
// case-insensitive fordi "Password123" er lige så dårlig som "password123".
export const TOP_100_FAELLESKODER = [
  "123456","123456789","qwerty","password","12345","qwerty123","1q2w3e",
  "12345678","111111","1234567890","1234567","password1","123123","abc123",
  "iloveyou","000000","qwerty1","123321","dragon","monkey","letmein",
  "trustno1","sunshine","master","welcome","shadow","ashley","football",
  "jesus","michael","ninja","mustang","password123","admin","administrator",
  "root","toor","passw0rd","pass123","pass1234","qwertyuiop","asdfghjkl",
  "zxcvbnm","qazwsx","qwe123","1qaz2wsx","1qazxsw2","superman","batman",
  "baseball","princess","hello","freedom","whatever","666666","654321",
  "abcdefg","abcd1234","1234qwer","qwer1234","password12","password1234",
  "welcome1","welcome123","login","changeme","secret","default","test123",
  "test1234","guest","hello123","hello1234","hallo","danmark","københavn",
  "sommer2024","sommer2025","sommer2026","vinter2024","vinter2025","vinter2026",
  "forår2025","efterår2025","adgangskode","kodeord","adgang","bruger",
  "brugernavn","login123","administrator1","kodeord123","adgangskode123",
  "hemmelig","hemmelig123","planmed","planmed123","planmed2024","planmed2025",
  "planmed2026","ejer","ejer123","owner","owner123",
];

const FAELLESKODER_SET = new Set(TOP_100_FAELLESKODER.map(k => k.toLowerCase()));

// validerEjerKode(kode) → { gyldig: boolean, fejl: string[] }
// fejl indeholder i18n-nøgler (auth.ownerSetup.val.*) — ikke tekst.
export function validerEjerKode(kode) {
  const fejl = [];
  const s = typeof kode === "string" ? kode : "";
  if (s.length < 12) fejl.push("auth.ownerSetup.val.tooShort");
  if (!/[a-zæøå]/.test(s)) fejl.push("auth.ownerSetup.val.noLower");
  if (!/[A-ZÆØÅ]/.test(s)) fejl.push("auth.ownerSetup.val.noUpper");
  if (!/\d/.test(s)) fejl.push("auth.ownerSetup.val.noDigit");
  if (s && FAELLESKODER_SET.has(s.toLowerCase())) fejl.push("auth.ownerSetup.val.common");
  return { gyldig: fejl.length === 0, fejl };
}

// beregnStyrke(kode) → { score: 0-4, labelKey: string, farve: string }
// score-inddeling:
//   0 (Svag)        — < 12 tegn eller på fælleskoder-liste
//   1 (Middel)      — 12+ tegn + 2/3 af: lille, stor, tal
//   2 (Stærk)       — 12+ tegn + alle 3: lille, stor, tal
//   3 (Meget stærk) — 16+ tegn + alle 3 + specialtegn
export function beregnStyrke(kode) {
  const s = typeof kode === "string" ? kode : "";
  if (!s) return { score: 0, labelKey: "auth.ownerSetup.strength.none", farve: "#d1d5db" };
  if (FAELLESKODER_SET.has(s.toLowerCase())) {
    return { score: 0, labelKey: "auth.ownerSetup.strength.weak", farve: "#dc2626" };
  }
  const harLille = /[a-zæøå]/.test(s);
  const harStor = /[A-ZÆØÅ]/.test(s);
  const harTal = /\d/.test(s);
  const harSpecial = /[^A-Za-zÆØÅæøå0-9]/.test(s);
  const komp = (harLille ? 1 : 0) + (harStor ? 1 : 0) + (harTal ? 1 : 0);

  if (s.length < 12 || komp < 2) {
    return { score: 0, labelKey: "auth.ownerSetup.strength.weak", farve: "#dc2626" };
  }
  if (komp < 3) {
    return { score: 1, labelKey: "auth.ownerSetup.strength.medium", farve: "#f59e0b" };
  }
  if (s.length >= 16 && harSpecial) {
    return { score: 3, labelKey: "auth.ownerSetup.strength.veryStrong", farve: "#16a34a" };
  }
  return { score: 2, labelKey: "auth.ownerSetup.strength.strong", farve: "#65a30d" };
}

// Gradient rød → grøn til styrke-bar. Bredde i procent.
export function styrkeGradient() {
  return "linear-gradient(90deg,#dc2626 0%,#f59e0b 33%,#65a30d 66%,#16a34a 100%)";
}
