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
