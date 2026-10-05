import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LibraryScreen } from './LibraryScreen'
import { fetchCatalog, purchaseItem, type CatalogItem } from './libraryApi'

vi.mock('./libraryApi', () => ({ fetchCatalog: vi.fn(), purchaseItem: vi.fn() }))
vi.mock('./ItemView', () => ({
  ItemView: ({ item, onBack }: { item: CatalogItem; onBack: () => void }) => (
    <div>
      <p>Otwarte: {item.name}</p>
      <button type="button" onClick={onBack}>
        wróć
      </button>
    </div>
  ),
}))

const card: CatalogItem = { id: 'card_laugh', type: 'knowledge_card', name: 'Czy szczury się śmieją?', teaser: 'Łaskotanie', price: 30, preview: null, owned: false, equipped: false }
const quiz: CatalogItem = { id: 'quiz_body', type: 'quiz', name: 'Quiz: ciało i gatunki', teaser: '5 pytań', price: 50, preview: null, owned: true, equipped: false }
const skin: CatalogItem = { id: 'pin_gold', type: 'pin_skin', name: 'Złoty szczur', teaser: 'Lśni', price: 300, preview: 'gold', owned: true, equipped: true }

test('pokazuje saldo i sekcje z cenami lub oznaczeniem posiadania', async () => {
  vi.mocked(fetchCatalog).mockResolvedValue([card, quiz, skin])
  render(<LibraryScreen balance={40} onBalanceChange={vi.fn()} />)

  expect(screen.getByText('Masz 40 racików')).toBeInTheDocument()
  const cards = await screen.findByRole('region', { name: 'Karty wiedzy' })
  expect(within(cards).getByRole('button', { name: /Czy szczury się śmieją\?.*30 racików/ })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Quizy' })).getByText('Masz ✓')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Wygląd' })).getByText('Założone')).toBeInTheDocument()
})

test('kupuje przedmiot po potwierdzeniu i otwiera go', async () => {
  vi.mocked(fetchCatalog).mockResolvedValueOnce([card]).mockResolvedValue([{ ...card, owned: true }])
  vi.mocked(purchaseItem).mockResolvedValue('purchased')
  const onBalanceChange = vi.fn()
  render(<LibraryScreen balance={40} onBalanceChange={onBalanceChange} />)

  await userEvent.click(await screen.findByRole('button', { name: /Czy szczury się śmieją/ }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('Kupić „Czy szczury się śmieją?” za 30 racików?')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Kup' }))

  expect(purchaseItem).toHaveBeenCalledWith('card_laugh')
  expect(onBalanceChange).toHaveBeenCalled()
  expect(await screen.findByText('Otwarte: Czy szczury się śmieją?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'wróć' }))
  expect(screen.getByRole('region', { name: 'Karty wiedzy' })).toBeInTheDocument()
})

test('za mało racików blokuje zakup', async () => {
  vi.mocked(fetchCatalog).mockResolvedValue([card])
  render(<LibraryScreen balance={10} onBalanceChange={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Czy szczury się śmieją/ }))
  expect(screen.getByText(/Brakuje Ci 20 racików/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kup' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('posiadany przedmiot otwiera się od razu', async () => {
  vi.mocked(fetchCatalog).mockResolvedValue([quiz])
  render(<LibraryScreen balance={0} onBalanceChange={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Quiz: ciało i gatunki/ }))
  expect(screen.getByText('Otwarte: Quiz: ciało i gatunki')).toBeInTheDocument()
})

test('nieudany zakup i błąd katalogu pokazują komunikat', async () => {
  vi.mocked(fetchCatalog).mockResolvedValueOnce([card])
  vi.mocked(purchaseItem).mockResolvedValue('error')
  const { unmount } = render(<LibraryScreen balance={40} onBalanceChange={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Czy szczury się śmieją/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Kup' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się kupić. Spróbuj ponownie.')
  unmount()

  vi.mocked(fetchCatalog).mockRejectedValue(new Error('offline'))
  render(<LibraryScreen balance={40} onBalanceChange={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać Biblioteki.')
})
