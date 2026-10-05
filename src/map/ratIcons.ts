export interface PinSkin {
  fill: string
  stroke: string
  eye: string
}

// Skórki pinezek z Biblioteki; przedmiot w bazie ma tylko klucz (np. {"skin":"gold"}).
export const PIN_SKINS: Record<string, PinSkin> = {
  default: { fill: '#C98A8F', stroke: '#3A3839', eye: '#3A3839' },
  gold: { fill: '#D9B44A', stroke: '#3A3839', eye: '#3A3839' },
  night: { fill: '#3A3839', stroke: '#EBD3D3', eye: '#EBD3D3' },
  sewer: { fill: '#7E9A83', stroke: '#3A3839', eye: '#3A3839' },
}

export function skinOrDefault(skin: string | null | undefined): string {
  return skin && Object.hasOwn(PIN_SKINS, skin) ? skin : 'default'
}

// Sylwetka szczura (patrz public/logo.svg) jako pinezka; własne zgłoszenia mają jasną obwódkę.
const RAT_PATHS = ({ fill, stroke, eye }: PinSkin) => `
  <path d="M13 38 C4 40 4 52 14 52" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="28" cy="36" rx="16" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M38 28 C46 26 54 30 58 36 C52 40 44 41 39 40 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="40" cy="27" r="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="48" cy="33" r="1.5" fill="${eye}"/>`

export function ratIconSvg(skin: string, mine: boolean): string {
  const paths = RAT_PATHS(PIN_SKINS[skinOrDefault(skin)])
  if (!mine) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${paths}</svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="38" r="27" fill="#FFFFFF" fill-opacity="0.85" stroke="#A5646B" stroke-width="3"/>
  ${paths}</svg>`
}

export const RAT_ICON_SVG = ratIconSvg('default', false)
export const RAT_MINE_ICON_SVG = ratIconSvg('default', true)

export function svgToImage(svg: string, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(size, size)
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nie udało się wczytać ikony'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
