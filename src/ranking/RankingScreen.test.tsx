import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { fetchRanking } from './rankingApi'
import { RankingScreen } from './RankingScreen'

vi.mock('./rankingApi', () => ({ fetchRanking: vi.fn() }))

test('pokazuje ranking miesięczny i zaznacza moją pozycję', async () => {
  vi.mocked(fetchRanking).mockResolvedValue([
    { place: 1, nickname: 'Ala', rats: 12, isMe: false },
    { place: 2, nickname: 'Ola', rats: 3, isMe: true },
  ])
  render(<RankingScreen />)

  const items = await screen.findAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText('Ala')).toBeInTheDocument()
  expect(within(items[0]).getByText('12 szczurów')).toBeInTheDocument()
  expect(within(items[1]).getByText('(Ty)')).toBeInTheDocument()
  expect(fetchRanking).toHaveBeenCalledWith('month')
  expect(screen.getByRole('button', { name: 'Ten miesiąc' })).toHaveAttribute('aria-pressed', 'true')
})

test('przełącza na ranking od początku', async () => {
  vi.mocked(fetchRanking).mockResolvedValue([])
  render(<RankingScreen />)
  await userEvent.click(await screen.findByRole('button', { name: 'Od początku' }))
  expect(fetchRanking).toHaveBeenLastCalledWith('all')
})

test('moja pozycja spoza czołówki jest oddzielona', async () => {
  vi.mocked(fetchRanking).mockResolvedValue([
    { place: 50, nickname: 'Pięćdziesiąty', rats: 4, isMe: false },
    { place: 73, nickname: 'Ja', rats: 1, isMe: true },
  ])
  render(<RankingScreen />)
  expect(await screen.findByText('…')).toBeInTheDocument()
  expect(screen.getByText('73.')).toBeInTheDocument()
})

test('pusty ranking i błąd', async () => {
  vi.mocked(fetchRanking).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'))
  render(<RankingScreen />)
  expect(await screen.findByText(/Bądź pierwszą osobą na liście/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Od początku' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać rankingu.')
})
