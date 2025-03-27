import {Source, Template, TemplateValueType, TemplateType} from 'src/types'

export const generateForHosts = (source: Source): Template[] => [
  {
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
  },
  {
    tempVar: ':rp:',
    id: 'rp',
    type: TemplateType.Constant,
    label: '',
    values: [
      {
        value: source.defaultRP,
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  },
]

export const generateForHostsForStatisticalGraph = (
  source: Source
): Template[] => [
  {
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
  },
  {
    tempVar: ':rp:',
    id: 'rp',
    type: TemplateType.Constant,
    label: '',
    values: [
      {
        value: source.defaultRP,
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  },
  {
    tempVar: ':top_count:',
    id: 'top_count',
    type: TemplateType.Text,
    label: '',
    values: [
      {
        value: '10',
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  },
  {
    tempVar: ':idle_count:',
    id: 'idle_count',
    type: TemplateType.Text,
    label: '',
    values: [
      {
        value: '10',
        type: TemplateValueType.Constant,
        selected: true,
        localSelected: true,
      },
    ],
  },
]
