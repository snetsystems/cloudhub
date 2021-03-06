import {Source, Me} from 'src/types'
import {Notification} from 'src/types/notifications'

export enum TemplateValueType {
  Database = 'database',
  TagKey = 'tagKey',
  FieldKey = 'fieldKey',
  Measurement = 'measurement',
  TagValue = 'tagValue',
  CSV = 'csv',
  Map = 'map',
  Points = 'points',
  Constant = 'constant',
  MetaQuery = 'influxql',
  FluxQuery = 'flux',
  TimeStamp = 'timeStamp',
}

export interface TemplateValue {
  value: string
  type: TemplateValueType
  selected: boolean
  localSelected: boolean
  key?: string
}

export interface TemplateQuery {
  db?: string
  rp?: string
  measurement?: string
  tagKey?: string
  fieldKey?: string
  influxql?: string
  flux?: string
}

export enum TemplateType {
  AutoGroupBy = 'autoGroupBy',
  Constant = 'constant',
  FieldKeys = 'fieldKeys',
  Measurements = 'measurements',
  TagKeys = 'tagKeys',
  TagValues = 'tagValues',
  CSV = 'csv',
  Map = 'map',
  Databases = 'databases',
  MetaQuery = 'influxql',
  FluxQuery = 'flux',
  Text = 'text',
  TimeStamp = 'timeStamp',
}

export interface Template {
  id: string
  tempVar: string
  values: TemplateValue[]
  type: TemplateType
  label: string
  query?: TemplateQuery
  sourceID?: string
}

export interface TemplateUpdate {
  key: string
  value: string
}

export interface TimeRangeQueryParams {
  lower?: string
  upper?: string
  zoomedLower?: string
  zoomedUpper?: string
}

export interface TemplateBuilderProps {
  template: Template
  templates: Template[]
  source: Source
  me: Me
  isUsingAuth: boolean
  onUpdateTemplate: (nextTemplate: Template) => void
  onUpdateDefaultTemplateValue: (item: TemplateValue) => void
  notify?: (message: Notification) => void
}
