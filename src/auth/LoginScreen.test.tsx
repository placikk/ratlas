import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LoginScreen } from './LoginScreen'
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from './authApi'

vi.mock('./authApi', () => ({
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signOut: vi.fn(),
}))

async function requestCode() {
  vi.mocked(sendEmailCode).mockResolvedValue(undefined)
  render(<LoginScreen />)
  await userEvent.type(screen.getByLabelText('Adres e-mail'), 'ala@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Wyślij kod' }))
}

test('wysyła kod i prosi o jego wpisanie', async () => {
  await requestCode()
  expect(sendEmailCode).toHaveBeenCalledWith('ala@example.com')
  expect(await screen.findByText('Wysłaliśmy kod na ala@example.com. Sprawdź skrzynkę (także spam).')).toBeInTheDocument()
  expect(screen.getByLabelText('Kod z e-maila')).toBeInTheDocument()
})

test('weryfikuje wpisany kod', async () => {
  await requestCode()
  vi.mocked(verifyEmailCode).mockResolvedValue(undefined)
  await userEvent.type(await screen.findByLabelText('Kod z e-maila'), '123456')
  await userEvent.click(screen.getByRole('button', { name: 'Zaloguj' }))
  expect(verifyEmailCode).toHaveBeenCalledWith('ala@example.com', '123456')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('pokazuje błąd przy złym kodzie', async () => {
  await requestCode()
  vi.mocked(verifyEmailCode).mockRejectedValue(new Error('invalid'))
  await userEvent.type(await screen.findByLabelText('Kod z e-maila'), '000000')
  await userEvent.click(screen.getByRole('button', { name: 'Zaloguj' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Kod jest nieprawidłowy albo wygasł.')
})

test('pokazuje błąd, gdy nie da się wysłać kodu', async () => {
  vi.mocked(sendEmailCode).mockRejectedValue(new Error('rate limit'))
  render(<LoginScreen />)
  await userEvent.type(screen.getByLabelText('Adres e-mail'), 'ala@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Wyślij kod' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wysłać kodu. Spróbuj za chwilę.')
})

test('pozwala wrócić do zmiany adresu', async () => {
  await requestCode()
  await userEvent.click(await screen.findByRole('button', { name: 'Zmień adres e-mail' }))
  expect(screen.getByLabelText('Adres e-mail')).toBeInTheDocument()
})

test('loguje przez Google', async () => {
  vi.mocked(signInWithGoogle).mockResolvedValue(undefined)
  render(<LoginScreen />)
  await userEvent.click(screen.getByRole('button', { name: 'Zaloguj przez Google' }))
  expect(signInWithGoogle).toHaveBeenCalled()
})
