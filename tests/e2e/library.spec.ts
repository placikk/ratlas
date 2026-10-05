import { expect, test } from '@playwright/test'
import { completeOnboarding, dismissInstallHint, grantRaciki, signIn, uniqueEmail, uniqueNickname } from './helpers'

test('zakup karty wiedzy za raciki i jej przeczytanie', async ({ page }) => {
  const email = uniqueEmail()
  await signIn(page, email)
  // Raciki przed onboardingiem — profil wczytuje się na nowo po jego zakończeniu.
  await grantRaciki(email, 100)
  await completeOnboarding(page, uniqueNickname())
  await dismissInstallHint(page)

  await page.getByRole('button', { name: 'Biblioteka', exact: true }).click()
  await expect(page.getByText('Masz 100 racików')).toBeVisible()

  await page.getByRole('button', { name: /Czy szczury się śmieją\?/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kup', exact: true }).click()
  await expect(page.getByText(/Jaak Panksepp/)).toBeVisible()

  await page.getByRole('button', { name: '← Wróć do Biblioteki' }).click()
  await expect(page.getByText('Masz 70 racików')).toBeVisible()
  await expect(page.getByRole('button', { name: /Czy szczury się śmieją\?.*Masz ✓/ })).toBeVisible()
})
