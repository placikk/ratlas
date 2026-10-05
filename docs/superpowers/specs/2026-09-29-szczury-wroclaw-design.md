# Ratlas — projekt aplikacji

**Data:** 2026-09-29
**Status:** projekt zatwierdzony sekcjami w rozmowie, czeka na przegląd spisanej wersji
**Nazwa:** Ratlas (rat + atlas — „szczurza mapa Wrocławia”; wcześniej robocza nazwa „Szczury Wrocławia”)
**Waluta w grze:** raciki (odmiana: 1 racik, 2 raciki, 5 racików) — w interfejsie zawsze „raciki”; w kodzie i bazie nazwy techniczne `tokens*` pozostają bez zmian

## 1. Cel i założenia

Aplikacja dla mieszkańców Wrocławia: robisz zdjęcie szczura, model AI potwierdza, że to szczur (i ile ich jest), dostajesz punkty do licznika i raciki wymieniane na materiały edukacyjne. Mapa pokazuje ostatnie obserwacje, które z czasem zanikają. Grywalizacja: rangi, ranking, jawne i ukryte osiągnięcia.

**Założenia nadrzędne:**
- Docelowo prawdziwy, publiczny produkt dla Wrocławia.
- **Start za 0 zł**: tylko darmowe plany, bez kont w sklepach (Apple 99 USD/rok, Google Play 25 USD), bez podpinania karty.
- Bez reklam na starcie; monetyzacja rozważana dopiero, gdy projekt się przyjmie.
- Architektura gotowa na rozrost: podmiana modelu AI, opakowanie w aplikację sklepową, więcej nagród — bez przepisywania.
- Autor zna podstawy programowania i trochę ML, ale nie zna technologii mobilnych.

## 2. Decyzje (skrót)

| Temat | Decyzja |
|---|---|
| Platforma | PWA (instalowana z przeglądarki na Androidzie i iOS); później opakowanie w Capacitor i publikacja w sklepach |
| Frontend | React + TypeScript + Vite + `vite-plugin-pwa`, hosting Cloudflare Pages (darmowy) |
| Backend | Supabase: Postgres + PostGIS, Auth, Storage, Edge Functions (TS/Deno), `pg_cron` |
| Rozpoznawanie szczurów | Start: multimodalny model AI przez API (VLM) za interfejsem `RatVerifier`. Później: hybryda z własnym, douczonym detektorem |
| Ochrona przed oszustwami | Poziom „rozsądny”: zdjęcie tylko z aparatu na żywo, weryfikacja na serwerze, granice Wrocławia, limit dzienny, wykrywanie duplikatów, cooldown miejsca, zgłaszanie nadużyć |
| Logowanie | Google + jednorazowy 6-cyfrowy kod wysyłany e-mailem (bez haseł). Kod zamiast linku, bo na iOS link z maila otwiera Safari, a nie zainstalowaną PWA (osobna sesja). Publicznie widać tylko pseudonim |
| Mapa | Dokładna lokalizacja + pseudonim autora (z możliwością ukrycia); dokładność konfigurowalna, by w razie problemów przejść na rozmytą |
| Punktacja | Liczy się każdy szczur na zdjęciu (max 5), z cooldownem miejsca i limitem dziennym |
| Nagrody | Start: treści cyfrowe (karty wiedzy, quizy, kosmetyka). Później: kody od partnerów |
| Ranking | Miesięczny + ogólny |
| Język | Polski, przygotowany pod tłumaczenia (i18n) |

## 3. Architektura

```
┌─────────────────────────┐        ┌──────────────────────────────────────┐
│  PWA (React + TS + Vite)│        │              Supabase                │
│  Cloudflare Pages       │  HTTPS │  Auth ── Google + kod e-mail         │
│  • aparat (live)        │ ─────► │  Postgres + PostGIS ── dane, ranking │
│  • GPS                  │        │  Storage ── zdjęcia                  │
│  • mapa MapLibre        │        │  Edge Function `submit-sighting`     │
│  • kolejka offline      │        │        ▼                             │
└─────────────────────────┘        │  RatVerifier (interfejs)             │
                                   │    ├─ VlmVerifier (start)            │
                                   │    └─ DetectorVerifier (później)     │
                                   └──────────────────────────────────────┘
```

**Zasada nr 1: nie ufamy telefonowi.** Klient robi zdjęcie i wysyła je z lokalizacją. Wszystko, co przyznaje punkty, dzieje się na serwerze. Tabele z punktami są dla użytkowników tylko do odczytu (RLS); zapisuje wyłącznie kod serwerowy.

### Moduły frontendu
- **Kamera**: podgląd na żywo (`getUserMedia`), przełączanie na przedni aparat, zrobienie zdjęcia, kompresja, GPS.
- **Mapa**: pinezki z zanikaniem, gniazda (klastry), panel szczegółów.
- **Profil**: licznik, ranga + pasek postępu, raciki, osiągnięcia, ustawienia.
- **Ranking**: zakładki Miesięczny / Ogólny.
- **Szczurza Biblioteka**: sklep za raciki i odblokowane treści.
- **Onboarding**: logowanie, pseudonim, zgody, komunikat o bezpieczeństwie, instrukcja instalacji PWA (szczególnie iOS).

### Moduły backendu
- **Edge Function `submit-sighting`**: cała ścieżka zgłoszenia (sekcja 4).
- **`RatVerifier`**: interfejs z jedną metodą `verify(image) → VerificationResult`.
- **Silnik osiągnięć**: reguły jako dane w bazie (sekcja 6).
- **Funkcje SQL**: `award_sighting` (naliczenie w transakcji), `purchase_item`, `sightings_in_view(bbox)`.
- **Zadania `pg_cron`**: ponawianie weryfikacji `pending`, odświeżanie rankingów, sprzątanie starych odrzuconych zdjęć.
- **Edge Function `delete-account`**: usunięcie konta i danych.

### Kontrakt `RatVerifier`

```ts
interface VerificationResult {
  ratCount: number;            // 0 = brak szczura
  isSelfie: boolean;           // autor widoczny razem ze szczurem
  isScreenOrPrint: boolean;    // zdjęcie ekranu / wydruku
  isToyOrDrawing: boolean;     // zabawka, rysunek, figurka
  hasThirdPartyFaces: boolean; // rozpoznawalne twarze osób trzecich
  tags: AllowedTag[];          // zamknięta lista, np. "smietnik", "krasnal", "woda", "tramwaj_przystanek", "deszcz"
  raw: unknown;                // pełna odpowiedź modelu (do audytu i przyszłego treningu)
}
```

Odpowiedź modelu walidowana schematem (zod). Niepoprawna odpowiedź = błąd weryfikacji (status `pending`, ponowienie).

**Wybór dostawcy VLM** zapada w fazie planu po sprawdzeniu: (a) darmowych limitów, (b) warunków — dostawca **nie może trenować na przesłanych zdjęciach**, (c) jakości na zbiorze ewaluacyjnym (sekcja 12). Kandydaci: Gemini (darmowy próg), Cloudflare Workers AI (bezpieczny wariant zapasowy — nie trenuje na danych klientów).

## 4. Zgłoszenie szczura

### Klient
1. Podgląd z aparatu na żywo; brak wyboru z galerii.
2. Po zrobieniu zdjęcia: skalowanie do ~1600 px dłuższego boku, kompresja (~200–250 KB), usunięcie EXIF (rysowanie przez canvas).
3. GPS z dokładnością; jeśli dokładność > 100 m → „Łapię sygnał GPS…”.
4. Wysłanie do `submit-sighting`. Bez sieci: zapis w IndexedDB i automatyczna wysyłka po powrocie zasięgu (max 24 h od zrobienia zdjęcia, potem zgłoszenie przepada z komunikatem).

### Serwer (od najtańszej kontroli)

| # | Kontrola | Wynik negatywny |
|---|---|---|
| 1 | Zalogowany | 401 |
| 2 | Limit dzienny (`daily_submission_limit`, domyślnie 10) | „Wróć jutro” — bez wywołania modelu |
| 3 | Punkt w `city_boundary` (PostGIS) | „Działamy tylko we Wrocławiu” |
| 4 | Duplikat: hash percepcyjny vs zdjęcia z ostatnich 30 dni (odległość Hamminga ≤ próg) | `rejected: duplicate` |
| 5 | `RatVerifier.verify` | `rejected: no_rat` / `screen_or_print` / `toy_or_drawing`; błąd → `pending` |
| 6 | Cooldown: ten sam użytkownik, ≤ 50 m, ≤ 30 min od poprzedniego zaliczonego | `accepted_no_points` (pinezka jest, punktów nie ma) |
| 7 | `award_sighting` w jednej transakcji: szczury = `min(ratCount, 5)`, raciki, osiągnięcia, dziennik racików | `accepted` |

Wszystkie progi pochodzą z `app_config`.

### Statusy zgłoszenia
`pending` → `accepted` | `accepted_no_points` | `rejected` (z `reject_reason`) ; dodatkowo flaga `hidden` po zgłoszeniach nadużyć.

### Zdjęcia
- Zaakceptowane, bez twarzy osób trzecich i niebędące selfie → publiczny bucket `map-photos` (nazwy UUID).
- Wszystkie pozostałe (selfie, odrzucone, pending) → prywatny bucket `sightings-private` (dostęp: autor + admin).
- Odrzucone zdjęcia usuwane automatycznie po 30 dniach.

### Ekran wyniku
Animacja „+3 szczury · +30 racików”; przy nowym ukrytym osiągnięciu osobny efekt „Odkryłeś sekretne osiągnięcie!”. Dla `pending`: „Sprawdzamy Twojego szczura, damy znać” — wynik pojawia się w profilu po ponownej weryfikacji.

### Zgłaszanie nadużyć
Każdą pinezkę można zgłosić (jedna osoba — jedno zgłoszenie na pinezkę). Po 3 zgłoszeniach od różnych osób pinezka dostaje `hidden = true` i czeka na decyzję admina w panelu Supabase (bez własnego panelu admina na start). Admin może cofnąć punkty przez wpis korygujący w `token_ledger`.

## 5. Model danych

**Użytkownicy i punkty**
- `profiles`: `id` (= `auth.users.id`), `nickname` (unikalny), `show_nickname_on_map` (domyślnie `true`), `total_rats`, `tokens_balance`, `training_consent`, `created_at`.
- `token_ledger`: `id`, `user_id`, `delta`, `reason` (`sighting` | `achievement` | `purchase` | `correction`), `ref_id`, `created_at`. Saldo w `profiles` to pamięć podręczna sumy dziennika.

**Zgłoszenia**
- `sightings`: `id`, `user_id`, `status`, `reject_reason`, `location` (geography Point), `location_accuracy_m`, `captured_at`, `created_at`, `photo_path`, `phash`, `rats_detected`, `rats_awarded`, `tokens_awarded`, `is_selfie`, `has_third_party_faces`, `public_on_map`, `hidden`, `verifier`, `verifier_raw` (jsonb), `verify_attempts`.
- `reports`: `id`, `sighting_id`, `reporter_id`, `reason`, `created_at`; unikalne (`sighting_id`, `reporter_id`).

**Grywalizacja**
- `ranks`: `id`, `name`, `min_rats`, `icon`.
- `achievements`: `id`, `code`, `name`, `description`, `secret`, `reward_tokens`, `rule` (jsonb), `icon`.
- `user_achievements`: `user_id`, `achievement_id`, `sighting_id`, `unlocked_at`; unikalne (`user_id`, `achievement_id`).
- Zmaterializowane widoki `ranking_all_time`, `ranking_monthly` (bieżący miesiąc wg `Europe/Warsaw`), odświeżane przez `pg_cron` co ~5 min.

**Nagrody**
- `reward_items`: `id`, `type` (`knowledge_card` | `quiz` | `cosmetic` | `partner_code`), `name`, `price`, `content` (jsonb/markdown), `active`.
- `user_rewards`: `user_id`, `item_id`, `acquired_at`, `data` (np. wynik quizu).
- `partner_codes`: `id`, `item_id`, `code`, `assigned_to`, `assigned_at` (na start pusta).

**Konfiguracja**
- `app_config` (klucz → jsonb): `daily_submission_limit`, `cooldown_radius_m`, `cooldown_minutes`, `max_rats_per_photo`, `tokens_per_rat`, `pin_fade_days`, `map_location_precision` (`exact` | `fuzzy`), `duplicate_hamming_threshold`, `reports_to_hide`.
- `city_boundary`: obrys administracyjny Wrocławia (z OSM).
- `odra_geometry`: przebieg Odry (do osiągnięcia „Odrzański Wilk”).

**RLS**: użytkownik czyta własne dane i publiczne widoki (mapa, ranking, katalog nagród); nie ma prawa zapisu do `sightings`, `token_ledger`, `user_achievements`, `profiles.total_rats/tokens_balance`. Może edytować tylko `nickname`, `show_nickname_on_map`, `training_consent`.

## 6. Grywalizacja

### Rangi (wg `total_rats`)

| Szczury | Ranga |
|---|---|
| 0 | Szczurzy Nowicjusz |
| 5 | Podwórkowy Obserwator |
| 15 | Tropiciel z Nadodrza |
| 40 | Kanałowy Zwiadowca |
| 100 | Łowca z Rynku |
| 250 | Szczurołap |
| 500 | Król Szczurów Wrocławia |

### Osiągnięcia jawne
Pierwszy szczur; 10 / 50 / 100 szczurów; Gniazdo (5 szczurów na jednym zdjęciu); Seria (zaliczony szczur 7 dni z rzędu). Nagroda 25–50 racików.

### Osiągnięcia ukryte (nagroda 50–100 racików)

| Osiągnięcie | Reguła |
|---|---|
| Szczurze Selfie | `is_selfie` |
| Nocny Marek | godzina zgłoszenia 0:00–4:00 (Europe/Warsaw) |
| Śmietnikowy Smakosz | tag `smietnik` |
| Szczur i Krasnal | tag `krasnal` |
| Odrzański Wilk | tag `woda` lub odległość od `odra_geometry` ≤ 100 m |
| Pasażer MPK | tag `tramwaj_przystanek` |
| Mokry Futrzak | tag `deszcz` |

W profilu ukryte osiągnięcia wyglądają jak „???”, z licznikiem „Zostało N sekretów do odkrycia”.

### Silnik reguł
Typy reguł obsługiwane w kodzie: `flag` (pole wyniku weryfikacji), `tag`, `total_rats_gte`, `rats_in_photo_gte`, `hour_between`, `streak_days_gte`, `near_geometry`. Nowe osiągnięcie istniejącego typu = nowy wiersz w `achievements` (+ ewentualnie nowy tag na zamkniętej liście w poleceniu dla modelu). Osiągnięcia oceniane są tylko dla zgłoszeń `accepted` (nie dla `accepted_no_points`).

### Ekonomia (domyślne wartości w `app_config`)
10 racików za szczura; osiągnięcia jak wyżej. Orientacyjne ceny: karta wiedzy ~30, quiz ~50, kosmetyka 100–300.

### Ranking
Zakładki Miesięczny i Ogólny; wartość = suma `rats_awarded`. Pokazujemy top 50 + pozycję zalogowanego użytkownika. Remis: wyżej ten, kto osiągnął wynik wcześniej.

## 7. Mapa

- **MapLibre GL** + darmowe kafelki wektorowe **OpenFreeMap** (bez klucza API), własny styl w palecie aplikacji.
- **Dane**: `sightings_in_view(bbox)` → `accepted`/`accepted_no_points`, `public_on_map`, nie `hidden`, młodsze niż `pin_fade_days` (7), max ~500. Odświeżanie po przesunięciu mapy i co ~60 s.
- **Zanikanie**: `opacity = max(0.15, 1 − wiek / pin_fade_days)`, liczone na kliencie z czasu serwera; po 7 dniach zapytanie nie zwraca pinezki.
- **Znaczniki**: sylwetka szczura w brudnym różu; przy >1 szczurze szary dymek z liczbą; własne zgłoszenia z obwódką; kosmetyczne skórki pinezek (z Biblioteki) widoczne dla wszystkich. Przy oddaleniu klastry „gniazd” z sumą szczurów.
- **Panel po kliknięciu**: zdjęcie, liczba szczurów, „N godz. temu”, pseudonim (jeśli autor nie ukrył), przycisk „Zgłoś”.
- **Lokalizacja**: `map_location_precision = exact` na start; `fuzzy` = przesunięcie 50–100 m wyliczane raz przy zapisie.
- Domyślny widok: Wrocław; przycisk „pokaż mnie”. Mapę można przeglądać spoza Wrocławia.

## 8. Szczurza Biblioteka (nagrody)

- **Karty wiedzy** (Markdown + obrazek), na start ~10, np.: „Czy szczury się śmieją?”, „Szczur wędrowny i śniady”, „Szczury a leptospiroza”, „Szczury w historii Wrocławia”. Fakty weryfikowane; treści z Wikipedii tylko z atrybucją (CC BY-SA).
- **Quizy** (pytania w JSON, wynik zapisany w `user_rewards.data`).
- **Kosmetyka**: skórki pinezek, ramki avatara, tytuły przy pseudonimie.
- **Zakup**: `purchase_item(item_id)` — atomowo sprawdza saldo, zapisuje `token_ledger`, dodaje `user_rewards`; ponowny zakup tego samego przedmiotu jest blokowany.
- **Kody partnerów (przyszłość)**: ta sama funkcja pobiera wolny kod (`FOR UPDATE SKIP LOCKED`).

## 9. Wygląd i marka

**Paleta** (tokeny CSS, tryb jasny i ciemny):

| Token | Jasny | Ciemny | Użycie |
|---|---|---|---|
| `--fur` | `#6B6A6E` | `#9A989C` | główny szary (futro) |
| `--fur-dark` | `#3A3839` | `#E6E2E0` | tekst |
| `--fur-light` | `#D9D6D4` | `#3A3839` | obramowania, tła kart |
| `--rose` | `#C98A8F` | `#D69BA0` | brudny róż — akcent, przyciski, pinezki |
| `--rose-dark` | `#A5646B` | `#E5B3B7` | stan wciśnięty, linki |
| `--rose-light` | `#EBD3D3` | `#4A3537` | tła wyróżnień |
| `--bg` | `#F4F1EF` | `#232122` | tło aplikacji |
| `--danger` | `#B4504F` | `#D77A78` | błędy |

**Typografia**: Nunito (zaokrąglona, przyjazna, pełne polskie znaki), dołączona lokalnie przez `@fontsource`.

**Ikona aplikacji**: sylwetka szczura z profilu (szara) na zaokrąglonym kwadracie w brudnym różu, ogon zawinięty w łuk. Warianty: `maskable` dla Androida, `apple-touch-icon` dla iOS, favicon. Rysowana jako SVG, rastrowana do wymaganych rozmiarów.

**Znaczniki mapy**: sylwetka szczura (SVG) w `--rose` z obwódką `--fur-dark`; klaster „gniazda” jako okrągła „nora” z liczbą.

**Drobiazgi**: animacja ładowania ze śladami łapek; ekran wyniku z podskakującym szczurem; bez dźwięków domyślnie.

## 10. Obsługa błędów

| Sytuacja | Zachowanie |
|---|---|
| Brak zgody na aparat | Ekran z instrukcją włączenia uprawnień dla danej przeglądarki |
| Brak zgody na GPS | Zgłaszanie zablokowane z wyjaśnieniem; mapa działa |
| Słaba dokładność GPS | Oczekiwanie do ≤ 100 m, potem możliwość ponowienia |
| Poza Wrocławiem | Komunikat, bez wywołania modelu |
| Brak sieci | Kolejka w IndexedDB, automatyczne ponowienie (max 24 h) |
| Limit / błąd modelu AI | Status `pending`, ponowienie przez `pg_cron` z rosnącym odstępem; po 5 nieudanych próbach `rejected: verification_failed` z możliwością ponownego zgłoszenia |
| Niepoprawna odpowiedź modelu | Walidacja zod → traktowana jak błąd modelu |
| Limit dzienny | Komunikat „Wróć jutro” |
| Konflikt pseudonimu | Komunikat przy wyborze, propozycja wolnego wariantu |

## 11. Prywatność i kwestie prawne

- Przy rejestracji: akceptacja regulaminu i polityki prywatności, oświadczenie „mam ukończone 16 lat”, **osobna dobrowolna zgoda** na użycie zdjęć do trenowania przyszłego modelu (`training_consent`).
- Dostawca VLM nie może trenować na przesłanych zdjęciach — warunek twardy przy wyborze.
- „Usuń konto”: kaskadowe usunięcie profilu, zdjęć i zgłoszeń; zostają tylko anonimowe sumy.
- Selfie i zdjęcia z twarzami osób trzecich nigdy nie trafiają na publiczną mapę.
- Komunikat bezpieczeństwa przy pierwszym uruchomieniu: nie dotykaj szczurów, nie wchodź na teren prywatny, fotografuj z dystansu.
- Szkic regulaminu i polityki prywatności przygotowany w projekcie; przed publicznym startem zalecany przegląd przez osobę znającą prawo (np. darmowa uczelniana poradnia prawna).

## 12. Testy

- **Jednostkowe (Vitest)**: silnik osiągnięć, punktacja i limity, funkcja zanikania, parsowanie/walidacja odpowiedzi modelu, kompresja zdjęcia (logika wymiarów).
- **Baza (pgTAP, lokalny Supabase przez CLI + Docker)**: polityki RLS (użytkownik nie zapisze punktów), `award_sighting`, `purchase_item` (brak podwójnego zakupu, brak ujemnego salda), `sightings_in_view`, granice miasta, cooldown.
- **Edge Functions (Deno test)**: ścieżka `submit-sighting` z `FakeVerifier`.
- **Ewaluacja modelu**: własny zbiór ~50–100 zdjęć (szczury, myszy, wiewiórki, chomiki, zabawki, zdjęcia ekranu, selfie) z etykietami; skrypt liczy precyzję/czułość dla „jest szczur” i trafność flag. Próg akceptacji dostawcy: precyzja „jest szczur” ≥ 95%. Ten sam zbiór posłuży później do porównania z własnym detektorem.
- **E2E (Playwright)**: logowanie (konto testowe), zgłoszenie z symulowanym aparatem (Chromium fake video capture) i nadpisaną geolokalizacją, pojawienie się pinezki, zakup karty wiedzy.

## 13. Etapy

**Etap 1 — MVP (pierwszy plan implementacji)**
- Szkielet PWA (instalowalność, ikona, paleta, i18n, onboarding z instrukcją dla iOS).
- Logowanie Google + kod z e-maila, pseudonim, zgody.
- Zgłoszenie szczura z pełną ochroną z sekcji 4 i `VlmVerifier`.
- Licznik, raciki, rangi, profil.
- Mapa z zanikaniem, znacznikami i panelem szczegółów; zgłaszanie nadużyć.
- Ranking miesięczny i ogólny.
- Osiągnięcia jawne i ukryte z sekcji 6.
- Usuwanie konta, regulamin i polityka prywatności (szkic).

**Etap 2 — Szczurza Biblioteka**
- Katalog, zakupy, ~10 kart wiedzy, quizy, kosmetyka (skórki pinezek, ramki, tytuły).

**Etap 3 — Rozwój (gdy projekt się przyjmie)**
- Własny detektor i hybryda (`DetectorVerifier` jako pierwszy filtr, VLM dla trafień).
- Kody od partnerów.
- Capacitor i publikacja w Google Play / App Store.
- Odświeżanie mapy na żywo (Supabase Realtime), ewentualne statystyki osiedli.
- Przeniesienie starszych zdjęć do tańszego magazynu, gdy zbliżymy się do limitu 1 GB.

## 14. Poza zakresem (na teraz)

Reklamy, nagrody fizyczne z wysyłką, własny panel admina, ranking osiedli, powiadomienia push, czat/komentarze, ręczna moderacja każdego zgłoszenia.

## 15. Ustalenia z realizacji planu 2

- Zaległe zgłoszenia (`pending`) rozstrzyga aplikacja przy starcie (funkcja `retry-pending`), a nie `pg_cron` — bez trzymania tajnych kluczy w bazie. Zgłoszenie czeka, aż autor ponownie otworzy aplikację.
- Kolejka offline w IndexedDB odłożona; przy braku zasięgu zdjęcie zostaje w pamięci ekranu z przyciskiem „Spróbuj ponownie”.
- Kasowanie odrzuconych zdjęć po 30 dniach przeniesione do planu 4.
- Dokładność GPS sprawdza także serwer (`gps_max_accuracy_m` = 100 m).
- Weryfikacja: Gemini przez REST `generateContent` (domyślnie `gemini-3.5-flash`, zmienny sekretem `GEMINI_MODEL`); lokalnie `VERIFIER=fake`.
- Ponowienia weryfikacji z rosnącym odstępem: 1 h, 2 h, 4 h, 8 h, 16 h od poprzedniej próby (ok. 31 h łącznie), liczone przy otwarciu aplikacji.
- Warunki danych Gemini: dla użytkowników z EOG, Szwajcarii i Wielkiej Brytanii darmowy próg Gemini API podlega zasadom płatnym — Google nie używa przesłanych treści do trenowania (ai.google.dev/gemini-api/terms).

## 16. Ustalenia z realizacji planu 3

- Mapa: MapLibre GL 6 + OpenFreeMap (styl Positron przekolorowany w kodzie), ładowana leniwie; pinezki z `sightings_in_view` (tylko zalogowani), odświeżanie po przesunięciu mapy i co 60 s.
- Skórki pinezek (Biblioteka) i tryb `fuzzy` lokalizacji — odłożone; własne pinezki mają wyróżnioną ikonę.
- Zgłaszanie nadużyć: powody `not_rat` / `inappropriate` / `other`; po 3 zgłoszeniach pinezka jest ukrywana; przegląd według `docs/admin.md`.
- Profil ma sekcję „Moje zgłoszenia” (ostatnie 10, z miniaturą, statusem i powodem odrzucenia; prywatne zdjęcia przez podpisane adresy ważne 1 h).
- Liczba szczurów przy pinezce to ciemna cyfra z białą obwódką (zamiast „szarego dymka”); własne pinezki mają jasny okrąg.

## 17. Ustalenia z realizacji planu 4 i projekt planu 5 (Szczurza Biblioteka)

**Plan 4 (zrealizowany):** ranking liczony na bieżąco funkcją `get_ranking` (bez widoków zmaterializowanych); ranking pomija pinezki ukryte po zgłoszeniach nadużyć; „Odrzański Wilk” tylko po tagu `woda`; zgłaszać nadużycia mogą osoby z ≥1 zaliczonym szczurem, maks. 10 na dobę; odrzucone zdjęcia usuwa `retry-pending` po 30 dniach przy otwarciu aplikacji (najpóźniej razem z kontem); publiczne strony `/prywatnosc` i `/regulamin`; ikony maskable/apple z różowym tłem.

**Plan 5 — Szczurza Biblioteka:**
- Nowa zakładka **📚 Biblioteka** (między Rankingiem a Profilem): saldo racików, sekcje Karty wiedzy, Quizy, Wygląd; przedmiot ma cenę albo „Masz”.
- `reward_items` (`id` tekstowy, `type` `knowledge_card` | `quiz` | `pin_skin` | `title`, `name`, `teaser`, `price`, `content` jsonb, `sort_order`, `active`) i `user_rewards` (`user_id`, `item_id`, `acquired_at`, `data` jsonb). Katalog bez `content` dla nieposiadanych; treść tylko po zakupie (`get_item_content`).
- `purchase_item(item_id)`: atomowo — blokada profilu, sprawdzenie salda, wpis `token_ledger` (`purchase`, ujemny), `user_rewards`; podwójny zakup i ujemne saldo zablokowane.
- Ceny: karta 30, quiz 50, tytuł 100–150, skórka pinezki 200–300.
- Treść startowa: 10 kart wiedzy (własny tekst po polsku ze źródłami; do przeczytania przez właściciela przed publicznym startem), 3 quizy × 5 pytań. Quiz można powtarzać, zapisujemy najlepszy wynik; quizy nie dają racików.
- Kosmetyka: skórki pinezek (widoczne dla wszystkich na mapie przy pinezkach właściciela) i tytuły przy pseudonimie (ranking, panel pinezki). Naraz założona jedna skórka i jeden tytuł (`profiles.active_pin_skin`, `profiles.active_title`, zmieniane funkcją `set_equipped`). Ramki avatara pominięte (brak avatarów). Kody partnerów — etap 3.
