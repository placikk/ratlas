import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { App } from './App'
import { makeProfile } from './test/fixtures'

const mocks = vi.hoisted(() => ({ useSession: vi.fn(), fetchMyProfile: vi.fn(), updateSettings: vi.fn() }))

vi.mock('./auth/useSession', () => ({ useSession: mocks.useSession }))
vi.mock('./profile/profileApi', () => ({
  fetchMyProfile: mocks.fetchMyProfile,
  completeOnboarding: vi.fn(),
  updateSettings: mocks.updateSettings,
}))
vi.mock('./auth/authApi', () => ({
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('./report/reportApi', () => ({ retryPending: vi.fn(async () => 0), submitSighting: vi.fn() }))
vi.mock('./profile/ranksApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./profile/ranksApi')>()),
  useRanks: () => [],
}))

vi.mock('./map/MapScreen', () => ({ MapScreen: () => <div>Mapa szczurów</div> }))

const signedIn = { status: 'signedIn', session: { user: { id: 'u1' } } }

test('podczas sprawdzania sesji pokazuje ekran ładowania', () => {
  mocks.useSession.mockReturnValue({ status: 'loading' })
  render(<App />)
  expect(screen.getByText('Wczytuję…')).toBeInTheDocument()
})

test('niezalogowany widzi ekran logowania', () => {
  mocks.useSession.mockReturnValue({ status: 'signedOut' })
  render(<App />)
  expect(screen.getByRole('button', { name: 'Zaloguj przez Google' })).toBeInTheDocument()
})

test('nowy użytkownik trafia do onboardingu', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockResolvedValue(makeProfile({ nickname: null, terms_accepted_at: null }))
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Witaj w szczurzej ekipie!' })).toBeInTheDocument()
  expect(mocks.fetchMyProfile).toHaveBeenCalledWith('u1')
})

test('użytkownik po onboardingu widzi aplikację z zakładkami', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockResolvedValue(makeProfile())
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  expect(screen.getByRole('heading', { name: 'Szczurek' })).toBeInTheDocument()
})

test('błąd ładowania profilu można ponowić', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(makeProfile())
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))
  expect(await screen.findByRole('button', { name: 'Mapa' })).toBeInTheDocument()
})

test('nieudane odświeżenie profilu nie zastępuje aplikacji ekranem błędu', async () => {
  mocks.useSession.mockReturnValue(signedIn)
  mocks.fetchMyProfile.mockResolvedValueOnce(makeProfile()).mockRejectedValue(new Error('offline'))
  mocks.updateSettings.mockResolvedValue(undefined)
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Profil' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Pokazuj mój pseudonim na mapie' }))
  await waitFor(() => expect(mocks.fetchMyProfile).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('button', { name: 'Mapa' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument()
})
