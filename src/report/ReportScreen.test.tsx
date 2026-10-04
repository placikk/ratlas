import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { LocationError } from './location'
import { ReportScreen } from './ReportScreen'

const mocks = vi.hoisted(() => ({
  capturePhoto: vi.fn(),
  getAccuratePosition: vi.fn(),
  submitSighting: vi.fn(),
  getUserMedia: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('./photo', () => ({ capturePhoto: mocks.capturePhoto }))
vi.mock('./location', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./location')>()),
  getAccuratePosition: mocks.getAccuratePosition,
}))
vi.mock('./reportApi', () => ({ submitSighting: mocks.submitSighting }))

const photo = new Blob(['x'], { type: 'image/jpeg' })
const fix = { lat: 51.11, lon: 17.032, accuracyM: 12 }

beforeEach(() => {
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.stop }] })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mocks.getUserMedia },
    configurable: true,
  })
  mocks.capturePhoto.mockResolvedValue(photo)
  mocks.getAccuratePosition.mockResolvedValue(fix)
})

async function takePhoto() {
  const shutter = await screen.findByRole('button', { name: 'Zrób zdjęcie' })
  await waitFor(() => expect(shutter).toBeEnabled())
  await userEvent.click(shutter)
}

test('zaliczony szczur pokazuje zdobyte szczury i raciki', async () => {
  mocks.submitSighting.mockResolvedValue({ kind: 'recorded', status: 'accepted', rejectReason: null, ratsAwarded: 3, tokensAwarded: 30 })
  const onRecorded = vi.fn()
  render(<ReportScreen onRecorded={onRecorded} />)

  await takePhoto()

  expect(await screen.findByRole('heading', { name: 'Brawo! 🐀' })).toBeInTheDocument()
  expect(screen.getByText('+3 szczury · +30 racików')).toBeInTheDocument()
  expect(mocks.submitSighting).toHaveBeenCalledWith(photo, fix, expect.any(Date))
  expect(onRecorded).toHaveBeenCalled()
  expect(mocks.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
})

test('poza Wrocławiem pokazuje powód i nie odświeża profilu', async () => {
  mocks.submitSighting.mockResolvedValue({ kind: 'blocked', reason: 'outside_city' })
  const onRecorded = vi.fn()
  render(<ReportScreen onRecorded={onRecorded} />)

  await takePhoto()

  expect(await screen.findByText('Ratlas działa tylko we Wrocławiu.')).toBeInTheDocument()
  expect(onRecorded).not.toHaveBeenCalled()
})

test('bez zasięgu można wysłać to samo zdjęcie ponownie', async () => {
  mocks.submitSighting
    .mockResolvedValueOnce({ kind: 'offline' })
    .mockResolvedValueOnce({ kind: 'recorded', status: 'pending', rejectReason: null, ratsAwarded: 0, tokensAwarded: 0 })
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()
  await userEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))

  expect(await screen.findByRole('heading', { name: 'Sprawdzamy…' })).toBeInTheDocument()
  expect(mocks.submitSighting).toHaveBeenCalledTimes(2)
  expect(mocks.submitSighting.mock.calls[1][0]).toBe(photo)
})

test('odrzucone zdjęcie pokazuje powód', async () => {
  mocks.submitSighting.mockResolvedValue({ kind: 'recorded', status: 'rejected', rejectReason: 'no_rat', ratsAwarded: 0, tokensAwarded: 0 })
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()

  expect(await screen.findByText(/Nie widzimy tu szczura/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Zgłoś kolejnego' }))
  expect(await screen.findByRole('button', { name: 'Zrób zdjęcie' })).toBeInTheDocument()
})

test('brak zgody na aparat', async () => {
  mocks.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
  render(<ReportScreen onRecorded={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Potrzebujemy dostępu do aparatu')
})

test('brak zgody na lokalizację', async () => {
  mocks.getAccuratePosition.mockRejectedValue(new LocationError('denied'))
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()

  expect(await screen.findByRole('alert')).toHaveTextContent('Potrzebujemy lokalizacji')
  expect(mocks.submitSighting).not.toHaveBeenCalled()
})

test('przełączenie aparatu zatrzymuje poprzedni i uruchamia przedni', async () => {
  render(<ReportScreen onRecorded={vi.fn()} />)
  await screen.findByRole('button', { name: 'Zrób zdjęcie' })
  await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Przełącz aparat' }))

  await waitFor(() => expect(mocks.getUserMedia).toHaveBeenLastCalledWith({ video: { facingMode: 'user', width: { ideal: 1920 } }, audio: false }))
  expect(mocks.stop).toHaveBeenCalled()
})

test('zaliczony szczur pokazuje odblokowane osiągnięcia', async () => {
  mocks.submitSighting.mockResolvedValue({
    kind: 'recorded',
    status: 'accepted',
    rejectReason: null,
    ratsAwarded: 1,
    tokensAwarded: 10,
    achievements: [
      { code: 'first_rat', name: 'Pierwszy szczur', secret: false, rewardTokens: 25 },
      { code: 'selfie', name: 'Szczurze Selfie', secret: true, rewardTokens: 75 },
    ],
  })
  render(<ReportScreen onRecorded={vi.fn()} />)

  await takePhoto()

  expect(await screen.findByText('🏆 Nowe osiągnięcie: Pierwszy szczur (+25 racików)')).toBeInTheDocument()
  expect(screen.getByText('🤫 Sekretne osiągnięcie odkryte: Szczurze Selfie! (+75 racików)')).toBeInTheDocument()
})
