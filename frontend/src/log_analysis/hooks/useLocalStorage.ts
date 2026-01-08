// Libraries
import {useCallback, useState} from 'react'
import _ from 'lodash'

// Types
export function useLocalStorage<T extends object>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, Error | null] {
  const readValue = useCallback(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      if (!item) return initialValue
      const parsed = JSON.parse(item)

      return _.defaults({}, parsed, initialValue)
    } catch (err) {
      return initialValue
    }
  }, [key, initialValue])

  const [storedValue, setStoredValue] = useState<T>(readValue)
  const [error, setError] = useState<Error | null>(null)

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
        setError(null)
      } catch (err) {
        setStoredValue(initialValue)
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to save to LocalStorage.')
        )
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(initialValue))
          } catch {}
        }
      }
    },
    [key, storedValue, initialValue]
  )

  return [storedValue, setValue, error]
}
