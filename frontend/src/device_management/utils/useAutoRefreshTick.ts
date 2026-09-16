import {useEffect, useState} from 'react'

import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

/**
 * RenderCellContext carries manualRefresh but not the auto refresh interval,
 * and the dashboard keeps that rate per dashboard rather than in app state.
 * GlobalAutoRefresher is what the page already polls on, so subscribing to it
 * ticks in step with every other cell.
 */
export const useAutoRefreshTick = (): number => {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onTick = () => setTick(count => count + 1)
    GlobalAutoRefresher.subscribe(onTick)
    return () => GlobalAutoRefresher.unsubscribe(onTick)
  }, [])

  return tick
}
