import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { NicknameEditor } from './NicknameEditor'
import { changeNickname } from './profileApi'

vi.mock('./profileApi', () => ({ changeNickname: vi.fn() }))

async function edit(value: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Zmień pseudonim' }))
  const input = screen.getByLabelText('Twój pseudonim')
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

test('zapisuje nowy pseudonim i odświeża profil', async () => {
  vi.mocked(changeNickname).mockResolvedValue({ ok: true })
  const onChange = vi.fn()
  render(<NicknameEditor nickname="Szczurek" onChange={onChange} />)
  await edit('Szczurołap')
  await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))
  expect(changeNickname).toHaveBeenCalledWith('Szczurołap')
  expect(onChange).toHaveBeenCalled()
  expect(screen.queryByLabelText('Twój pseudonim')).not.toBeInTheDocument()
})

test('podpowiada błędny format i blokuje zapis', async () => {
  render(<NicknameEditor nickname="Szczurek" onChange={vi.fn()} />)
  await edit('a b')
  expect(screen.getByText('Dozwolone są tylko litery, cyfry, _ i -.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled()
})

test('informuje o zajętym pseudonimie', async () => {
  vi.mocked(changeNickname).mockResolvedValue({ ok: false, reason: 'nickname_taken' })
  const onChange = vi.fn()
  render(<NicknameEditor nickname="Szczurek" onChange={onChange} />)
  await edit('Ola')
  await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ten pseudonim jest już zajęty.')
  expect(onChange).not.toHaveBeenCalled()
})
