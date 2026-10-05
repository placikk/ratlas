import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseQuiz, scoreQuiz } from './content'
import { saveQuizResult } from './libraryApi'
import { useItemContent } from './useItemContent'

export function QuizView({ itemId }: { itemId: string }) {
  const { t } = useTranslation()
  const state = useItemContent(itemId)
  const [picks, setPicks] = useState<number[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [best, setBest] = useState<number | null>(null)

  if (state.kind === 'loading') return <p className="muted">{t('app.loading')}</p>
  const questions = state.kind === 'loaded' ? parseQuiz(state.item.content) : null
  if (!questions) {
    return (
      <p className="error" role="alert">
        {t('library.contentFailed')}
      </p>
    )
  }

  const stored = state.kind === 'loaded' ? state.item.data.best_score : undefined
  const bestScore = best ?? (typeof stored === 'number' ? stored : null)
  const total = questions.length

  async function advance() {
    if (picked === null || !questions) return
    const nextPicks = [...picks, picked]
    setPicks(nextPicks)
    setPicked(null)
    if (nextPicks.length === total) {
      const saved = await saveQuizResult(itemId, scoreQuiz(questions, nextPicks))
      if (saved !== null) setBest(saved)
    }
  }

  if (picks.length === total) {
    return (
      <div className="stack">
        <p className="library__score">{t('library.quiz.score', { score: scoreQuiz(questions, picks), total })}</p>
        {bestScore !== null && <p className="muted">{t('library.quiz.best', { best: bestScore, total })}</p>}
        <button
          className="btn"
          type="button"
          onClick={() => {
            setPicks([])
            setPicked(null)
          }}
        >
          {t('library.quiz.again')}
        </button>
      </div>
    )
  }

  const index = picks.length
  const question = questions[index]

  return (
    <div className="stack">
      <span className="muted">{t('library.quiz.progress', { n: index + 1, total })}</span>
      <p className="library__question">{question.question}</p>
      <div className="stack">
        {question.answers.map((answer, answerIndex) => {
          let className = 'btn btn--ghost'
          if (picked !== null && answerIndex === question.correct) className = 'btn library__answer--correct'
          else if (picked !== null && answerIndex === picked) className = 'btn btn--ghost library__answer--wrong'
          return (
            <button
              key={answerIndex}
              className={className}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(answerIndex)}
            >
              {answer}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <>
          <p role="status">
            {picked === question.correct ? t('library.quiz.correct') : t('library.quiz.wrong')} {question.explain}
          </p>
          <button className="btn" type="button" onClick={() => void advance()}>
            {index + 1 === total ? t('library.quiz.finish') : t('library.quiz.next')}
          </button>
        </>
      )}
    </div>
  )
}
