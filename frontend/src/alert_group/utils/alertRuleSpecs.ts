import {
  AlertConditionApi,
  AlertGroupRule,
  AlertRuleSpec,
  AlertTemplate,
  DEFAULT_RULE_SPEC,
  normalizeAlertConditions,
} from 'src/types'

/** Fallback for partial sources (e.g. templates). Normalized rules: use `rule.specs[0]`. */
export const getRuleSpec = (source: {specs?: AlertRuleSpec[]}): AlertRuleSpec =>
  source.specs?.[0] ?? DEFAULT_RULE_SPEC

export const patchRuleSpec = (
  rule: AlertGroupRule,
  patch: Partial<AlertRuleSpec>
): Partial<AlertGroupRule> => ({
  specs: [{...(rule.specs[0] ?? DEFAULT_RULE_SPEC), ...patch}],
})

const normalizeSpecFromApi = (spec: AlertRuleSpec): AlertRuleSpec => {
  const conditions = normalizeAlertConditions(spec.conditions)
  return {
    ...DEFAULT_RULE_SPEC,
    ...spec,
    conditions: conditions.length ? conditions : DEFAULT_RULE_SPEC.conditions,
  }
}

/** Ensure specs[0] defaults and form-friendly condition values after API GET. */
export const ensureRuleFromApi = (
  raw: Partial<AlertGroupRule>
): Partial<AlertGroupRule> => {
  const spec = raw.specs?.[0]
    ? normalizeSpecFromApi(raw.specs[0])
    : {...DEFAULT_RULE_SPEC}

  return {
    ...raw,
    specs: [spec],
    templateKey: raw.templateKey || '',
  }
}

const buildSpecTriggerValues = (
  trigger: AlertRuleSpec['trigger'],
  values?: AlertRuleSpec['values']
): AlertRuleSpec['values'] | undefined => {
  if (trigger === 'relative') {
    return {
      change: values?.change || 'change',
      shift: values?.shift || '1m',
    }
  }
  if (trigger === 'deadman') {
    return {
      period: values?.period || '10m',
    }
  }
  return undefined
}

type AlertRuleSpecWire = Omit<AlertRuleSpec, 'conditions'> & {
  conditions: AlertConditionApi[]
}

const normalizeSpecForApi = (spec: AlertRuleSpec): AlertRuleSpecWire => ({
  ...(spec.id ? {id: spec.id} : {}),
  database: spec.database || '',
  retentionPolicy: spec.retentionPolicy || '',
  measurement: spec.measurement,
  field: spec.field,
  trigger: spec.trigger || 'threshold',
  every: spec.every || DEFAULT_RULE_SPEC.every,
  values: buildSpecTriggerValues(spec.trigger, spec.values),
  urlErrorConfig: spec.urlErrorConfig,
  conditions: (spec.conditions || []).map(
    (condition): AlertConditionApi => ({
      level: condition.level,
      value: Number(condition.value),
      operator: condition.operator,
      enabled: condition.enabled,
    })
  ),
})

export const buildAlertGroupRuleRequest = (rule: AlertGroupRule) => ({
  ...(rule.id ? {id: rule.id} : {}),
  name: rule.name,
  kapacitorId: rule.kapacitorId,
  taskType: rule.taskType,
  targetType: rule.targetType,
  occurrenceType: rule.occurrenceType,
  occurrenceCount: rule.occurrenceCount,
  occurrenceWindow: rule.occurrenceWindow,
  pauseSeconds: rule.pauseSeconds,
  notifyRecovery: rule.notifyRecovery,
  message: rule.message,
  templateKey: rule.templateKey || '',
  active: rule.active,
  ...(rule.hostnames?.length ? {hostnames: rule.hostnames} : {}),
  ...(rule.urlTargetIds ? {urlTargetIds: rule.urlTargetIds} : {}),
  ...(rule.derivative ? {derivative: rule.derivative} : {}),
  ...(rule.eval ? {eval: rule.eval} : {}),
  specs: [normalizeSpecForApi(rule.specs[0] ?? DEFAULT_RULE_SPEC)],
  eventHandlers: rule.eventHandlers || [],
})

export const normalizeAlertTemplate = (
  template: AlertTemplate
): AlertTemplate => {
  const spec = template.specs?.[0]
  if (!spec) {
    return template
  }

  return {
    ...template,
    specs: [normalizeSpecFromApi(spec as AlertRuleSpec)],
  }
}
