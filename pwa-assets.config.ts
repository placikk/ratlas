import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ikony maskable (Android) i apple-touch (iOS) dostają różowe tło zamiast białego:
// róg zaokrąglonego logo zlewa się z tłem, więc telefon nie dorysowuje białej obwódki.
const rose = { background: '#C98A8F', fit: 'contain' } as const

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: rose },
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: rose },
  },
  images: ['public/logo.svg'],
})
