import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { InstallHint } from './InstallHint'
import type { InstallEnv } from './platform'

const iphone: InstallEnv = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  maxTouchPoints: 5,
  standalone: false,
}

beforeEach(() => {
  window.localStorage.clear()
})

test('na iPhonie pokazuje instrukcję instalacji', () => {
  render(<InstallHint env={iphone} />)
  expect(screen.getByText('Zainstaluj aplikację')).toBeInTheDocument()
})

test('po kliknięciu „Rozumiem” znika na stałe', async () => {
  const { unmount } = render(<InstallHint env={iphone} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rozumiem' }))
  expect(screen.queryByText('Zainstaluj aplikację')).not.toBeInTheDocument()
  unmount()
  render(<InstallHint env={iphone} />)
  expect(screen.queryByText('Zainstaluj aplikację')).not.toBeInTheDocument()
})

test('w zainstalowanej aplikacji nic nie pokazuje', () => {
  render(<InstallHint env={{ ...iphone, standalone: true }} />)
  expect(screen.queryByText('Zainstaluj aplikację')).not.toBeInTheDocument()
})
