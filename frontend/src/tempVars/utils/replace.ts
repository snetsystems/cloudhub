import {topologicalSort, graphFromTemplates} from 'src/tempVars/utils/graph'

import {
  Template,
  TemplateType,
  TemplateValueType,
  TemplateValue,
} from 'src/types/tempVars'
import {TEMP_VAR_INTERVAL} from 'src/shared/constants'

const DESIRED_POINTS_PER_GRAPH = 360

export const computeInterval = (durationMs: number): number => {
  return Math.round(durationMs / DESIRED_POINTS_PER_GRAPH)
}

export const replaceInterval = (query: string, durationMs: number) => {
  if (!query.includes(TEMP_VAR_INTERVAL)) {
    return query
  }

  const interval = computeInterval(durationMs)
  const renderedQuery = replaceAll(query, TEMP_VAR_INTERVAL, `${interval}ms`)

  return renderedQuery
}

const sortTemplates = (templates: Template[]): Template[] => {
  const graph = graphFromTemplates(templates)

  return topologicalSort(graph).map(t => t.initialTemplate)
}

const templateReplace = (query: string, templates: Template[]) => {
  const sortedTemplates = sortTemplates(templates)

  return sortedTemplates.reduce(
    (acc, template) => renderTemplate(acc, template),
    query
  )
}

const renderTemplate = (query: string, template: Template): string => {
  if (!template.values.length) {
    return query
  }

  if (query && !query.includes(template.tempVar)) {
    return query
  }

  const localSelectedTemplateValue: TemplateValue = template.values.find(
    v => v.localSelected
  )
  const selectedTemplateValue: TemplateValue = template.values.find(
    v => v.selected
  )

  const templateValue = localSelectedTemplateValue || selectedTemplateValue
  if (!templateValue) {
    return query
  }

  const {tempVar} = template
  const {value, type} = templateValue

  let q = query
  switch (type) {
    case TemplateValueType.TagValue:
      return replaceTagValueWithRegex(query, tempVar, value, template)
    case TemplateValueType.TagKey:
    case TemplateValueType.FieldKey:
    case TemplateValueType.Measurement:
    case TemplateValueType.Database:
      return replaceAll(q, tempVar, `"${value}"`)
    case TemplateValueType.TimeStamp:
      return replaceAll(q, tempVar, `'${value}'`)
    case TemplateValueType.CSV:
    case TemplateValueType.Constant:
    case TemplateValueType.MetaQuery:
    case TemplateValueType.FluxQuery:
    case TemplateValueType.Map:
      return replaceAll(q, tempVar, value)
    default:
      return query
  }
}

const replaceAll = (query: string, search: string, replacement: string) => {
  return (query || '').split(search).join(replacement)
}

const replaceTagValueWithRegex = (
  query: string,
  tempVar: string,
  selectedValue: string,
  template: Template
): string => {
  const hasAllInTemplate = template.values.some(v => v.value === 'allTagValues')
  const hasAllOption = hasAllInTemplate || template.options?.isAllEnabled === true

  // Escape single quotes within the value to prevent query syntax errors.
  // example: John's PC -> John\'s PC
  const escapedValue = selectedValue.replace(/'/g, "\\'")

  if (!hasAllOption) {
    return replaceAll(query, tempVar, `'${escapedValue}'`)
  }

  const isAllSelected = selectedValue === 'allTagValues'

  const regexPatternWithDelimiters = isAllSelected
    ? '/^.*$/'
    : `/^${escapeRegexForPattern(selectedValue)}$/`

  return replaceAll(query, tempVar, regexPatternWithDelimiters)
}

const escapeRegexForPattern = (str: string): string => {
  return str.replace(/[.*+?^${}()[\]\\]/g, '\\$&')
}

export const templateInternalReplace = (template: Template): string => {
  if (template.type === TemplateType.MetaQuery) {
    return template.query.influxql
  }
  if (template.type === TemplateType.FluxQuery) {
    return template.query.flux
  }

  const {influxql, db, measurement, tagKey} = template.query
  return influxql
    .replace(':database:', `"${db}"`)
    .replace(':measurement:', `"${measurement}"`)
    .replace(':tagKey:', `"${tagKey}"`)
}

export default templateReplace