export interface Ratio {
  xNum: number
  yNum: number
  height: number
}

export interface LogAnalysisManualRefresh {
  key: string
  value: number
}

export interface ESResponse {
  id: string
  rawResponse: RawResponse
  isPartial: boolean
  isRunning: boolean
  total: number
  loaded: number
  isRestored: boolean
}

export interface SyslogTableRows extends HitFields {
  id: string
}

interface RawResponse {
  took: number
  timed_out: boolean
  _shards: Shards
  hits: HitsContainer
}

interface Shards {
  total: number
  successful: number
  skipped: number
  failed: number
}

interface HitsContainer {
  total: number
  max_score: null
  hits: HitItem[]
}

interface HitItem {
  _index: string
  _id: string
  _score: null
  fields: HitFields
  sort: Array<string | number>
  _ignored?: string[]
  ignored_field_values?: HitFields
}

export interface HitFields {
  '@timestamp'?: string[]
  'host.ip'?: string[]
  'host.hostname'?: string[]
  message?: string[]
  message_tokens?: string[]
  'event.original'?: string[]
  'service.type'?: string[]
  'process.name'?: string[]
  'process.pid'?: number[]
  'log.syslog.severity.code'?: number[]
  'log.syslog.priority'?: number[]
  'log.syslog.facility.code'?: number[]
  '@version.keyword'?: string[]
  '@version'?: string[]
  type?: string[]
  'message.keyword'?: string[]
}

export interface MatchPhraseFilterClause {
  match_phrase: {[key: string]: string | number}
}

export interface RangeFilterClause {
  range: {
    [field: string]: {
      format?: string
      gte?: string
      lte?: string
    }
  }
}

export type FilteredLogsForLogAnalysis = Array<
  MatchPhraseFilterClause | RangeFilterClause
>
