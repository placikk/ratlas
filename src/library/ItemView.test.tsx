import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ItemView } from './ItemView'
import { fetchItemContent, saveQuizResult, setEquipped, type CatalogItem } from './libraryApi'

vi.mock('./libraryApi', () => ({ fetchItemContent: vi.fn(), saveQuizResult: vi.fn(), setEquipped: vi.fn() }))

const base = { teaser: 't', price: 30, preview: null, owned: true, equipped: false }
const card: CatalogItem = { ...base, id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?' }
const quiz: CatalogItem = { ...base, id: 'quiz_body', type: 'quiz', name: 'Quiz: ciało i gatunki' }
const skin: CatalogItem = { ...base, id: 'pin_gold', type: 'pin_skin', name: 'Złoty szczur', preview: 'gold' }

test('karta wiedzy pokazuje akapity i źródła', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue({
    content: { body: ['Akapit pierwszy.', 'Akapit drugi.'], sources: [{ label: 'Science', url: 'https://doi.org/x' }] },
    data: {},
  })
  const onBack = vi.fn()
  render(<ItemView item={card} onBack={onBack} onChanged={vi.fn()} />)
  expect(await screen.findByText('Akapit pierwszy.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Science' })).toHaveAttribute('href', 'https://doi.org/x')
  await userEvent.click(screen.getByRole('button', { name: '← Wróć do Biblioteki' }))
  expect(onBack).toHaveBeenCalled()
})

test('quiz: odpowiedzi, wyjaśnienia, wynik i zapis', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue({
    content: {
      questions: [
        { question: 'Pierwsze?', answers: ['Tak', 'Nie', 'Może'], correct: 0, explain: 'Bo tak.' },
        { question: 'Drugie?', answers: ['Tak', 'Nie', 'Może'], correct: 1, explain: 'Bo nie.' },
      ],
    },
    data: { best_score: 1 },
  })
  vi.mocked(saveQuizResult).mockResolvedValue(2)
  render(<ItemView item={quiz} onBack={vi.fn()} onChanged={vi.fn()} />)

  expect(await screen.findByText('Pierwsze?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tak' }))
  expect(screen.getByRole('status')).toHaveTextContent('Dobrze! Bo tak.')
  await userEvent.click(screen.getByRole('button', { name: 'Dalej' }))

  expect(screen.getByText('Drugie?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Nie' }))
  await userEvent.click(screen.getByRole('button', { name: 'Zobacz wynik' }))

  expect(await screen.findByText('Twój wynik: 2 z 2')).toBeInTheDocument()
  expect(await screen.findByText('Najlepszy wynik: 2 z 2')).toBeInTheDocument()
  expect(saveQuizResult).toHaveBeenCalledWith('quiz_body', 2)
  await userEvent.click(screen.getByRole('button', { name: 'Jeszcze raz' }))
  expect(screen.getByText('Pierwsze?')).toBeInTheDocument()
})

test('błędna odpowiedź w quizie pokazuje wyjaśnienie', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue({
    content: { questions: [{ question: 'Q?', answers: ['A', 'B', 'C'], correct: 0, explain: 'Dobra to A.' }] },
    data: {},
  })
  render(<ItemView item={quiz} onBack={vi.fn()} onChanged={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'C' }))
  expect(screen.getByRole('status')).toHaveTextContent('Niestety nie. Dobra to A.')
})

test('wygląd: zakładanie i zdejmowanie', async () => {
  vi.mocked(setEquipped).mockResolvedValue('ok')
  const onChanged = vi.fn()
  const { rerender } = render(<ItemView item={skin} onBack={vi.fn()} onChanged={onChanged} />)
  expect(screen.getByText('Tak zobaczą Twoje pinezki inne osoby na mapie.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Załóż' }))
  expect(setEquipped).toHaveBeenCalledWith('pin_skin', 'pin_gold')
  expect(onChanged).toHaveBeenCalled()

  rerender(<ItemView item={{ ...skin, equipped: true }} onBack={vi.fn()} onChanged={onChanged} />)
  expect(screen.getByText('Masz to na sobie.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Zdejmij' }))
  expect(setEquipped).toHaveBeenLastCalledWith('pin_skin', null)
})

test('błąd treści pokazuje komunikat', async () => {
  vi.mocked(fetchItemContent).mockResolvedValue(null)
  render(<ItemView item={card} onBack={vi.fn()} onChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać treści.')
})
