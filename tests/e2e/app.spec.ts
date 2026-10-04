import { expect, test } from '@playwright/test'
import { completeOnboarding, dismissInstallHint, signIn, uniqueEmail, uniqueNickname } from './helpers'

test('nowa osoba loguje się kodem, przechodzi onboarding i widzi mapę', async ({ page }) => {
  await signIn(page, uniqueEmail())
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('OpenFreeMap', { exact: false })).toBeVisible()
})

test('profil pokazuje osiągnięcia z sekretami i pustą listę zgłoszeń, a ranking się otwiera', async ({ page }) => {
  await signIn(page, uniqueEmail())
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)

  await page.getByRole('button', { name: 'Profil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Osiągnięcia' })).toBeVisible()
  await expect(page.getByText('Zostało 7 sekretów do odkrycia')).toBeVisible()
  await expect(page.getByText('Nie masz jeszcze zgłoszeń. Czas na łowy! 🐀')).toBeVisible()

  await page.getByRole('button', { name: 'Ranking', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ten miesiąc' })).toHaveAttribute('aria-pressed', 'true')
})

test('zmiana pseudonimu i usunięcie konta', async ({ page }) => {
  const email = uniqueEmail()
  await signIn(page, email)
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)

  await page.getByRole('button', { name: 'Profil', exact: true }).click()
  const renamed = uniqueNickname()
  await page.getByRole('button', { name: 'Zmień pseudonim' }).click()
  await page.getByLabel('Twój pseudonim').fill(renamed)
  await page.getByRole('button', { name: 'Zapisz' }).click()
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible()

  await page.getByRole('button', { name: 'Usuń konto' }).click()
  await page.getByRole('checkbox', { name: 'Rozumiem, że tego nie da się cofnąć' }).check()
  await page.getByRole('button', { name: 'Usuń konto na zawsze' }).click()
  await expect(page.getByRole('button', { name: 'Zaloguj przez Google' })).toBeVisible({ timeout: 30_000 })

  // Ten sam e-mail tworzy teraz zupełnie nowe konto — wraca onboarding.
  await signIn(page, email)
  await expect(page.getByRole('heading', { name: 'Witaj w szczurzej ekipie!' })).toBeVisible()
})
