export const GPS_MAX_ACCURACY_M = 100
export const GPS_TIMEOUT_MS = 20_000

export interface Fix {
  lat: number
  lon: number
  accuracyM: number
}

export type LocationFailure = 'denied' | 'unavailable' | 'inaccurate'

export class LocationError extends Error {
  failure: LocationFailure

  constructor(failure: LocationFailure) {
    super(`location: ${failure}`)
    this.name = 'LocationError'
    this.failure = failure
  }
}

const PERMISSION_DENIED = 1

// Śledzi pozycję, aż dokładność spadnie do maxAccuracyM (GPS „dochodzi” przez kilka sekund).
export function getAccuratePosition(
  options: { maxAccuracyM?: number; timeoutMs?: number; geolocation?: Geolocation } = {},
): Promise<Fix> {
  const maxAccuracyM = options.maxAccuracyM ?? GPS_MAX_ACCURACY_M
  const geolocation = options.geolocation ?? navigator.geolocation

  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new LocationError('unavailable'))
      return
    }

    const watchId = geolocation.watchPosition(
      (position) => {
        const fix = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }
        if (fix.accuracyM <= maxAccuracyM) {
          finish()
          resolve(fix)
        }
      },
      (error) => {
        finish()
        reject(new LocationError(error.code === PERMISSION_DENIED ? 'denied' : 'unavailable'))
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    )

    const timer = setTimeout(() => {
      finish()
      reject(new LocationError('inaccurate'))
    }, options.timeoutMs ?? GPS_TIMEOUT_MS)

    function finish() {
      geolocation.clearWatch(watchId)
      clearTimeout(timer)
    }
  })
}
