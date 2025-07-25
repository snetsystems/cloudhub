import {useCallback, useRef, useEffect} from 'react'

interface Props<T extends (...args: any[]) => any> {
  callback: T
  delay?: number
}

const useDebounce = <T extends (...args: any[]) => any>({
  callback,
  delay = 500,
}: Props<T>) => {
  const timer = useRef<number>()

  // 콜백이 바뀌면 참조도 업데이트
  const savedCallback = useRef<T>(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        savedCallback.current(...args)
      }, delay)
    },
    [delay]
  )

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  return debouncedFn
}

export default useDebounce
