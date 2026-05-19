import {AlertGroupRule, AlertTemplate} from 'src/alert_group/types'

export const findSelectedAlertTemplate = (
  templates: AlertTemplate[] = [],
  rule: Pick<AlertGroupRule, 'measurement' | 'field'>
): AlertTemplate | undefined =>
  templates.find(
    template =>
      template.measurement === rule.measurement && template.field === rule.field
  )
