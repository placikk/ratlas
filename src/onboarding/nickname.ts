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
