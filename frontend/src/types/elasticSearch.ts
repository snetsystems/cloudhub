import {OperatorMeta} from 'src/log_analysis/constants/search-filter'

export interface BasicAuth {
  username: string
  password: string
}

export interface ApiKeyAuth {
  id: string
  apiKey: string
}

export interface EsLinks {
  self: string
  search: string
  indices: string
  bulk: string
  permissions: string
  users: string
  roles: string
  health: string
  proxy: string
}

export interface BaseElasticSearchData {
  id: string
  name: string
  default: boolean
  defaultIndex: string
  indexPatterns: string[]
  version: string
  url: string
  insecureSkipVerify: boolean
  organization: string
  links: EsLinks
  authentication: 'basic' | 'apiKey' | 'unknown'
  basicAuth: BasicAuth | null
  apiKeyAuth: ApiKeyAuth | null
}

export interface ElasticSearchState {
  isFetching: boolean
  error: string | null
  esSources: BaseElasticSearchData[]
}

export interface AllGetResponse {
  esSources: BaseElasticSearchData[]
}

export interface CreateElasticSearchParams {
  id?: string
  name: string
  url: string
  basicAuth?: BasicAuth | null
  apiKeyAuth?: ApiKeyAuth | null
  insecureSkipVerify: boolean
  organization: string
  authentication: 'basic' | 'apiKey' | 'unknown'
}

export type ToggleEsWizard = (
  isVisible: boolean,
  esInfo?: BaseElasticSearchData
) => () => void

export interface FieldInfo {
  field: string
  type: string
  aggregatable: boolean
  searchable: boolean
}
export interface FieldListResponse {
  fields: FieldInfo[]
  total: number
}

export interface AutoCompleteResult {
  fields: FieldInfo[]
  operators: OperatorMeta[]
  values?: string[]
}
