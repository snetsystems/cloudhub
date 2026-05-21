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
} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'
import {AlertGroupRule, AlertRuleEventHandler, UserGroup, UserGroupMember} from 'src/alert_group/types'
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
  kapacitorId: string | null
  receiveMode: 'all' | 'specific'
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
      kapacitorId: null,
      receiveMode: recipientGroupIds.length > 0 ? 'specific' : 'all',
    }
  }

  public async componentDidMount() {
    const {rule, onUpdateRule, source} = this.props
    // If eventHandlers is absent or empty on initial render, create a default email handler.
    if (!rule.eventHandlers || rule.eventHandlers.length === 0) {
      const defaultEmailHandler: AlertRuleEventHandler = {
        type: 'email',
        enabled: true,
        recipientGroupIds: [],
        configJson: {to: [], body: ''},
      }
      onUpdateRule({eventHandlers: [defaultEmailHandler]})
      this.setState({selectedType: 'email'})
    } else {
      this.setState({selectedType: rule.eventHandlers[0].type})
    }

    // Query SMTP Config (path corrected to match Kapacitor API spec precisely)
    try {
      const kapacitor = await getActiveKapacitor(source)
      if (kapacitor) {
        const response = await getKapacitorConfig(kapacitor)
        const sections = response?.data?.sections
        const smtpElement = sections?.smtp?.elements?.[0]
        const smtpSection = smtpElement?.options
        const from = smtpSection?.from || 'alert@example.com'
        const host = smtpSection?.host || 'smtp.example.com'
        const port = smtpSection?.port || '587'
        this.setState({
          smtpConfig: {from, host, port: String(port)},
          kapacitorId: kapacitor.id,
          loadingSmtp: false,
        })
      } else {
        this.setState({loadingSmtp: false})
      }
    } catch (e) {
      console.error('Failed to load SMTP configuration from Kapacitor', e)
      this.setState({loadingSmtp: false})
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

  private handleAddHandler = (item: {type: AlertRuleEventHandler['type']}): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []

    if (_.some(handlers, {type: item.type})) {
      return
    }

    const newHandler: AlertRuleEventHandler = {
      type: item.type,
      enabled: true,
      recipientGroupIds: [],
      configJson:
        item.type === 'webhook'
          ? {url: ''}
          : item.type === 'email'
          ? {to: [], body: ''}
          : {},
    }

    onUpdateRule({eventHandlers: [...handlers, newHandler]})
    this.setState({selectedType: item.type})
  }

  private handleAddHandlerFromDropdown = (item: DropdownItem): void => {
    const handlerItem = item as {type: AlertRuleEventHandler['type']; text: string}
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

    const activeType = this.state.selectedType && _.some(nextHandlers, {type: this.state.selectedType})
      ? this.state.selectedType
      : (nextHandlers.length > 0 ? nextHandlers[0].type : null)

    this.setState({selectedType: activeType})
  }

  private handleSelectTab = (type: AlertRuleEventHandler['type']) => (): void => {
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
          {t('alert_group_basic.calculating_recipients', '수신 대상자를 계산 중입니다...')}
        </span>
      )
    }

    const matchedMembers = this.getMatchedMembers()

    if (matchedMembers.length === 0) {
      return (
        <span className="alert-group-empty-text">
          {this.state.receiveMode === 'all'
            ? t('alert_group_basic.no_receivable_groups', '수신 가능한 그룹이 없습니다.')
            : t('alert_group_basic.no_selected_groups_or_members', '선택된 그룹이 없거나 멤버가 없습니다.')}
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
              {m.email || '—'} ({t('group_management.email', '이메일')}: {m.emailLevel})
            </span>
          </div>
        ))}
      </div>
    )
  }

  private handleWebhookUrlChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const url = e.target.value

    const nextHandlers = handlers.map(h => {
      if (h.type === 'webhook') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            url,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleRecipientEmailsChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const {rule, onUpdateRule} = this.props
    const handlers = rule.eventHandlers || []
    const rawTo = e.target.value
    const toArray = _.split(rawTo, ' ')

    const nextHandlers = handlers.map(h => {
      if (h.type === 'email') {
        return {
          ...h,
          configJson: {
            ...h.configJson,
            to: toArray,
          },
        }
      }
      return h
    })

    onUpdateRule({eventHandlers: nextHandlers})
  }

  private handleMailTitleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    this.props.onUpdateRule({message: e.target.value})
  }

  private handleClickMailTitleTemplate = (template: string) => (): void => {
    const currentMessage = this.props.rule.message || ''
    const nextMessage = currentMessage ? `${currentMessage} ${template}` : template
    this.props.onUpdateRule({message: nextMessage})
  }

  private handleEmailBodyChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
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

  private handleGoToConfig = (): void => {
    const {source, router} = this.props
    const {kapacitorId} = this.state
    if (kapacitorId) {
      router.push(`/sources/${source.id}/kapacitors/${kapacitorId}/edit#smtp`)
    } else {
      router.push(`/sources/${source.id}/alert-rules`)
    }
  }

  public render() {
    const {rule, userGroups, t} = this.props
    const {selectedType, smtpConfig, receiveMode} = this.state
    const handlers = rule.eventHandlers || []

    const availableTypes: {type: AlertRuleEventHandler['type']; text: string}[] = [
      {type: 'email', text: 'email'},
      {type: 'sms', text: 'sms'},
      {type: 'webhook', text: 'webhook'},
    ]

    const dropdownItems = availableTypes
      .filter(item => !_.some(handlers, {type: item.type}))
      .map(item => ({
        ...item,
        text: item.text,
      }))

    const activeType = selectedType && _.some(handlers, {type: selectedType})
      ? selectedType
      : (handlers.length > 0 ? handlers[0].type : null)

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
            <p>{t('alert_group_basic.send_this_alert_to', 'Send this Alert to:')}</p>
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
                      {h.type}
                      <button
                        className="endpoint-tab--delete"
                        onClick={this.handleRemoveHandler(h.type)}
                      />
                    </li>
                  )
                })}
              </ul>

              {selectedHandler && (
                <div className="endpoint-tab-contents">
                  {/* Email handler detail configuration (SMTP) */}
                  {selectedHandler.type === 'email' && (
                    <div className="endpoint-tab--parameters">
                      <h4 className="u-flex u-jc-space-between">
                        {t('alert_group_basic.smtp_parameters_title', 'Parameters from Kapacitor Configuration')}
                        <div className="btn btn-default btn-sm" onClick={this.handleGoToConfig}>
                          <span className="icon cog-thick" />
                          {t('alert_group_basic.edit_smtp_config', 'Edit SMTP Configuration')}
                        </div>
                      </h4>
                      <div className="faux-form">
                        <div className="form-group col-md-4">
                          <label htmlFor="smtp-from">{t('alert_group_basic.smtp_from', 'From E-mail')}</label>
                          <input
                            id="smtp-from"
                            type="text"
                            className="form-control input-sm form-malachite"
                            value={smtpConfig.from}
                            disabled
                          />
                        </div>
                        <div className="form-group col-md-4">
                          <label htmlFor="smtp-host">{t('alert_group_basic.smtp_host', 'SMTP Host')}</label>
                          <input
                            id="smtp-host"
                            type="text"
                            className="form-control input-sm form-malachite"
                            value={smtpConfig.host}
                            disabled
                          />
                        </div>
                        <div className="form-group col-md-4">
                          <label htmlFor="smtp-port">{t('alert_group_basic.smtp_port', 'SMTP Port')}</label>
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
                  )}

                  {/* Select recipient groups (migrated basic section group card directly below SMTP settings) */}
                  <div className="endpoint-tab--parameters">
                    <h4>{t('alert_group_basic.recipient_user_groups', 'Recipient User Groups')}</h4>
                    <div className="alert-group-receive-panel-card">
                      <div className="alert-group-receive-panel-card__fields">
                        <div className="alert-group-receive-panel-card__field">
                          <span className="alert-group-receive-panel-card__label">
                            {t('alert_group_basic.receipt_mode', '수신 모드')}
                          </span>
                          <div className="alert-group-receive-panel-card__control">
                            <Radio shape={ButtonShape.Default}>
                              <Radio.Button
                                id="receive-mode-all"
                                value="all"
                                active={receiveMode === 'all'}
                                onClick={this.handleReceiveModeChange}
                              >
                                {t('alert_group_basic.receive_all', '전체 수신')}
                              </Radio.Button>
                              <Radio.Button
                                id="receive-mode-groups"
                                value="specific"
                                active={receiveMode === 'specific'}
                                onClick={this.handleReceiveModeChange}
                              >
                                {t('alert_group_basic.receive_specific_groups', '특정 그룹 수신')}
                              </Radio.Button>
                            </Radio>
                          </div>
                        </div>
                        {receiveMode === 'specific' && (
                          <div className="alert-group-receive-panel-card__field">
                            <span className="alert-group-receive-panel-card__label">
                              {t('alert_group_basic.receipt_groups', '수신 그룹')}
                            </span>
                            <div className="alert-group-receive-panel-card__control">
                              {userGroups.length > 0 ? (
                                <MultiSelectDropdown
                                  selectedIDs={rule.recipientGroupIds || []}
                                  onChange={this.handleUserGroupDropdownChange}
                                  buttonColor={ComponentColor.Default}
                                  buttonSize={ComponentSize.Small}
                                  menuColor={DropdownMenuColors.Onyx}
                                  emptyText={t('alert_group_basic.select_group', '그룹 선택')}
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
                                  {t('alert_group_basic.no_registered_receipt_groups', '등록된 수신 그룹이 없습니다.')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="alert-group-receive-panel-card__preview">
                        <div className="alert-group-receive-user-header">
                          <p className="alert-group-receive-user-title">
                            {t('alert_group_basic.receipt_users_preview', '수신 대상 사용자 프리뷰')}
                            <span className="alert-group-receive-user-count">
                              ({this.getMatchedMembers().length})
                            </span>
                          </p>
                          <p className="alert-group-receive-user-hint">
                            {receiveMode === 'all'
                              ? t('alert_group_basic.all_groups_will_receive', '모든 그룹의 사용자가 수신하게 됩니다.')
                              : t('alert_group_basic.selected_groups_will_receive', '선택한 그룹의 사용자만 수신하게 됩니다.')}
                          </p>
                        </div>
                        {this.renderMatchedUserPanel()}
                      </div>
                    </div>
                  </div>

                  {/* Email handler parameters (E-mail Addresses, Mail Title, Templates, Body in order) */}
                  {selectedHandler.type === 'email' && (
                    <div className="endpoint-tab--parameters">
                      <h4>{t('alert_group_basic.parameters_for_this_handler', 'Parameters for this Alert Handler')}</h4>
                      <div className="faux-form">
                        <div className="form-group col-md-12">
                          <label htmlFor="email-recipients">
                            {t('alert_group_basic.recipient_emails', 'Recipient E-mail Addresses: (separated by spaces) (Optional)')}
                          </label>
                          <input
                            id="email-recipients"
                            type="text"
                            className="form-control input-sm form-malachite"
                            placeholder={t('alert_group_basic.recipient_emails_placeholder', 'ex: bob@domain.com susan@domain.com')}
                            value={((selectedHandler.configJson?.to as string[]) || []).join(' ')}
                            onChange={this.handleRecipientEmailsChange}
                            autoComplete="off"
                            spellCheck="false"
                          />
                        </div>

                        {/* Mail Title textarea field (bound to rule.message, changed to textarea) */}
                        <div className="form-group col-md-12">
                          <label htmlFor="mail-title">
                            {t('alert_group_basic.mail_title', 'Mail Title')}
                          </label>
                          <textarea
                            id="mail-title"
                            className="form-control form-malachite"
                            placeholder={t('alert_group_basic.mail_title_placeholder', '메일 타이틀을 입력하세요')}
                            value={rule.message || ''}
                            onChange={this.handleMailTitleChange}
                            spellCheck={false}
                            style={{width: '100%', height: '60px', minHeight: '60px', resize: 'vertical'}}
                          />
                        </div>

                        {/* Templates chips area (placed right below Mail Title) */}
                        <div className="form-group col-md-12">
                          <label>{t('alert_group_basic.templates_label', 'Templates:')}</label>
                          <div className="alert-group-template-chips">
                            {_.map(RULE_MESSAGE_TEMPLATES, (template, key) => {
                              return (
                                <CodeData
                                  key={key}
                                  template={template}
                                  onClickTemplate={this.handleClickMailTitleTemplate(
                                    template.label
                                  )}
                                />
                              )
                            })}
                            <ReactTooltip
                              effect="solid"
                              html={true}
                              class="influx-tooltip kapacitor-tooltip"
                            />
                          </div>
                        </div>

                        {/* Email Message Body text area (bound to configJson.body) */}
                        <div className="form-group col-md-12">
                          <label htmlFor="email-body">
                            {t('alert_group_basic.email_body', 'Email Message Body')}
                          </label>
                          <textarea
                            id="email-body"
                            className="form-control form-malachite alert-group-email-body-textarea"
                            placeholder={t('alert_group_basic.email_body_placeholder', 'Enter the body for your email here. Can contain html')}
                            value={(selectedHandler.configJson?.body as string) || ''}
                            onChange={this.handleEmailBodyChange}
                            spellCheck={false}
                            style={{width: '100%', height: '120px'}}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Webhook recipient settings */}
                  {selectedHandler.type === 'webhook' && (
                    <div className="endpoint-tab--parameters">
                      <h4>{t('alert_group_basic.webhook_parameters', 'Parameters for Webhook Handler')}</h4>
                      <div className="faux-form">
                        <div className="form-group col-md-12">
                          <label htmlFor="webhook-url">
                            {t('alert_group_basic.webhook_url', 'Webhook URL')}
                          </label>
                          <input
                            id="webhook-url"
                            type="text"
                            className="form-control input-sm form-malachite"
                            placeholder="https://example.com/webhook"
                            value={(selectedHandler.configJson?.url as string) || ''}
                            onChange={this.handleWebhookUrlChange}
                            autoComplete="off"
                            spellCheck="false"
                          />
                        </div>
                      </div>
                    </div>
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
