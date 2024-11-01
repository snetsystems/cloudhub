import React, {Component} from 'react'

import PredictionRuleMessageText from 'src/device_management/components/PredictionRuleMessageText'
import RuleMessageTemplates from 'src/kapacitor/components/alert_rules/RuleMessageTemplates'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {AlertRule} from 'src/types'
import {KapacitorRuleActions} from 'src/types/actions'

interface Props {
  rule: AlertRule
  ruleActions: KapacitorRuleActions
}

@ErrorHandling
class PredictionRuleMessage extends Component<Props> {
  constructor(props) {
    super(props)
  }

  public render() {
    const {rule, ruleActions} = this.props

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">Message</h3>
        <div className="rule-section--body">
          <PredictionRuleMessageText
            message={rule.message}
            updateMessage={this.handleChangeMessage}
          />
          <RuleMessageTemplates
            rule={rule}
            updateMessage={ruleActions.updateMessage}
          />
        </div>
      </div>
    )
  }

  private handleChangeMessage = (value: string) => {
    const {ruleActions, rule} = this.props
    ruleActions.updateMessage(rule.id, value)
  }
}

export default PredictionRuleMessage
