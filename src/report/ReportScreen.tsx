import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CameraView, type Facing } from './CameraView'
import { getAccuratePosition, GPS_MAX_ACCURACY_M, LocationError, type Fix, type LocationFailure } from './location'
import { submitSighting, type SubmitOutcome } from './reportApi'
import { ResultView } from './ResultView'

type Problem =
  | 'camera_denied'
  | 'location_denied'
  | 'location_unavailable'
  | 'location_inaccurate'
  | 'offline'
  | 'unknown'

interface Shot {
  photo: Blob
  fix: Fix
  capturedAt: Date
}

type State =
  | { kind: 'camera' }
  | { kind: 'working'; step: 'locating' | 'sending' }
  | { kind: 'result'; outcome: SubmitOutcome }
  | { kind: 'problem'; problem: Problem; retry: Shot | null }

const LOCATION_PROBLEMS: Record<LocationFailure, Problem> = {
  denied: 'location_denied',
  unavailable: 'location_unavailable',
  inaccurate: 'location_inaccurate',
}

export function ReportScreen({ onRecorded }: { onRecorded: () => void }) {
  const { t } = useTranslation()
  const [facing, setFacing] = useState<Facing>('environment')
  const [state, setState] = useState<State>({ kind: 'camera' })

  const onDenied = useCallback(() => setState({ kind: 'problem', problem: 'camera_denied', retry: null }), [])

  async function send(shot: Shot) {
    setState({ kind: 'working', step: 'sending' })
    const result = await submitSighting(shot.photo, shot.fix, shot.capturedAt)
    if (result.kind === 'offline' || result.kind === 'error') {
      setState({ kind: 'problem', problem: result.kind === 'offline' ? 'offline' : 'unknown', retry: shot })
      return
    }
    if (result.kind === 'recorded') onRecorded()
    setState({ kind: 'result', outcome: result })
  }

  async function onShot(photo: Blob) {
    const capturedAt = new Date()
    setState({ kind: 'working', step: 'locating' })
    let fix: Fix
    try {
      fix = await getAccuratePosition({ maxAccuracyM: GPS_MAX_ACCURACY_M })
    } catch (error) {
      const problem = error instanceof LocationError ? LOCATION_PROBLEMS[error.failure] : 'unknown'
      setState({ kind: 'problem', problem, retry: null })
      return
    }
    await send({ photo, fix, capturedAt })
  }

  const backToCamera = () => setState({ kind: 'camera' })

  if (state.kind === 'working') {
    return (
      <section className="screen report__status">
        <p role="status">{t(state.step === 'locating' ? 'report.locating' : 'report.sending')}</p>
      </section>
    )
  }

  if (state.kind === 'result') {
    return <ResultView outcome={state.outcome} onAgain={backToCamera} />
  }

  if (state.kind === 'problem') {
    const retry = state.retry
    return (
      <section className="screen stack">
        <p className="error" role="alert">
          {t(`report.problems.${state.problem}`)}
        </p>
        {retry && (
          <button className="btn" type="button" onClick={() => void send(retry)}>
            {t('report.retry')}
          </button>
        )}
        <button className="btn btn--ghost" type="button" onClick={backToCamera}>
          {t('report.back')}
        </button>
      </section>
    )
  }

  return (
    <section className="report">
      <CameraView key={facing} facing={facing} onShot={(photo) => void onShot(photo)} onDenied={onDenied} />
      <p className="report__tip">{t('report.tip')}</p>
      <button
        className="btn btn--ghost report__flip"
        type="button"
        onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
      >
        {t('report.flip')}
      </button>
    </section>
  )
}
