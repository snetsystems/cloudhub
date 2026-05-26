import {
  AlertGroupRule,
  AlertRuleEventHandler,
  AlertTemplate,
} from 'src/alert_group/types'

export const findSelectedAlertTemplate = (
  templates: AlertTemplate[] = [],
  rule: Pick<AlertGroupRule, 'measurement' | 'field'>
): AlertTemplate | undefined =>
  templates.find(
    template =>
      template.measurement === rule.measurement && template.field === rule.field
  )

export const applyAlertTemplateToRule = (
  rule: AlertGroupRule,
  template: AlertTemplate
): AlertGroupRule => {
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
    recipientGroupIds:
      emailHandler?.recipientGroupIds || rule.recipientGroupIds || [],
    configJson: {
      ...(emailHandler?.configJson || {to: []}),
      body:
        template.emailBody ||
        (emailHandler?.configJson?.body as string | undefined) ||
        '',
    },
  }

  return {
    ...rule,
    name: template.name,
    database: template.database || rule.database,
    retentionPolicy: template.retentionPolicy || rule.retentionPolicy,
    measurement: template.measurement,
    field: template.field,
    derivative: template.derivative,
    eval: template.eval,
    trigger: template.trigger || 'threshold',
    triggerOperator: template.triggerOperator,
    triggerValues: template.values || rule.triggerValues,
    taskType: template.taskType,
    every: template.every,
    occurrenceType: template.occurrenceType,
    occurrenceCount: template.occurrenceCount,
    occurrenceWindow: template.occurrenceWindow,
    pauseSeconds: template.pauseSeconds,
    notifyRecovery: template.notifyRecovery,
    message: template.message,
    conditions:
      template.conditions && template.conditions.length > 0
        ? template.conditions
        : rule.conditions,
    eventHandlers: [...nonEmailHandlers, nextEmailHandler],
  }
}
