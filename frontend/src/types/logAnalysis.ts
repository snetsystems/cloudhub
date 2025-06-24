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

export type FilteredLogsForLogAnalysis = LogAnalysisFilter[]

export type LogFilterClause =
  | MatchPhraseFilterClause
  | RangeFilterClause
  | BoolShouldClause

export interface KqlDslWrapper {
  kql: string
  dsl: LogFilterClause
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

export interface KQLFilterClause {
  kind: 'kql-wrapper'
  kql: string
  dsl: LogFilterClause
}

export interface BaseFilter {
  id: string
}

export type LogsFilterClause =
  | (BaseFilter & MatchPhraseFilterClause)
  | (BaseFilter & RangeFilterClause)
  | (BaseFilter & BoolShouldClause)
  | (BaseFilter & KQLFilterClause)

export interface BoolShouldClause {
  bool: {
    should: ReadonlyArray<MatchPhraseFilterClause>
    minimum_should_match: 1
  }
}

export type LogAnalysisFilter = LogFilterClause | KQLFilterClause
