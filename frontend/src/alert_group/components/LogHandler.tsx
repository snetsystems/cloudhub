import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/types'

export interface LogHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  t: TFunction
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class LogHandler extends PureComponent<LogHandlerProps> {
  private handleConfigChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'log') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            filePath: value,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  public render() {
    const {selectedHandler, t} = this.props

    return (
      <div className="endpoint-tab--parameters">
        <h4>
          {t(
            'alert_group_basic.log_parameters_title',
            'Parameters for File Log Alert'
          )}
        </h4>
        <div className="faux-form">
          <div className="form-group col-md-12">
            <label htmlFor="log-filepath">
              {t(
                'alert_group_basic.log_filepath',
                'Log File Path'
              )}{' '}
              <span className="rule-section--required-star">
                *
              </span>
            </label>
            <input
              id="log-filepath"
              type="text"
              className="form-control input-sm form-malachite"
              placeholder="/var/log/cloudhub-alert.log"
              value={
                (selectedHandler.configJson?.filePath as string) || ''
              }
              onChange={this.handleConfigChange}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    )
  }
}
