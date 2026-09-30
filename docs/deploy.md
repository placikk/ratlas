# Wdrożenie Szczurów Wrocławia (0 zł)

Wszystkie usługi poniżej mają darmowe plany i nie wymagają karty płatniczej.

## 1. Supabase (baza, logowanie)

1. Załóż konto na https://supabase.com (logowanie przez GitHub lub e-mail).
2. „New project": nazwa `szczury-wroclaw`, region **Central EU (Frankfurt)**, plan Free. Zapisz hasło do bazy w menedżerze haseł.
3. W terminalu, w katalogu projektu:
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF>   # REF to fragment adresu projektu: https://<REF>.supabase.co
   npx supabase db push
   ```
4. Szablony e-maili z kodem: `npx supabase config push`. Jeśli polecenie nie przeniesie szablonów, w panelu: Authentication → Emails → „Magic link" i „Confirm signup" — wklej treść `supabase/templates/otp.html` i temat „Twój kod logowania – Szczury Wrocławia".
5. Authentication → Sign In / Providers → Email: włączony, długość kodu 6.
6. Project Settings → API Keys: skopiuj **Publishable key**; Project URL to `https://<REF>.supabase.co`.

## 2. Logowanie przez Google

1. https://console.cloud.google.com → nowy projekt `szczury-wroclaw`.
2. APIs & Services → OAuth consent screen: typ **External**, nazwa „Szczury Wrocławia", Twój e-mail kontaktowy, logo `public/pwa-192x192.png`. Opublikuj aplikację (Publish app), żeby logować mogły się wszystkie osoby.
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

- Android (Chrome): otwórz adres → menu ⋮ → „Zainstaluj aplikację" → ikona szczura na ekranie.
- iPhone (Safari): otwórz adres → pojawi się podpowiedź → Udostępnij → „Dodaj do ekranu początkowego".
- W zainstalowanej aplikacji zaloguj się kodem z e-maila oraz przez Google, przejdź onboarding, sprawdź profil.

## Kolejne wdrożenia

`npm run deploy` (po `npx supabase db push`, jeśli doszły migracje).
