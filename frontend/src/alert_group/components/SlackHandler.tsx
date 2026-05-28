import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/alert_group/types'

export interface SlackHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  loadingSlack: boolean
  isSlackConfigured: boolean
  t: TFunction
  onGoToConfig: (hash: string) => void
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class SlackHandler extends PureComponent<SlackHandlerProps> {
  private handleConfigChange = (key: string) => (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'slack') {
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

  public render() {
    const {
      selectedHandler,
      loadingSlack,
      isSlackConfigured,
      t,
      onGoToConfig,
    } = this.props

    return (
      <>
        {/* Loading state */}
        {loadingSlack && (
          <div className="alert-group-loading-smtp">
            {t(
              'alert_group_basic.loading_slack_config',
              'Slack 설정을 확인 중입니다...'
            )}
          </div>
        )}

        {/* Slack NOT configured Warning Banner */}
        {!loadingSlack && !isSlackConfigured && (
          <div className="endpoint-tab--parameters">
            <div className="alert-group-delivery-callout alert-group-delivery-callout--compact alert-group-handler-callout">
              <h4 className="alert-group-delivery-callout__title alert-group-handler-callout-title">
                {t(
                  'alert_group_basic.slack_not_configured_title',
                  'Slack 설정 필요'
                )}
              </h4>
              <p className="alert-group-delivery-callout__body">
                {t(
                  'alert_group_basic.slack_not_configured_body',
                  'Slack 알림을 발송하려면 Kapacitor에 Slack이 등록되어 있어야 합니다. 현재 Slack 설정이 완료되지 않았습니다.'
                )}
              </p>
              <button
                type="button"
                className="btn btn-warning btn-sm alert-group-handler-callout-btn"
                onClick={() => onGoToConfig('#slack')}
              >
                <span className="icon cog-thick alert-group-handler-callout-icon" />
                {t(
                  'alert_group_basic.go_to_slack_config',
                  'Slack 설정 화면으로 이동'
                )}
              </button>
            </div>
          </div>
        )}

        {!loadingSlack && isSlackConfigured && (
          <div className="endpoint-tab--parameters">
            <h4 className="u-flex u-jc-space-between">
              {t(
                'alert_group_basic.slack_parameters_title',
                'Parameters for Slack Channel Alert'
              )}
              <div
                className="btn btn-default btn-sm"
                onClick={() => onGoToConfig('#slack')}
              >
                <span className="icon cog-thick" />
                {t(
                  'alert_group_basic.edit_slack_config',
                  'Edit Slack Configuration'
                )}
              </div>
            </h4>
            <div className="faux-form">
              <div className="form-group col-md-6">
                <label htmlFor="slack-workspace">
                  {t(
                    'alert_group_basic.slack_workspace',
                    'Slack Workspace'
                  )}{' '}
                  <span className="rule-section--required-star">
                    *
                  </span>
                </label>
                <input
                  id="slack-workspace"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="my-workspace"
                  value={
                    (selectedHandler.configJson?.workspace as string) || ''
                  }
                  onChange={this.handleConfigChange('workspace')}
                  spellCheck={false}
                />
              </div>
              <div className="form-group col-md-6">
                <label htmlFor="slack-channel">
                  {t(
                    'alert_group_basic.slack_channel',
                    'Slack Channel'
                  )}{' '}
                  <span className="rule-section--required-star">
                    *
                  </span>
                </label>
                <input
                  id="slack-channel"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="#alerts"
                  value={
                    (selectedHandler.configJson?.channel as string) || ''
                  }
                  onChange={this.handleConfigChange('channel')}
                  spellCheck={false}
                />
              </div>
              <div className="form-group col-md-6 alert-group-handler-form-group-mt10">
                <label htmlFor="slack-username">
                  {t(
                    'alert_group_basic.slack_username',
                    'Slack Username'
                  )}
                </label>
                <input
                  id="slack-username"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="e.g. cloudhub-bot"
                  value={
                    (selectedHandler.configJson?.username as string) || ''
                  }
                  onChange={this.handleConfigChange('username')}
                  spellCheck={false}
                />
              </div>
              <div className="form-group col-md-6 alert-group-handler-form-group-mt10">
                <label htmlFor="slack-emoji">
                  {t(
                    'alert_group_basic.slack_emoji',
                    'Slack Icon Emoji'
                  )}
                </label>
                <input
                  id="slack-emoji"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="e.g. :bell:"
                  value={
                    (selectedHandler.configJson?.iconEmoji as string) || ''
                  }
                  onChange={this.handleConfigChange('iconEmoji')}
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
