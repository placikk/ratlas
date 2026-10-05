import { execSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const MAILPIT = 'http://127.0.0.1:54324'

interface MailpitMessage {
  ID: string
  Created: string
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`
}

export function uniqueNickname(): string {
  return `E2E_${Date.now() % 100_000_000}`
}

async function latestCode(email: string, since: number): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json()) as {
      messages?: MailpitMessage[]
    }
    const fresh = (list.messages ?? []).find((message) => Date.parse(message.Created) >= since)
    if (fresh) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text: string }
      const code = message.Text.match(/\b\d{6,10}\b/)?.[0]
      if (code) return code
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Brak kodu logowania dla ${email}`)
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Adres e-mail').fill(email)
  const since = Date.now()
  await page.getByRole('button', { name: 'Wyślij kod' }).click()
  await page.getByLabel('Kod z e-maila').fill(await latestCode(email, since))
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click()
}

export async function completeOnboarding(page: Page, nickname: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Witaj w szczurzej ekipie!' })).toBeVisible()
  await page.getByLabel('Twój pseudonim').fill(nickname)
  await page.getByRole('checkbox', { name: 'Mam ukończone 16 lat' }).check()
  await page.getByRole('checkbox', { name: 'Akceptuję regulamin i politykę prywatności' }).check()
  await page.getByRole('button', { name: 'Zaczynamy!' }).click()
  await expect(page.getByRole('button', { name: 'Mapa', exact: true })).toBeVisible()
}

export async function dismissInstallHint(page: Page): Promise<void> {
  const notNow = page.getByRole('button', { name: 'Nie teraz' })
  if (await notNow.isVisible()) await notNow.click()
}

function localSecretKey(): string {
  const status = execSync('npx supabase status -o env', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  const line = status.split('\n').find((entry) => entry.startsWith('SECRET_KEY='))
  if (!line) throw new Error('Brak SECRET_KEY — czy działa npm run db:start?')
  return line.slice('SECRET_KEY='.length).replace(/^"|"$/g, '')
}

// Testowe raciki: korekta w dzienniku i saldo profilu (tylko lokalna baza).
export async function grantRaciki(email: string, amount: number): Promise<void> {
  const admin = createClient('http://127.0.0.1:54321', localSecretKey())
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`Brak konta ${email}`)
  const ledger = await admin.from('token_ledger').insert({ user_id: user.id, delta: amount, reason: 'correction' })
  if (ledger.error) throw ledger.error
  const profile = await admin.from('profiles').update({ tokens_balance: amount }).eq('id', user.id)
  if (profile.error) throw profile.error
}
