import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import da from "./locales/da.json";
import en from "./locales/en.json";

const STORAGE_KEY = "planmed_lang";
const valgtSprog = (() => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "da" || s === "en") return s;
  } catch (e) {}
  // Fald tilbage til browser-sprog hvis det starter med 'en'; ellers dansk default.
  if (typeof navigator !== "undefined" && /^en/i.test(navigator.language || "")) return "en";
  return "da";
})();

i18n
  .use(initReactI18next)
  .init({
    resources: { da: { translation: da }, en: { translation: en } },
    lng: valgtSprog,
    fallbackLng: "da",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

i18n.on("languageChanged", (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng); } catch (e) {}
});

export const SPROG = [
  { kode: "da", navn: "Dansk",   flag: "🇩🇰" },
  { kode: "en", navn: "English", flag: "🇬🇧" },
];

export default i18n;
