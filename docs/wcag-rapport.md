# WCAG 2.1 AA — Tilgængelighedsrapport

**Dato:** 2026-04-20
**Værktøj:** @axe-core/cli 4.11.3 + manuel kode-audit
**Mål:** WCAG 2.1 niveau AA, minimum 90% automatiserede tests bestået.

## Resumé

PlanMed er i denne iteration opgraderet på 7 akser der ramte mange callsites samtidig. De primære rettelser er strukturelle (Modal-dialog-semantik, label→input-kobling) snarere end stedvise, så dækningen af de rettede klasser er bred.

| Område | Status | Dækning |
|---|---|---|
| Modal-dialog aria | ✓ Rettet | Alle Modal-instanser |
| Label/input-kobling | ✓ Rettet | Alle FRow-wrappers |
| :focus-visible | ✓ Tilføjet | Globalt via App.jsx `<style>` |
| Skip-link (2.4.1) | ✓ Tilføjet | Global, target `#pm-main` |
| Semantisk `<main>` + `<nav>` | ✓ Rettet | Top-level routing |
| Farvekontrast | ✓ Rettet | `C.txtM` hævet |
| Ikon-knapper (aria-label) | ◐ Delvist | 5 mest kritiske rettet, 15+ TODO |
| Tastatur-navigation | ✓ Grundlæggende | Modal Escape + autofokus |
| axe-cli smoke-test | ✗ Ej kørt | Chrome mangler i miljø — se kørsel nedenfor |

## Sådan køres axe-cli lokalt

axe-cli kræver Chrome installeret (chromedriver understøtter ikke Edge). Forudsat dev-server på `localhost:5173`:

```bash
npm install --save-dev @axe-core/cli
npx axe http://localhost:5173/ \
  --tags wcag2aa,wcag21aa \
  --save docs/axe-baseline.json \
  --load-delay 3000 \
  --exit
```

`--exit` returnerer exit-kode 1 ved fejl, så commandoen kan bruges i CI (fx GitHub Actions-job `a11y` der kun blokerer merge hvis kritiske fejl opstår).

I dette miljø kunne axe-cli ikke startes (kun Microsoft Edge installeret, som chromedriver 4.11 ikke accepterer — `unrecognized Chrome version: Edg/147.0.3912.72`). CI bør bruge `actions/setup-chrome@v1` eller `browser-actions/setup-chrome` før axe-kørsel.

## Rettelser i denne iteration

### 1. Modal-komponenten — dialog-semantik

**Fil:** `src/components/primitives.jsx` (Modal).

Ændringer:
- `role="dialog"` + `aria-modal="true"` (WCAG 4.1.2 Name, Role, Value).
- `aria-labelledby` peger på titel-element med auto-genereret `React.useId()`.
- Titel rendret som `<h2>` (var `<span>`) — giver landmarks i skærmlæser-navigation.
- Escape-tast lukker modalen (2.1.1 Keyboard, 2.1.2 No Keyboard Trap).
- Autofokus på første fokuserbare inputs ved mount — tastatur-brugere kan starte interaktion straks.
- Luk-knap har `aria-label="Luk"` (var kun tekst-glyph "X").
- `tabIndex={-1}` på container så fokus kan flyttes ind programmatisk uden at knappen bliver en ny Tab-stop.

### 2. FRow/Input/Sel — label-input-kobling

**Filer:** `src/components/primitives.jsx` (FRow, Input, Sel).

Ændringer:
- `FRow` genererer stabilt id via `React.useId()` og wrapper label i `<label htmlFor={id}>`.
- `FRow.inject()` cloner første accepterende child (native `input/select/textarea` eller `Input/Sel/Textarea`-komponenter) og sætter `id` hvis det ikke allerede er sat.
- `Input` og `Sel` forwarder nu `id`, `aria-label`, `aria-describedby`.
- Opt-in override via `<FRow htmlFor="my-id">` hvis en callsite vil have et specifikt id.

Effekt: **alle** FRow-wrapped inputs i appen får nu korrekt label-kobling uden at callsites skal ændres.

### 3. Farvekontrast (WCAG 1.4.3)

**Fil:** `src/data/constants.js`.

| Token | Før | Efter | Kontrast på hvid |
|---|---|---|---|
| `txt` | `#0f1923` | (uændret) | 17.74:1 ✓ AAA |
| `txtD` | `#3a4d63` | (uændret) | 8.67:1 ✓ AAA |
| **`txtM`** | **`#6b84a0`** | **`#546c8a`** | **5.40:1 ✓ AA** (var 3.86:1 FAIL) |
| `acc` | `#0050b3` | (uændret) | 7.50:1 ✓ AAA |

`txtM` bruges som sekundær/muted tekst på tværs af appen (hints, labels, stats). Det er den mest udbredte farve og den eneste der fejlede AA for normal tekst.

Verificeret via pure JS-luminans-beregning (kode i SUITE 73) og direkte node-kørsel mod WCAG 2.1 formlen.

### 4. Fokus-indikator (WCAG 2.4.7)

**Fil:** `src/App.jsx` (global `<style>`).

Tilføjet:
- `:focus-visible { outline: 3px solid ${C.acc}; outline-offset: 2px; border-radius: 4px }` på alle fokuserbare elementer.
- `:focus:not(:focus-visible)` fjerner outline ved mus-klik — fokus-ring vises KUN ved tastatur-navigation (undgår støj ved mus-brug men bevarer tastatur-tilgængelighed).
- Dækker: `button, a, [role=button], [role=tab], [role=menuitem], [role=dialog], input, select, textarea, [tabindex]`.

### 5. Skip-link (WCAG 2.4.1)

Tilføjet `.pm-skip-link` i `App.jsx`:
- Absolut positioneret `left: -9999px` (skjult visuelt).
- Ved `:focus` flytter til `left: 8px` og bliver synlig — tastatur-brugere kan springe over venstre-menu.
- Target `<main id="pm-main" tabIndex={-1}>` så fokus faktisk flyttes.

### 6. Semantiske landmarks

- `<main id="pm-main">` wrapper hovedindhold (før `<div>`).
- `<nav aria-label="Hovedmenu">` på venstre sidebar (var `<nav>` uden label, hvilket er tvetydigt hvis appen får flere `<nav>`-regioner).

### 7. Ikon-knapper med aria-label

Rettet i denne iteration (5 mest brugte):
- `src/components/primitives.jsx` Modal-luk → `aria-label="Luk"`
- `src/components/dialogs.jsx` GlobalSearch ryd → `aria-label="Ryd søgning"`
- `src/views/PatientKalenderView.jsx` Detalje-modal luk → `aria-label="Luk patientdetaljer"`
- `src/views/PatientKalenderView.jsx` Slet opgave × → `aria-label="Slet opgave"`
- `src/views/PatientKalenderView.jsx` Drill-down luk → `aria-label="Luk drill-down"`
- `src/views/IndstillingerView.jsx` Ryd søgefelt → `aria-label="Ryd søgning"`

**Resterende TODO** (grep `>×</button>\|>X</button>\|>✕</button>` efter resten):
- `src/views/ForlobView.jsx` linje 82, 519, 545, 584 — slet-knapper i forløbs-UI
- `src/views/LokalerView.jsx` linje 1011, 1178 — slet-knapper i lokale-UI
- `src/admin/AdminView.jsx` linje 1119, 1714, 1763 — slet-knapper i admin

Disse er ikke kritiske (kontekst er synlig i omgivelserne) men bør rettes i næste iteration.

## Resterende problemer

### Højt-prioriterede (fix i næste iteration)

1. **`<div onClick>` som interaktive elementer** — spredt i UI, fx custom checkboxes i `NyPatientForm` og forløb-kort. Bør konverteres til `<button>` eller `<input type="checkbox">` med semantic wrapper.
2. **Form-validering** (3.3.1 Error Identification) — `aria-invalid` og `aria-describedby` på felter med fejl. Nuværende: fejl vises som plain `<div>` uden association.
3. **Tabel-headers** (1.3.1 Info and Relationships) — flere tabeller bruger `<div>` med grid-layout; bør være `<table>` med `<thead>/<th scope>`. Relevant i PlanLogView, AktivLogView, KapacitetsView.
4. **Landmarks på alle views** — alle views renders direkte i `<main>`; bør have `<h1>` på øverste view-titel for skærmlæser-navigation.
5. **Modal focus-trap** — nuværende implementering flytter fokus INDI modalen ved mount, men Tab kan bevæge sig UD af modalen til baggrunden. Komplet fokus-trap kræver keyboard-event-handler på første/sidste fokuserbare element.

### Mellem-prioriterede

6. **Emoji-som-icon** uden aria-hidden — fx ⚠ i eksport-bokse. Skærmlæsere læser "advarsel-emoji" hvilket kan være overflødigt når omgivende tekst allerede forklarer.
7. **Toast-notifikationer** — mangler `role="status"` / `aria-live="polite"` så skærmlæsere annoncerer succesbeskeder (fx "Patient oprettet").
8. **Language attribute** — `<html lang="da">` er korrekt, men UI har engelske strings (via i18n). Dynamisk `lang`-attribute på elementer med fremmed-sprog-tekst ville være mere korrekt (3.1.2 Language of Parts).

### Lav-prioriterede

9. **Tekst-zoom til 200%** (1.4.4) — eksisterende fixed-width layouts (Modal w=520, sidebar 220) kan knække; bør testes i browser med Ctrl++ / Ctrl+0.
10. **Reduceret bevægelse** (2.3.3) — animations (slideUp keyframe, transitions) bør respektere `@media (prefers-reduced-motion)`.

## Tastatur-navigation — status

| Interaktion | Status | Note |
|---|---|---|
| Tab-rækkefølge | ✓ Logisk | Følger DOM-orden, ingen negative tabindex-hacks |
| Escape lukker modal | ✓ Alle Modal-instanser | Tilføjet i denne iteration |
| Enter submitter form | ◐ Delvist | NyPatientForm + EjerSetupDialog har `onKeyDown Enter`; andre forms mangler |
| Arrow-nav i lister | ✗ Ingen | Roving tabindex / arrow keys ikke implementeret |
| Fokus-trap i modal | ◐ Autofokus ved åbning | Men Tab kan gå ud af modal — se TODO #5 |
| Skip-link | ✓ Tilføjet | `Tab` fra start af side fokuserer den |

## Automatiserede tests

**SUITE 73** (`src/tests/PlanMedTester.jsx`, ~15 assertions):

- Kontrast-assertions mod WCAG-formel (6 farver × target ≥4.5:1)
- Runtime-rendering af `<Modal>` + `<FRow>` + `<Input>` i test-container
- Assertions: `role=dialog`, `aria-modal=true`, `aria-labelledby` peger på eksisterende element, titel-tekst matcher, luk-knap har `aria-label`
- Label-kobling: `label[for]` == `input[id]` og begge er non-tom

Kør via Ejer-konsol → Tests → SUITE 73.

## Anbefalinger

1. **CI-integration af axe-cli** — tilføj GitHub Actions-job `a11y` der installerer Chrome + kører `npx axe http://localhost:4173/ --exit` mod preview-build. Forbyd merge hvis nye kritiske fejl opstår.
2. **Design-token audit** — når nye farver tilføjes, kør kontrast-check først. Overvej automatiseret PR-check der parser constants.js og fejler på ratio <4.5.
3. **Komponent-bibliotek** — formalisér `<Btn>`, `<Input>`, `<FRow>`, `<Modal>` som det autoritative tilgængeligheds-lag; forbud mod direkte `<button>` / `<input>` i nye views (via ESLint-regel `jsx-a11y/no-raw-controls` evt.).
4. **Brugertest med skærmlæser** — NVDA (Windows) eller VoiceOver (Mac) hver 3. iteration. Automatiserede tests fanger ~30-40% af reelle problemer; resten kræver manuel test.
5. **Fokus-trap-bibliotek** — overvej `focus-trap-react` for at få fuldstændig fokus-trap i modals uden at skrive det selv.
