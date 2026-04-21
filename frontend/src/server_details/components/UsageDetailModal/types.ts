import type {Source} from 'src/types/sources'
import type {Addon} from 'src/types/auth'
import type {TimeRange} from 'src/types'
import type {CellQuery} from 'src/types/dashboards'

export type UsageDetailType = 'cpu' | 'memory' | 'network' | 'disk'

export interface UsageDetailServerContext {
  selectedHost: string | null
  source: Source | null
  addons?: Addon[]
  timeRange?: TimeRange
  manualRefresh?: number
  detailQueries?: CellQuery[]
}
