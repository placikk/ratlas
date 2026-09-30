# Ratlas

Szczurza mapa Wrocławia — PWA, w której mieszkańcy fotografują szczury, zbierają raciki (żetony w grze) i odkrywają sekretne osiągnięcia.

- Specyfikacja: `docs/superpowers/specs/2026-09-29-szczury-wroclaw-design.md`
- Plany implementacji: `docs/superpowers/plans/`

## Uruchomienie lokalne

```bash
npm install
npm run db:start                  # lokalny Supabase w Dockerze (pierwszy raz: kilka minut)
cp .env.example .env.local        # i wpisz klucz z: npx supabase status
npm run dev                       # http://localhost:5173 (e-maile z kodami: http://127.0.0.1:54324)
npm test                          # testy frontendu
npm run test:db                   # testy bazy (pgTAP)
```
