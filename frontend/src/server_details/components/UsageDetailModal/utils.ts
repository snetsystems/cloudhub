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
  host: string,
  processName?: string,
  user?: string
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
    type: TemplateType.TagValues,
    label: '',
    values: [
      {
        value: host,
        type: TemplateValueType.TagValue,
        selected: true,
        localSelected: true,
      },
    ],
  }

  let result = [
    dbTemplate,
    rpTemplate,
    dashboardTime,
    upperDashboardTime,
    hostTemplate,
  ]
  if (processName != null) {
    const processNameTemplate: Template = {
      tempVar: ':process_name:',
      id: 'process_name',
      type: TemplateType.TagValues,
      label: '',
      values: [
        {
          value: processName,
          type: TemplateValueType.TagValue,
          selected: true,
          localSelected: true,
        },
      ],
    }
    result = [...result, processNameTemplate]
  }
  if (user != null) {
    const userTemplate: Template = {
      tempVar: ':user:',
      id: 'user',
      type: TemplateType.TagValues,
      label: '',
      values: [
        {
          value: user,
          type: TemplateValueType.TagValue,
          selected: true,
          localSelected: true,
        },
      ],
    }
    result = [...result, userTemplate]
  }
  return result
}
