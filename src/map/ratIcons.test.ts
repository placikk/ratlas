import { expect, test } from 'vitest'
import { PIN_SKINS, RAT_ICON_SVG, ratIconSvg, skinOrDefault } from './ratIcons'

test('domyślna skórka wygląda jak dotychczasowa ikona', () => {
  expect(RAT_ICON_SVG).toBe(ratIconSvg('default', false))
  expect(RAT_ICON_SVG).toContain('fill="#C98A8F" stroke="#3A3839" stroke-width="2"')
  expect(RAT_ICON_SVG).toContain('<circle cx="48" cy="33" r="1.5" fill="#3A3839"/>')
})

test('skórka zmienia kolor futra, a własna pinezka ma okrąg', () => {
  expect(ratIconSvg('gold', false)).toContain(PIN_SKINS.gold.fill)
  expect(ratIconSvg('gold', true)).toContain('<circle cx="32" cy="38" r="27"')
  expect(ratIconSvg('gold', false)).not.toContain('<circle cx="32" cy="38" r="27"')
})

test('nieznana skórka wraca do domyślnej', () => {
  expect(skinOrDefault('gold')).toBe('gold')
  expect(skinOrDefault('toString')).toBe('default')
  expect(skinOrDefault(null)).toBe('default')
})
