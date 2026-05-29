import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/types'

export interface TelegramHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  loadingTelegram: boolean
  isTelegramConfigured: boolean
  t: TFunction
  onGoToConfig: (hash: string) => void
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class TelegramHandler extends PureComponent<TelegramHandlerProps> {
  private handleConfigChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'telegram') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            chatId: value,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  public render() {
    const {
      selectedHandler,
      loadingTelegram,
      isTelegramConfigured,
      t,
      onGoToConfig,
    } = this.props

    return (
      <>
        {/* Loading state */}
        {loadingTelegram && (
          <div className="alert-group-loading-smtp">
            {t(
              'alert_group_basic.loading_telegram_config',
              'Telegram 설정을 확인 중입니다...'
            )}
          </div>
        )}

        {/* Telegram NOT configured Warning Banner */}
        {!loadingTelegram && !isTelegramConfigured && (
          <div className="endpoint-tab--parameters">
            <div className="alert-group-delivery-callout alert-group-delivery-callout--compact alert-group-handler-callout">
              <h4 className="alert-group-delivery-callout__title alert-group-handler-callout-title">
                {t(
                  'alert_group_basic.telegram_not_configured_title',
                  'Telegram 설정 필요'
                )}
              </h4>
              <p className="alert-group-delivery-callout__body">
                {t(
                  'alert_group_basic.telegram_not_configured_body',
                  'Telegram 알림을 발송하려면 Kapacitor에 Telegram이 등록되어 있어야 합니다. 현재 Telegram 설정이 완료되지 않았습니다.'
                )}
              </p>
              <button
                type="button"
                className="btn btn-warning btn-sm alert-group-handler-callout-btn"
                onClick={() => onGoToConfig('#telegram')}
              >
                <span className="icon cog-thick alert-group-handler-callout-icon" />
                {t(
                  'alert_group_basic.go_to_telegram_config',
                  'Telegram 설정 화면으로 이동'
                )}
              </button>
            </div>
          </div>
        )}

        {!loadingTelegram && isTelegramConfigured && (
          <div className="endpoint-tab--parameters">
            <h4 className="u-flex u-jc-space-between">
              {t(
                'alert_group_basic.telegram_parameters_title',
                'Parameters for Telegram Alert'
              )}
              <div
                className="btn btn-default btn-sm"
                onClick={() => onGoToConfig('#telegram')}
              >
                <span className="icon cog-thick" />
                {t(
                  'alert_group_basic.edit_telegram_config',
                  'Edit Telegram Configuration'
                )}
              </div>
            </h4>
            <div className="faux-form">
              <div className="form-group col-md-12">
                <label htmlFor="telegram-chat-id">
                  {t(
                    'alert_group_basic.telegram_chat_id',
                    'Telegram Chat ID'
                  )}
                  <span className="rule-section--required-star">
                    *
                  </span>
                </label>
                <input
                  id="telegram-chat-id"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="-100123456789"
                  value={
                    (selectedHandler.configJson?.chatId as string) || ''
                  }
                  onChange={this.handleConfigChange}
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
}
