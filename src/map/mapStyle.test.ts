import type { StyleSpecification } from 'maplibre-gl'
import { expect, test } from 'vitest'
import { ratifyStyle } from './mapStyle'

const style = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': 'rgb(194, 200, 202)', 'fill-antialias': true } },
    { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', paint: { 'fill-color': 'rgb(234, 234, 229)' } },
    { id: 'road_minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#fff' } },
  ],
} as StyleSpecification

test('przekolorowuje tło, wodę i budynki na szczurzą paletę', () => {
  const result = ratifyStyle(style)
  const paint = (id: string) => result.layers.find((layer) => layer.id === id)?.paint as Record<string, unknown>
  expect(paint('background')['background-color']).toBe('#F4F1EF')
  expect(paint('water')['fill-color']).toBe('#D3CCCD')
  expect(paint('water')['fill-antialias']).toBe(true)
  expect(paint('building')['fill-color']).toBe('#EBE5E2')
  expect(paint('road_minor')['line-color']).toBe('#fff')
})

test('nie zmienia stylu wejściowego', () => {
  ratifyStyle(style)
  expect((style.layers[0].paint as Record<string, unknown>)['background-color']).toBe('rgb(242,243,240)')
})
