// Inaktivitets-timer hook.
// Lytter på bruger-events og kalder onTimeout hvis der ikke har været aktivitet
// inden for timeoutMin minutter. Kan også notificere X minutter før timeout
// via advarselMin, så App kan vise "Du logges ud snart"-modal.
//
// Brug:
//   const {nulstil, advarselAktiv} = useInaktivitetsTimer(30, handleLogout, {
//     advarselMin: 2,
//     enabled: authStage === "app",
//   });
//
// - nulstil():        eksplicit reset (brug fra "Jeg er her"-knap i modal)
// - advarselAktiv:    boolean — true når (timeout - advarselMin) er nået
//                     men timeout endnu ikke har fyret
import { useEffect, useRef, useCallback, useState } from "react";

const AKTIVITETS_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

export function useInaktivitetsTimer(timeoutMin, onTimeout, options = {}) {
  const { advarselMin = 0, enabled = true } = options;

  const [advarselAktiv, setAdvarselAktiv] = useState(false);
  const timeoutRef = useRef(null);
  const advarselRef = useRef(null);
  // Hold seneste onTimeout i ref så ændringer i callbacken ikke genstarter effect
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const nulstil = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (advarselRef.current) clearTimeout(advarselRef.current);
    setAdvarselAktiv(false);
    if (!enabled) return;
    const timeoutMs = Math.max(0, timeoutMin * 60 * 1000);
    const advarselMs = Math.max(0, advarselMin * 60 * 1000);
    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current && onTimeoutRef.current();
    }, timeoutMs);
    // Planlæg kun advarsel hvis der er mindst 1 sekund mellem advarsel og
    // endelig timeout — ellers bliver advarselDelayMs=0 og modalen re-åbner
    // straks efter hver nulstil, hvilket får "Jeg er her"-knappen til at
    // virke som om den ikke gør noget.
    if (advarselMs > 0 && timeoutMs - advarselMs >= 1000) {
      const advarselDelayMs = timeoutMs - advarselMs;
      advarselRef.current = setTimeout(() => setAdvarselAktiv(true), advarselDelayMs);
    }
  }, [timeoutMin, advarselMin, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (advarselRef.current) clearTimeout(advarselRef.current);
      setAdvarselAktiv(false);
      return undefined;
    }
    nulstil();
    const handler = () => nulstil();
    AKTIVITETS_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handler, { passive: true })
    );
    return () => {
      AKTIVITETS_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handler)
      );
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (advarselRef.current) clearTimeout(advarselRef.current);
    };
  }, [enabled, nulstil]);

  return { nulstil, advarselAktiv };
}
