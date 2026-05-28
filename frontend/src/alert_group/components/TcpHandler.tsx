import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/alert_group/types'

export interface TcpHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  t: TFunction
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class TcpHandler extends PureComponent<TcpHandlerProps> {
  private handleConfigChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'tcp') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            address: value,
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
            'alert_group_basic.tcp_parameters_title',
            'Parameters for TCP Alert'
          )}
        </h4>
        <div className="faux-form">
          <div className="form-group col-md-12">
            <label htmlFor="tcp-address">
              {t(
                'alert_group_basic.tcp_address',
                'TCP Address (host:port)'
              )}{' '}
              <span className="rule-section--required-star">
                *
              </span>
            </label>
            <input
              id="tcp-address"
              type="text"
              className="form-control input-sm form-malachite"
              placeholder="example.com:8080"
              value={
                (selectedHandler.configJson?.address as string) ||
                ''
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
