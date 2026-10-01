import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { CameraView } from './CameraView'

const mocks = vi.hoisted(() => ({ capturePhoto: vi.fn(), getUserMedia: vi.fn() }))

vi.mock('./photo', () => ({ capturePhoto: mocks.capturePhoto }))

const photo = new Blob(['x'], { type: 'image/jpeg' })

function useTrack(track: Record<string, unknown>) {
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] })
}

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: mocks.getUserMedia }, configurable: true })
  mocks.capturePhoto.mockResolvedValue(photo)
})

async function renderCamera() {
  const onShot = vi.fn()
  const { container } = render(<CameraView facing="environment" onShot={onShot} onDenied={vi.fn()} />)
  const shutter = screen.getByRole('button', { name: 'Zrób zdjęcie' })
  await waitFor(() => expect(shutter).toBeEnabled())
  const video = container.querySelector('video') as HTMLVideoElement
  const area = container.querySelector('.camera') as HTMLElement
  return { onShot, shutter, video, area }
}

test('bez sprzętowego przybliżenia powiększa podgląd i wycina środek zdjęcia', async () => {
  useTrack({ stop: vi.fn() })
  const { onShot, shutter, video } = await renderCamera()

  await userEvent.click(screen.getByRole('button', { name: 'Przybliż 2×' }))

  expect(video.style.transform).toBe('scale(2)')
  expect(screen.getByText('2.0×')).toBeInTheDocument()
  await userEvent.click(shutter)
  expect(mocks.capturePhoto).toHaveBeenCalledWith(video, 2)
  expect(onShot).toHaveBeenCalledWith(photo)
})

test('ze sprzętowym przybliżeniem steruje aparatem, a zdjęcie jest pełne', async () => {
  const applyConstraints = vi.fn().mockResolvedValue(undefined)
  useTrack({ stop: vi.fn(), getCapabilities: () => ({ zoom: { min: 1, max: 8 } }), applyConstraints })
  const { shutter, video } = await renderCamera()

  await userEvent.click(screen.getByRole('button', { name: 'Przybliż 3×' }))

  expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] })
  expect(video.style.transform).toBe('')
  await userEvent.click(shutter)
  expect(mocks.capturePhoto).toHaveBeenCalledWith(video, 1)
})

test('rozsunięcie dwóch palców przybliża obraz', async () => {
  useTrack({ stop: vi.fn() })
  const { area, video } = await renderCamera()

  fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] })
  fireEvent.touchMove(area, { touches: [{ clientX: 50, clientY: 100 }, { clientX: 250, clientY: 100 }] })

  expect(video.style.transform).toBe('scale(2)')
  expect(screen.getByRole('button', { name: 'Przybliż 2×' })).toHaveAttribute('aria-pressed', 'true')
})
