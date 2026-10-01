import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

// Kolory warstw podkładu (Positron z OpenFreeMap) dopasowane do palety Ratlasa.
const RECOLOR: Record<string, Record<string, string>> = {
  background: { 'background-color': '#F4F1EF' },
  road_area_pier: { 'fill-color': '#F4F1EF' },
  water: { 'fill-color': '#D3CCCD' },
  building: { 'fill-color': '#EBE5E2' },
  landuse_residential: { 'fill-color': '#EFEAE7' },
}

export function ratifyStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const colors = RECOLOR[layer.id]
      if (!colors) return layer
      return { ...layer, paint: { ...(layer as { paint?: object }).paint, ...colors } } as LayerSpecification
    }),
  }
}
