import { expect, test } from 'vitest'
import { parseCard, parseQuiz, scoreQuiz } from './content'

test('odczytuje kartę wiedzy i odrzuca złą treść', () => {
  expect(parseCard({ body: ['A', 'B'], sources: [{ label: 'Źródło', url: 'https://x.pl' }] })).toEqual({
    body: ['A', 'B'],
    sources: [{ label: 'Źródło', url: 'https://x.pl' }],
  })
  expect(parseCard({ body: 'A' })).toBeNull()
  expect(parseCard(null)).toBeNull()
  expect(parseCard({ body: ['A'], sources: [{ label: 'x', url: 'javascript:alert(1)' }] })).toEqual({ body: ['A'], sources: [] })
})

test('odczytuje quiz i odrzuca pytania z błędnym indeksem', () => {
  const question = { question: 'Q?', answers: ['a', 'b', 'c'], correct: 2, explain: 'Bo tak.' }
  expect(parseQuiz({ questions: [question] })).toEqual([question])
  expect(parseQuiz({ questions: [{ ...question, correct: 3 }] })).toBeNull()
  expect(parseQuiz({ questions: [] })).toBeNull()
  expect(parseQuiz({})).toBeNull()
})

test('liczy poprawne odpowiedzi', () => {
  const questions = [
    { question: '1', answers: ['a', 'b', 'c'], correct: 0, explain: '' },
    { question: '2', answers: ['a', 'b', 'c'], correct: 1, explain: '' },
    { question: '3', answers: ['a', 'b', 'c'], correct: 2, explain: '' },
  ]
  expect(scoreQuiz(questions, [0, 1, 0])).toBe(2)
  expect(scoreQuiz(questions, [])).toBe(0)
})
