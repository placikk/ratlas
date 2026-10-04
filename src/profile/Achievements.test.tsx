import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Achievements } from './Achievements'
import { fetchMyAchievements } from './achievementsApi'

vi.mock('./achievementsApi', () => ({ fetchMyAchievements: vi.fn() }))

const unlocked = { position: 1, code: 'first_rat', name: 'Pierwszy szczur', description: 'Zalicz swojego pierwszego szczura.', secret: false, rewardTokens: 25, unlockedAt: '2026-10-04T10:00:00Z' }
const locked = { position: 2, code: 'rats_10', name: 'Dziesiątka', description: 'Zalicz 10 szczurów.', secret: false, rewardTokens: 30, unlockedAt: null }
const secretLocked = { position: 10, code: null, name: null, description: null, secret: true, rewardTokens: null, unlockedAt: null }
const secretUnlocked = { position: 7, code: 'selfie', name: 'Szczurze Selfie', description: 'Zrób sobie selfie ze szczurem.', secret: true, rewardTokens: 75, unlockedAt: '2026-10-04T11:00:00Z' }

test('pokazuje postęp, odblokowane, zablokowane i ukryte sekrety', async () => {
  vi.mocked(fetchMyAchievements).mockResolvedValue([unlocked, locked, secretUnlocked, secretLocked, { ...secretLocked, position: 11 }])
  render(<Achievements />)

  expect(await screen.findByText('2 z 5')).toBeInTheDocument()
  expect(screen.getByText('Pierwszy szczur')).toBeInTheDocument()
  expect(screen.getByText('Szczurze Selfie')).toBeInTheDocument()
  expect(screen.getByText('Dziesiątka')).toBeInTheDocument()
  expect(screen.getAllByText('???')).toHaveLength(2)
  expect(screen.getByText('Zostały 2 sekrety do odkrycia')).toBeInTheDocument()
  expect(screen.getByText('+25 racików')).toBeInTheDocument()
})

test('błąd pobierania pokazuje komunikat', async () => {
  vi.mocked(fetchMyAchievements).mockRejectedValue(new Error('offline'))
  render(<Achievements />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać osiągnięć.')
})
