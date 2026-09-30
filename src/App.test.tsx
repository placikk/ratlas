import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { App } from './App'

test('pokazuje nazwę aplikacji', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Szczury Wrocławia' })).toBeInTheDocument()
})
