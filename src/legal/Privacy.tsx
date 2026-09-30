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
