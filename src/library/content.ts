export interface KnowledgeCard {
  body: string[]
  sources: { label: string; url: string }[]
}

export interface QuizQuestion {
  question: string
  answers: string[]
  correct: number
  explain: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function parseCard(content: unknown): KnowledgeCard | null {
  if (!isRecord(content) || !isStringArray(content.body) || content.body.length === 0) return null
  const sources = Array.isArray(content.sources) ? content.sources : []
  return {
    body: content.body,
    // Tylko linki https — treść pochodzi z bazy, ale nie wstawiamy do href niczego innego.
    sources: sources.filter(
      (source): source is { label: string; url: string } =>
        isRecord(source) && typeof source.label === 'string' && typeof source.url === 'string' && source.url.startsWith('https://'),
    ),
  }
}

export function parseQuiz(content: unknown): QuizQuestion[] | null {
  if (!isRecord(content) || !Array.isArray(content.questions) || content.questions.length === 0) return null
  const questions: QuizQuestion[] = []
  for (const item of content.questions) {
    if (
      !isRecord(item) ||
      typeof item.question !== 'string' ||
      !isStringArray(item.answers) ||
      typeof item.correct !== 'number' ||
      !Number.isInteger(item.correct) ||
      item.correct < 0 ||
      item.correct >= item.answers.length
    ) {
      return null
    }
    questions.push({
      question: item.question,
      answers: item.answers,
      correct: item.correct,
      explain: typeof item.explain === 'string' ? item.explain : '',
    })
  }
  return questions
}

export function scoreQuiz(questions: QuizQuestion[], picks: number[]): number {
  return picks.filter((pick, index) => questions[index]?.correct === pick).length
}
