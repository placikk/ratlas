import { expect, test } from 'vitest'
import { shouldShowIosInstallHint, type InstallEnv } from './platform'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

function env(overrides: Partial<InstallEnv>): InstallEnv {
  return { userAgent: IPHONE_UA, maxTouchPoints: 5, standalone: false, ...overrides }
}

test('pokazuje podpowiedź na iPhonie w przeglądarce', () => {
  expect(shouldShowIosInstallHint(env({}), false)).toBe(true)
})

test('pokazuje podpowiedź na iPadzie udającym Maca', () => {
  expect(shouldShowIosInstallHint(env({ userAgent: MAC_UA, maxTouchPoints: 5 }), false)).toBe(true)
})

test('nie pokazuje na zwykłym Macu', () => {
  expect(shouldShowIosInstallHint(env({ userAgent: MAC_UA, maxTouchPoints: 0 }), false)).toBe(false)
})

test('nie pokazuje na Androidzie', () => {
  expect(shouldShowIosInstallHint(env({ userAgent: ANDROID_UA }), false)).toBe(false)
})

test('nie pokazuje w zainstalowanej aplikacji', () => {
  expect(shouldShowIosInstallHint(env({ standalone: true }), false)).toBe(false)
})

test('nie pokazuje po zamknięciu podpowiedzi', () => {
  expect(shouldShowIosInstallHint(env({}), true)).toBe(false)
})
