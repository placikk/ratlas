# Plan 1: Fundament — implementacja

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalowalna PWA „Szczury Wrocławia” w szczurzych kolorach, z logowaniem (Google + kod z e-maila), onboardingiem (pseudonim, zgody, regulamin), profilem z ustawieniami i dolnym paskiem zakładek — wdrożona za 0 zł.

**Architecture:** Frontend React + TypeScript + Vite jako PWA (`vite-plugin-pwa`), bez routera — nawigacja zakładkami w stanie Reacta. Backend Supabase: tabela `profiles` z RLS i uprawnieniami na poziomie kolumn (użytkownik zmienia tylko ustawienia), trigger tworzący profil przy rejestracji, funkcja `complete_onboarding`. Komponenty rozmawiają z Supabase wyłącznie przez cienkie moduły `*Api.ts`, które w testach są mockowane.

**Tech Stack:** Node 22, Vite 8, React 19, TypeScript ~6, Vitest 5 + Testing Library + jsdom, i18next/react-i18next, `@supabase/supabase-js` 2, Supabase CLI 2 (npm, lokalnie w Dockerze), pgTAP, `vite-plugin-pwa`, `@vite-pwa/assets-generator`, `@fontsource/nunito`, Wrangler (Cloudflare Pages).

**Spec:** [docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md](../specs/2026-09-29-szczury-wroclaw-design.md)

## Mapa drogowa (Etap 1 specyfikacji)

Etap 1 jest podzielony na cztery plany; każdy kończy się działającą, przetestowaną aplikacją. Plany 2–4 powstaną po wykonaniu poprzedniego, żeby opierały się na prawdziwym kodzie.

1. **Fundament** (ten plan) — PWA, marka, i18n, logowanie, onboarding, profil, wdrożenie.
2. **Zgłoszenia** — granice Wrocławia, `app_config`, `RatVerifier` (Gemini), Edge Function `submit-sighting` z kontrolami anty-oszustw, ekran aparatu, ekran wyniku, liczniki, żetony, rangi, ponawianie `pending`, zbiór ewaluacyjny modelu.
3. **Mapa** — MapLibre + OpenFreeMap, pinezki z zanikaniem, gniazda, panel szczegółów, zgłaszanie nadużyć.
4. **Grywalizacja i porządki** — osiągnięcia jawne i ukryte, rankingi, usuwanie konta, E2E (Playwright).

## Global Constraints

- Koszt: tylko darmowe plany; żadnych usług wymagających karty płatniczej.
- Język interfejsu: polski; **każdy** tekst widoczny dla użytkownika pochodzi z `src/i18n/pl.json` (przez `useTranslation`), wyjątek: treść dokumentów prawnych w `src/legal/*.tsx`.
- Paleta (tokeny CSS): `--fur #6B6A6E`, `--fur-dark #3A3839`, `--fur-light #D9D6D4`, `--rose #C98A8F`, `--rose-dark #A5646B`, `--rose-light #EBD3D3`, `--bg #F4F1EF`, `--danger #B4504F`; tryb ciemny: `--fur #9A989C`, `--fur-dark #E6E2E0`, `--fur-light #3A3839`, `--rose #D69BA0`, `--rose-dark #E5B3B7`, `--rose-light #4A3537`, `--bg #232122`, `--danger #D77A78`.
- Czcionka: Nunito (`@fontsource/nunito`, lokalnie, bez Google Fonts CDN).
- Pseudonim: 3–20 znaków, regex `^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_-]{3,20}$`, unikalny bez względu na wielkość liter.
- Użytkownik (rola `authenticated`) może aktualizować w `profiles` tylko kolumny `show_nickname_on_map` i `training_consent`; wszystko inne zmienia serwer.
- Wymagany wiek: 16+ (oświadczenie w onboardingu).
- TypeScript: `verbatimModuleSyntax` i `erasableSyntaxOnly` są włączone — używaj `import type` dla typów i **nie używaj `enum`** (tylko unie stringów).
- Testy komponentów importują teksty po polsku (np. `getByRole('button', { name: 'Wyślij kod' })`), więc zmiana tekstu w `pl.json` wymaga zmiany testu.
- Lokalny Supabase uruchamiaj **zawsze** przez `npm run db:start` (odchudzony zestaw kontenerów — komputer ma 7 GB RAM).
- Commity: końcówka wiadomości `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Struktura plików po wykonaniu planu

```
index.html                         # meta PWA, ikony, lang="pl"
vite.config.ts                     # React + PWA + konfiguracja Vitest
.env.example                       # wzór zmiennych (commitowany)
.env.local                         # lokalne klucze (NIE commitowany)
public/logo.svg                    # źródło ikony (szczur)
public/*.png, favicon.ico          # ikony wygenerowane z logo.svg
src/main.tsx                       # start: czcionki, style, i18n, <App/>
src/App.tsx                        # bramka: ładowanie → logowanie → onboarding → powłoka
src/env.d.ts                       # typy zmiennych VITE_*
src/styles/theme.css               # tokeny kolorów (jasny/ciemny)
src/styles/base.css                # reset + wspólne klasy (.btn, .input, .card, .stack…)
src/i18n/index.ts, pl.json         # tłumaczenia
src/lib/supabase.ts                # jedyny klient Supabase
src/lib/storage.ts                 # bezpieczny localStorage (try/catch)
src/auth/authApi.ts                # logowanie Google / kod e-mail / wylogowanie
src/auth/useSession.ts             # stan sesji
src/auth/LoginScreen.tsx (+.css)   # ekran logowania
src/profile/profileApi.ts          # typ Profile + odczyt/zapis profilu, onboarding
src/profile/useProfile.ts          # ładowanie profilu
src/profile/ProfileScreen.tsx      # profil + ustawienia + wylogowanie
src/onboarding/nickname.ts         # walidacja pseudonimu
src/onboarding/OnboardingScreen.tsx
src/legal/legalConfig.ts           # dane administratora (do uzupełnienia przed startem)
src/legal/Terms.tsx, Privacy.tsx   # szkice dokumentów
src/legal/LegalModal.tsx           # okno z dokumentem
src/install/platform.ts            # wykrywanie iOS / trybu standalone
src/install/InstallHint.tsx        # podpowiedź „Dodaj do ekranu początkowego”
src/shell/AppShell.tsx (+shell.css)# układ z zakładkami
src/shell/TabBar.tsx               # dolny pasek zakładek
src/shell/ComingSoon.tsx           # zakładki z planów 2–4
src/ui/Splash.tsx                  # ekran ładowania / błędu
src/test/setup.ts                  # jest-dom, i18n, cleanup
src/test/fixtures.ts               # makeProfile()
supabase/config.toml               # konfiguracja lokalna (auth, szablony)
supabase/templates/otp.html        # e-mail z kodem
supabase/migrations/20260930000000_profiles.sql
supabase/tests/profiles.test.sql   # pgTAP
docs/deploy.md                     # instrukcja wdrożenia
```

---

### Task 1: Szkielet projektu PWA

**Files:**
- Create (scaffold): `package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `.gitignore`, `.oxlintrc.json`, `src/main.tsx`, `src/App.tsx`
- Create: `src/test/setup.ts`, `src/App.test.tsx`
- Delete (z szablonu): `src/App.css`, `src/index.css`, `src/assets/`, `public/icons.svg`

**Interfaces:**
- Consumes: nic
- Produces: `export function App(): JSX.Element` w `src/App.tsx`; skrypty npm `dev`, `build`, `test`, `test:watch`, `lint`; plik `src/test/setup.ts` ładowany przez Vitest przed każdym testem.

- [ ] **Step 1: Wygeneruj szablon Vite obok repozytorium i przenieś pliki**

`npm create vite` przerywa działanie w niepustym katalogu, więc generujemy do podkatalogu i przenosimy:

```bash
cd /home/placik/Dokumenty/Szczury
npm create vite@latest .scaffold -- --template react-ts --no-interactive
cp -rn .scaffold/. .
rm -rf .scaffold
rm -rf src/assets src/App.css src/index.css public/icons.svg
npm install
```

Expected: katalog zawiera `package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `node_modules/`.

- [ ] **Step 2: Zainstaluj narzędzia testowe i dodaj skrypty**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest"
```

- [ ] **Step 3: Skonfiguruj Vitest w `vite.config.ts`**

Zastąp całą zawartość `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    mockReset: true,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
})
```

Utwórz `src/test/setup.ts` (bez globali Vitesta Testing Library nie sprząta sama, stąd jawne `cleanup`):

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 4: Napisz test, który nie przejdzie**

Utwórz `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { App } from './App'

test('pokazuje nazwę aplikacji', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Szczury Wrocławia' })).toBeInTheDocument()
})
```

- [ ] **Step 5: Uruchom test i sprawdź, że nie przechodzi**

Run: `npm test`
Expected: FAIL — szablon eksportuje `default`, a nie nazwane `App` (błąd typu „App is not a function” / „does not provide an export named 'App'”).

- [ ] **Step 6: Minimalna implementacja**

Zastąp `src/App.tsx`:

```tsx
export function App() {
  return <h1>Szczury Wrocławia</h1>
}
```

Zastąp `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Uruchom testy i build**

Run: `npm test && npm run build`
Expected: `Tests 1 passed`, build kończy się `✓ built in …`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React PWA project with Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Marka — motyw, czcionka, ikona, manifest PWA

**Files:**
- Create: `src/styles/theme.css`, `src/styles/base.css`, `public/logo.svg`, wygenerowane `public/pwa-64x64.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico`
- Modify: `index.html`, `vite.config.ts`, `src/main.tsx`, `package.json`
- Delete: `public/favicon.svg`

**Interfaces:**
- Consumes: `src/main.tsx` z Task 1
- Produces: klasy CSS używane przez wszystkie kolejne zadania: `.screen`, `.stack`, `.row`, `.card`, `.btn`, `.btn--ghost`, `.btn--link`, `.input`, `.check`, `.muted`, `.error`, `.modal-backdrop`, `.modal`, `.modal__body`; zmienne `--tabbar-height`, `--radius`, `--surface`, `--text`, `--text-muted`, `--on-rose`; plik `/logo.svg` używany jako logo w UI.

- [ ] **Step 1: Zainstaluj zależności**

```bash
npm install @fontsource/nunito
npm install -D vite-plugin-pwa @vite-pwa/assets-generator
npm pkg set scripts.icons="pwa-assets-generator --preset minimal-2023 public/logo.svg"
```

- [ ] **Step 2: Narysuj ikonę**

Utwórz `public/logo.svg` (szary szczur z profilu na brudnym różu; wersja sprawdzona wizualnie):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#C98A8F"/>
  <path d="M120 290 C 40 300, 30 410, 120 420 C 200 428, 260 400, 250 360" fill="none" stroke="#EBD3D3" stroke-width="16" stroke-linecap="round"/>
  <ellipse cx="220" cy="262" rx="125" ry="72" fill="#6B6A6E"/>
  <path d="M300 205 C 360 192, 420 225, 462 268 C 425 292, 360 305, 305 300 Z" fill="#6B6A6E"/>
  <circle cx="322" cy="198" r="26" fill="#6B6A6E"/>
  <circle cx="322" cy="198" r="13" fill="#EBD3D3"/>
  <circle cx="385" cy="240" r="8" fill="#3A3839"/>
  <circle cx="460" cy="268" r="9" fill="#EBD3D3"/>
  <path d="M440 272 L 485 258 M440 278 L 486 284" stroke="#3A3839" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="170" cy="332" rx="24" ry="10" fill="#EBD3D3"/>
  <ellipse cx="290" cy="330" rx="24" ry="10" fill="#EBD3D3"/>
</svg>
```

- [ ] **Step 3: Wygeneruj ikony PNG**

```bash
rm -f public/favicon.svg
npm run icons
ls public
```

Expected: `apple-touch-icon-180x180.png favicon.ico logo.svg maskable-icon-512x512.png pwa-192x192.png pwa-512x512.png pwa-64x64.png`.

- [ ] **Step 4: Tokeny kolorów**

Utwórz `src/styles/theme.css`:

```css
:root {
  --fur: #6b6a6e;
  --fur-dark: #3a3839;
  --fur-light: #d9d6d4;
  --rose: #c98a8f;
  --rose-dark: #a5646b;
  --rose-light: #ebd3d3;
  --bg: #f4f1ef;
  --surface: #ffffff;
  --danger: #b4504f;
  --text: var(--fur-dark);
  --text-muted: var(--fur);
  --on-rose: #2a2627;
  --radius: 16px;
  --tabbar-height: 68px;
  --font: 'Nunito', system-ui, sans-serif;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --fur: #9a989c;
    --fur-dark: #e6e2e0;
    --fur-light: #3a3839;
    --rose: #d69ba0;
    --rose-dark: #e5b3b7;
    --rose-light: #4a3537;
    --bg: #232122;
    --surface: #2e2b2c;
    --danger: #d77a78;
    color-scheme: dark;
  }
}
```

- [ ] **Step 5: Style bazowe**

Utwórz `src/styles/base.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

h1,
h2 {
  margin: 0;
  font-weight: 800;
}

p {
  margin: 0;
}

button,
input {
  font: inherit;
}

.screen {
  min-height: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: calc(24px + env(safe-area-inset-top)) 16px calc(var(--tabbar-height) + 24px + env(safe-area-inset-bottom));
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 20px;
  border: 0;
  border-radius: var(--radius);
  background: var(--rose);
  color: var(--on-rose);
  font-weight: 800;
  cursor: pointer;
}

.btn:active {
  background: var(--rose-dark);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn--ghost {
  background: transparent;
  color: var(--text);
  border: 2px solid var(--fur-light);
}

.btn--link {
  min-height: auto;
  padding: 0;
  background: none;
  border: 0;
  color: var(--rose-dark);
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.input {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 2px solid var(--fur-light);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
}

.input:focus {
  outline: none;
  border-color: var(--rose);
}

.check {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.check input {
  width: 22px;
  height: 22px;
  margin: 2px 0 0;
  flex-shrink: 0;
  accent-color: var(--rose);
}

.muted {
  color: var(--text-muted);
}

.error {
  color: var(--danger);
  font-weight: 700;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}

.modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  border-radius: var(--radius) var(--radius) 0 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.modal__body {
  overflow-y: auto;
}

.modal__body h2 {
  margin: 8px 0;
}

.modal__body h3 {
  margin: 16px 0 4px;
}

.modal__body p,
.modal__body li {
  margin: 4px 0;
}
```

- [ ] **Step 6: Podłącz czcionki i style**

Zastąp `src/main.tsx`:

```tsx
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './styles/theme.css'
import './styles/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: `index.html`**

Zastąp całą zawartość `index.html`:

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#C98A8F" />
    <meta name="description" content="Wypatruj szczurów we Wrocławiu, zbieraj żetony i odkrywaj sekretne osiągnięcia." />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/logo.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <title>Szczury Wrocławia</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Manifest PWA**

Zastąp `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Szczury Wrocławia',
        short_name: 'Szczury',
        description: 'Wypatruj szczurów we Wrocławiu, zbieraj żetony i odkrywaj sekretne osiągnięcia.',
        lang: 'pl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F1EF',
        theme_color: '#C98A8F',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    mockReset: true,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
})
```

- [ ] **Step 9: Zweryfikuj build i manifest**

Run:

```bash
npm test && npm run build && node -e "const m=JSON.parse(require('fs').readFileSync('dist/manifest.webmanifest','utf8'));if(m.name!=='Szczury Wrocławia'||m.icons.length!==4)process.exit(1);console.log('manifest OK')" && ls dist/sw.js
```

Expected: testy przechodzą, `manifest OK`, istnieje `dist/sw.js`.

- [ ] **Step 10: Sprawdzenie wizualne**

Run: `npm run dev`, otwórz http://localhost:5173 — nagłówek w czcionce Nunito na ciepłym, złamanym tle; w karcie przeglądarki ikona szczura. Zatrzymaj serwer (Ctrl+C).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add rat brand theme, icons and PWA manifest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tłumaczenia (i18n)

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/pl.json`, `src/i18n/i18n.test.ts`
- Modify: `src/main.tsx`, `src/test/setup.ts`, `src/App.tsx`

**Interfaces:**
- Consumes: nic
- Produces: `src/i18n/index.ts` (import dla efektu ubocznego; default export `i18n`). Klucze z `pl.json` poniżej są używane przez wszystkie kolejne zadania — nie zmieniaj ich nazw.

- [ ] **Step 1: Zainstaluj**

```bash
npm install i18next react-i18next
```

- [ ] **Step 2: Napisz test, który nie przejdzie**

Utwórz `src/i18n/i18n.test.ts`:

```ts
import { expect, test } from 'vitest'
import i18n from './index'

test('zwraca polskie teksty', () => {
  expect(i18n.t('app.name')).toBe('Szczury Wrocławia')
})

test('wstawia zmienne do tekstu', () => {
  expect(i18n.t('login.codeSent', { email: 'ala@example.com' })).toBe(
    'Wysłaliśmy kod na ala@example.com. Sprawdź skrzynkę (także spam).',
  )
})
```

- [ ] **Step 3: Uruchom test**

Run: `npx vitest run src/i18n`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 4: Teksty**

Utwórz `src/i18n/pl.json`:

```json
{
  "app": {
    "name": "Szczury Wrocławia",
    "loading": "Wczytuję…",
    "error": "Coś poszło nie tak.",
    "retry": "Spróbuj ponownie"
  },
  "login": {
    "tagline": "Wypatruj szczurów, zbieraj żetony, odkrywaj sekrety.",
    "google": "Zaloguj przez Google",
    "or": "albo e-mailem",
    "emailLabel": "Adres e-mail",
    "sendCode": "Wyślij kod",
    "codeSent": "Wysłaliśmy kod na {{email}}. Sprawdź skrzynkę (także spam).",
    "codeLabel": "Kod z e-maila",
    "verify": "Zaloguj",
    "changeEmail": "Zmień adres e-mail",
    "sendFailed": "Nie udało się wysłać kodu. Spróbuj za chwilę.",
    "invalidCode": "Kod jest nieprawidłowy albo wygasł."
  },
  "onboarding": {
    "title": "Witaj w szczurzej ekipie!",
    "safetyTitle": "Zanim zaczniesz",
    "safetyText": "Nie dotykaj szczurów i nie wchodź na teren prywatny. Fotografuj z dystansu 🐀",
    "nicknameLabel": "Twój pseudonim",
    "nicknameHint": "3–20 znaków: litery, cyfry, _ lub -. Będzie widoczny w rankingu.",
    "nicknameTooShort": "Pseudonim musi mieć co najmniej 3 znaki.",
    "nicknameTooLong": "Pseudonim może mieć najwyżej 20 znaków.",
    "nicknameBadChars": "Dozwolone są tylko litery, cyfry, _ i -.",
    "nicknameTaken": "Ten pseudonim jest już zajęty.",
    "age": "Mam ukończone 16 lat",
    "termsAccept": "Akceptuję regulamin i politykę prywatności",
    "read": "Przeczytaj:",
    "training": "Zgadzam się na użycie moich zdjęć do trenowania modelu rozpoznającego szczury (opcjonalne, możesz to zmienić w profilu)",
    "submit": "Zaczynamy!"
  },
  "tabs": {
    "map": "Mapa",
    "report": "Zgłoś",
    "ranking": "Ranking",
    "profile": "Profil"
  },
  "comingSoon": "Już wkrótce 🐀",
  "profile": {
    "rats": "Szczury",
    "tokens": "Żetony",
    "settings": "Ustawienia",
    "showNickname": "Pokazuj mój pseudonim na mapie",
    "trainingConsent": "Moje zdjęcia mogą pomóc trenować model rozpoznający szczury",
    "saveFailed": "Nie udało się zapisać ustawień.",
    "logout": "Wyloguj się"
  },
  "install": {
    "title": "Zainstaluj aplikację",
    "ios": "Stuknij „Udostępnij” na dole Safari, a potem „Dodaj do ekranu początkowego”.",
    "dismiss": "Rozumiem"
  },
  "legal": {
    "terms": "Regulamin",
    "privacy": "Polityka prywatności",
    "close": "Zamknij"
  }
}
```

- [ ] **Step 5: Inicjalizacja i18n**

Utwórz `src/i18n/index.ts` (`initAsync: false` — tłumaczenia są dostępne od razu po imporcie, bez migania kluczy):

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import pl from './pl.json'

void i18n.use(initReactI18next).init({
  lng: 'pl',
  fallbackLng: 'pl',
  resources: { pl: { translation: pl } },
  interpolation: { escapeValue: false },
  initAsync: false,
})

export default i18n
```

- [ ] **Step 6: Załaduj i18n w aplikacji i w testach**

W `src/main.tsx` dodaj linię `import './i18n'` bezpośrednio po `import './styles/base.css'`.

Zastąp `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import '../i18n'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

Zastąp `src/App.tsx` (nazwa aplikacji już z tłumaczeń):

```tsx
import { useTranslation } from 'react-i18next'

export function App() {
  const { t } = useTranslation()
  return <h1>{t('app.name')}</h1>
}
```

- [ ] **Step 7: Uruchom testy i sprawdź typy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą (3), `tsc` bez błędów.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Polish translations with i18next

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lokalny Supabase i tabela profili

**Files:**
- Create: `supabase/config.toml` (przez `supabase init`), `supabase/migrations/20260930000000_profiles.sql`, `supabase/tests/profiles.test.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: nic
- Produces (baza):
  - tabela `public.profiles(id uuid, nickname text null, show_nickname_on_map bool, total_rats int, tokens_balance int, training_consent bool, age_confirmed bool, terms_accepted_at timestamptz null, created_at timestamptz)`
  - profil tworzony automatycznie dla każdego nowego `auth.users`
  - RPC `complete_onboarding(p_nickname text, p_training_consent boolean) returns profiles`; błędy: `23505` (pseudonim zajęty), `23514` (zły format), `P0001` „already onboarded”, `28000` (niezalogowany)
  - uprawnienia: `authenticated` może `select` własny wiersz i `update` tylko `show_nickname_on_map`, `training_consent`
- Skrypty npm: `db:start`, `db:stop`, `db:reset`, `test:db`

- [ ] **Step 1: Zainstaluj CLI i zainicjuj projekt**

```bash
npm install -D supabase
npx supabase init
npm pkg set scripts.db:start="supabase start -x realtime,imgproxy,studio,logflare,vector,supavisor,postgres-meta" scripts.db:stop="supabase stop" scripts.db:reset="supabase db reset" scripts.test:db="supabase test db"
```

Expected: powstaje `supabase/config.toml` i `supabase/.gitignore`.

- [ ] **Step 2: Uruchom lokalny Supabase**

Run: `npm run db:start`
Expected: pierwsze uruchomienie pobiera obrazy Dockera (kilka minut), na końcu wypisuje adresy (`API URL: http://127.0.0.1:54321`, `Mailpit: http://127.0.0.1:54324`) i klucze (`Publishable key: sb_publishable_…`).

- [ ] **Step 3: Napisz testy bazy (pgTAP)**

Utwórz `supabase/tests/profiles.test.sql`:

```sql
begin;
select plan(9);

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'ala@example.com'),
       ('22222222-2222-2222-2222-222222222222', 'ola@example.com');

select is(
  (select count(*)::int from public.profiles),
  2,
  'nowy użytkownik dostaje profil automatycznie'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles),
  1,
  'użytkownik widzi tylko własny profil'
);

select lives_ok(
  $$ select public.complete_onboarding('Szczurołap_1', true) $$,
  'onboarding z poprawnym pseudonimem się udaje'
);

select is(
  (select nickname from public.profiles),
  'Szczurołap_1',
  'pseudonim zapisany'
);

select throws_ok(
  $$ select public.complete_onboarding('Inny', false) $$,
  'P0001',
  'already onboarded',
  'onboardingu nie da się powtórzyć'
);

select throws_ok(
  $$ update public.profiles set total_rats = 999 $$,
  '42501',
  null,
  'użytkownik nie może sam zmienić liczby szczurów'
);

select lives_ok(
  $$ update public.profiles set show_nickname_on_map = false $$,
  'użytkownik może zmienić ustawienie widoczności pseudonimu'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$ select public.complete_onboarding('szczurołap_1', false) $$,
  '23505',
  null,
  'pseudonim jest unikalny bez względu na wielkość liter'
);

select throws_ok(
  $$ select public.complete_onboarding('a b', false) $$,
  '23514',
  null,
  'pseudonim w złym formacie jest odrzucany'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm run test:db`
Expected: FAIL — `relation "public.profiles" does not exist`.

- [ ] **Step 5: Migracja**

Utwórz `supabase/migrations/20260930000000_profiles.sql`:

```sql
-- Profil gracza: tworzony automatycznie przy rejestracji, uzupełniany w onboardingu.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  show_nickname_on_map boolean not null default true,
  total_rats integer not null default 0 check (total_rats >= 0),
  tokens_balance integer not null default 0 check (tokens_balance >= 0),
  training_consent boolean not null default false,
  age_confirmed boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_format
    check (nickname is null or nickname ~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_-]{3,20}$')
);

create unique index profiles_nickname_lower_idx on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Użytkownik może zmieniać tylko ustawienia; punkty i zgody zmienia wyłącznie serwer.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (show_nickname_on_map, training_consent) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.complete_onboarding(p_nickname text, p_training_consent boolean)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set nickname = p_nickname,
         training_consent = p_training_consent,
         age_confirmed = true,
         terms_accepted_at = now()
   where id = auth.uid()
     and terms_accepted_at is null
  returning * into result;

  if result.id is null then
    raise exception 'already onboarded' using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke execute on function public.complete_onboarding(text, boolean) from public, anon;
grant execute on function public.complete_onboarding(text, boolean) to authenticated;
```

- [ ] **Step 6: Zastosuj migrację i uruchom testy**

Run: `npm run db:reset && npm run test:db`
Expected: `profiles.test.sql .. ok`, `Tests=9`, `Result: PASS`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add profiles table with RLS and onboarding RPC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Klient Supabase i stan sesji

**Files:**
- Create: `src/env.d.ts`, `src/lib/supabase.ts`, `src/auth/useSession.ts`, `src/auth/useSession.test.tsx`, `.env.example`, `.env.local` (niecommitowany)

**Interfaces:**
- Consumes: lokalny Supabase z Task 4
- Produces:
  - `export const supabase: SupabaseClient` z `src/lib/supabase.ts` — **jedyne** miejsce tworzenia klienta
  - `export type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session }`
  - `export function useSession(): SessionState` z `src/auth/useSession.ts`

- [ ] **Step 1: Zainstaluj**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Zmienne środowiskowe**

Utwórz `src/env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Utwórz `.env.example`:

```
# Skopiuj do .env.local i uzupełnij wartościami z `npx supabase status`
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Utwórz `.env.local` z prawdziwym kluczem lokalnym:

```bash
KEY=$(npx supabase status -o env 2>/dev/null | sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p')
printf "VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n" "$KEY" > .env.local
cat .env.local
git check-ignore .env.local
```

Expected: plik zawiera klucz `sb_publishable_…`, a `git check-ignore` wypisuje `.env.local` (plik jest ignorowany dzięki wzorcowi `*.local` z szablonu Vite).

- [ ] **Step 3: Klient**

Utwórz `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Brak VITE_SUPABASE_URL lub VITE_SUPABASE_PUBLISHABLE_KEY — skopiuj .env.example do .env.local')
}

export const supabase = createClient(url, key)
```

- [ ] **Step 4: Napisz test hooka sesji**

Utwórz `src/auth/useSession.test.tsx`:

```tsx
import type { Session } from '@supabase/supabase-js'
import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useSession } from './useSession'

type Listener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => {
  const state: { listener: Listener | null } = { listener: null }
  const unsubscribe = vi.fn()
  const onAuthStateChange = vi.fn((listener: Listener) => {
    state.listener = listener
    return { data: { subscription: { unsubscribe } } }
  })
  return { state, unsubscribe, onAuthStateChange }
})

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: mocks.onAuthStateChange } },
}))

const fakeSession = { user: { id: 'u1' } } as unknown as Session

test('na początku stan to ładowanie', () => {
  const { result } = renderHook(() => useSession())
  expect(result.current).toEqual({ status: 'loading' })
})

test('bez sesji użytkownik jest wylogowany', () => {
  const { result } = renderHook(() => useSession())
  act(() => mocks.state.listener?.('INITIAL_SESSION', null))
  expect(result.current).toEqual({ status: 'signedOut' })
})

test('z sesją użytkownik jest zalogowany', () => {
  const { result } = renderHook(() => useSession())
  act(() => mocks.state.listener?.('SIGNED_IN', fakeSession))
  expect(result.current).toEqual({ status: 'signedIn', session: fakeSession })
})

test('wypisuje się z nasłuchu po odmontowaniu', () => {
  const { unmount } = renderHook(() => useSession())
  unmount()
  expect(mocks.unsubscribe).toHaveBeenCalled()
})
```

- [ ] **Step 5: Uruchom test**

Run: `npx vitest run src/auth`
Expected: FAIL — `Failed to resolve import "./useSession"`.

- [ ] **Step 6: Implementacja**

Utwórz `src/auth/useSession.ts` (`onAuthStateChange` od razu zgłasza zdarzenie `INITIAL_SESSION`, więc nie trzeba osobno wołać `getSession`):

```ts
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session }

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut' })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return state
}
```

- [ ] **Step 7: Uruchom testy i typy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą, bez błędów typów.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client and session hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ekran logowania (Google + kod z e-maila)

**Files:**
- Create: `supabase/templates/otp.html`, `src/auth/authApi.ts`, `src/auth/LoginScreen.tsx`, `src/auth/LoginScreen.css`, `src/auth/LoginScreen.test.tsx`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `supabase` z `src/lib/supabase.ts`
- Produces:
  - `src/auth/authApi.ts`: `signInWithGoogle(): Promise<void>`, `sendEmailCode(email: string): Promise<void>`, `verifyEmailCode(email: string, token: string): Promise<void>`, `signOut(): Promise<void>` — każda rzuca wyjątek przy błędzie
  - `export function LoginScreen(): JSX.Element`

Dlaczego kod, a nie link: na iPhonie link z maila otwiera się w Safari, a zainstalowana PWA ma osobną pamięć — użytkownik zostałby zalogowany w Safari, a nie w aplikacji. Kod wpisywany w aplikacji działa wszędzie.

- [ ] **Step 1: Szablon e-maila z kodem**

Utwórz `supabase/templates/otp.html`:

```html
<h2>Twój kod do Szczurów Wrocławia</h2>
<p>Wpisz ten kod w aplikacji:</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>
<p>Kod wygasa po godzinie. Jeśli to nie Ty, zignoruj tę wiadomość.</p>
```

- [ ] **Step 2: Konfiguracja auth**

W `supabase/config.toml`, w sekcji `[auth]`:
- zamień `site_url = "http://127.0.0.1:3000"` na `site_url = "http://localhost:5173"`
- zamień `additional_redirect_urls = ["https://127.0.0.1:3000"]` na `additional_redirect_urls = ["http://localhost:5173", "http://127.0.0.1:5173"]`

Bezpośrednio **przed** linią `[auth.sms]` wstaw (nowi użytkownicy dostają szablon `confirmation`, powracający `magic_link` — oba muszą zawierać kod):

```toml
[auth.email.template.magic_link]
subject = "Twój kod logowania – Szczury Wrocławia"
content_path = "./supabase/templates/otp.html"

[auth.email.template.confirmation]
subject = "Twój kod logowania – Szczury Wrocławia"
content_path = "./supabase/templates/otp.html"
```

Sprawdź, że w `[auth.email]` jest `otp_length = 6`.

Run: `npm run db:stop && npm run db:start`
Expected: start bez błędów konfiguracji.

- [ ] **Step 3: Moduł logowania**

Utwórz `src/auth/authApi.ts`:

```ts
import { supabase } from '../lib/supabase'

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
```

- [ ] **Step 4: Napisz testy ekranu logowania**

Utwórz `src/auth/LoginScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LoginScreen } from './LoginScreen'
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from './authApi'

vi.mock('./authApi', () => ({
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signOut: vi.fn(),
}))

async function requestCode() {
  vi.mocked(sendEmailCode).mockResolvedValue(undefined)
  render(<LoginScreen />)
  await userEvent.type(screen.getByLabelText('Adres e-mail'), 'ala@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Wyślij kod' }))
}

test('wysyła kod i prosi o jego wpisanie', async () => {
  await requestCode()
  expect(sendEmailCode).toHaveBeenCalledWith('ala@example.com')
  expect(await screen.findByText('Wysłaliśmy kod na ala@example.com. Sprawdź skrzynkę (także spam).')).toBeInTheDocument()
  expect(screen.getByLabelText('Kod z e-maila')).toBeInTheDocument()
})

test('weryfikuje wpisany kod', async () => {
  await requestCode()
  vi.mocked(verifyEmailCode).mockResolvedValue(undefined)
  await userEvent.type(await screen.findByLabelText('Kod z e-maila'), '123456')
  await userEvent.click(screen.getByRole('button', { name: 'Zaloguj' }))
  expect(verifyEmailCode).toHaveBeenCalledWith('ala@example.com', '123456')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('pokazuje błąd przy złym kodzie', async () => {
  await requestCode()
  vi.mocked(verifyEmailCode).mockRejectedValue(new Error('invalid'))
  await userEvent.type(await screen.findByLabelText('Kod z e-maila'), '000000')
  await userEvent.click(screen.getByRole('button', { name: 'Zaloguj' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Kod jest nieprawidłowy albo wygasł.')
})

test('pokazuje błąd, gdy nie da się wysłać kodu', async () => {
  vi.mocked(sendEmailCode).mockRejectedValue(new Error('rate limit'))
  render(<LoginScreen />)
  await userEvent.type(screen.getByLabelText('Adres e-mail'), 'ala@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Wyślij kod' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wysłać kodu. Spróbuj za chwilę.')
})

test('pozwala wrócić do zmiany adresu', async () => {
  await requestCode()
  await userEvent.click(await screen.findByRole('button', { name: 'Zmień adres e-mail' }))
  expect(screen.getByLabelText('Adres e-mail')).toBeInTheDocument()
})

test('loguje przez Google', async () => {
  vi.mocked(signInWithGoogle).mockResolvedValue(undefined)
  render(<LoginScreen />)
  await userEvent.click(screen.getByRole('button', { name: 'Zaloguj przez Google' }))
  expect(signInWithGoogle).toHaveBeenCalled()
})
```

- [ ] **Step 5: Uruchom testy**

Run: `npx vitest run src/auth/LoginScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./LoginScreen"`.

- [ ] **Step 6: Implementacja ekranu**

Utwórz `src/auth/LoginScreen.css`:

```css
.login {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 16px;
  text-align: center;
}

.login__logo {
  align-self: center;
  border-radius: 28px;
}

.login__or {
  margin-top: 8px;
}

.login form {
  text-align: left;
}
```

Utwórz `src/auth/LoginScreen.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import './LoginScreen.css'
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from './authApi'

type Step = { kind: 'email' } | { kind: 'code'; email: string }

export function LoginScreen() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>, errorKey: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(t(errorKey))
    } finally {
      setBusy(false)
    }
  }

  function onSendCode(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    void run(async () => {
      await sendEmailCode(trimmed)
      setStep({ kind: 'code', email: trimmed })
    }, 'login.sendFailed')
  }

  function onVerify(event: FormEvent) {
    event.preventDefault()
    if (step.kind !== 'code') return
    void run(() => verifyEmailCode(step.email, code.trim()), 'login.invalidCode')
  }

  function onChangeEmail() {
    setStep({ kind: 'email' })
    setCode('')
    setError(null)
  }

  return (
    <main className="screen login">
      <img className="login__logo" src="/logo.svg" alt="" width={112} height={112} />
      <h1>{t('app.name')}</h1>
      <p className="muted">{t('login.tagline')}</p>

      <button className="btn" type="button" disabled={busy} onClick={() => void run(signInWithGoogle, 'app.error')}>
        {t('login.google')}
      </button>

      <p className="login__or muted">{t('login.or')}</p>

      {step.kind === 'email' ? (
        <form className="stack" onSubmit={onSendCode}>
          <label className="stack">
            <span>{t('login.emailLabel')}</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="btn btn--ghost" type="submit" disabled={busy}>
            {t('login.sendCode')}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={onVerify}>
          <p>{t('login.codeSent', { email: step.email })}</p>
          <label className="stack">
            <span>{t('login.codeLabel')}</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {t('login.verify')}
          </button>
          <button className="btn btn--ghost" type="button" onClick={onChangeEmail}>
            {t('login.changeEmail')}
          </button>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
```

- [ ] **Step 7: Uruchom testy i typy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą, bez błędów typów.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add login screen with Google and email code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Onboarding — pseudonim, zgody, dokumenty prawne

**Files:**
- Create: `src/profile/profileApi.ts`, `src/profile/profileApi.test.ts`, `src/test/fixtures.ts`, `src/onboarding/nickname.ts`, `src/onboarding/nickname.test.ts`, `src/legal/legalConfig.ts`, `src/legal/Terms.tsx`, `src/legal/Privacy.tsx`, `src/legal/LegalModal.tsx`, `src/onboarding/OnboardingScreen.tsx`, `src/onboarding/OnboardingScreen.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 5), RPC `complete_onboarding` i tabela `profiles` (Task 4)
- Produces:
  - `src/profile/profileApi.ts`:
    - `export interface Profile { id: string; nickname: string | null; show_nickname_on_map: boolean; total_rats: number; tokens_balance: number; training_consent: boolean; terms_accepted_at: string | null }`
    - `export type ProfileSettings = Pick<Profile, 'show_nickname_on_map' | 'training_consent'>`
    - `export type OnboardingFailure = 'nickname_taken' | 'nickname_invalid' | 'unknown'`
    - `export type OnboardingResult = { ok: true } | { ok: false; reason: OnboardingFailure }`
    - `fetchMyProfile(userId: string): Promise<Profile>` (rzuca przy błędzie)
    - `completeOnboarding(nickname: string, trainingConsent: boolean): Promise<OnboardingResult>`
    - `updateSettings(userId: string, patch: Partial<ProfileSettings>): Promise<void>` (rzuca przy błędzie)
    - `onboardingFailureFor(code: string | undefined): OnboardingFailure`
  - `src/test/fixtures.ts`: `makeProfile(overrides?: Partial<Profile>): Profile`
  - `src/onboarding/nickname.ts`: `type NicknameProblem = 'too_short' | 'too_long' | 'bad_chars'`, `checkNickname(raw: string): NicknameProblem | null`
  - `src/legal/LegalModal.tsx`: `type LegalDoc = 'terms' | 'privacy'`, `LegalModal({ doc, onClose })`
  - `OnboardingScreen({ onDone }: { onDone: () => void })`

- [ ] **Step 1: Napisz testy walidacji pseudonimu**

Utwórz `src/onboarding/nickname.test.ts`:

```ts
import { expect, test } from 'vitest'
import { checkNickname } from './nickname'

test.each([
  ['Szczurek', null],
  ['Szczurołap_1', null],
  ['ab-ę', null],
  ['  Ola  ', null],
  ['ab', 'too_short'],
  ['a'.repeat(21), 'too_long'],
  ['a b', 'bad_chars'],
  ['szczur!', 'bad_chars'],
  ['🐀🐀🐀', 'bad_chars'],
])('checkNickname(%j) = %j', (input, expected) => {
  expect(checkNickname(input)).toBe(expected)
})
```

- [ ] **Step 2: Uruchom test**

Run: `npx vitest run src/onboarding/nickname.test.ts`
Expected: FAIL — `Failed to resolve import "./nickname"`.

- [ ] **Step 3: Implementacja walidacji**

Utwórz `src/onboarding/nickname.ts` (ta sama reguła co ograniczenie `profiles_nickname_format` w bazie):

```ts
export type NicknameProblem = 'too_short' | 'too_long' | 'bad_chars'

const ALLOWED = /^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_-]+$/

export function checkNickname(raw: string): NicknameProblem | null {
  const nickname = raw.trim()
  // [...] liczy znaki tak jak Postgres (emoji = 1 znak), a nie jednostki UTF-16.
  const length = [...nickname].length
  if (length < 3) return 'too_short'
  if (length > 20) return 'too_long'
  if (!ALLOWED.test(nickname)) return 'bad_chars'
  return null
}
```

Run: `npx vitest run src/onboarding/nickname.test.ts`
Expected: PASS (9 przypadków).

- [ ] **Step 4: Napisz testy API profilu**

Utwórz `src/profile/profileApi.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { completeOnboarding, onboardingFailureFor } from './profileApi'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

test.each([
  ['23505', 'nickname_taken'],
  ['23514', 'nickname_invalid'],
  ['XX000', 'unknown'],
  [undefined, 'unknown'],
])('kod błędu %j oznacza %j', (code, expected) => {
  expect(onboardingFailureFor(code)).toBe(expected)
})

test('onboarding wywołuje funkcję w bazie', async () => {
  mocks.rpc.mockResolvedValue({ data: {}, error: null })
  await expect(completeOnboarding('Szczurek', true)).resolves.toEqual({ ok: true })
  expect(mocks.rpc).toHaveBeenCalledWith('complete_onboarding', {
    p_nickname: 'Szczurek',
    p_training_consent: true,
  })
})

test('zajęty pseudonim jest zgłaszany', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
  await expect(completeOnboarding('Szczurek', false)).resolves.toEqual({ ok: false, reason: 'nickname_taken' })
})
```

Run: `npx vitest run src/profile`
Expected: FAIL — `Failed to resolve import "./profileApi"`.

- [ ] **Step 5: Implementacja API profilu**

Utwórz `src/profile/profileApi.ts`:

```ts
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  nickname: string | null
  show_nickname_on_map: boolean
  total_rats: number
  tokens_balance: number
  training_consent: boolean
  terms_accepted_at: string | null
}

export type ProfileSettings = Pick<Profile, 'show_nickname_on_map' | 'training_consent'>

export type OnboardingFailure = 'nickname_taken' | 'nickname_invalid' | 'unknown'

export type OnboardingResult = { ok: true } | { ok: false; reason: OnboardingFailure }

const PROFILE_COLUMNS =
  'id, nickname, show_nickname_on_map, total_rats, tokens_balance, training_consent, terms_accepted_at'

export async function fetchMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single()
  if (error) throw error
  return data as Profile
}

export function onboardingFailureFor(code: string | undefined): OnboardingFailure {
  if (code === '23505') return 'nickname_taken'
  if (code === '23514') return 'nickname_invalid'
  return 'unknown'
}

export async function completeOnboarding(nickname: string, trainingConsent: boolean): Promise<OnboardingResult> {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_nickname: nickname,
    p_training_consent: trainingConsent,
  })
  if (!error) return { ok: true }
  return { ok: false, reason: onboardingFailureFor(error.code) }
}

export async function updateSettings(userId: string, patch: Partial<ProfileSettings>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}
```

Utwórz `src/test/fixtures.ts`:

```ts
import type { Profile } from '../profile/profileApi'

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    nickname: 'Szczurek',
    show_nickname_on_map: true,
    total_rats: 0,
    tokens_balance: 0,
    training_consent: false,
    terms_accepted_at: '2026-09-30T10:00:00Z',
    ...overrides,
  }
}
```

Run: `npx vitest run src/profile`
Expected: PASS.

- [ ] **Step 6: Dokumenty prawne (szkice)**

Utwórz `src/legal/legalConfig.ts`:

```ts
// PRZED PUBLICZNYM STARTEM: wpisz prawdziwe dane administratora i adres kontaktowy (patrz docs/deploy.md).
export const LEGAL = {
  adminName: 'Twórca aplikacji Szczury Wrocławia',
  contactEmail: 'kontakt@example.com',
  version: '2026-09-30',
}
```

Utwórz `src/legal/Terms.tsx`:

```tsx
import { LEGAL } from './legalConfig'

export function Terms() {
  return (
    <article>
      <h2>Regulamin</h2>
      <p className="muted">Wersja robocza z dnia {LEGAL.version}</p>

      <h3>1. Czym jest aplikacja</h3>
      <p>
        Szczury Wrocławia to bezpłatna aplikacja, w której mieszkańcy Wrocławia fotografują napotkane szczury, zbierają
        punkty i żetony oraz poznają ciekawostki o szczurach. Aplikację prowadzi {LEGAL.adminName}.
      </p>

      <h3>2. Konto</h3>
      <ul>
        <li>Z aplikacji mogą korzystać osoby, które ukończyły 16 lat.</li>
        <li>Każda osoba może mieć jedno konto.</li>
        <li>Pseudonim nie może być obraźliwy ani podszywać się pod inne osoby.</li>
      </ul>

      <h3>3. Zdjęcia</h3>
      <ul>
        <li>Zgłaszasz wyłącznie zdjęcia zrobione przez siebie, na żywo, w aplikacji.</li>
        <li>Nie fotografuj ludzi bez ich zgody. Zdjęcia z twarzami osób trzecich nie są publikowane na mapie.</li>
        <li>
          Przesyłając zdjęcie, udzielasz nam bezpłatnej, niewyłącznej zgody na jego wyświetlanie w aplikacji (mapa, profil)
          przez czas przechowywania zgłoszenia.
        </li>
      </ul>

      <h3>4. Bezpieczeństwo</h3>
      <p>
        Nie dotykaj szczurów, nie karm ich i nie wchodź na teren prywatny ani w niebezpieczne miejsca. Szczury mogą przenosić
        choroby — fotografuj z dystansu.
      </p>

      <h3>5. Punkty i żetony</h3>
      <ul>
        <li>Punkty i żetony nie mają wartości pieniężnej i nie podlegają wymianie na pieniądze.</li>
        <li>
          Oszukiwanie (np. zdjęcia ekranu, cudze zdjęcia, wiele kont) może skutkować odebraniem punktów i żetonów albo
          zablokowaniem konta.
        </li>
      </ul>

      <h3>6. Zmiany i kontakt</h3>
      <p>
        O zmianach regulaminu poinformujemy w aplikacji. Pytania i zgłoszenia: {LEGAL.contactEmail}.
      </p>
    </article>
  )
}
```

Utwórz `src/legal/Privacy.tsx`:

```tsx
import { LEGAL } from './legalConfig'

export function Privacy() {
  return (
    <article>
      <h2>Polityka prywatności</h2>
      <p className="muted">Wersja robocza z dnia {LEGAL.version}</p>

      <h3>1. Administrator</h3>
      <p>
        Administratorem danych jest {LEGAL.adminName}, kontakt: {LEGAL.contactEmail}.
      </p>

      <h3>2. Jakie dane przetwarzamy i po co</h3>
      <ul>
        <li>Adres e-mail i identyfikator konta Google — logowanie (art. 6 ust. 1 lit. b RODO).</li>
        <li>Pseudonim, liczba szczurów, żetony, osiągnięcia — działanie gry i rankingu (art. 6 ust. 1 lit. b RODO).</li>
        <li>
          Zdjęcia, lokalizacja i czas zgłoszeń — weryfikacja zgłoszeń, mapa i ochrona przed oszustwami (art. 6 ust. 1 lit. b
          i f RODO).
        </li>
        <li>
          Zdjęcia do trenowania naszego modelu rozpoznającego szczury — tylko za Twoją zgodą (art. 6 ust. 1 lit. a RODO),
          którą możesz wycofać w profilu.
        </li>
      </ul>

      <h3>3. Co jest publiczne</h3>
      <p>
        Zaakceptowane zdjęcia szczurów są widoczne na mapie przez 7 dni wraz z miejscem i czasem zgłoszenia oraz Twoim
        pseudonimem (możesz go ukryć w ustawieniach). Selfie i zdjęcia z twarzami osób trzecich nie są publikowane.
        Pseudonim i wynik są widoczne w rankingu.
      </p>

      <h3>4. Komu powierzamy dane</h3>
      <ul>
        <li>Supabase — baza danych i przechowywanie zdjęć (serwery w UE).</li>
        <li>Cloudflare — hosting aplikacji.</li>
        <li>Google — logowanie przez Google oraz analiza zdjęć przez model Gemini (bez używania ich do trenowania modeli Google).</li>
      </ul>

      <h3>5. Jak długo</h3>
      <p>
        Dane konta przechowujemy do czasu usunięcia konta. Odrzucone zdjęcia usuwamy po 30 dniach.
      </p>

      <h3>6. Twoje prawa</h3>
      <p>
        Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia i sprzeciwu,
        a także wycofania zgody w dowolnym momencie. Aby usunąć konto, napisz na {LEGAL.contactEmail}. Możesz też złożyć
        skargę do Prezesa Urzędu Ochrony Danych Osobowych.
      </p>
    </article>
  )
}
```

Utwórz `src/legal/LegalModal.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Privacy } from './Privacy'
import { Terms } from './Terms'

export type LegalDoc = 'terms' | 'privacy'

export function LegalModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="modal-backdrop">
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={t(doc === 'terms' ? 'legal.terms' : 'legal.privacy')}
      >
        <div className="modal__body">{doc === 'terms' ? <Terms /> : <Privacy />}</div>
        <button className="btn" type="button" onClick={onClose}>
          {t('legal.close')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Napisz testy ekranu onboardingu**

Utwórz `src/onboarding/OnboardingScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { completeOnboarding } from '../profile/profileApi'
import { OnboardingScreen } from './OnboardingScreen'

vi.mock('../profile/profileApi', () => ({
  completeOnboarding: vi.fn(),
  fetchMyProfile: vi.fn(),
  updateSettings: vi.fn(),
}))

async function fillForm(nickname: string) {
  await userEvent.type(screen.getByLabelText('Twój pseudonim'), nickname)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Mam ukończone 16 lat' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Akceptuję regulamin i politykę prywatności' }))
}

test('przycisk jest nieaktywny, dopóki formularz nie jest kompletny', async () => {
  render(<OnboardingScreen onDone={vi.fn()} />)
  const submit = screen.getByRole('button', { name: 'Zaczynamy!' })
  expect(submit).toBeDisabled()
  await fillForm('Szczurek')
  expect(submit).toBeEnabled()
})

test('podpowiada, co jest nie tak z pseudonimem', async () => {
  render(<OnboardingScreen onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Twój pseudonim'), 'a b')
  expect(screen.getByText('Dozwolone są tylko litery, cyfry, _ i -.')).toBeInTheDocument()
})

test('zapisuje onboarding i kończy', async () => {
  vi.mocked(completeOnboarding).mockResolvedValue({ ok: true })
  const onDone = vi.fn()
  render(<OnboardingScreen onDone={onDone} />)
  await fillForm('Szczurek')
  await userEvent.click(screen.getByRole('checkbox', { name: /trenowania modelu/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Zaczynamy!' }))
  expect(completeOnboarding).toHaveBeenCalledWith('Szczurek', true)
  expect(onDone).toHaveBeenCalled()
})

test('informuje o zajętym pseudonimie', async () => {
  vi.mocked(completeOnboarding).mockResolvedValue({ ok: false, reason: 'nickname_taken' })
  const onDone = vi.fn()
  render(<OnboardingScreen onDone={onDone} />)
  await fillForm('Szczurek')
  await userEvent.click(screen.getByRole('button', { name: 'Zaczynamy!' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ten pseudonim jest już zajęty.')
  expect(onDone).not.toHaveBeenCalled()
})

test('otwiera i zamyka regulamin', async () => {
  render(<OnboardingScreen onDone={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Regulamin' }))
  expect(screen.getByRole('dialog', { name: 'Regulamin' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Zamknij' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

Run: `npx vitest run src/onboarding/OnboardingScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./OnboardingScreen"`.

- [ ] **Step 8: Implementacja ekranu onboardingu**

Utwórz `src/onboarding/OnboardingScreen.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalModal, type LegalDoc } from '../legal/LegalModal'
import { completeOnboarding, type OnboardingFailure } from '../profile/profileApi'
import { checkNickname, type NicknameProblem } from './nickname'

const PROBLEM_KEYS: Record<NicknameProblem, string> = {
  too_short: 'onboarding.nicknameTooShort',
  too_long: 'onboarding.nicknameTooLong',
  bad_chars: 'onboarding.nicknameBadChars',
}

const FAILURE_KEYS: Record<OnboardingFailure, string> = {
  nickname_taken: 'onboarding.nicknameTaken',
  nickname_invalid: 'onboarding.nicknameBadChars',
  unknown: 'app.error',
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [trainingConsent, setTrainingConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null)

  const problem = checkNickname(nickname)
  const canSubmit = problem === null && ageConfirmed && termsAccepted && !busy

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const result = await completeOnboarding(nickname.trim(), trainingConsent)
    setBusy(false)
    if (result.ok) {
      onDone()
      return
    }
    setError(t(FAILURE_KEYS[result.reason]))
  }

  return (
    <main className="screen stack">
      <h1>{t('onboarding.title')}</h1>

      <section className="card stack">
        <strong>{t('onboarding.safetyTitle')}</strong>
        <p>{t('onboarding.safetyText')}</p>
      </section>

      <form className="stack" onSubmit={onSubmit}>
        <label className="stack">
          <span>{t('onboarding.nicknameLabel')}</span>
          <input
            className="input"
            autoComplete="nickname"
            maxLength={30}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        {nickname.length > 0 && problem ? (
          <p className="error">{t(PROBLEM_KEYS[problem])}</p>
        ) : (
          <p className="muted">{t('onboarding.nicknameHint')}</p>
        )}

        <label className="check">
          <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
          <span>{t('onboarding.age')}</span>
        </label>

        <label className="check">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
          <span>{t('onboarding.termsAccept')}</span>
        </label>
        <div className="row">
          <span className="muted">{t('onboarding.read')}</span>
          <button className="btn--link" type="button" onClick={() => setOpenDoc('terms')}>
            {t('legal.terms')}
          </button>
          <button className="btn--link" type="button" onClick={() => setOpenDoc('privacy')}>
            {t('legal.privacy')}
          </button>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={trainingConsent}
            onChange={(event) => setTrainingConsent(event.target.checked)}
          />
          <span>{t('onboarding.training')}</span>
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={!canSubmit}>
          {t('onboarding.submit')}
        </button>
      </form>

      {openDoc && <LegalModal doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </main>
  )
}
```

- [ ] **Step 9: Uruchom wszystkie testy i typy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą, bez błędów typów.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add onboarding with nickname, consents and legal drafts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Podpowiedź instalacji na iPhonie

**Files:**
- Create: `src/lib/storage.ts`, `src/install/platform.ts`, `src/install/platform.test.ts`, `src/install/InstallHint.tsx`, `src/install/InstallHint.test.tsx`

**Interfaces:**
- Consumes: nic
- Produces:
  - `src/lib/storage.ts`: `readFlag(key: string): boolean`, `writeFlag(key: string): void` — nigdy nie rzucają
  - `src/install/platform.ts`: `interface InstallEnv { userAgent: string; maxTouchPoints: number; standalone: boolean }`, `isIos(env: InstallEnv): boolean`, `shouldShowIosInstallHint(env: InstallEnv, dismissed: boolean): boolean`, `readInstallEnv(): InstallEnv`
  - `InstallHint({ env }: { env?: InstallEnv })` — renderuje `null`, gdy podpowiedź niepotrzebna

- [ ] **Step 1: Napisz testy wykrywania platformy**

Utwórz `src/install/platform.test.ts`:

```ts
import { expect, test } from 'vitest'
import { shouldShowIosInstallHint, type InstallEnv } from './platform'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

function env(overrides: Partial<InstallEnv>): InstallEnv {
  return { userAgent: IPHONE_UA, maxTouchPoints: 5, standalone: false, ...overrides }
}

test('pokazuje podpowiedź na iPhonie w przeglądarce', () => {
  expect(shouldShowIosInstallHint(env({}), false)).toBe(true)
})

test('pokazuje podpowiedź na iPadzie udającym Maca', () => {
  expect(shouldShowIosInstallHint(env({ userAgent: MAC_UA, maxTouchPoints: 5 }), false)).toBe(true)
})

test('nie pokazuje na zwykłym Macu', () => {
  expect(shouldShowIosInstallHint(env({ userAgent: MAC_UA, maxTouchPoints: 0 }), false)).toBe(false)
})

test('nie pokazuje na Androidzie', () => {
  expect(shouldShowIosInstallHint(env({ userAgent: ANDROID_UA }), false)).toBe(false)
})

test('nie pokazuje w zainstalowanej aplikacji', () => {
  expect(shouldShowIosInstallHint(env({ standalone: true }), false)).toBe(false)
})

test('nie pokazuje po zamknięciu podpowiedzi', () => {
  expect(shouldShowIosInstallHint(env({}), true)).toBe(false)
})
```

Run: `npx vitest run src/install`
Expected: FAIL — `Failed to resolve import "./platform"`.

- [ ] **Step 2: Implementacja**

Utwórz `src/install/platform.ts`:

```ts
export interface InstallEnv {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
}

export function isIos(env: InstallEnv): boolean {
  // iPadOS w trybie „witryna na komputer” przedstawia się jako Macintosh, ale ma ekran dotykowy.
  return /iPad|iPhone|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
}

export function shouldShowIosInstallHint(env: InstallEnv, dismissed: boolean): boolean {
  return isIos(env) && !env.standalone && !dismissed
}

export function readInstallEnv(): InstallEnv {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: window.matchMedia?.('(display-mode: standalone)')?.matches === true || iosStandalone,
  }
}
```

Utwórz `src/lib/storage.ts`:

```ts
// localStorage bywa niedostępny (tryb prywatny, zablokowane dane witryny) — wtedy po prostu nic nie pamiętamy.
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // brak pamięci przeglądarki — flaga przepadnie po zamknięciu aplikacji
  }
}
```

Run: `npx vitest run src/install`
Expected: PASS (6 testów).

- [ ] **Step 3: Napisz testy komponentu**

Utwórz `src/install/InstallHint.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { InstallHint } from './InstallHint'
import type { InstallEnv } from './platform'

const iphone: InstallEnv = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  maxTouchPoints: 5,
  standalone: false,
}

beforeEach(() => {
  window.localStorage.clear()
})

test('na iPhonie pokazuje instrukcję instalacji', () => {
  render(<InstallHint env={iphone} />)
  expect(screen.getByText('Zainstaluj aplikację')).toBeInTheDocument()
})

test('po kliknięciu „Rozumiem” znika na stałe', async () => {
  const { unmount } = render(<InstallHint env={iphone} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rozumiem' }))
  expect(screen.queryByText('Zainstaluj aplikację')).not.toBeInTheDocument()
  unmount()
  render(<InstallHint env={iphone} />)
  expect(screen.queryByText('Zainstaluj aplikację')).not.toBeInTheDocument()
})

test('w zainstalowanej aplikacji nic nie pokazuje', () => {
  render(<InstallHint env={{ ...iphone, standalone: true }} />)
  expect(screen.queryByText('Zainstaluj aplikację')).not.toBeInTheDocument()
})
```

Run: `npx vitest run src/install/InstallHint.test.tsx`
Expected: FAIL — `Failed to resolve import "./InstallHint"`.

- [ ] **Step 4: Implementacja komponentu**

Utwórz `src/install/InstallHint.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readFlag, writeFlag } from '../lib/storage'
import { readInstallEnv, shouldShowIosInstallHint, type InstallEnv } from './platform'

const DISMISSED_KEY = 'szczury.installHintDismissed'

export function InstallHint({ env }: { env?: InstallEnv }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISSED_KEY))

  if (!shouldShowIosInstallHint(env ?? readInstallEnv(), dismissed)) return null

  function dismiss() {
    writeFlag(DISMISSED_KEY)
    setDismissed(true)
  }

  return (
    <aside className="card stack install-hint" role="note">
      <strong>{t('install.title')}</strong>
      <p>{t('install.ios')}</p>
      <button className="btn btn--ghost" type="button" onClick={dismiss}>
        {t('install.dismiss')}
      </button>
    </aside>
  )
}
```

- [ ] **Step 5: Uruchom wszystkie testy i typy**

Run: `npm test && npx tsc -b`
Expected: wszystkie testy przechodzą, bez błędów typów.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add iOS install hint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Powłoka aplikacji, profil i bramka logowania

**Files:**
- Create: `src/ui/Splash.tsx`, `src/profile/useProfile.ts`, `src/shell/TabBar.tsx`, `src/shell/TabBar.test.tsx`, `src/shell/ComingSoon.tsx`, `src/shell/AppShell.tsx`, `src/shell/shell.css`, `src/profile/ProfileScreen.tsx`, `src/profile/ProfileScreen.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 5), `LoginScreen`, `signOut` (Task 6), `Profile`, `fetchMyProfile`, `updateSettings`, `OnboardingScreen`, `LegalModal`, `makeProfile` (Task 7), `InstallHint` (Task 8)
- Produces:
  - `Splash({ failed?: boolean; onRetry?: () => void })`
  - `useProfile(userId: string): { profile: Profile | null; failed: boolean; reload: () => void }`
  - `type Tab = 'map' | 'report' | 'ranking' | 'profile'`, `TabBar({ active: Tab; onSelect: (tab: Tab) => void })`
  - `AppShell({ profile: Profile; onProfileChange: () => void })` — plany 2–4 podmieniają w nim `ComingSoon` na prawdziwe ekrany
  - `ProfileScreen({ profile: Profile; onChange: () => void })`

- [ ] **Step 1: Napisz test paska zakładek**

Utwórz `src/shell/TabBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { TabBar } from './TabBar'

test('oznacza aktywną zakładkę', () => {
  render(<TabBar active="map" onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Profil' })).not.toHaveAttribute('aria-current')
})

test('zgłasza wybór zakładki', async () => {
  const onSelect = vi.fn()
  render(<TabBar active="map" onSelect={onSelect} />)
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  expect(onSelect).toHaveBeenCalledWith('profile')
})
```

Run: `npx vitest run src/shell`
Expected: FAIL — `Failed to resolve import "./TabBar"`.

- [ ] **Step 2: Implementacja paska i układu**

Utwórz `src/shell/shell.css`:

```css
.shell {
  min-height: 100%;
}

.install-hint {
  margin: calc(12px + env(safe-area-inset-top)) 16px 0;
}

.tabbar {
  position: fixed;
  inset: auto 0 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--surface);
  border-top: 1px solid var(--fur-light);
}

.tabbar__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.tabbar__item[aria-current='page'] {
  color: var(--rose-dark);
}

.tabbar__icon {
  font-size: 22px;
  line-height: 1;
}

.tabbar__item--primary .tabbar__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--rose);
}

.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}

.profile__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile__header img {
  border-radius: 16px;
}

.profile__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.profile__stats .card {
  display: flex;
  flex-direction: column;
}

.profile__stats strong {
  font-size: 28px;
  font-weight: 800;
}

.splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  padding: 16px;
  text-align: center;
}

.splash img {
  border-radius: 24px;
}

.splash__logo--pulse {
  animation: splash-pulse 1.2s ease-in-out infinite;
}

@keyframes splash-pulse {
  50% {
    transform: scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash__logo--pulse {
    animation: none;
  }
}
```

Utwórz `src/shell/TabBar.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

export type Tab = 'map' | 'report' | 'ranking' | 'profile'

const TABS: { id: Tab; icon: string }[] = [
  { id: 'map', icon: '🗺️' },
  { id: 'report', icon: '📸' },
  { id: 'ranking', icon: '🏆' },
  { id: 'profile', icon: '🐀' },
]

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { t } = useTranslation()
  return (
    <nav className="tabbar" aria-label={t('app.name')}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === 'report' ? 'tabbar__item tabbar__item--primary' : 'tabbar__item'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tabbar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span>{t(`tabs.${tab.id}`)}</span>
        </button>
      ))}
    </nav>
  )
}
```

Utwórz `src/shell/ComingSoon.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <section className="screen coming-soon">
      <img src="/logo.svg" alt="" width={72} height={72} />
      <h1>{title}</h1>
      <p className="muted">{t('comingSoon')}</p>
    </section>
  )
}
```

Utwórz `src/ui/Splash.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

export function Splash({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <main className="splash">
      <img
        className={failed ? undefined : 'splash__logo--pulse'}
        src="/logo.svg"
        alt=""
        width={96}
        height={96}
      />
      {failed ? (
        <>
          <p role="alert">{t('app.error')}</p>
          <button className="btn" type="button" onClick={onRetry}>
            {t('app.retry')}
          </button>
        </>
      ) : (
        <p className="muted">{t('app.loading')}</p>
      )}
    </main>
  )
}
```

W `src/main.tsx` dodaj `import './shell/shell.css'` bezpośrednio po `import './styles/base.css'` (style powłoki są potrzebne już na ekranie ładowania, więc ładujemy je globalnie).

Run: `npx vitest run src/shell`
Expected: PASS.

- [ ] **Step 3: Napisz testy ekranu profilu**

Utwórz `src/profile/ProfileScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { signOut } from '../auth/authApi'
import { makeProfile } from '../test/fixtures'
import { ProfileScreen } from './ProfileScreen'
import { updateSettings } from './profileApi'

vi.mock('./profileApi', () => ({ updateSettings: vi.fn(), fetchMyProfile: vi.fn(), completeOnboarding: vi.fn() }))
vi.mock('../auth/authApi', () => ({
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}))

test('pokazuje pseudonim i liczniki', () => {
  render(<ProfileScreen profile={makeProfile({ total_rats: 12, tokens_balance: 120 })} onChange={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Szczurek' })).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('120')).toBeInTheDocument()
})

test('zapisuje ustawienie widoczności pseudonimu', async () => {
  vi.mocked(updateSettings).mockResolvedValue(undefined)
  const onChange = vi.fn()
  render(<ProfileScreen profile={makeProfile()} onChange={onChange} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Pokazuj mój pseudonim na mapie' }))
  expect(updateSettings).toHaveBeenCalledWith('u1', { show_nickname_on_map: false })
  expect(onChange).toHaveBeenCalled()
})

test('informuje o nieudanym zapisie', async () => {
  vi.mocked(updateSettings).mockRejectedValue(new Error('offline'))
  const onChange = vi.fn()
  render(<ProfileScreen profile={makeProfile()} onChange={onChange} />)
  await userEvent.click(screen.getByRole('checkbox', { name: /trenować model/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać ustawień.')
  expect(onChange).not.toHaveBeenCalled()
})

test('wylogowuje', async () => {
  vi.mocked(signOut).mockResolvedValue(undefined)
  render(<ProfileScreen profile={makeProfile()} onChange={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Wyloguj się' }))
  expect(signOut).toHaveBeenCalled()
})
```

Run: `npx vitest run src/profile/ProfileScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./ProfileScreen"`.

- [ ] **Step 4: Implementacja profilu**

Utwórz `src/profile/ProfileScreen.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from '../auth/authApi'
import { LegalModal, type LegalDoc } from '../legal/LegalModal'
import { updateSettings, type Profile, type ProfileSettings } from './profileApi'

export function ProfileScreen({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const { t } = useTranslation()
  const [saveFailed, setSaveFailed] = useState(false)
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null)

  async function save(patch: Partial<ProfileSettings>) {
    setSaveFailed(false)
    try {
      await updateSettings(profile.id, patch)
      onChange()
    } catch {
      setSaveFailed(true)
    }
  }

  return (
    <section className="screen stack">
      <header className="profile__header">
        <img src="/logo.svg" alt="" width={64} height={64} />
        <h1>{profile.nickname}</h1>
      </header>

      <div className="profile__stats">
        <div className="card">
          <strong>{profile.total_rats}</strong>
          <span className="muted">{t('profile.rats')}</span>
        </div>
        <div className="card">
          <strong>{profile.tokens_balance}</strong>
          <span className="muted">{t('profile.tokens')}</span>
        </div>
      </div>

      <h2>{t('profile.settings')}</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={profile.show_nickname_on_map}
          onChange={(event) => void save({ show_nickname_on_map: event.target.checked })}
        />
        <span>{t('profile.showNickname')}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={profile.training_consent}
          onChange={(event) => void save({ training_consent: event.target.checked })}
        />
        <span>{t('profile.trainingConsent')}</span>
      </label>
      {saveFailed && (
        <p className="error" role="alert">
          {t('profile.saveFailed')}
        </p>
      )}

      <div className="row">
        <button className="btn--link" type="button" onClick={() => setOpenDoc('terms')}>
          {t('legal.terms')}
        </button>
        <button className="btn--link" type="button" onClick={() => setOpenDoc('privacy')}>
          {t('legal.privacy')}
        </button>
      </div>

      <button className="btn btn--ghost" type="button" onClick={() => void signOut().catch(() => undefined)}>
        {t('profile.logout')}
      </button>

      {openDoc && <LegalModal doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </section>
  )
}
```

Run: `npx vitest run src/profile`
Expected: PASS.

- [ ] **Step 5: Hook profilu i powłoka**

Utwórz `src/profile/useProfile.ts` (stan ustawiamy tylko w odpowiedzi na wynik zapytania, nie synchronicznie w efekcie — tego wymaga reguła lintera `react/set-state-in-effect`; flaga `cancelled` chroni przed wynikiem spóźnionego zapytania):

```ts
import { useCallback, useEffect, useState } from 'react'
import { fetchMyProfile, type Profile } from './profileApi'

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchMyProfile(userId).then(
      (loaded) => {
        if (cancelled) return
        setProfile(loaded)
        setFailed(false)
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId, attempt])

  const reload = useCallback(() => {
    setFailed(false)
    setAttempt((count) => count + 1)
  }, [])

  return { profile, failed, reload }
}
```

Utwórz `src/shell/AppShell.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InstallHint } from '../install/InstallHint'
import { ProfileScreen } from '../profile/ProfileScreen'
import type { Profile } from '../profile/profileApi'
import { ComingSoon } from './ComingSoon'
import { TabBar, type Tab } from './TabBar'

export function AppShell({ profile, onProfileChange }: { profile: Profile; onProfileChange: () => void }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('map')

  return (
    <div className="shell">
      <InstallHint />
      <main>
        {tab === 'profile' ? (
          <ProfileScreen profile={profile} onChange={onProfileChange} />
        ) : (
          <ComingSoon title={t(`tabs.${tab}`)} />
        )}
      </main>
      <TabBar active={tab} onSelect={setTab} />
    </div>
  )
}
```

- [ ] **Step 6: Napisz testy bramki w `App`**

Zastąp `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { App } from './App'
import { makeProfile } from './test/fixtures'

const mocks = vi.hoisted(() => ({ useSession: vi.fn(), fetchMyProfile: vi.fn() }))

vi.mock('./auth/useSession', () => ({ useSession: mocks.useSession }))
vi.mock('./profile/profileApi', () => ({
  fetchMyProfile: mocks.fetchMyProfile,
  completeOnboarding: vi.fn(),
  updateSettings: vi.fn(),
}))
vi.mock('./auth/authApi', () => ({
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signOut: vi.fn(),
}))

const signedIn = { status: 'signedIn', session: { user: { id: 'u1' } } }

test('podczas sprawdzania sesji pokazuje ekran ładowania', () => {
  mocks.useSession.mockReturnValue({ status: 'loading' })
  render(<App />)
  expect(screen.getByText('Wczytuję…')).toBeInTheDocument()
})

test('niezalogowany widzi ekran logowania', () => {
  mocks.useSession.mockReturnValue({ status: 'signedOut' })
  render(<App />)
  expect(screen.getByRole('button', { name: 'Zaloguj przez Google' })).toBeInTheDocument()
})

test('nowy użytkownik trafia do onboardingu', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockResolvedValue(makeProfile({ nickname: null, terms_accepted_at: null }))
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Witaj w szczurzej ekipie!' })).toBeInTheDocument()
  expect(mocks.fetchMyProfile).toHaveBeenCalledWith('u1')
})

test('użytkownik po onboardingu widzi aplikację z zakładkami', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockResolvedValue(makeProfile())
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  expect(screen.getByRole('heading', { name: 'Szczurek' })).toBeInTheDocument()
})

test('błąd ładowania profilu można ponowić', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(makeProfile())
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))
  expect(await screen.findByRole('button', { name: 'Mapa' })).toBeInTheDocument()
})
```

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — obecny `App` pokazuje tylko nagłówek (np. brak tekstu „Wczytuję…”).

- [ ] **Step 7: Bramka w `App`**

Zastąp `src/App.tsx`:

```tsx
import { LoginScreen } from './auth/LoginScreen'
import { useSession } from './auth/useSession'
import { OnboardingScreen } from './onboarding/OnboardingScreen'
import { useProfile } from './profile/useProfile'
import { AppShell } from './shell/AppShell'
import { Splash } from './ui/Splash'

export function App() {
  const session = useSession()
  if (session.status === 'loading') return <Splash />
  if (session.status === 'signedOut') return <LoginScreen />
  const userId = session.session.user.id
  return <SignedInApp key={userId} userId={userId} />
}

function SignedInApp({ userId }: { userId: string }) {
  const { profile, failed, reload } = useProfile(userId)
  if (failed) return <Splash failed onRetry={reload} />
  if (!profile) return <Splash />
  if (!profile.terms_accepted_at) return <OnboardingScreen onDone={reload} />
  return <AppShell profile={profile} onProfileChange={reload} />
}
```

- [ ] **Step 8: Uruchom wszystkie testy, typy, lint i build**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: wszystkie testy przechodzą, bez błędów typów i lintera, build OK.

- [ ] **Step 9: Test ręczny całego przepływu**

1. `npm run db:start` (jeśli nie działa) i `npm run dev`.
2. Otwórz http://localhost:5173 → ekran logowania z logo szczura.
3. Wpisz `test@example.com` → „Wyślij kod”.
4. Otwórz Mailpit http://127.0.0.1:54324 → e-mail „Twój kod logowania – Szczury Wrocławia” → przepisz kod → „Zaloguj”.
5. Onboarding: pseudonim `Tester_1`, zaznacz 16 lat i regulamin, otwórz i zamknij „Regulamin” → „Zaczynamy!”.
6. Widać zakładki; „Mapa”, „Zgłoś”, „Ranking” pokazują „Już wkrótce 🐀”.
7. „Profil”: przełącz „Pokazuj mój pseudonim na mapie”, odśwież stronę (F5) — ustawienie zostaje.
8. „Wyloguj się” → ekran logowania.
9. W narzędziach deweloperskich przeglądarki (F12 → Application → Manifest) widać manifest z ikoną szczura; w trybie ciemnym systemu kolory się zmieniają.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add app shell with tabs, profile screen and auth gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Wdrożenie (z udziałem właściciela projektu)

Ten task wymaga zakładania kont — agent przygotowuje pliki i instrukcję, a kroki z kontami wykonuje właściciel projektu (agent prowadzi go krok po kroku i czeka na potwierdzenia).

**Files:**
- Create: `docs/deploy.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: cały projekt
- Produces: skrypt `npm run deploy`; publiczny adres `https://<projekt>.pages.dev`

- [ ] **Step 1: Wrangler i skrypt wdrożenia**

```bash
npm install -D wrangler
npm pkg set scripts.deploy="npm run build && wrangler pages deploy dist --project-name szczury-wroclaw"
```

Do `.gitignore` dopisz linię `.wrangler/`.

- [ ] **Step 2: Instrukcja wdrożenia**

Utwórz `docs/deploy.md`:

````markdown
# Wdrożenie Szczurów Wrocławia (0 zł)

Wszystkie usługi poniżej mają darmowe plany i nie wymagają karty płatniczej.

## 1. Supabase (baza, logowanie)

1. Załóż konto na https://supabase.com (logowanie przez GitHub lub e-mail).
2. „New project”: nazwa `szczury-wroclaw`, region **Central EU (Frankfurt)**, plan Free. Zapisz hasło do bazy w menedżerze haseł.
3. W terminalu, w katalogu projektu:
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF>   # REF to fragment adresu projektu: https://<REF>.supabase.co
   npx supabase db push
   ```
4. Szablony e-maili z kodem: `npx supabase config push`. Jeśli polecenie nie przeniesie szablonów, w panelu: Authentication → Emails → „Magic link” i „Confirm signup” — wklej treść `supabase/templates/otp.html` i temat „Twój kod logowania – Szczury Wrocławia”.
5. Authentication → Sign In / Providers → Email: włączony, długość kodu 6.
6. Project Settings → API Keys: skopiuj **Publishable key**; Project URL to `https://<REF>.supabase.co`.

## 2. Logowanie przez Google

1. https://console.cloud.google.com → nowy projekt `szczury-wroclaw`.
2. APIs & Services → OAuth consent screen: typ **External**, nazwa „Szczury Wrocławia”, Twój e-mail kontaktowy, logo `public/pwa-192x192.png`. Opublikuj aplikację (Publish app), żeby logować mogły się wszystkie osoby.
3. Credentials → Create credentials → OAuth client ID → **Web application**.
   - Authorized JavaScript origins: `https://szczury-wroclaw.pages.dev`
   - Authorized redirect URIs: `https://<REF>.supabase.co/auth/v1/callback`
4. Skopiuj Client ID i Client Secret → Supabase: Authentication → Sign In / Providers → Google → włącz i wklej.

## 3. Cloudflare Pages (hosting aplikacji)

1. Załóż konto na https://dash.cloudflare.com (plan Free).
2. W katalogu projektu utwórz `.env.production.local` (plik jest ignorowany przez git):
   ```
   VITE_SUPABASE_URL=https://<REF>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
3. Wdróż:
   ```bash
   npx wrangler login
   npx wrangler pages project create szczury-wroclaw --production-branch main
   npm run deploy
   ```
4. Adres aplikacji: `https://szczury-wroclaw.pages.dev` (jeśli nazwa jest zajęta, Cloudflare poda inny — użyj go poniżej).

## 4. Połącz adresy

W Supabase: Authentication → URL Configuration:
- Site URL: `https://szczury-wroclaw.pages.dev`
- Redirect URLs: `https://szczury-wroclaw.pages.dev`, `http://localhost:5173`

## 5. Przed udostępnieniem ludziom

- [ ] Uzupełnij `src/legal/legalConfig.ts` (prawdziwy administrator i e-mail kontaktowy) i wdroż ponownie.
- [ ] Poproś osobę znającą prawo (np. uczelnianą poradnię prawną) o przejrzenie regulaminu i polityki prywatności.

## 6. Test na telefonie

- Android (Chrome): otwórz adres → menu ⋮ → „Zainstaluj aplikację” → ikona szczura na ekranie.
- iPhone (Safari): otwórz adres → pojawi się podpowiedź → Udostępnij → „Dodaj do ekranu początkowego”.
- W zainstalowanej aplikacji zaloguj się kodem z e-maila oraz przez Google, przejdź onboarding, sprawdź profil.

## Kolejne wdrożenia

`npm run deploy` (po `npx supabase db push`, jeśli doszły migracje).
````

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add zero-cost deployment guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Wdrożenie z właścicielem projektu**

Przejdź z właścicielem projektu przez `docs/deploy.md` punkt po punkcie (sekcje 1–4 i 6). Agent uruchamia polecenia terminalowe, właściciel wykonuje kroki w przeglądarce i podaje `REF` oraz klucze. Task jest ukończony, gdy na prawdziwym telefonie działa: instalacja z ikoną szczura, logowanie kodem z e-maila, logowanie Google, onboarding i zapis ustawień profilu.
