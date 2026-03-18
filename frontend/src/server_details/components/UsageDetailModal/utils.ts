import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {Template, TemplateType, TemplateValueType} from 'src/types'
import type {TimeRange} from 'src/types'
import type {Source} from 'src/types/sources'

export const DEFAULT_DETAIL_TIME_RANGE: TimeRange = {
  lower: 'now() - 1h',
  upper: null,
}

export function buildDetailTemplates(
  source: Source,
  timeRange: TimeRange,
  host: string
): Template[] {
  const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
    lower: timeRange.lower,
    upper: timeRange.upper ?? 'now()',
  })

  const dbTemplate: Template = {
    tempVar: ':db:',
    id: 'db',
    type: TemplateType.Constant,
    label: '',
    values: [
      {
        value: source.telegraf,
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  }

  const rpTemplate: Template = {
    tempVar: ':rp:',
    id: 'rp',
    type: TemplateType.Constant,
    label: '',
    values: [
      {
        value: source.defaultRP || 'autogen',
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  }

  const hostTemplate: Template = {
    tempVar: ':host:',
    id: 'host',
    type: TemplateType.Constant,
    label: '',
    values: [
      {
        value: host,
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  }

  return [dbTemplate, rpTemplate, dashboardTime, upperDashboardTime, hostTemplate]
}
