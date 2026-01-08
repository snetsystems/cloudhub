import {useState, useEffect, useRef, RefObject} from 'react'
import throttle from 'lodash/throttle'

export function useResizeObserver<T extends HTMLElement>(): [
  RefObject<T>,
  {width: number; height: number}
] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({width: 0, height: 0})

  const throttledSetSize = useRef(
    throttle((width: number, height: number) => {
      setSize({width, height})
    }, 150)
  ).current

  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      const {width, height} = entries[0].contentRect
      throttledSetSize(width, height)
    })

    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      throttledSetSize.cancel()
    }
  }, [ref.current])

  return [ref, size]
}
