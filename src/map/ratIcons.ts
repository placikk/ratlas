// Sylwetka szczura (patrz public/logo.svg) jako pinezka; własne zgłoszenia mają jasną obwódkę.
const RAT_PATHS = (fill: string, stroke: string, strokeWidth: number) => `
  <path d="M13 38 C4 40 4 52 14 52" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="28" cy="36" rx="16" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
  <path d="M38 28 C46 26 54 30 58 36 C52 40 44 41 39 40 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
  <circle cx="40" cy="27" r="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
  <circle cx="48" cy="33" r="1.5" fill="#3A3839"/>`

export const RAT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${RAT_PATHS('#C98A8F', '#3A3839', 2)}</svg>`

export const RAT_MINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="38" r="27" fill="#FFFFFF" fill-opacity="0.85" stroke="#A5646B" stroke-width="3"/>
  ${RAT_PATHS('#C98A8F', '#3A3839', 2)}</svg>`

export function svgToImage(svg: string, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(size, size)
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nie udało się wczytać ikony'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
