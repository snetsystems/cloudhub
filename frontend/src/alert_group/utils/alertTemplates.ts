import {
  AlertGroupRule,
  AlertRuleEventHandler,
  AlertTemplate,
} from 'src/types'
import {
  getRuleSpec,
  patchRuleSpec,
} from 'src/alert_group/utils/alertRuleSpecs'

export const findSelectedAlertTemplate = (
  templates: AlertTemplate[] = [],
  rule: Pick<AlertGroupRule, 'specs'>
): AlertTemplate | undefined => {
  const ruleSpec = getRuleSpec(rule)
  return templates.find(template => {
    const templateSpec = getRuleSpec({specs: template.specs})
    return (
      templateSpec.measurement === ruleSpec.measurement &&
      templateSpec.field === ruleSpec.field
    )
  })
}

export const applyAlertTemplateToRule = (
  rule: AlertGroupRule,
  template: AlertTemplate
): AlertGroupRule => {
  const templateSpec = getRuleSpec({specs: template.specs})

  const eventHandlers = Array.isArray(rule.eventHandlers)
    ? rule.eventHandlers
    : []
  const emailHandler = eventHandlers.find(handler => handler.type === 'email')
  const nonEmailHandlers = eventHandlers.filter(
    handler => handler.type !== 'email'
  )
  const nextEmailHandler: AlertRuleEventHandler = {
    ...(emailHandler || {}),
    type: 'email',
    enabled: emailHandler?.enabled ?? true,
    recipientGroupIds: emailHandler?.recipientGroupIds || [],
    configJson: {
      ...(emailHandler?.configJson || {to: []}),
      body:
        template.emailBody ||
        (emailHandler?.configJson?.body as string | undefined) ||
        '',
    },
  }

  const nextTrigger = templateSpec.trigger || 'threshold'
  let nextConditions = templateSpec.conditions || getRuleSpec(rule).conditions!

  if (nextTrigger === 'deadman') {
    nextConditions = nextConditions.map(condition => ({
      ...condition,
      enabled: false,
    }))
  }

  const currentSpec = getRuleSpec(rule)

  return {
    ...rule,
    ...patchRuleSpec(rule, {
      database: templateSpec.database || currentSpec.database,
      retentionPolicy: templateSpec.retentionPolicy || currentSpec.retentionPolicy,
      measurement: templateSpec.measurement,
      field: templateSpec.field,
      trigger: nextTrigger,
      every: template.every || templateSpec.every,
      values: {
        change: 'change',
        shift: '1m',
        period: '10m',
        ...currentSpec.values,
        ...templateSpec.values,
      },
      conditions: nextConditions,
      urlErrorConfig: templateSpec.urlErrorConfig,
    }),
    templateKey: template.id,
    derivative: template.derivative,
    eval: template.eval,
    taskType: template.taskType,
    occurrenceType: template.occurrenceType,
    occurrenceCount: template.occurrenceCount,
    occurrenceWindow: template.occurrenceWindow,
    pauseSeconds: template.pauseSeconds,
    notifyRecovery: template.notifyRecovery,
    message: template.message,
    eventHandlers: [...nonEmailHandlers, nextEmailHandler],
  }
}
