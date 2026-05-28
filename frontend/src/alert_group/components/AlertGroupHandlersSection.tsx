// frontend/src/alert_group/components/AlertGroupHandlersSection.tsx
import React, {PureComponent} from 'react'
import _ from 'lodash'
import classnames from 'classnames'
import {withTranslation, WithTranslation} from 'react-i18next'
import Dropdown from 'src/shared/components/Dropdown'
import {
  AlertGroupRule,
  AlertRuleEventHandler,
  UserGroup,
} from 'src/alert_group/types'
import {getActiveKapacitor, getKapacitorConfig} from 'src/shared/apis/index'
import {Source, DropdownItem} from 'src/types'
import {InjectedRouter} from 'react-router'

// Subcomponents
import EmailHandler from 'src/alert_group/components/EmailHandler'
import WebhookHandler from 'src/alert_group/components/WebhookHandler'
import TcpHandler from 'src/alert_group/components/TcpHandler'
import ExecHandler from 'src/alert_group/components/ExecHandler'
import LogHandler from 'src/alert_group/components/LogHandler'
import SlackHandler from 'src/alert_group/components/SlackHandler'
import KafkaHandler from 'src/alert_group/components/KafkaHandler'
import TelegramHandler from 'src/alert_group/components/TelegramHandler'

interface Props extends WithTranslation {
  rule: AlertGroupRule
  userGroups: UserGroup[]
  source: Source
  router: InjectedRouter
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
  onOpenTestModal: () => void
  isTestingSend: boolean
}

interface SmtpConfig {
  from: string
  host: string
  port: string
}

interface State {
  selectedType: AlertRuleEventHandler['type'] | null
  smtpConfig: SmtpConfig
  loadingSmtp: boolean
  isSmtpConfigured: boolean

  loadingSlack: boolean
  isSlackConfigured: boolean

  loadingKafka: boolean
  isKafkaConfigured: boolean

  loadingTelegram: boolean
  isTelegramConfigured: boolean

  kapacitorId: string | null
}

class AlertGroupHandlersSectionView extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      selectedType: null,
      smtpConfig: {
        from: 'alert@example.com',
        host: 'smtp.example.com',
        port: '587',
      },
      loadingSmtp: true,
      isSmtpConfigured: false,

      loadingSlack: true,
      isSlackConfigured: false,

      loadingKafka: true,
      isKafkaConfigured: false,

      loadingTelegram: true,
      isTelegramConfigured: false,

      kapacitorId: null,
    }
  }

  public async componentDidMount() {
    const {rule, source} = this.props

    // Query SMTP/Slack/Kafka/Telegram configurations from Kapacitor daemon
    try {
      const kapacitor = await getActiveKapacitor(source)
      if (kapacitor) {
        const response = await getKapacitorConfig(kapacitor)
        const sections = response?.data?.sections

        // SMTP Config
        const smtpElement = sections?.smtp?.elements?.[0]
        const smtpSection = smtpElement?.options
        const from = smtpSection?.from || 'alert@example.com'
        const host = smtpSection?.host || 'smtp.example.com'
        const port = smtpSection?.port || '587'
        const smtpEnabled =
          smtpSection?.enabled !== false && smtpSection?.enabled !== 'false'
        const isSmtpConfigured = !!(
          smtpEnabled &&
          host &&
          host !== 'smtp.example.com'
        )

        // Slack Config
        const slackElement = sections?.slack?.elements?.[0]
        const slackSection = slackElement?.options
        const slackEnabled =
          slackSection?.enabled !== false && slackSection?.enabled !== 'false'
        const isSlackConfigured = !!slackEnabled

        // Kafka Config
        const kafkaElement = sections?.kafka?.elements?.[0]
        const kafkaSection = kafkaElement?.options
        const kafkaEnabled =
          kafkaSection?.enabled !== false && kafkaSection?.enabled !== 'false'
        const isKafkaConfigured = !!kafkaEnabled

        // Telegram Config
        const telegramElement = sections?.telegram?.elements?.[0]
        const telegramSection = telegramElement?.options
        const telegramEnabled =
          telegramSection?.enabled !== false &&
          telegramSection?.enabled !== 'false'
        const isTelegramConfigured = !!telegramEnabled

        this.setState({
          smtpConfig: {from, host, port: String(port)},
          kapacitorId: kapacitor.id,
          loadingSmtp: false,
          isSmtpConfigured,

          loadingSlack: false,
          isSlackConfigured,

          loadingKafka: false,
          isKafkaConfigured,

          loadingTelegram: false,
          isTelegramConfigured,
        })
      } else {
        this.setState({
          loadingSmtp: false,
          isSmtpConfigured: false,
          loadingSlack: false,
          isSlackConfigured: false,
          loadingKafka: false,
          isKafkaConfigured: false,
          loadingTelegram: false,
          isTelegramConfigured: false,
        })
      }
    } catch (e) {
      console.error('Failed to load SMTP configuration from Kapacitor', e)
      this.setState({
        loadingSmtp: false,
        isSmtpConfigured: false,
        loadingSlack: false,
        isSlackConfigured: false,
        loadingKafka: false,
        isKafkaConfigured: false,
        loadingTelegram: false,
        isTelegramConfigured: false,
      })
    }

    // eventHandlers의 초기값 세팅: 아무것도 강제로 선택 안 한 상태로 유지 (저장된 값이 있으면 첫번째 타입 적용)
    if (rule.eventHandlers && rule.eventHandlers.length > 0) {
      this.setState({selectedType: rule.eventHandlers[0].type})
    } else {
      this.setState({selectedType: null})
    }
  }

  private handleAddHandler = (item: {
    type: AlertRuleEventHandler['type']
  }): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    if (_.some(handlers, {type: item.type})) {
      return
    }

    let initialConfig: Record<string, unknown> = {}
    if (item.type === 'email') {
      initialConfig = {body: ''}
    } else if (item.type === 'webhook') {
      initialConfig = {url: '', headers: {}}
    } else if (item.type === 'tcp') {
      initialConfig = {address: ''}
    } else if (item.type === 'exec') {
      initialConfig = {command: []}
    } else if (item.type === 'log') {
      initialConfig = {filePath: ''}
    } else if (item.type === 'slack') {
      initialConfig = {workspace: '', channel: '', username: '', iconEmoji: ''}
    } else if (item.type === 'kafka') {
      initialConfig = {cluster: '', 'kafka-topic': ''}
    } else if (item.type === 'telegram') {
      initialConfig = {chatId: ''}
    }

    const newHandler: AlertRuleEventHandler = {
      type: item.type,
      enabled: true,
      recipientGroupIds: [],
      configJson: initialConfig,
    }

    onUpdateRule({eventHandlers: [...handlers, newHandler]})
    this.setState({selectedType: item.type})
  }

  private handleAddHandlerFromDropdown = (item: DropdownItem): void => {
    const handlerItem = item as {
      type: AlertRuleEventHandler['type']
      text: string
    }
    this.handleAddHandler(handlerItem)
  }

  private handleRemoveHandler = (type: AlertRuleEventHandler['type']) => (
    e: React.MouseEvent<HTMLElement>
  ): void => {
    e.stopPropagation()
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    const nextHandlers = _.reject(handlers, {type})
    onUpdateRule({eventHandlers: nextHandlers})

    const activeType =
      this.state.selectedType &&
      _.some(nextHandlers, {type: this.state.selectedType})
        ? this.state.selectedType
        : nextHandlers.length > 0
        ? nextHandlers[0].type
        : null

    this.setState({selectedType: activeType})
  }

  private handleSelectTab = (
    type: AlertRuleEventHandler['type']
  ) => (): void => {
    this.setState({selectedType: type})
  }

  private handleGoToConfig = (hash: unknown): void => {
    const {source, router} = this.props
    const {kapacitorId} = this.state
    const hashStr = typeof hash === 'string' ? hash : ''
    if (kapacitorId) {
      router.push(
        `/sources/${source.id}/kapacitors/${kapacitorId}/edit${hashStr}`
      )
    } else {
      router.push(`/sources/${source.id}/alert-rules`)
    }
  }

  public render() {
    const {rule, userGroups, t, onOpenTestModal, isTestingSend} = this.props
    const {
      selectedType,
      smtpConfig,
      loadingSmtp,
      isSmtpConfigured,

      loadingSlack,
      isSlackConfigured,

      loadingKafka,
      isKafkaConfigured,

      loadingTelegram,
      isTelegramConfigured,
      kapacitorId,
    } = this.state
    const handlers = rule.eventHandlers || []

    const availableTypes: {
      type: AlertRuleEventHandler['type'] | null
      text: string
    }[] = [
      {type: 'webhook', text: 'post'},
      {type: 'tcp', text: 'tcp'},
      {type: 'exec', text: 'exec'},
      {type: 'log', text: 'log'},
      {type: 'slack', text: 'slack (default)'},
      {type: 'email', text: 'email'},
      {type: null, text: 'SEPARATOR'},
      {type: 'kafka', text: 'kafka (default)'},
      {type: 'telegram', text: 'telegram'},
    ]

    const activeHandlerTypes = handlers.map(h => h.type)
    const filteredTypes = availableTypes.filter(item => {
      if (item.text === 'SEPARATOR') {
        return true
      }
      return !activeHandlerTypes.includes(item.type!)
    })

    const dropdownItems: DropdownItem[] = []
    for (let i = 0; i < filteredTypes.length; i++) {
      const item = filteredTypes[i]
      if (item.text === 'SEPARATOR') {
        const hasBefore =
          dropdownItems.length > 0 &&
          dropdownItems[dropdownItems.length - 1].text !== 'SEPARATOR'
        const hasAfter = filteredTypes
          .slice(i + 1)
          .some(x => x.text !== 'SEPARATOR')
        if (hasBefore && hasAfter) {
          dropdownItems.push({
            ...item,
            id: 'separator-' + i,
          } as any)
        }
      } else {
        dropdownItems.push({
          ...item,
          id: item.type!,
        } as any)
      }
    }

    const activeType =
      selectedType && _.some(handlers, {type: selectedType})
        ? selectedType
        : handlers.length > 0
        ? handlers[0].type
        : null

    const selectedHandler = _.find(handlers, {type: activeType})

    const dropdownLabel = handlers.length
      ? t('alert_group_basic.add_another_handler', 'Add another Handler')
      : t('alert_group_basic.add_a_handler', 'Add a Handler')

    const ruleSectionClassName = handlers.length
      ? 'rule-section--row rule-section--row-first rule-section--border-bottom'
      : 'rule-section--row rule-section--row-first rule-section--row-last'

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">
          {t('alert_group_basic.alert_handlers', 'Alert Handlers')}
        </h3>
        <div className="rule-section--body">
          <div className={ruleSectionClassName}>
            <p>
              {t('alert_group_basic.send_this_alert_to', 'Send this Alert to:')}
            </p>
            <Dropdown
              items={dropdownItems}
              menuClass="dropdown-malachite"
              selected={dropdownLabel}
              onChoose={this.handleAddHandlerFromDropdown}
              className="dropdown-170 rule-message--add-endpoint"
              disabled={dropdownItems.length === 0}
            />
          </div>

          {handlers.length > 0 && (
            <div className="rule-message--endpoints">
              <ul className="endpoint-tabs">
                {handlers.map(h => {
                  const isActive = h.type === activeType
                  return (
                    <li
                      key={h.type}
                      className={classnames('endpoint-tab', {
                        active: isActive,
                      })}
                      onClick={this.handleSelectTab(h.type)}
                    >
                      {h.type === 'webhook' ? 'post' : h.type}
                      <button
                        className="endpoint-tab--delete"
                        onClick={this.handleRemoveHandler(h.type)}
                      />
                    </li>
                  )
                })}
              </ul>

              {selectedHandler && (
                <div className="endpoint-tab-contents endpoint-tab-contents--alert-group">
                  {selectedHandler.type === 'email' && (
                    <EmailHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      userGroups={userGroups}
                      smtpConfig={smtpConfig}
                      loadingSmtp={loadingSmtp}
                      isSmtpConfigured={isSmtpConfigured}
                      kapacitorId={kapacitorId}
                      isTestingSend={isTestingSend}
                      t={t}
                      onGoToConfig={this.handleGoToConfig}
                      onUpdateRule={this.props.onUpdateRule}
                      onOpenTestModal={onOpenTestModal}
                    />
                  )}

                  {selectedHandler.type === 'webhook' && (
                    <WebhookHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      t={t}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}

                  {selectedHandler.type === 'tcp' && (
                    <TcpHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      t={t}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}

                  {selectedHandler.type === 'exec' && (
                    <ExecHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      t={t}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}

                  {selectedHandler.type === 'log' && (
                    <LogHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      t={t}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}

                  {selectedHandler.type === 'slack' && (
                    <SlackHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      loadingSlack={loadingSlack}
                      isSlackConfigured={isSlackConfigured}
                      t={t}
                      onGoToConfig={this.handleGoToConfig}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}

                  {selectedHandler.type === 'kafka' && (
                    <KafkaHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      loadingKafka={loadingKafka}
                      isKafkaConfigured={isKafkaConfigured}
                      t={t}
                      onGoToConfig={this.handleGoToConfig}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}

                  {selectedHandler.type === 'telegram' && (
                    <TelegramHandler
                      rule={rule}
                      selectedHandler={selectedHandler}
                      loadingTelegram={loadingTelegram}
                      isTelegramConfigured={isTelegramConfigured}
                      t={t}
                      onGoToConfig={this.handleGoToConfig}
                      onUpdateRule={this.props.onUpdateRule}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

export default withTranslation()(AlertGroupHandlersSectionView)
