import React, {PureComponent} from 'react'
import classnames from 'classnames'
import {withTranslation, WithTranslation} from 'react-i18next'
import {
  Input,
  InputType,
  Button,
  ComponentSize,
  ComponentColor,
  ComponentStatus,
  IconFont,
} from 'src/reusable_ui'
import {AlertTemplate} from 'src/types'
import {getRuleSpec} from 'src/alert_group/utils/alertRuleSpecs'
import AlertGroupTemplateTooltip from 'src/alert_group/components/AlertGroupTemplateTooltip'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

interface Props extends WithTranslation {
  templates: AlertTemplate[]
  availableMeasurements: Set<string>
  selectedTemplateId: string
  onSelectTemplate: (templateId: string) => void
  createNewText?: string
  showCreateIcon?: boolean
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
    if (template.category === 'url-monitoring') {
      return true
    }
    const {availableMeasurements} = this.props
    if (!availableMeasurements || availableMeasurements.size === 0) {
      return true
    }
    return availableMeasurements.has(getRuleSpec({specs: template.specs}).measurement)
  }

  private getDisabledReason = (template: AlertTemplate): string =>
    this.props.t('alert_group_rule.disabled_reason_telegraf', {
      measurement: getRuleSpec({specs: template.specs}).measurement,
    })

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
    const {
      templates,
      selectedTemplateId,
      onSelectTemplate,
      createNewText,
      showCreateIcon = true,
      t,
    } = this.props
    const {searchTerm, tooltip} = this.state

    const buttonText = createNewText ?? t('alert_group_rule.create_new')

    const needle = searchTerm.toLowerCase()
    const filteredTemplates = templates
      .filter(template => {
        if (!needle) {
          return true
        }
        if (template.name.toLowerCase().includes(needle)) {
          return true
        }
        if (
          template.description &&
          template.description.toLowerCase().includes(needle)
        ) {
          return true
        }
        if (
          template.tags &&
          template.tags.some(tag => tag.toLowerCase().includes(needle))
        ) {
          return true
        }
        return false
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base',
        })
        if (byName !== 0) {
          return byName
        }
        return a.id.localeCompare(b.id)
      })

    return (
      <div className="alert-group-sidebar-wrapper card">
        <div className="alert-group-sidebar--search">
          <Input
            type={InputType.Text}
            placeholder={t('alert_group_rule.search')}
            value={searchTerm}
            onChange={this.handleSearchChange}
            spellCheck={false}
          />
        </div>
        <Button
          text={buttonText}
          onClick={() => onSelectTemplate('custom')}
          icon={showCreateIcon ? IconFont.Plus : undefined}
          color={ComponentColor.Success}
          size={ComponentSize.Small}
          status={ComponentStatus.Default}
        />
        <div className="alert-group-sidebar">
          <FancyScrollbar className="alert-group-sidebar--menu">
            <div className="alert-group-sidebar--section-title">
              <div className="alert-group-sidebar--section-title-title">
                <span className={`icon ${IconFont.Cubouniform}`} aria-hidden />
                {t('alert_group_rule.quick_setting_template')}
              </div>
              <div className="alert-group-sidebar--section-title-sub">
                {t('alert_group_rule.quick_template_desc')}
              </div>
            </div>

            {(() => {
              const items = filteredTemplates.map(template => {
                const available = this.isAvailable(template)
                return {template, available}
              })

              const availableItems = items.filter(item => item.available)
              const disabledItems = items.filter(item => !item.available)

              const renderItem = ({
                template,
                available,
              }: {
                template: AlertTemplate
                available: boolean
              }) => (
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

              return (
                <>
                  {availableItems.map(renderItem)}
                  {disabledItems.length > 0 && (
                    <div className="alert-group-sidebar--divider">
                      <div className="alert-group-sidebar--divider-line" />
                      <span className="alert-group-sidebar--divider-text">
                        {t('alert_group_rule.unavailable')}
                      </span>
                      <div className="alert-group-sidebar--divider-line" />
                    </div>
                  )}
                  {disabledItems.map(renderItem)}
                </>
              )
            })()}
          </FancyScrollbar>
          {tooltip ? (
            <AlertGroupTemplateTooltip
              x={tooltip.x}
              y={tooltip.y}
              message={tooltip.message}
            />
          ) : null}
        </div>
      </div>
    )
  }
}

export default withTranslation()(AlertGroupTemplateSidebar)
