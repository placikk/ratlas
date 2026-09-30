# Wdrożenie Ratlasa (0 zł)

Wszystkie usługi poniżej mają darmowe plany i nie wymagają karty płatniczej.

## 1. Supabase (baza, logowanie)

1. Załóż konto na https://supabase.com (logowanie przez GitHub lub e-mail).
2. „New project": nazwa `ratlas`, region **Central EU (Frankfurt)**, plan Free. Zapisz hasło do bazy w menedżerze haseł.
3. W terminalu, w katalogu projektu:
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF>   # REF to fragment adresu projektu: https://<REF>.supabase.co
   npx supabase db push
   ```
4. Szablony e-maili z kodem: w panelu Authentication → Emails → szablony „Magic link" i „Confirm signup" — wklej treść `supabase/templates/otp.html`, temat „Twój kod logowania – Ratlas".
5. Authentication → Sign In / Providers → Email: włączony, długość kodu 6.
6. Project Settings → API Keys: skopiuj **Publishable key**; Project URL to `https://<REF>.supabase.co`.

## 2. Wysyłka e-maili z kodami (SMTP)

**Ważne:** wbudowana wysyłka e-maili Supabase dostarcza wiadomości tylko członkom organizacji Supabase i z bardzo niskim limitem. Bez własnego SMTP logowanie kodem działa tylko dla członków organizacji — publicznie działa wtedy tylko logowanie Google.

Brevo (darmowy plan, https://www.brevo.com, ok. 300 e-maili dziennie, bez karty):

1. Załóż konto w Brevo.
2. Senders & IP → dodaj i zweryfikuj adres nadawcy.
3. SMTP & API → wygeneruj klucz SMTP.
4. W Supabase: Authentication → Emails → SMTP Settings → włącz Custom SMTP: host `smtp-relay.brevo.com`, port `587`, login i hasło (klucz SMTP) z Brevo, nadawca = zweryfikowany adres, nazwa „Ratlas".
5. Authentication → Rate Limits: limit e-maili np. 100 na godzinę.

Możesz użyć innego darmowego dostawcy SMTP w ten sam sposób.

## 3. Logowanie przez Google

1. https://console.cloud.google.com → nowy projekt `ratlas`.
2. APIs & Services → OAuth consent screen: typ **External**, nazwa „Ratlas", Twój e-mail kontaktowy, logo `public/pwa-192x192.png`. Opublikuj aplikację (Publish app), żeby logować mogły się wszystkie osoby.
3. Credentials → Create credentials → OAuth client ID → **Web application**.
   - Authorized JavaScript origins: `https://ratlas.pages.dev`
   - Authorized redirect URIs: `https://<REF>.supabase.co/auth/v1/callback`
4. Skopiuj Client ID i Client Secret → Supabase: Authentication → Sign In / Providers → Google → włącz i wklej.

## 4. Cloudflare Pages (hosting aplikacji)

1. Załóż konto na https://dash.cloudflare.com (plan Free).
2. W katalogu projektu utwórz `.env.production.local` (plik jest ignorowany przez git):
   ```
   VITE_SUPABASE_URL=https://<REF>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
3. Wdróż:
   ```bash
   npx wrangler login
   npx wrangler pages project create ratlas --production-branch main
   npm run deploy
   ```
4. Adres aplikacji: `https://ratlas.pages.dev` (jeśli nazwa jest zajęta, Cloudflare poda inny — użyj go poniżej).

## 5. Połącz adresy

W Supabase: Authentication → URL Configuration:
- Site URL: `https://ratlas.pages.dev`
- Redirect URLs: `https://ratlas.pages.dev`, `http://localhost:5173`

## 6. Przed udostępnieniem ludziom

- [ ] Uzupełnij `src/legal/legalConfig.ts` (prawdziwy administrator i e-mail kontaktowy) i wdroż ponownie.
- [ ] Poproś osobę znającą prawo (np. uczelnianą poradnię prawną) o przejrzenie regulaminu i polityki prywatności.

## 7. Test na telefonie

- Android (Chrome): otwórz adres → menu ⋮ → „Zainstaluj aplikację" → ikona szczura na ekranie.
- iPhone (Safari): otwórz adres → pojawi się podpowiedź → Udostępnij → „Dodaj do ekranu początkowego".
- W zainstalowanej aplikacji zaloguj się kodem z e-maila oraz przez Google, przejdź onboarding, sprawdź profil.
- Na iPhonie sprawdź logowanie Google w zainstalowanej aplikacji (tryb standalone) — jeśli nie wraca zalogowany, używaj logowania kodem z e-maila.

## Kolejne wdrożenia

`npm run deploy` (po `npx supabase db push`, jeśli doszły migracje).

Uwaga: nie używaj `npx supabase config push` — nadpisałby produkcyjne adresy (Site URL) ustawieniami lokalnymi.
