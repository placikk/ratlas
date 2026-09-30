import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { completeOnboarding } from '../profile/profileApi'
import { OnboardingScreen } from './OnboardingScreen'

vi.mock('../profile/profileApi', () => ({
  completeOnboarding: vi.fn(),
  fetchMyProfile: vi.fn(),
  updateSettings: vi.fn(),
}))

async function fillForm(nickname: string) {
  await userEvent.type(screen.getByLabelText('Twój pseudonim'), nickname)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Mam ukończone 16 lat' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Akceptuję regulamin i politykę prywatności' }))
}

test('przycisk jest nieaktywny, dopóki formularz nie jest kompletny', async () => {
  render(<OnboardingScreen onDone={vi.fn()} />)
  const submit = screen.getByRole('button', { name: 'Zaczynamy!' })
  expect(submit).toBeDisabled()
  await fillForm('Szczurek')
  expect(submit).toBeEnabled()
})

test('podpowiada, co jest nie tak z pseudonimem', async () => {
  render(<OnboardingScreen onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('Twój pseudonim'), 'a b')
  expect(screen.getByText('Dozwolone są tylko litery, cyfry, _ i -.')).toBeInTheDocument()
})

test('zapisuje onboarding i kończy', async () => {
  vi.mocked(completeOnboarding).mockResolvedValue({ ok: true })
  const onDone = vi.fn()
  render(<OnboardingScreen onDone={onDone} />)
  await fillForm('Szczurek')
  await userEvent.click(screen.getByRole('checkbox', { name: /trenowania modelu/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Zaczynamy!' }))
  expect(completeOnboarding).toHaveBeenCalledWith('Szczurek', true)
  expect(onDone).toHaveBeenCalled()
})

test('informuje o zajętym pseudonimie', async () => {
  vi.mocked(completeOnboarding).mockResolvedValue({ ok: false, reason: 'nickname_taken' })
  const onDone = vi.fn()
  render(<OnboardingScreen onDone={onDone} />)
  await fillForm('Szczurek')
  await userEvent.click(screen.getByRole('button', { name: 'Zaczynamy!' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ten pseudonim jest już zajęty.')
  expect(onDone).not.toHaveBeenCalled()
})

test('otwiera i zamyka regulamin', async () => {
  render(<OnboardingScreen onDone={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Regulamin' }))
  expect(screen.getByRole('dialog', { name: 'Regulamin' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Zamknij' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
