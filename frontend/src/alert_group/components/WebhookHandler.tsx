import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {
  Button,
  IconFont,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  Input,
  InputType,
} from 'src/reusable_ui'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/alert_group/types'

export interface WebhookHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  t: TFunction
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class WebhookHandler extends PureComponent<WebhookHandlerProps> {
  private handleConfigChange = (key: string) => (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'webhook') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            [key]: value,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleAddHeader = (): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    const nextHandlers = handlers.map(h => {
      if (h.type === 'webhook') {
        const currentHeaders =
          (h.configJson?.headers as Record<string, string>) || {}
        return {
          ...h,
          configJson: {
            ...h.configJson,
            headers: {
              ...currentHeaders,
              '': '',
            },
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleDeleteHeader = (keyToDelete: string) => (): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    const nextHandlers = handlers.map(h => {
      if (h.type === 'webhook') {
        const currentHeaders = {
          ...((h.configJson?.headers as Record<string, string>) || {}),
        }
        delete currentHeaders[keyToDelete]
        return {
          ...h,
          configJson: {
            ...h.configJson,
            headers: currentHeaders,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleHeaderKeyChange = (oldKey: string, newKey: string): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    const nextHandlers = handlers.map(h => {
      if (h.type === 'webhook') {
        const currentHeaders =
          (h.configJson?.headers as Record<string, string>) || {}
        const nextHeadersObj: Record<string, string> = {}

        Object.entries(currentHeaders).forEach(([k, v]) => {
          if (k === oldKey) {
            nextHeadersObj[newKey] = v
          } else {
            nextHeadersObj[k] = v
          }
        })

        return {
          ...h,
          configJson: {
            ...h.configJson,
            headers: nextHeadersObj,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleHeaderValueChange = (key: string, newValue: string): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    const nextHandlers = handlers.map(h => {
      if (h.type === 'webhook') {
        const currentHeaders =
          (h.configJson?.headers as Record<string, string>) || {}
        return {
          ...h,
          configJson: {
            ...h.configJson,
            headers: {
              ...currentHeaders,
              [key]: newValue,
            },
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  public render() {
    const {selectedHandler, t} = this.props
    const headers = (selectedHandler.configJson?.headers as Record<string, string>) || {}
    const hasEmptyHeaderKey = Object.keys(headers).some(k => !k.trim())

    return (
      <div className="endpoint-tab--parameters">
        <h4>
          {t(
            'alert_group_basic.webhook_parameters_title',
            'Parameters for Webhook HTTP Post'
          )}
        </h4>
        <div className="faux-form">
          <div className="form-group col-md-12">
            <label htmlFor="webhook-url">
              {t('alert_group_basic.webhook_url', 'Webhook URL')}{' '}
              <span className="rule-section--required-star">
                *
              </span>
            </label>
            <input
              id="webhook-url"
              type="text"
              className="form-control input-sm form-malachite"
              placeholder={t(
                'alert_group_basic.webhook_url_placeholder',
                'https://example.com/endpoint'
              )}
              value={
                (selectedHandler.configJson?.url as string) || ''
              }
              onChange={this.handleConfigChange('url')}
              spellCheck={false}
            />
          </div>

          {/* Webhook Headers Grid */}
          <div className="form-group col-md-12 alert-group-handler-form-group-mt10">
            <label className="alert-group-handler-header-label">
              {t(
                'alert_group_basic.webhook_headers',
                'HTTP Post Headers'
              )}
              <Button
                text={t(
                  'alert_group_basic.add_header',
                  'Add Header'
                )}
                icon={IconFont.Plus}
                onClick={this.handleAddHeader}
                color={ComponentColor.Default}
                size={ComponentSize.Small}
                customClass="alert-group-handler-add-btn"
                status={
                  hasEmptyHeaderKey
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
                titleText={
                  hasEmptyHeaderKey
                    ? t(
                        'alert_group_basic.add_header_disabled_tooltip',
                        '빈 헤더의 Key를 입력한 후에 추가할 수 있습니다.'
                      )
                    : undefined
                }
              />
            </label>
            <div className="alert-group-webhook-headers-list">
              {Object.entries(headers).map(([key, val], idx) => (
                <div
                  key={idx}
                  className="alert-group-webhook-header-row"
                >
                  <Input
                    type={InputType.Text}
                    size={ComponentSize.Small}
                    customClass="alert-group-webhook-header-input"
                    placeholder={t(
                      'alert_group_basic.header_key',
                      'Key'
                    )}
                    value={key}
                    onChange={e =>
                      this.handleHeaderKeyChange(
                        key,
                        e.target.value
                      )
                    }
                    spellCheck={false}
                  />
                  <Input
                    type={InputType.Text}
                    size={ComponentSize.Small}
                    customClass="alert-group-webhook-header-input"
                    placeholder={t(
                      'alert_group_basic.header_value',
                      'Value'
                    )}
                    value={val}
                    onChange={e =>
                      this.handleHeaderValueChange(
                        key,
                        e.target.value
                      )
                    }
                    spellCheck={false}
                  />
                  <ConfirmButton
                    icon="trash"
                    confirmText={t(
                      'alert_group_basic.delete_confirm',
                      'Delete'
                    )}
                    confirmAction={this.handleDeleteHeader(key)}
                    type="btn-danger"
                    size="btn-sm"
                    square={true}
                  />
                </div>
              ))}
              {Object.keys(headers).length === 0 && (
                <span className="alert-group-webhook-no-headers">
                  {t(
                    'alert_group_basic.no_headers',
                    '등록된 HTTP 헤더가 없습니다.'
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
