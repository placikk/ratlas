import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ikony powstają z public/icon.svg — pełny różowy kwadrat bez przezroczystych rogów, więc launcher
// (Android, Samsung, iOS) sam przycina kształt i nie dorysowuje białej obwódki. Logo w aplikacji to public/logo.svg.
const rose = { background: '#C98A8F', fit: 'contain' } as const

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: rose },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: rose },
  },
  images: ['public/icon.svg'],
})
