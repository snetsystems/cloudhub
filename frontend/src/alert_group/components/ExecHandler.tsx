import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/types'

export interface ExecHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  t: TFunction
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class ExecHandler extends PureComponent<ExecHandlerProps> {
  private handleExecCommandChange = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const val = e.target.value
    const command = val ? val.trim().split(/\s+/) : []

    const nextHandlers = handlers.map(h => {
      if (h.type === 'exec') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            command,
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
            'alert_group_basic.exec_parameters_title',
            'Parameters for Exec Command'
          )}
        </h4>
        <div className="faux-form">
          <div className="form-group col-md-12">
            <label htmlFor="exec-command">
              {t(
                'alert_group_basic.exec_command',
                'Shell Command'
              )}{' '}
              <span className="rule-section--required-star">
                *
              </span>
            </label>
            <input
              id="exec-command"
              type="text"
              className="form-control input-sm form-malachite"
              placeholder={t(
                'alert_group_basic.exec_command_placeholder',
                'e.g. /usr/bin/my-script.sh arg1 arg2'
              )}
              value={
                Array.isArray(selectedHandler.configJson?.command)
                  ? selectedHandler.configJson.command.join(' ')
                  : ''
              }
              onChange={this.handleExecCommandChange}
              spellCheck={false}
            />
            <span className="form-text text-muted alert-group-handler-helper-text">
              {t(
                'alert_group_basic.exec_command_help',
                '실행할 스크립트 경로와 인자(Argument)를 공백으로 구분하여 입력하세요.'
              )}
            </span>
          </div>
        </div>
      </div>
    )
  }
}
