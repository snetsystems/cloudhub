// frontend/src/alert_group/components/AlertGroupHandlersSection.tsx
import React, {PureComponent, ChangeEvent} from 'react'
import _ from 'lodash'
import classnames from 'classnames'
import {withTranslation, WithTranslation} from 'react-i18next'
import {
  MultiSelectDropdown,
  DropdownMenuColors,
  ComponentColor,
  ComponentSize,
  Radio,
  ButtonShape,
  Button,
  ComponentStatus,
  IconFont,
  Input,
  InputType,
} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import EmailBodyPreview from 'src/alert_group/components/EmailBodyPreview'
import {
  AlertGroupRule,
  AlertRuleEventHandler,
  UserGroup,
  UserGroupMember,
} from 'src/alert_group/types'
import {getActiveKapacitor, getKapacitorConfig} from 'src/shared/apis/index'
import CodeData from 'src/kapacitor/components/CodeData'
import {RULE_MESSAGE_TEMPLATES} from 'src/kapacitor/constants'
import ReactTooltip from 'react-tooltip'
import {Source, DropdownItem} from 'src/types'
import {InjectedRouter} from 'react-router'

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
  receiveMode: 'all' | 'specific'
  emailBodyView: 'edit' | 'preview'
}

class AlertGroupHandlersSectionView extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    const recipientGroupIds = props.rule.recipientGroupIds || []

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
      receiveMode: recipientGroupIds.length > 0 ? 'specific' : 'all',
      emailBodyView: 'edit',
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

  public componentDidUpdate(prevProps: Props) {
    // Synchronize state when recipient group information changes due to parent rule update or external template selection.
    if (this.props.rule !== prevProps.rule) {
      const recipientGroupIds = this.props.rule.recipientGroupIds || []
      const nextReceiveMode = recipientGroupIds.length > 0 ? 'specific' : 'all'
      if (nextReceiveMode !== this.state.receiveMode) {
        this.setState({receiveMode: nextReceiveMode})
      }
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

  private handleReceiveModeChange = (mode: 'all' | 'specific'): void => {
    this.setState({receiveMode: mode})
    if (mode === 'all') {
      this.props.onUpdateRule({recipientGroupIds: []})
    }
  }

  private handleUserGroupDropdownChange = (selectedIDs: string[]): void => {
    this.props.onUpdateRule({recipientGroupIds: selectedIDs})
  }

  private getMatchedMembers(): UserGroupMember[] {
    const {rule, userGroups} = this.props
    const {receiveMode} = this.state
    const recipientGroupIds = rule.recipientGroupIds || []

    let matchedGroups: UserGroup[] = []

    if (receiveMode === 'all') {
      matchedGroups = userGroups
    } else {
      const selected = new Set(recipientGroupIds)
      matchedGroups = userGroups.filter(ug => ug.id && selected.has(ug.id))
    }

    const members: UserGroupMember[] = []
    matchedGroups.forEach(ug => {
      if (ug.members) {
        members.push(...ug.members)
      }
    })

    // Remove duplicate users
    return _.uniqBy(members, 'userId')
  }

  private renderMatchedUserPanel(): JSX.Element {
    const {userGroups} = this.props
    const {t} = this.props

    if (!userGroups || userGroups.length === 0) {
      return (
        <span className="alert-group-empty-text">
          {t(
            'alert_group_basic.calculating_recipients',
            '수신 대상자를 계산 중입니다...'
          )}
        </span>
      )
    }

    const matchedMembers = this.getMatchedMembers()

    if (matchedMembers.length === 0) {
      return (
        <span className="alert-group-empty-text">
          {this.state.receiveMode === 'all'
            ? t(
                'alert_group_basic.no_receivable_groups',
                '수신 가능한 그룹이 없습니다.'
              )
            : t(
                'alert_group_basic.no_selected_groups_or_members',
                '선택된 그룹이 없거나 멤버가 없습니다.'
              )}
        </span>
      )
    }

    return (
      <div className="alert-group-receive-user-list">
        {matchedMembers.map(m => (
          <div key={m.userId} className="alert-group-receive-user-list--row">
            <span className="alert-group-receive-user-list--name">
              {m.userName}
            </span>
            <span className="alert-group-receive-user-list--email">
              {m.email || '—'} ({t('group_management.email', '이메일')}:{' '}
              {m.emailLevel})
            </span>
          </div>
        ))}
      </div>
    )
  }

  private handleMailTitleChange = (
    e: ChangeEvent<HTMLTextAreaElement>
  ): void => {
    this.props.onUpdateRule({message: e.target.value})
  }

  private handleClickMailTitleTemplate = (template: string) => (): void => {
    const currentMessage = this.props.rule.message || ''
    const nextMessage = currentMessage
      ? `${currentMessage} ${template}`
      : template
    this.props.onUpdateRule({message: nextMessage})
  }

  private handleEmailBodyViewChange = (mode: 'edit' | 'preview'): void => {
    this.setState({emailBodyView: mode})
  }
  private get emailBodyPreviewMock(): {
    level: string
    message: string
    host: string
    time: string
    id: string
  } {
    const {t, rule} = this.props
    const level = t('alert_group_basic.preview_level', 'CRITICAL')
    const host = t('alert_group_basic.preview_host', 'example-host-01')
    const message =
      rule?.message ||
      t(
        'alert_group_basic.preview_message',
        '{{host}} {{level}} 예시 알림 메시지'
      )
        .replace('{{host}}', host)
        .replace('{{level}}', level)
    return {
      level,
      message,
      host,
      time: new Date().toISOString(),
      id: 'alert-group-preview-example',
    }
  }

  private handleEmailBodyChange = (
    e: ChangeEvent<HTMLTextAreaElement>
  ): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const body = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'email') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            body,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleConfigChange = (
    type: AlertRuleEventHandler['type'],
    key: string
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const value = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === type) {
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
      receiveMode,
      loadingSmtp,
      isSmtpConfigured,

      loadingSlack,
      isSlackConfigured,

      loadingKafka,
      isKafkaConfigured,

      loadingTelegram,
      isTelegramConfigured,
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

    const hasEmptyHeaderKey =
      selectedHandler?.type === 'webhook' &&
      Object.keys(
        (selectedHandler.configJson?.headers as Record<string, string>) || {}
      ).some(key => !key)

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
                    <>
                      {/* Loading state */}
                      {loadingSmtp && (
                        <div className="alert-group-loading-smtp">
                          {t(
                            'alert_group_basic.loading_smtp_config',
                            'SMTP 설정을 확인 중입니다...'
                          )}
                        </div>
                      )}

                      {/* Case 1: SMTP is NOT configured (Show ONLY the callout banner) */}
                      {!loadingSmtp && !isSmtpConfigured && (
                        <div className="endpoint-tab--parameters">
                          <div className="alert-group-delivery-callout alert-group-delivery-callout--compact alert-group-handler-callout">
                            <h4 className="alert-group-delivery-callout__title alert-group-handler-callout-title">
                              {t(
                                'alert_group_basic.smtp_not_configured_title',
                                'SMTP 설정 필요'
                              )}
                            </h4>
                            <p className="alert-group-delivery-callout__body">
                              {t(
                                'alert_group_basic.smtp_not_configured_body',
                                '이메일 알림을 발송하려면 Kapacitor에 SMTP가 등록되어 있어야 합니다. 현재 SMTP 설정이 완료되지 않았습니다.'
                              )}
                            </p>
                            <button
                              type="button"
                              className="btn btn-warning btn-sm alert-group-handler-callout-btn"
                              onClick={this.handleGoToConfig}
                            >
                              <span className="icon cog-thick alert-group-handler-callout-icon" />
                              {t(
                                'alert_group_basic.go_to_smtp_config',
                                'SMTP 설정 화면으로 이동'
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Case 2: SMTP is configured (Show SMTP configuration, Recipient User Groups, parameters form and Test send button) */}
                      {!loadingSmtp && isSmtpConfigured && (
                        <>
                          {/* Email handler detail configuration (SMTP) */}
                          <div className="endpoint-tab--parameters">
                            <h4 className="u-flex u-jc-space-between">
                              {t(
                                'alert_group_basic.smtp_parameters_title',
                                'Parameters from Kapacitor Configuration'
                              )}
                              <div
                                className="btn btn-default btn-sm"
                                onClick={this.handleGoToConfig}
                              >
                                <span className="icon cog-thick" />
                                {t(
                                  'alert_group_basic.edit_smtp_config',
                                  'Edit SMTP Configuration'
                                )}
                              </div>
                            </h4>
                            <div className="faux-form">
                              <div className="form-group col-md-4">
                                <label htmlFor="smtp-from">
                                  {t(
                                    'alert_group_basic.smtp_from',
                                    'From E-mail'
                                  )}
                                </label>
                                <input
                                  id="smtp-from"
                                  type="text"
                                  className="form-control input-sm form-malachite"
                                  value={smtpConfig.from}
                                  disabled
                                />
                              </div>
                              <div className="form-group col-md-4">
                                <label htmlFor="smtp-host">
                                  {t(
                                    'alert_group_basic.smtp_host',
                                    'SMTP Host'
                                  )}
                                </label>
                                <input
                                  id="smtp-host"
                                  type="text"
                                  className="form-control input-sm form-malachite"
                                  value={smtpConfig.host}
                                  disabled
                                />
                              </div>
                              <div className="form-group col-md-4">
                                <label htmlFor="smtp-port">
                                  {t(
                                    'alert_group_basic.smtp_port',
                                    'SMTP Port'
                                  )}
                                </label>
                                <input
                                  id="smtp-port"
                                  type="text"
                                  className="form-control input-sm form-malachite"
                                  value={smtpConfig.port}
                                  disabled
                                />
                              </div>
                            </div>
                          </div>

                          {/* Select recipient groups */}
                          <div className="endpoint-tab--parameters">
                            <h4>
                              {t(
                                'alert_group_basic.recipient_user_groups',
                                'Recipient User Groups'
                              )}
                            </h4>
                            <div className="alert-group-receive-panel-card">
                              <div className="alert-group-receive-panel-card__fields">
                                <div className="alert-group-receive-panel-card__field">
                                  <span className="alert-group-receive-panel-card__label">
                                    {t(
                                      'alert_group_basic.receipt_mode',
                                      '수신 모드'
                                    )}
                                  </span>
                                  <div className="alert-group-receive-panel-card__control">
                                    <Radio shape={ButtonShape.Default}>
                                      <Radio.Button
                                        id="receive-mode-all"
                                        value="all"
                                        active={receiveMode === 'all'}
                                        onClick={this.handleReceiveModeChange}
                                      >
                                        {t(
                                          'alert_group_basic.receive_all',
                                          '전체 수신'
                                        )}
                                      </Radio.Button>
                                      <Radio.Button
                                        id="receive-mode-groups"
                                        value="specific"
                                        active={receiveMode === 'specific'}
                                        onClick={this.handleReceiveModeChange}
                                      >
                                        {t(
                                          'alert_group_basic.receive_specific_groups',
                                          '특정 그룹 수신'
                                        )}
                                      </Radio.Button>
                                    </Radio>
                                  </div>
                                </div>
                                {receiveMode === 'specific' && (
                                  <div className="alert-group-receive-panel-card__field">
                                    <span className="alert-group-receive-panel-card__label">
                                      {t(
                                        'alert_group_basic.receipt_groups',
                                        '수신 그룹'
                                      )}
                                    </span>
                                    <div className="alert-group-receive-panel-card__control">
                                      {userGroups.length > 0 ? (
                                        <MultiSelectDropdown
                                          selectedIDs={
                                            rule.recipientGroupIds || []
                                          }
                                          onChange={
                                            this.handleUserGroupDropdownChange
                                          }
                                          buttonColor={ComponentColor.Default}
                                          buttonSize={ComponentSize.Small}
                                          menuColor={DropdownMenuColors.Onyx}
                                          emptyText={t(
                                            'alert_group_basic.select_group',
                                            '그룹 선택'
                                          )}
                                        >
                                          {userGroups.map(ug => (
                                            <MultiSelectDropdown.Item
                                              key={ug.id!}
                                              id={ug.id!}
                                              value={ug}
                                            >
                                              {ug.name}
                                            </MultiSelectDropdown.Item>
                                          ))}
                                        </MultiSelectDropdown>
                                      ) : (
                                        <div className="alert-group-tags-empty-hint">
                                          {t(
                                            'alert_group_basic.no_registered_receipt_groups',
                                            '등록된 수신 그룹이 없습니다.'
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="alert-group-receive-panel-card__preview">
                                <div className="alert-group-receive-user-header">
                                  <p className="alert-group-receive-user-title">
                                    {t(
                                      'alert_group_basic.receipt_users_preview',
                                      '수신 대상 사용자 프리뷰'
                                    )}
                                    <span className="alert-group-receive-user-count">
                                      ({this.getMatchedMembers().length})
                                    </span>
                                  </p>
                                  <p className="alert-group-receive-user-hint">
                                    {receiveMode === 'all'
                                      ? t(
                                          'alert_group_basic.all_groups_will_receive',
                                          '모든 그룹의 사용자가 수신하게 됩니다.'
                                        )
                                      : t(
                                          'alert_group_basic.selected_groups_will_receive',
                                          '선택한 그룹의 사용자만 수신하게 됩니다.'
                                        )}
                                  </p>
                                </div>
                                {this.renderMatchedUserPanel()}
                              </div>
                            </div>
                          </div>

                          {/* Email handler parameters (E-mail Addresses, Mail Title, Templates, Body in order) */}
                          <div className="endpoint-tab--parameters">
                            <h4>
                              {t(
                                'alert_group_basic.parameters_for_this_handler',
                                'Parameters for this Alert Handler'
                              )}
                            </h4>
                            <div className="faux-form">
                              {/* Mail Title textarea field (bound to rule.message, changed to textarea) */}
                              <div className="form-group col-md-12">
                                <label htmlFor="mail-title">
                                  {t(
                                    'alert_group_basic.mail_title',
                                    'Mail Title'
                                  )}
                                </label>
                                <textarea
                                  id="mail-title"
                                  className="form-control form-malachite alert-group-mail-title-textarea"
                                  placeholder={t(
                                    'alert_group_basic.mail_title_placeholder',
                                    '메일 타이틀을 입력하세요'
                                  )}
                                  value={rule.message || ''}
                                  onChange={this.handleMailTitleChange}
                                  spellCheck={false}
                                />
                              </div>

                              {/* Templates chips area (placed right below Mail Title) */}
                              <div className="form-group col-md-12">
                                <label>
                                  {t(
                                    'alert_group_basic.templates_label',
                                    'Templates:'
                                  )}
                                </label>
                                <div className="alert-group-template-chips">
                                  {_.map(
                                    RULE_MESSAGE_TEMPLATES,
                                    (template, key) => {
                                      return (
                                        <CodeData
                                          key={key}
                                          template={template}
                                          onClickTemplate={this.handleClickMailTitleTemplate(
                                            template.label
                                          )}
                                        />
                                      )
                                    }
                                  )}
                                  <ReactTooltip
                                    effect="solid"
                                    html={true}
                                    class="influx-tooltip kapacitor-tooltip"
                                  />
                                </div>
                              </div>

                              <div className="form-group col-md-12">
                                <div className="alert-group-email-body-header">
                                  <label htmlFor="email-body">
                                    {t(
                                      'alert_group_basic.email_body',
                                      'Email Message Body'
                                    )}
                                  </label>
                                  <Radio shape={ButtonShape.Default}>
                                    <Radio.Button
                                      id="email-body-view-edit"
                                      value="edit"
                                      active={
                                        this.state.emailBodyView === 'edit'
                                      }
                                      onClick={this.handleEmailBodyViewChange}
                                    >
                                      {t(
                                        'alert_group_basic.email_body_edit',
                                        '편집'
                                      )}
                                    </Radio.Button>
                                    <Radio.Button
                                      id="email-body-view-preview"
                                      value="preview"
                                      active={
                                        this.state.emailBodyView === 'preview'
                                      }
                                      onClick={this.handleEmailBodyViewChange}
                                    >
                                      {t(
                                        'alert_group_basic.email_body_preview',
                                        '미리보기'
                                      )}
                                    </Radio.Button>
                                  </Radio>
                                </div>

                                <textarea
                                  id="email-body"
                                  className="form-control form-malachite alert-group-email-body-textarea"
                                  placeholder={t(
                                    'alert_group_basic.email_body_placeholder',
                                    'Enter the body for your email here. Can contain html'
                                  )}
                                  value={
                                    (selectedHandler.configJson
                                      ?.body as string) || ''
                                  }
                                  onChange={this.handleEmailBodyChange}
                                  spellCheck={false}
                                  style={{
                                    display:
                                      this.state.emailBodyView === 'edit'
                                        ? undefined
                                        : 'none',
                                  }}
                                />
                                {this.state.emailBodyView === 'preview' && (
                                  <EmailBodyPreview
                                    className="alert-group-email-body-preview"
                                    html={
                                      (selectedHandler.configJson
                                        ?.body as string) || ''
                                    }
                                    mock={this.emailBodyPreviewMock}
                                  />
                                )}
                              </div>

                              {/* 수신 테스트 (이메일 섹션 가장 하단에 배치) */}
                              <div className="form-group col-md-12 alert-group-test-send-group">
                                <label>
                                  {t(
                                    'alert_group_basic.test_receipt',
                                    '수신 테스트 '
                                  )}
                                </label>
                                <div className="alert-group-test-send-block">
                                  <Button
                                    text={
                                      isTestingSend
                                        ? t(
                                            'alert_group_basic.sending',
                                            '발송 중...'
                                          )
                                        : t(
                                            'alert_group_basic.test_receipt',
                                            '수신 테스트 '
                                          )
                                    }
                                    icon={IconFont.Bell}
                                    onClick={onOpenTestModal}
                                    color={ComponentColor.Success}
                                    size={ComponentSize.Small}
                                    status={
                                      !rule.kapacitorId || isTestingSend
                                        ? ComponentStatus.Disabled
                                        : ComponentStatus.Default
                                    }
                                  />
                                  <span className="alert-group-test-send-block__hint">
                                    {t(
                                      'alert_group_basic.test_receipt_hint',
                                      '현재 설정된 수신 대상자에게 테스트 알림을 발송합니다.'
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {selectedHandler.type === 'webhook' && (
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
                            onChange={this.handleConfigChange('webhook', 'url')}
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
                            {Object.entries(
                              (selectedHandler.configJson?.headers as Record<
                                string,
                                string
                              >) || {}
                            ).map(([key, val], idx) => (
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
                            {Object.keys(
                              (selectedHandler.configJson?.headers as Record<
                                string,
                                string
                              >) || {}
                            ).length === 0 && (
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
                  )}

                  {selectedHandler.type === 'tcp' && (
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
                            onChange={this.handleConfigChange('tcp', 'address')}
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedHandler.type === 'exec' && (
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
                  )}

                  {selectedHandler.type === 'log' && (
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
                              (selectedHandler.configJson
                                ?.filePath as string) || ''
                            }
                            onChange={this.handleConfigChange(
                              'log',
                              'filePath'
                            )}
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedHandler.type === 'slack' && (
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
                              onClick={() => this.handleGoToConfig('#slack')}
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
                              onClick={() => this.handleGoToConfig('#slack')}
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
                                  (selectedHandler.configJson
                                    ?.workspace as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'slack',
                                  'workspace'
                                )}
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
                                  (selectedHandler.configJson
                                    ?.channel as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'slack',
                                  'channel'
                                )}
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
                                  (selectedHandler.configJson
                                    ?.username as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'slack',
                                  'username'
                                )}
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
                                  (selectedHandler.configJson
                                    ?.iconEmoji as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'slack',
                                  'iconEmoji'
                                )}
                                spellCheck={false}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {selectedHandler.type === 'kafka' && (
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
                              onClick={() => this.handleGoToConfig('#kafka')}
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
                              onClick={() => this.handleGoToConfig('#kafka')}
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
                                  (selectedHandler.configJson
                                    ?.cluster as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'kafka',
                                  'cluster'
                                )}
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
                                  (selectedHandler.configJson?.[
                                    'kafka-topic'
                                  ] as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'kafka',
                                  'kafka-topic'
                                )}
                                spellCheck={false}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {selectedHandler.type === 'telegram' && (
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
                              onClick={() => this.handleGoToConfig('#telegram')}
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
                              onClick={() => this.handleGoToConfig('#telegram')}
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
                                )}{' '}
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
                                  (selectedHandler.configJson
                                    ?.chatId as string) || ''
                                }
                                onChange={this.handleConfigChange(
                                  'telegram',
                                  'chatId'
                                )}
                                spellCheck={false}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
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
