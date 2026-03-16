import type {Source} from 'src/types/sources'
import type {Addon} from 'src/types/auth'

export type UsageDetailType = 'cpu' | 'memory' | 'network' | 'disk'

export interface UsageDetailServerContext {
  selectedHost: string | null
  source: Source | null
  addons?: Addon[]
}
