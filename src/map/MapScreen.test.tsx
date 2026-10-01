import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { PinCollection } from './pins'
import { MAP_REFRESH_MS, MapScreen } from './MapScreen'

const mocks = vi.hoisted(() => ({
  fetchPins: vi.fn(),
  fetchFadeDays: vi.fn(async () => 7),
  reportPin: vi.fn(),
  photoUrl: vi.fn((path: string) => `https://x/${path}`),
  view: { onSelect: null as null | ((id: string) => void), onBoundsChange: null as null | ((b: unknown) => void), collection: null as null | PinCollection },
}))

vi.mock('./mapApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mapApi')>()),
  fetchPins: mocks.fetchPins,
  fetchFadeDays: mocks.fetchFadeDays,
  reportPin: mocks.reportPin,
  photoUrl: mocks.photoUrl,
}))

vi.mock('./MapView', () => ({
  MapView: (props: { collection: PinCollection; onSelect: (id: string) => void; onBoundsChange: (b: unknown) => void }) => {
    mocks.view.onSelect = props.onSelect
    mocks.view.onBoundsChange = props.onBoundsChange
    mocks.view.collection = props.collection
    return <div data-testid="map" />
  },
}))

const NOW = Date.parse('2026-10-08T12:00:00Z')
const bounds = { west: 16.9, south: 51.0, east: 17.2, north: 51.2 }
const pin = {
  id: 'a',
  lon: 17.03,
  lat: 51.11,
  rats: 3,
  createdAt: new Date(NOW - 2 * 3_600_000).toISOString(),
  photoPath: 'a.jpg',
  nickname: 'Ala',
  isMine: false,
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
  mocks.fetchPins.mockResolvedValue([pin])
})

afterEach(() => {
  vi.useRealTimers()
})

async function showMap() {
  render(<MapScreen />)
  await act(async () => mocks.view.onBoundsChange?.(bounds))
}

test('po przesunięciu mapy pobiera pinezki i przekazuje je mapie', async () => {
  await showMap()
  expect(mocks.fetchPins).toHaveBeenCalledWith(bounds)
  expect(mocks.view.collection?.features[0].properties).toEqual({ id: 'a', rats: 3, opacity: expect.any(Number), mine: false })
})

test('co minutę odświeża pinezki', async () => {
  await showMap()
  await act(async () => vi.advanceTimersByTime(MAP_REFRESH_MS))
  expect(mocks.fetchPins).toHaveBeenCalledTimes(2)
})

test('kliknięcie pinezki pokazuje zdjęcie, liczbę szczurów, czas i autora', async () => {
  await showMap()
  await act(async () => mocks.view.onSelect?.('a'))
  const panel = screen.getByRole('dialog', { name: 'Szczegóły zgłoszenia' })
  expect(panel).toHaveTextContent('3 szczury')
  expect(panel).toHaveTextContent('2 godziny temu')
  expect(panel).toHaveTextContent('Wypatrzył(a): Ala')
  expect(screen.getByRole('img', { name: 'Zdjęcie szczura' })).toHaveAttribute('src', 'https://x/a.jpg')
})

test('zgłoszenie nadużycia z wyborem powodu', async () => {
  mocks.reportPin.mockResolvedValue('reported')
  await showMap()
  await act(async () => mocks.view.onSelect?.('a'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: 'Zgłoś nadużycie' }))
  const send = screen.getByRole('button', { name: 'Wyślij zgłoszenie' })
  expect(send).toBeDisabled()
  await user.click(screen.getByRole('radio', { name: 'To nie jest szczur' }))
  await user.click(send)
  expect(mocks.reportPin).toHaveBeenCalledWith('a', 'not_rat')
  expect(await screen.findByRole('status')).toHaveTextContent('Dziękujemy! Przyjrzymy się temu.')
})

test('ukryta po zgłoszeniu pinezka znika z mapy', async () => {
  mocks.reportPin.mockResolvedValue('hidden')
  await showMap()
  await act(async () => mocks.view.onSelect?.('a'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: 'Zgłoś nadużycie' }))
  await user.click(screen.getByRole('radio', { name: 'Coś innego' }))
  await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }))
  await user.click(await screen.findByRole('button', { name: 'Zamknij' }))
  expect(mocks.view.collection?.features).toEqual([])
})

test('własnej pinezki nie można zgłosić', async () => {
  mocks.fetchPins.mockResolvedValue([{ ...pin, isMine: true, nickname: null }])
  await showMap()
  await act(async () => mocks.view.onSelect?.('a'))
  expect(screen.getByText('To Twoje zgłoszenie')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Zgłoś nadużycie' })).not.toBeInTheDocument()
})

test('błąd pobierania pokazuje komunikat', async () => {
  mocks.fetchPins.mockRejectedValue(new Error('offline'))
  await showMap()
  expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się pobrać pinezek')
})

test('po błędzie zgłoszenia można spróbować ponownie', async () => {
  mocks.reportPin.mockResolvedValueOnce('error').mockResolvedValueOnce('reported')
  await showMap()
  await act(async () => mocks.view.onSelect?.('a'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: 'Zgłoś nadużycie' }))
  await user.click(screen.getByRole('radio', { name: 'Coś innego' }))
  await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Nie udało się wysłać zgłoszenia')
  await user.click(screen.getByRole('button', { name: 'Zgłoś nadużycie' }))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Coś innego' }))
  await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }))
  expect(mocks.reportPin).toHaveBeenCalledTimes(2)
  expect(await screen.findByRole('status')).toHaveTextContent('Dziękujemy! Przyjrzymy się temu.')
})

test('otwarty panel zostaje po odświeżeniu, które nie zwraca pinezki', async () => {
  await showMap()
  await act(async () => mocks.view.onSelect?.('a'))
  mocks.fetchPins.mockResolvedValue([])
  await act(async () => vi.advanceTimersByTime(MAP_REFRESH_MS))
  expect(screen.getByRole('dialog', { name: 'Szczegóły zgłoszenia' })).toBeInTheDocument()
})
