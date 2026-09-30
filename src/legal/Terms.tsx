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
