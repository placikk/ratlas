import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { TabBar } from './TabBar'

test('oznacza aktywną zakładkę', () => {
  render(<TabBar active="map" onSelect={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Profil' })).not.toHaveAttribute('aria-current')
})

test('zgłasza wybór zakładki', async () => {
  const onSelect = vi.fn()
  render(<TabBar active="map" onSelect={onSelect} />)
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  expect(onSelect).toHaveBeenCalledWith('profile')
})

test('ma zakładkę Biblioteka', async () => {
  const onSelect = vi.fn()
  render(<TabBar active="map" onSelect={onSelect} />)
  await userEvent.click(screen.getByRole('button', { name: 'Biblioteka' }))
  expect(onSelect).toHaveBeenCalledWith('library')
})
