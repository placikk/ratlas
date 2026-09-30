import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getAccuratePosition, LocationError } from './location'

type Success = (position: GeolocationPosition) => void
type Failure = (error: GeolocationPositionError) => void

function fakeGeolocation() {
  const handlers: { success?: Success; failure?: Failure } = {}
  const geolocation = {
    watchPosition: vi.fn((success: Success, failure: Failure) => {
      handlers.success = success
      handlers.failure = failure
      return 7
    }),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  }
  const report = (accuracy: number) =>
    handlers.success?.({ coords: { latitude: 51.11, longitude: 17.03, accuracy } } as GeolocationPosition)
  const fail = (code: number) => handlers.failure?.({ code } as GeolocationPositionError)
  return { geolocation: geolocation as unknown as Geolocation, report, fail, clearWatch: geolocation.clearWatch }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('czeka na wystarczająco dokładną pozycję', async () => {
  const fake = fakeGeolocation()
  const promise = getAccuratePosition({ geolocation: fake.geolocation })
  fake.report(300)
  fake.report(40)
  await expect(promise).resolves.toEqual({ lat: 51.11, lon: 17.03, accuracyM: 40 })
  expect(fake.clearWatch).toHaveBeenCalledWith(7)
})

test('brak zgody to błąd „denied”', async () => {
  const fake = fakeGeolocation()
  const promise = getAccuratePosition({ geolocation: fake.geolocation })
  fake.fail(1)
  await expect(promise).rejects.toMatchObject({ failure: 'denied' })
})

test('po czasie bez dokładnej pozycji to błąd „inaccurate”', async () => {
  const fake = fakeGeolocation()
  const promise = getAccuratePosition({ geolocation: fake.geolocation, timeoutMs: 1000 })
  fake.report(500)
  vi.advanceTimersByTime(1000)
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(LocationError)
  expect(error).toMatchObject({ failure: 'inaccurate' })
  expect(fake.clearWatch).toHaveBeenCalled()
})
