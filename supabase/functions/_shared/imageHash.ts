import jpeg from 'jpeg-js'

const COLS = 9
const ROWS = 8

// dHash: jasność uśredniona w siatce 9×8; bit = czy komórka jest jaśniejsza od sąsiadki z prawej.
// Odporny na zmianę rozmiaru i kompresji, więc wykrywa ponowne wrzucenie tego samego zdjęcia.
export function differenceHash(jpegBytes: Uint8Array): string {
  const { width, height, data } = jpeg.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxMemoryUsageInMB: 256,
  })
  const sums = new Float64Array(COLS * ROWS)
  const counts = new Uint32Array(COLS * ROWS)

  for (let y = 0; y < height; y++) {
    const row = Math.min(ROWS - 1, Math.floor((y * ROWS) / height))
    for (let x = 0; x < width; x++) {
      const col = Math.min(COLS - 1, Math.floor((x * COLS) / width))
      const i = (y * width + x) * 4
      sums[row * COLS + col] += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      counts[row * COLS + col] += 1
    }
  }

  let bits = ''
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const left = sums[row * COLS + col] / counts[row * COLS + col]
      const right = sums[row * COLS + col + 1] / counts[row * COLS + col + 1]
      bits += left > right ? '1' : '0'
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}

export function hammingDistance(a: string, b: string): number {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let count = 0
  while (diff > 0n) {
    count += Number(diff & 1n)
    diff >>= 1n
  }
  return count
}
