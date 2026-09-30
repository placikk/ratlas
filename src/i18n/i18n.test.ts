import { expect, test } from 'vitest'
import i18n from './index'

test('zwraca polskie teksty', () => {
  expect(i18n.t('app.name')).toBe('Ratlas')
})

test('wstawia zmienne do tekstu', () => {
  expect(i18n.t('login.codeSent', { email: 'ala@example.com' })).toBe(
    'Wysłaliśmy kod na ala@example.com. Sprawdź skrzynkę (także spam).',
  )
})
