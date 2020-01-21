export interface GridCell<T> {
  x: number
  y: number
  w: number
  h: number
  i: string
  name: string
  sources: T
}
