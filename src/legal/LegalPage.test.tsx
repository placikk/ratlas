import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LegalPage } from './LegalPage'
import { legalDocForPath } from './legalPaths'

test('rozpoznaje publiczne adresy dokumentów', () => {
  expect(legalDocForPath('/prywatnosc')).toBe('privacy')
  expect(legalDocForPath('/regulamin/')).toBe('terms')
  expect(legalDocForPath('/')).toBeNull()
  expect(legalDocForPath('/mapa')).toBeNull()
})

test('strona polityki prywatności ma treść i link do aplikacji', () => {
  render(<LegalPage doc="privacy" />)
  expect(screen.getByRole('heading', { name: 'Polityka prywatności' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Przejdź do aplikacji Ratlas' })).toHaveAttribute('href', '/')
})
