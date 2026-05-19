import React, {PureComponent} from 'react'
import classnames from 'classnames'
import {Input, InputType} from 'src/reusable_ui'
import {AlertTemplate} from 'src/alert_group/types'
import AlertGroupTemplateTooltip from 'src/alert_group/components/AlertGroupTemplateTooltip'

interface Props {
  templates: AlertTemplate[]
  availableMeasurements: Set<string>
  selectedTemplateId: string
  onSelectTemplate: (templateId: string) => void
}

interface State {
  searchTerm: string
  tooltip: {
    x: number
    y: number
    message: string
  } | null
}

class AlertGroupTemplateSidebar extends PureComponent<Props, State> {
  public state: State = {
    searchTerm: '',
    tooltip: null,
  }

  private handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({searchTerm: e.target.value})
  }

  // A template is "available" when its measurement is actually being collected
  // in the current source. Templates without a known availability set (e.g.
  // SHOW MEASUREMENTS failed) are always enabled so the UI degrades gracefully.
  private isAvailable = (template: AlertTemplate): boolean => {
    const {availableMeasurements} = this.props
    if (!availableMeasurements || availableMeasurements.size === 0) {
      return true
    }
    return availableMeasurements.has(template.measurement)
  }

  private getDisabledReason = (template: AlertTemplate): string =>
    `이 알람을 사용하려면 telegraf '${template.measurement}' 데이터 수집이 필요합니다.`

  private getTooltipMessage = (template: AlertTemplate): string => {
    if (!this.isAvailable(template)) {
      return this.getDisabledReason(template)
    }
    return template.description || ''
  }

  private handleTemplateMouseEnter = (
    template: AlertTemplate,
    e: React.MouseEvent<HTMLDivElement>
  ): void => {
    const message = this.getTooltipMessage(template)
    if (!message) {
      return
    }

    this.setState({
      tooltip: {
        x: e.clientX,
        y: e.clientY,
        message,
      },
    })
  }

  private handleTemplateMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const {tooltip} = this.state
    if (!tooltip) {
      return
    }

    this.setState({
      tooltip: {
        ...tooltip,
        x: e.clientX,
        y: e.clientY,
      },
    })
  }

  private handleTemplateMouseLeave = (): void => {
    this.setState({tooltip: null})
  }

  public render() {
    const {templates, selectedTemplateId, onSelectTemplate} = this.props
    const {searchTerm, tooltip} = this.state

    const needle = searchTerm.toLowerCase()
    const filteredTemplates = templates.filter(t => {
      if (!needle) {
        return true
      }
      if (t.name.toLowerCase().includes(needle)) {
        return true
      }
      if (t.description && t.description.toLowerCase().includes(needle)) {
        return true
      }
      if (t.tags && t.tags.some(tag => tag.toLowerCase().includes(needle))) {
        return true
      }
      return false
    })

    return (
      <div className="alert-group-sidebar">
        <div className="alert-group-sidebar--header">
          <div className="alert-group-sidebar--title">이벤트 설정</div>
          <div className="alert-group-sidebar--search">
            <Input
              type={InputType.Text}
              placeholder="검색"
              value={searchTerm}
              onChange={this.handleSearchChange}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="alert-group-sidebar--menu">
          <div
            className={classnames('alert-group-sidebar--item', {
              active: selectedTemplateId === 'custom',
            })}
            onClick={() => onSelectTemplate('custom')}
          >
            새로 만들기
          </div>

          <div className="alert-group-sidebar--section-title">빠른 설정</div>

          {filteredTemplates.map(template => {
            const available = this.isAvailable(template)
            return (
              <div
                key={template.id}
                className={classnames('alert-group-sidebar--item', {
                  active: selectedTemplateId === template.id,
                  disabled: !available,
                })}
                onClick={
                  available ? () => onSelectTemplate(template.id) : undefined
                }
                onMouseEnter={e => this.handleTemplateMouseEnter(template, e)}
                onMouseMove={this.handleTemplateMouseMove}
                onMouseLeave={this.handleTemplateMouseLeave}
              >
                {template.name}
              </div>
            )
          })}
        </div>
        {tooltip ? (
          <AlertGroupTemplateTooltip
            x={tooltip.x}
            y={tooltip.y}
            message={tooltip.message}
          />
        ) : null}
      </div>
    )
  }
}

export default AlertGroupTemplateSidebar
