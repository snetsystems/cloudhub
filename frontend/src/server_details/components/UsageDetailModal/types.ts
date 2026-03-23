import type {Source} from 'src/types/sources'
import type {Addon} from 'src/types/auth'
import type {TimeRange} from 'src/types'

export type UsageDetailType = 'cpu' | 'memory' | 'network' | 'disk'

export interface DetailQuery {
  query: string
  label: string
}

export interface UsageDetailServerContext {
  selectedHost: string | null
  source: Source | null
  addons?: Addon[]
  timeRange?: TimeRange
  manualRefresh?: number
  detailQueries?: DetailQuery[]
}
