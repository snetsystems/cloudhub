import React, {ChangeEvent, PureComponent} from 'react'
import {withTranslation, WithTranslation} from 'react-i18next'
import {Input, InputType} from 'src/reusable_ui'
import {AlertGroupRule} from 'src/alert_group/types'

interface Props extends WithTranslation {
  rule: AlertGroupRule
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

class AlertGroupNameSection extends PureComponent<Props> {
  private handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.props.onUpdateRule({name: e.target.value})
  }

  public render() {
    const {rule, t} = this.props

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">{t('alert_group_rule.event_rule_name')}</h3>
        <div className="rule-section--body" style={{padding: '20px 24px'}}>
          <Input
            value={rule.name || ''}
            onChange={this.handleNameChange}
            type={InputType.Text}
            placeholder={t('alert_group_rule.placeholder')}
            spellCheck={false}
          />
        </div>
      </div>
    )
  }
}

export default withTranslation()(AlertGroupNameSection)
