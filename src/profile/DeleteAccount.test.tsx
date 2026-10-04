import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { signOut } from '../auth/authApi'
import { deleteAccount } from './accountApi'
import { DeleteAccount } from './DeleteAccount'

vi.mock('./accountApi', () => ({ deleteAccount: vi.fn() }))
vi.mock('../auth/authApi', () => ({ signOut: vi.fn() }))

async function confirmDeletion() {
  await userEvent.click(screen.getByRole('button', { name: 'Usuń konto' }))
  const forever = screen.getByRole('button', { name: 'Usuń konto na zawsze' })
  expect(forever).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' }))
  await userEvent.click(forever)
}

test('usuwa konto i wylogowuje', async () => {
  vi.mocked(deleteAccount).mockResolvedValue(true)
  vi.mocked(signOut).mockResolvedValue(undefined)
  render(<DeleteAccount />)
  await confirmDeletion()
  expect(deleteAccount).toHaveBeenCalled()
  expect(signOut).toHaveBeenCalled()
})

test('błąd usuwania pokazuje komunikat i nie wylogowuje', async () => {
  vi.mocked(deleteAccount).mockResolvedValue(false)
  render(<DeleteAccount />)
  await confirmDeletion()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się usunąć konta.')
  expect(signOut).not.toHaveBeenCalled()
})
