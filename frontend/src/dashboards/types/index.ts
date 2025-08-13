import {SeverityLevelOptions} from 'src/logs/constants'

export interface TokenData {
  text: string
  value: number
}

export interface LogCountData {
  time: string
  value: number
  buckets: Record<keyof typeof SeverityLevelOptions, {doc_count: number}>
}
