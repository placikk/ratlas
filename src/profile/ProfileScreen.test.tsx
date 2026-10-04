import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { signOut } from '../auth/authApi'
import { makeProfile } from '../test/fixtures'
import { ProfileScreen } from './ProfileScreen'
import { updateSettings } from './profileApi'

vi.mock('./Achievements', () => ({ Achievements: () => null }))
vi.mock('./MySightings', () => ({ MySightings: () => null }))
vi.mock('./profileApi', () => ({ updateSettings: vi.fn(), fetchMyProfile: vi.fn(), completeOnboarding: vi.fn() }))
vi.mock('../auth/authApi', () => ({
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}))
vi.mock('./ranksApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ranksApi')>()),
  useRanks: () => [
    { id: 1, name: 'Szczurzy Nowicjusz', min_rats: 0 },
    { id: 2, name: 'Podwórkowy Obserwator', min_rats: 5 },
    { id: 3, name: 'Tropiciel z Nadodrza', min_rats: 15 },
  ],
}))

test('pokazuje pseudonim i liczniki', () => {
  render(<ProfileScreen profile={makeProfile({ total_rats: 12, tokens_balance: 120 })} onChange={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'Szczurek' })).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('120')).toBeInTheDocument()
})

test('zapisuje ustawienie widoczności pseudonimu', async () => {
  vi.mocked(updateSettings).mockResolvedValue(undefined)
  const onChange = vi.fn()
  render(<ProfileScreen profile={makeProfile()} onChange={onChange} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Pokazuj mój pseudonim na mapie' }))
  expect(updateSettings).toHaveBeenCalledWith('u1', { show_nickname_on_map: false })
  expect(onChange).toHaveBeenCalled()
})

test('informuje o nieudanym zapisie', async () => {
  vi.mocked(updateSettings).mockRejectedValue(new Error('offline'))
  const onChange = vi.fn()
  render(<ProfileScreen profile={makeProfile()} onChange={onChange} />)
  await userEvent.click(screen.getByRole('checkbox', { name: /trenować model/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać ustawień.')
  expect(onChange).not.toHaveBeenCalled()
})

test('wylogowuje', async () => {
  vi.mocked(signOut).mockResolvedValue(undefined)
  render(<ProfileScreen profile={makeProfile()} onChange={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Wyloguj się' }))
  expect(signOut).toHaveBeenCalled()
})

test('otwiera poradnik instalacji', async () => {
  render(<ProfileScreen profile={makeProfile()} onChange={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Jak zainstalować aplikację' }))
  expect(screen.getByRole('dialog', { name: 'Jak zainstalować Ratlas' })).toBeInTheDocument()
})

test('pokazuje rangę i postęp do następnej', () => {
  render(<ProfileScreen profile={makeProfile({ total_rats: 12 })} onChange={vi.fn()} />)
  expect(screen.getByText('Podwórkowy Obserwator')).toBeInTheDocument()
  expect(screen.getByText('Jeszcze 3 szczury do rangi „Tropiciel z Nadodrza”')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70')
})
