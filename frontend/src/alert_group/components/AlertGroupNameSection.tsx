import React, {ChangeEvent, PureComponent} from 'react'
import {Input, InputType} from 'src/reusable_ui'
import {AlertGroupRule} from 'src/alert_group/types'

interface Props {
  rule: AlertGroupRule
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

class AlertGroupNameSection extends PureComponent<Props> {
  private handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.props.onUpdateRule({name: e.target.value})
  }

  public render() {
    const {rule} = this.props

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">이벤트 규칙 이름</h3>
        <div className="rule-section--body" style={{ padding: '20px 24px' }}>
          <Input
            value={rule.name || ''}
            onChange={this.handleNameChange}
            type={InputType.Text}
            placeholder="규칙 이름을 입력해 주세요 (예: CPU 임계치 초과 알림)"
            spellCheck={false}
          />
        </div>
      </div>
    )
  }
}

export default AlertGroupNameSection
