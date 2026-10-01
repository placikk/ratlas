# Zbiór do oceny rozpoznawania szczurów

1. Wrzuć zdjęcia **JPEG** do `eval/photos/` (katalog jest ignorowany przez git — zdjęcia zostają na Twoim dysku).
2. Skopiuj `labels.example.csv` do `labels.csv` i opisz każde zdjęcie:
   - `rats` — ile szczurów naprawdę widać (0 dla myszy, wiewiórek, pustych ulic),
   - `screen` — 1, jeśli to zdjęcie ekranu albo wydruku,
   - `toy` — 1, jeśli to zabawka, rysunek, figurka,
   - `selfie` — 1, jeśli widać twarz fotografującego,
   - `faces` — 1, jeśli widać twarz osoby trzeciej (kolumna opcjonalna; brak = 0). Przeoczona twarz oznaczałaby opublikowanie jej na mapie, więc skrypt wypisuje takie pomyłki osobno.
3. Wpisz klucz Gemini do `supabase/functions/.env` (`GEMINI_API_KEY=…`).
4. Uruchom: `npm run eval`

Dobry zbiór startowy: 20–30 zdjęć, w tym „pułapki” (myszy, wiewiórki, chomiki, pluszaki, zdjęcia ekranu). Cel: precyzja „to jest szczur” ≥ 95%.
