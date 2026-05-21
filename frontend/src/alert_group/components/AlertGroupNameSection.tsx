import React, {ChangeEvent, PureComponent} from 'react'
import {withTranslation, WithTranslation} from 'react-i18next'
import {Input, InputType, SlideToggle, ComponentSize, ComponentColor} from 'src/reusable_ui'
import {AlertGroupRule} from 'src/alert_group/types'

interface Props extends WithTranslation {
  rule: AlertGroupRule
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

class AlertGroupNameSection extends PureComponent<Props> {
  private handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.props.onUpdateRule({name: e.target.value})
  }

  private handleToggleActive = (): void => {
    this.props.onUpdateRule({active: !this.props.rule.active})
  }

  public render() {
    const {rule, t} = this.props

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {t('alert_group_rule.event_rule_name')}
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <span style={{fontSize: '13px', color: '#f6f6f8', fontWeight: 'normal'}}>
              {t('alert_group_basic.enable_event', '이벤트 규칙 활성화')}
            </span>
            <SlideToggle
              active={rule.active}
              onChange={this.handleToggleActive}
              size={ComponentSize.ExtraSmall}
              color={ComponentColor.Primary}
            />
          </div>
        </h3>
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
