import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { InstallHint } from './InstallHint'
import { listenForInstallPrompt } from './installPrompt'
import type { InstallEnv } from './platform'

const iphone: InstallEnv = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  maxTouchPoints: 5,
  standalone: false,
}
const android: InstallEnv = {
  userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) Chrome/140.0.0.0 Mobile Safari/537.36',
  maxTouchPoints: 5,
  standalone: false,
}

beforeAll(() => {
  listenForInstallPrompt()
})

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  act(() => {
    window.dispatchEvent(new Event('appinstalled'))
  })
})

function offerInstall(prompt: () => Promise<void>) {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })
  act(() => {
    window.dispatchEvent(event)
  })
}

test('na iPhonie zachęca do instalacji i otwiera poradnik z sekcją iPhone', async () => {
  render(<InstallHint env={iphone} />)
  expect(screen.getByText('Zainstaluj Ratlas')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Jak to zrobić?' }))
  const guide = screen.getByRole('dialog', { name: 'Jak zainstalować Ratlas' })
  expect(within(guide).getByText('iPhone / iPad').closest('details')).toHaveAttribute('open')
  expect(within(guide).getByText('Android').closest('details')).not.toHaveAttribute('open')
})

test('na Androidzie z Chrome instaluje jednym przyciskiem', async () => {
  const prompt = vi.fn().mockResolvedValue(undefined)
  render(<InstallHint env={android} />)
  offerInstall(prompt)
  await userEvent.click(screen.getByRole('button', { name: 'Zainstaluj' }))
  expect(prompt).toHaveBeenCalled()
})

test('na Androidzie bez propozycji instalacji pokazuje poradnik', async () => {
  render(<InstallHint env={android} />)
  await userEvent.click(screen.getByRole('button', { name: 'Jak to zrobić?' }))
  const guide = screen.getByRole('dialog', { name: 'Jak zainstalować Ratlas' })
  expect(within(guide).getByText('Android').closest('details')).toHaveAttribute('open')
})

test('po kliknięciu „Nie teraz” znika na stałe', async () => {
  const { unmount } = render(<InstallHint env={iphone} />)
  await userEvent.click(screen.getByRole('button', { name: 'Nie teraz' }))
  expect(screen.queryByText('Zainstaluj Ratlas')).not.toBeInTheDocument()
  unmount()
  render(<InstallHint env={iphone} />)
  expect(screen.queryByText('Zainstaluj Ratlas')).not.toBeInTheDocument()
})

test('w zainstalowanej aplikacji nic nie pokazuje', () => {
  render(<InstallHint env={{ ...iphone, standalone: true }} />)
  expect(screen.queryByText('Zainstaluj Ratlas')).not.toBeInTheDocument()
})
