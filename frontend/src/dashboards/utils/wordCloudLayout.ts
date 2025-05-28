import * as d3 from 'd3'
import cloud from 'd3-cloud'

export type Orientation = 'single' | 'right angled' | 'multiple'
export type ScaleType = 'linear' | 'log' | 'square root'

export interface WordDatum {
  text: string
  value: number
  meta?: unknown
}
export interface CloudWord extends cloud.Word {
  value: number
  size: number
  meta?: unknown
}

interface LayoutOptions {
  width: number
  height: number
  topN: number
  orientation: Orientation
  scale: ScaleType
  minFontSize: number
  maxFontSize: number
  padding: number
}

function seed() {
  return 0.5
}
function hashWithinRange(str: string, max: number) {
  let h = 0
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % max
  return Math.abs(h) % max
}

const ORIENTATIONS: Record<Orientation, (w: cloud.Word) => number> = {
  single: () => 0,
  'right angled': w => hashWithinRange(w.text as string, 2) * 90,
  multiple: w => hashWithinRange(w.text as string, 12) * 15 - 90,
}
const SCALE_FACTORIES: Record<
  ScaleType,
  () => d3.ScaleContinuousNumeric<number, number>
> = {
  linear: () => d3.scaleLinear(),
  log: () => d3.scaleLog(),
  'square root': () => d3.scaleSqrt(),
}

export function generateWordCloudLayout(
  data: WordDatum[],
  opts: LayoutOptions
): Promise<CloudWord[]> {
  const {
    width,
    height,
    topN,
    orientation,
    scale,
    minFontSize,
    maxFontSize,
    padding,
  } = opts

  const subset = [...data]
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
    .sort(() => Math.random() - 0.5)

  const f = SCALE_FACTORIES[scale]()
  f.range(
    subset.length === 1
      ? [maxFontSize, maxFontSize]
      : [minFontSize, maxFontSize]
  )
  f.domain(d3.extent(subset, d => d.value) as [number, number])

  return new Promise(resolve => {
    cloud<CloudWord>()
      .size([width, height])
      .padding(padding)
      .rotate(w => ORIENTATIONS[orientation](w))
      .font('Inter UI, sans-serif')
      .fontSize(w => f((w as CloudWord).value))
      .random(seed)
      .spiral('archimedean')
      .words(subset.map(d => ({...d, size: f(d.value)})))
      .text(d => d.text)
      .timeInterval(1000)
      .on('end', layout => resolve(layout as CloudWord[]))
      .start()
  })
}
