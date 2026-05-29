import React, {PureComponent, ChangeEvent} from 'react'
import {TFunction} from 'react-i18next'
import {AlertGroupRule, AlertRuleEventHandler} from 'src/types'

export interface KafkaHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  loadingKafka: boolean
  isKafkaConfigured: boolean
  t: TFunction
  onGoToConfig: (hash: string) => void
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

export default class KafkaHandler extends PureComponent<KafkaHandlerProps> {
  private handleConfigChange = (key: string) => (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'kafka') {
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
      loadingKafka,
      isKafkaConfigured,
      t,
      onGoToConfig,
    } = this.props

    return (
      <>
        {/* Loading state */}
        {loadingKafka && (
          <div className="alert-group-loading-smtp">
            {t(
              'alert_group_basic.loading_kafka_config',
              'Kafka 설정을 확인 중입니다...'
            )}
          </div>
        )}

        {/* Kafka NOT configured Warning Banner */}
        {!loadingKafka && !isKafkaConfigured && (
          <div className="endpoint-tab--parameters">
            <div className="alert-group-delivery-callout alert-group-delivery-callout--compact alert-group-handler-callout">
              <h4 className="alert-group-delivery-callout__title alert-group-handler-callout-title">
                {t(
                  'alert_group_basic.kafka_not_configured_title',
                  'Kafka 설정 필요'
                )}
              </h4>
              <p className="alert-group-delivery-callout__body">
                {t(
                  'alert_group_basic.kafka_not_configured_body',
                  'Kafka 알림을 발송하려면 Kapacitor에 Kafka가 등록되어 있어야 합니다. 현재 Kafka 설정이 완료되지 않았습니다.'
                )}
              </p>
              <button
                type="button"
                className="btn btn-warning btn-sm alert-group-handler-callout-btn"
                onClick={() => onGoToConfig('#kafka')}
              >
                <span className="icon cog-thick alert-group-handler-callout-icon" />
                {t(
                  'alert_group_basic.go_to_kafka_config',
                  'Kafka 설정 화면으로 이동'
                )}
              </button>
            </div>
          </div>
        )}

        {!loadingKafka && isKafkaConfigured && (
          <div className="endpoint-tab--parameters">
            <h4 className="u-flex u-jc-space-between">
              {t(
                'alert_group_basic.kafka_parameters_title',
                'Parameters for Kafka Cluster Alert'
              )}
              <div
                className="btn btn-default btn-sm"
                onClick={() => onGoToConfig('#kafka')}
              >
                <span className="icon cog-thick" />
                {t(
                  'alert_group_basic.edit_kafka_config',
                  'Edit Kafka Configuration'
                )}
              </div>
            </h4>
            <div className="faux-form">
              <div className="form-group col-md-6">
                <label htmlFor="kafka-cluster">
                  {t(
                    'alert_group_basic.kafka_cluster',
                    'Kafka Cluster'
                  )}{' '}
                  <span className="rule-section--required-star">
                    *
                  </span>
                </label>
                <input
                  id="kafka-cluster"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="my-cluster"
                  value={
                    (selectedHandler.configJson?.cluster as string) || ''
                  }
                  onChange={this.handleConfigChange('cluster')}
                  spellCheck={false}
                />
              </div>
              <div className="form-group col-md-6">
                <label htmlFor="kafka-topic">
                  {t(
                    'alert_group_basic.kafka_topic',
                    'Kafka Topic'
                  )}{' '}
                  <span className="rule-section--required-star">
                    *
                  </span>
                </label>
                <input
                  id="kafka-topic"
                  type="text"
                  className="form-control input-sm form-malachite"
                  placeholder="alerts-topic"
                  value={
                    (selectedHandler.configJson?.['kafka-topic'] as string) || ''
                  }
                  onChange={this.handleConfigChange('kafka-topic')}
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
