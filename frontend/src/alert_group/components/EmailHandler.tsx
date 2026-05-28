import React, {PureComponent, ChangeEvent} from 'react'
import _ from 'lodash'
import {TFunction} from 'react-i18next'
import {
  Radio,
  ButtonShape,
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  IconFont,
  MultiSelectDropdown,
  DropdownMenuColors,
} from 'src/reusable_ui'
import EmailBodyPreview from 'src/alert_group/components/EmailBodyPreview'
import CodeData from 'src/kapacitor/components/CodeData'
import {RULE_MESSAGE_TEMPLATES} from 'src/kapacitor/constants'
import ReactTooltip from 'react-tooltip'
import {
  AlertGroupRule,
  AlertRuleEventHandler,
  UserGroup,
  UserGroupMember,
} from 'src/alert_group/types'

export interface EmailHandlerProps {
  rule: AlertGroupRule
  selectedHandler: AlertRuleEventHandler
  userGroups: UserGroup[]
  smtpConfig: {
    from: string
    host: string
    port: string
  }
  loadingSmtp: boolean
  isSmtpConfigured: boolean
  kapacitorId: string | null
  isTestingSend: boolean
  t: TFunction
  onGoToConfig: (hash?: unknown) => void
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
  onOpenTestModal: () => void
}

interface State {
  receiveMode: 'all' | 'specific'
  emailBodyView: 'edit' | 'preview'
}

export default class EmailHandler extends PureComponent<EmailHandlerProps, State> {
  constructor(props: EmailHandlerProps) {
    super(props)
    const recipientGroupIds = props.rule.recipientGroupIds || []
    this.state = {
      receiveMode: recipientGroupIds.length > 0 ? 'specific' : 'all',
      emailBodyView: 'edit',
    }
  }

  public componentDidUpdate(prevProps: EmailHandlerProps) {
    if (this.props.rule.recipientGroupIds !== prevProps.rule.recipientGroupIds) {
      const recipientGroupIds = this.props.rule.recipientGroupIds || []
      const nextReceiveMode = recipientGroupIds.length > 0 ? 'specific' : 'all'
      if (nextReceiveMode !== this.state.receiveMode) {
        this.setState({receiveMode: nextReceiveMode})
      }
    }
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

    return _.uniqBy(members, 'userId')
  }

  private renderMatchedUserPanel(): JSX.Element {
    const {userGroups, t} = this.props

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

  public render() {
    const {
      rule,
      selectedHandler,
      userGroups,
      smtpConfig,
      loadingSmtp,
      isSmtpConfigured,
      kapacitorId,
      isTestingSend,
      t,
      onGoToConfig,
      onOpenTestModal,
    } = this.props
    const {receiveMode, emailBodyView} = this.state

    return (
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
                onClick={onGoToConfig}
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
                  onClick={onGoToConfig}
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

            {/* Email handler parameters */}
            <div className="endpoint-tab--parameters">
              <h4>
                {t(
                  'alert_group_basic.parameters_for_this_handler',
                  'Parameters for this Alert Handler'
                )}
              </h4>
              <div className="faux-form">
                {/* Mail Title textarea field */}
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

                {/* Templates chips area */}
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
                          emailBodyView === 'edit'
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
                          emailBodyView === 'preview'
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
                        emailBodyView === 'edit'
                          ? undefined
                          : 'none',
                    }}
                  />
                  {emailBodyView === 'preview' && (
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

                {/* 수신 테스트 */}
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
                        !kapacitorId || isTestingSend
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
    )
  }
}
