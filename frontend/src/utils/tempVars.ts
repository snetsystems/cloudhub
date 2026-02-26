import {Source, Template, TemplateValueType, TemplateType} from 'src/types'

/**
 * Merges builtin dashboard templates with page getTempVars.
 * - getTempVars (DB/RP, source-backed) take priority by tempVar.
 */
export function mergeBuiltinWithGetTempVars(
  builtinTemplates: Template[],
  pageTempVars: Template[],
  source: Source
): Template[] {
  const pageVarKeys = new Set(pageTempVars.map(t => t.tempVar))
  const fromBuiltin = (builtinTemplates || [])
    .filter(t => !pageVarKeys.has(t.tempVar))
    .map(t => {
      if (!t.query) return t
      return {
        ...t,
        query: {
          ...t.query,
          db: source.telegraf ?? t.query.db,
          rp: source.defaultRP ?? t.query.rp,
        },
      }
    })
  return [...pageTempVars, ...fromBuiltin]
}

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
