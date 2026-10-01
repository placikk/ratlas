import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { MySightings } from './MySightings'
import { fetchMySightings } from './mySightingsApi'

vi.mock('./mySightingsApi', () => ({ fetchMySightings: vi.fn() }))

const base = { ratsAwarded: 0, tokensAwarded: 0, createdAt: new Date().toISOString(), photoUrl: 'https://x/p.jpg' }

test('pokazuje zgłoszenia ze statusem, powodem i zdobyczą', async () => {
  vi.mocked(fetchMySightings).mockResolvedValue([
    { ...base, id: 'a', status: 'accepted', rejectReason: null, ratsAwarded: 2, tokensAwarded: 20 },
    { ...base, id: 'b', status: 'rejected', rejectReason: 'screen_or_print' },
    { ...base, id: 'c', status: 'pending', rejectReason: null, photoUrl: null },
  ])
  render(<MySightings />)

  expect(await screen.findByText('Zaliczony')).toBeInTheDocument()
  expect(screen.getByText('+2 szczury · +20 racików')).toBeInTheDocument()
  expect(screen.getByText('Odrzucony: zdjęcie ekranu lub wydruku')).toBeInTheDocument()
  expect(screen.getByText('Sprawdzamy…')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Twoje zdjęcie' })).toHaveLength(2)
})

test('pusta lista zachęca do łowów', async () => {
  vi.mocked(fetchMySightings).mockResolvedValue([])
  render(<MySightings />)
  expect(await screen.findByText('Nie masz jeszcze zgłoszeń. Czas na łowy! 🐀')).toBeInTheDocument()
})

test('błąd pobierania pokazuje komunikat', async () => {
  vi.mocked(fetchMySightings).mockRejectedValue(new Error('offline'))
  render(<MySightings />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać zgłoszeń.')
})
