export interface DragOffset {
  x: number
  y: number
}

// Dragged card positions, persisted per view ('overview' or the drilldown
// namespace) so a hand-arranged map survives reloads. Values are absolute
// world coordinates, matching what useCardDrag stores in memory.
const STORAGE_KEY = 'hubble.cardOffsets.v1'

type StoredOffsets = Record<string, Record<string, DragOffset>>

const readAll = (): StoredOffsets => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as StoredOffsets) : {}
  } catch {
    return {}
  }
}

const writeAll = (all: StoredOffsets) => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // localStorage may be disabled — non-fatal
  }
}

export const loadCardOffsets = (view: string): Map<string, DragOffset> => {
  const offsets = new Map<string, DragOffset>()
  const stored = readAll()[view]
  if (!stored) return offsets
  for (const [nodeId, offset] of Object.entries(stored)) {
    if (
      offset &&
      typeof offset.x === 'number' &&
      typeof offset.y === 'number'
    ) {
      offsets.set(nodeId, {x: offset.x, y: offset.y})
    }
  }
  return offsets
}

export const saveCardOffset = (
  view: string,
  nodeId: string,
  offset: DragOffset
) => {
  const all = readAll()
  all[view] = {...(all[view] ?? {}), [nodeId]: offset}
  writeAll(all)
}

export const clearCardOffsets = (view: string) => {
  const all = readAll()
  if (!(view in all)) return
  delete all[view]
  writeAll(all)
}
