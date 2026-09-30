import { expect, test } from 'vitest'
import { detectPlatform, shouldShowInstallHint, type InstallEnv } from './platform'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

function env(overrides: Partial<InstallEnv>): InstallEnv {
  return { userAgent: IPHONE_UA, maxTouchPoints: 5, standalone: false, ...overrides }
}

test.each([
  ['iPhone', env({}), 'ios'],
  ['iPad udający Maca', env({ userAgent: MAC_UA, maxTouchPoints: 5 }), 'ios'],
  ['zwykły Mac', env({ userAgent: MAC_UA, maxTouchPoints: 0 }), 'other'],
  ['Android', env({ userAgent: ANDROID_UA }), 'android'],
])('rozpoznaje platformę: %s', (_name, input, expected) => {
  expect(detectPlatform(input)).toBe(expected)
})

test('pokazuje podpowiedź na iPhonie w przeglądarce', () => {
  expect(shouldShowInstallHint(env({}), false)).toBe(true)
})

test('pokazuje podpowiedź na Androidzie w przeglądarce', () => {
  expect(shouldShowInstallHint(env({ userAgent: ANDROID_UA }), false)).toBe(true)
})

test('nie pokazuje na komputerze', () => {
  expect(shouldShowInstallHint(env({ userAgent: MAC_UA, maxTouchPoints: 0 }), false)).toBe(false)
})

test('nie pokazuje w zainstalowanej aplikacji', () => {
  expect(shouldShowInstallHint(env({ standalone: true }), false)).toBe(false)
})

test('nie pokazuje po zamknięciu podpowiedzi', () => {
  expect(shouldShowInstallHint(env({}), true)).toBe(false)
})
