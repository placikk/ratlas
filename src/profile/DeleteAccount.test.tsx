import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { signOutLocal } from '../auth/authApi'
import { deleteAccount } from './accountApi'
import { DeleteAccount } from './DeleteAccount'

vi.mock('./accountApi', () => ({ deleteAccount: vi.fn() }))
vi.mock('../auth/authApi', () => ({ signOutLocal: vi.fn() }))

async function confirmDeletion() {
  await userEvent.click(screen.getByRole('button', { name: 'Usuń konto' }))
  const forever = screen.getByRole('button', { name: 'Usuń konto na zawsze' })
  expect(forever).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' }))
  await userEvent.click(forever)
}

test('usuwa konto i wylogowuje', async () => {
  vi.mocked(deleteAccount).mockResolvedValue(true)
  vi.mocked(signOutLocal).mockResolvedValue(undefined)
  render(<DeleteAccount />)
  await confirmDeletion()
  expect(deleteAccount).toHaveBeenCalled()
  expect(signOutLocal).toHaveBeenCalled()
})

test('błąd usuwania pokazuje komunikat i nie wylogowuje', async () => {
  vi.mocked(deleteAccount).mockResolvedValue(false)
  render(<DeleteAccount />)
  await confirmDeletion()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się usunąć konta.')
  expect(signOutLocal).not.toHaveBeenCalled()
})

test('anulowanie resetuje potwierdzenie', async () => {
  render(<DeleteAccount />)
  await userEvent.click(screen.getByRole('button', { name: 'Usuń konto' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' }))
  await userEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
  await userEvent.click(screen.getByRole('button', { name: 'Usuń konto' }))
  expect(screen.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' })).not.toBeChecked()
})
