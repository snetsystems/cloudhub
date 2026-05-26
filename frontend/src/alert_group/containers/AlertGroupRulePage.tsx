// frontend/src/alert_group/containers/AlertGroupRulePage.tsx
import React, {PureComponent} from 'react'
import {withTranslation, WithTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {InjectedRouter} from 'react-router'
import {Location} from 'history'

// Types
import {
  Source,
  RemoteDataState,
  Notification,
  NotificationFunc,
  Me,
} from 'src/types'
import {TimeRange} from 'src/types'
import {
  AlertGroupRule,
  AlertTemplate,
  UserGroup,
  DEFAULT_RULE,
} from 'src/alert_group/types'

// Components
import {
  Page,
  Button,
  Spinner,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  IconFont,
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Input,
  InputType,
  MultiSelectDropdown,
  DropdownMenuColors,
  SlideToggle,
} from 'src/reusable_ui'
import AlertGroupTemplateSidebar from 'src/alert_group/components/AlertGroupTemplateSidebar'
import AlertGroupNameSection from 'src/alert_group/components/AlertGroupNameSection'
import AlertGroupConditionSection from 'src/alert_group/components/AlertGroupConditionSection'
import AlertGroupPreviewGraph from 'src/alert_group/components/AlertGroupPreviewGraph'
import AlertGroupTargetSection from 'src/alert_group/components/AlertGroupTargetSection'
import AlertGroupHandlersSection from 'src/alert_group/components/AlertGroupHandlersSection'
import {applyAlertTemplateToRule} from 'src/alert_group/utils/alertTemplates'

// APIs
import {
  getAlertGroupRule,
  createAlertGroupRule,
  updateAlertGroupRule,
  testDraftAlertGroupNotification,
  getUserGroups,
  getAlertTemplates,
  fetchAvailableMeasurements,
} from 'src/alert_group/apis'
import {getActiveKapacitor} from 'src/shared/apis'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Notifications
import {notifyError, notifySuccess} from 'src/shared/copy/notifications'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

const DEFAULT_TIME_RANGE: TimeRange = {lower: 'now() - 1h', upper: null}

interface Auth {
  me: Me
  isUsingAuth: boolean
}

interface Props extends WithTranslation {
  source: Source
  auth: Auth
  params: {id?: string}
  router: InjectedRouter
  location: Location
  notify: (message: Notification | NotificationFunc) => void
}

interface State {
  rule: AlertGroupRule
  savedRule: AlertGroupRule | null
  userGroups: UserGroup[]
  templates: AlertTemplate[]
  availableMeasurements: Set<string>
  loading: RemoteDataState
  isSaving: boolean
  isTestModalOpen: boolean
  isTestingSend: boolean
  testTitle: string
  testMessage: string
  testRecipients: string
  testIncludeSelf: boolean
  testUserGroupIds: string[]
  builderMode: 'template' | 'raw'
  selectedTemplateId: string
}

@ErrorHandling
class AlertGroupRulePage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      rule: DEFAULT_RULE,
      savedRule: null,
      userGroups: [],
      templates: [],
      availableMeasurements: new Set<string>(),
      loading: RemoteDataState.NotStarted,
      isSaving: false,
      isTestModalOpen: false,
      isTestingSend: false,
      testTitle: '',
      testMessage: '',
      testRecipients: '',
      testIncludeSelf: true,
      testUserGroupIds: [],
      builderMode: 'template',
      selectedTemplateId: 'custom',
    }
  }

  public async componentDidMount() {
    this.setState({loading: RemoteDataState.Loading})

    try {
      const ruleId = this.ruleId
      const isEdit = ruleId && ruleId !== 'new'

      const [
        userGroups,
        templates,
        availableMeasurements,
        activeKapacitor,
      ] = await Promise.all([
        getUserGroups(),
        getAlertTemplates().catch(() => [] as AlertTemplate[]),
        fetchAvailableMeasurements(this.props.source).catch(
          () => new Set<string>()
        ),
        getActiveKapacitor(this.props.source).catch(() => null),
      ])

      const activeKapacitorId = activeKapacitor?.id || ''

      if (isEdit) {
        const rule = await getAlertGroupRule(ruleId!)

        let builderMode: 'template' | 'raw' = 'raw'
        let selectedTemplateId = 'custom'

        const matchedTemplate = templates.find(
          t => t.measurement === rule.measurement && t.field === rule.field
        )
        if (matchedTemplate) {
          builderMode = 'template'
          selectedTemplateId = matchedTemplate.id
        }

        const ruleWithKapacitor = {
          ...rule,
          kapacitorId: rule.kapacitorId || activeKapacitorId,
        }

        this.setState({
          rule: ruleWithKapacitor,
          savedRule: ruleWithKapacitor,
          userGroups,
          templates,
          availableMeasurements,
          loading: RemoteDataState.Done,
          builderMode,
          selectedTemplateId,
        })
      } else {
        this.setState({
          rule: {...this.state.rule, kapacitorId: activeKapacitorId},
          savedRule: null,
          userGroups,
          templates,
          availableMeasurements,
          loading: RemoteDataState.Done,
        })
      }
    } catch (e) {
      this.setState({loading: RemoteDataState.Error})
      this.props.notify(notifyError('데이터를 불러오는 데 실패했습니다.'))
      const {source, router} = this.props
      if (source && source.id) {
        router.push(`/sources/${source.id}/server-monitoring/server-alert`)
      }
    }

    document.addEventListener('visibilitychange', this.handleVisibilityRefetch)
  }

  public componentWillUnmount(): void {
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityRefetch
    )
  }

  private handleVisibilityRefetch = async (): Promise<void> => {
    if (document.visibilityState === 'visible') {
      try {
        const userGroups = await getUserGroups()

        this.setState({
          userGroups,
        })
      } catch (e) {
        console.error('Failed to refetch reference data', e)
      }
    }
  }

  private get ruleId(): string | undefined {
    const {params, location} = this.props
    return params.id || (location as any).query?.id
  }

  private get isNew(): boolean {
    const ruleId = this.ruleId
    return !ruleId || ruleId === 'new'
  }

  private handleUpdateRule = (patch: Partial<AlertGroupRule>): void => {
    this.setState(prev => ({rule: {...prev.rule, ...patch}}))
  }

  private handleSelectTemplate = (templateId: string): void => {
    if (templateId === 'custom') {
      const prevName = this.state.rule.name
      this.setState({
        selectedTemplateId: 'custom',
        builderMode: 'raw', // 'New' default shows Query Builder (3-panel UI)
        rule: {
          ...JSON.parse(JSON.stringify(DEFAULT_RULE)),
          name: prevName,
          hostnames: [], // 누를때 마다 selected server 목록 초기화
        },
      })
      return
    }

    const template = this.state.templates.find(t => t.id === templateId)
    if (!template) {
      return
    }

    // Disabled templates (measurement not in source) should not apply.
    const {availableMeasurements} = this.state
    if (
      availableMeasurements.size > 0 &&
      !availableMeasurements.has(template.measurement)
    ) {
      this.props.notify(
        notifyError(
          `이 알람을 사용하려면 '${template.measurement}' 데이터 수집이 필요합니다.`
        )
      )
      return
    }

    // Apply the template as a complete blueprint — every persisted rule field
    // is overwritten so the user only has to set hostnames + recipient groups.
    // Name carries over from prior state only when the user has typed one.
    this.setState(prev => ({
      selectedTemplateId: template.id,
      builderMode: 'template',
      rule: applyAlertTemplateToRule(prev.rule, template),
    }))
  }

  private handleSwitchToRawMode = (): void => {
    this.setState({builderMode: 'raw'})
  }

  private handleSave = async (): Promise<void> => {
    const {source, router, notify, t} = this.props
    const {rule} = this.state

    // 필수 입력 및 정합성 검사
    if (!rule.name || !rule.name.trim()) {
      notify(notifyError('이벤트 그룹 규칙 이름을 입력해주세요.'))
      return
    }
    if (!rule.database) {
      notify(notifyError('데이터베이스를 선택해주세요.'))
      return
    }
    if (!rule.measurement) {
      notify(notifyError('측정 대상(Measurement)을 선택해주세요.'))
      return
    }
    if (!rule.field) {
      notify(notifyError('필드(Field)를 선택해주세요.'))
      return
    }

    // 임계값 필수값 정합성 검사 (활성화된 조건의 임계값 입력 여부 검사)
    if (Array.isArray(rule.conditions) && rule.trigger !== 'deadman') {
      for (const cond of rule.conditions) {
        if (cond.enabled) {
          const valStr =
            cond.value !== undefined && cond.value !== null
              ? String(cond.value).trim()
              : ''
          if (valStr === '') {
            const levelLabel =
              cond.level === 'critical'
                ? 'Critical'
                : cond.level === 'warning'
                ? 'Warning'
                : 'Info'
            notify(
              notifyError(
                t('alert_group_rule.threshold_required', {level: levelLabel})
              )
            )
            return
          }
        }
      }
    }

    if (Array.isArray(rule.eventHandlers)) {
      for (const h of rule.eventHandlers) {
        if (!h.enabled) {
          continue
        }
        const cfg = h.configJson || {}
        if (h.type === 'tcp') {
          const address = (cfg.address as string) || ''
          if (!address.trim()) {
            notify(notifyError('TCP 주소를 입력해주세요.'))
            return
          }
        } else if (h.type === 'webhook') {
          const url = (cfg.url as string) || ''
          if (!url.trim()) {
            notify(notifyError('Webhook URL을 입력해주세요.'))
            return
          }
        } else if (h.type === 'exec') {
          const command = (cfg.command as string[]) || []
          if (
            !command ||
            command.length === 0 ||
            command.every(c => !c.trim())
          ) {
            notify(notifyError('실행 명령어를 입력해주세요.'))
            return
          }
        } else if (h.type === 'log') {
          const filePath = (cfg.filePath as string) || ''
          if (!filePath.trim()) {
            notify(notifyError('로그 파일 경로를 입력해주세요.'))
            return
          }
        } else if (h.type === 'slack') {
          const workspace = (cfg.workspace as string) || ''
          const channel = (cfg.channel as string) || ''
          if (!workspace.trim() || !channel.trim()) {
            notify(
              notifyError('Slack 워크스페이스와 채널을 모두 입력해주세요.')
            )
            return
          }
        } else if (h.type === 'kafka') {
          const cluster = (cfg.cluster as string) || ''
          const topic = (cfg['kafka-topic'] as string) || ''
          if (!cluster.trim() || !topic.trim()) {
            notify(notifyError('Kafka 클러스터와 토픽을 모두 입력해주세요.'))
            return
          }
        } else if (h.type === 'telegram') {
          const chatId = (cfg.chatId as string) || ''
          if (!chatId.trim()) {
            notify(notifyError('Telegram Chat ID를 입력해주세요.'))
            return
          }
        }
      }
    }

    this.setState({isSaving: true})

    console.log('Saving AlertGroupRule payload JSON:', rule)
    console.log('JSON Stringified payload:', JSON.stringify(rule, null, 2))

    try {
      if (this.isNew) {
        await createAlertGroupRule(rule)
      } else {
        await updateAlertGroupRule(this.ruleId!, rule)
      }

      const returnTo = (this.props.location.state as any)?.returnTo
      if (returnTo) {
        router.push(returnTo)
      } else {
        router.push(`/sources/${source.id}/server-monitoring/server-alert`)
      }
    } catch (e) {
      notify(
        notifyError(this.getRequestErrorMessage(e, '저장에 실패했습니다.'))
      )
      this.setState({isSaving: false})
    }
  }

  private handleCancel = (): void => {
    const {source, router, location} = this.props
    const returnTo = (location.state as any)?.returnTo
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.push(`/sources/${source.id}/server-monitoring/server-alert`)
    }
  }

  private getRequestErrorMessage = (error: any, fallback: string): string => {
    return error?.data?.message || error?.message || fallback
  }

  private handleOpenTestModal = (): void => {
    const {rule} = this.state
    this.setState({
      isTestModalOpen: true,
      testTitle: rule.name || 'Alert Group 테스트',
      testMessage: rule.message || '',
      testRecipients: '',
      testIncludeSelf: true,
      testUserGroupIds: [...(rule.recipientGroupIds || [])],
    })
  }

  private handleCloseTestModal = (): void => {
    this.setState({
      isTestModalOpen: false,
      isTestingSend: false,
    })
  }

  private handleTestTitleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({testTitle: e.target.value})
  }

  private handleTestMessageChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({testMessage: e.target.value})
  }

  private handleTestRecipientsChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({testRecipients: e.target.value})
  }

  private handleTestIncludeSelfChange = (): void => {
    this.setState(prev => ({testIncludeSelf: !prev.testIncludeSelf}))
  }

  private handleTestUserGroupIdsChange = (selectedIDs: string[]): void => {
    this.setState({testUserGroupIds: selectedIDs})
  }

  private handleTestSend = async (): Promise<void> => {
    const {notify} = this.props
    const {testTitle, testMessage, testUserGroupIds} = this.state

    if (!testTitle) {
      notify(notifyError('테스트 제목을 입력해주세요.'))
      return
    }
    if (!testMessage) {
      notify(notifyError('테스트 메시지를 입력해주세요.'))
      return
    }

    this.setState({isTestingSend: true})

    try {
      const result = await testDraftAlertGroupNotification({
        recipientGroupIds: testUserGroupIds,
        title: testTitle,
        message: testMessage,
      })

      notify(
        notifySuccess(`${result.sentCount}건의 테스트 알림을 전송했습니다.`)
      )
      this.setState({isTestModalOpen: false, isTestingSend: false})
    } catch (e) {
      notify(
        notifyError(
          this.getRequestErrorMessage(e, '테스트 발송에 실패했습니다.')
        )
      )
      this.setState({isTestingSend: false})
    }
  }

  public render() {
    const {source, auth} = this.props
    const {
      rule,
      userGroups,
      loading,
      isSaving,
      isTestModalOpen,
      isTestingSend,
      testTitle,
      testMessage,
      testRecipients,
      testIncludeSelf,
      testUserGroupIds,
      builderMode,
      selectedTemplateId,
    } = this.state

    const {t} = this.props
    const pageTitle = this.isNew
      ? t('alert_group_rule.create_title', '이벤트 그룹 규칙 생성')
      : t('alert_group_rule.edit_title', '이벤트 그룹 규칙 수정')
    const hasPreview = !!(rule.measurement && rule.field)

    return (
      <Page className="alert-group-rule-page">
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title={pageTitle} />
          </Page.Header.Left>
          <Page.Header.Right>
            <Button
              text={t('button.cancel', '취소')}
              onClick={this.handleCancel}
              color={ComponentColor.Default}
              size={ComponentSize.Small}
            />
            <Button
              text={
                isSaving
                  ? t('button.saving', '저장 중...')
                  : t('button.save', '저장')
              }
              onClick={this.handleSave}
              color={ComponentColor.Primary}
              size={ComponentSize.Small}
              icon={IconFont.Checkmark}
              status={
                isSaving ? ComponentStatus.Disabled : ComponentStatus.Default
              }
            />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents>
          <Spinner loading={loading}>
            <div className="alert-group-page-wrapper">
              <AlertGroupTemplateSidebar
                templates={this.state.templates}
                availableMeasurements={this.state.availableMeasurements}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={this.handleSelectTemplate}
              />
              <div className="alert-group-rule-builder">
                <AlertGroupNameSection
                  rule={rule}
                  onUpdateRule={this.handleUpdateRule}
                />
                <AlertGroupConditionSection
                  source={source}
                  me={auth ? auth.me : null}
                  isUsingAuth={auth ? auth.isUsingAuth : false}
                  rule={rule}
                  templates={this.state.templates}
                  onUpdateRule={this.handleUpdateRule}
                  builderMode={builderMode}
                  onSwitchToRawMode={this.handleSwitchToRawMode}
                >
                  <AlertGroupPreviewGraph
                    key={
                      hasPreview
                        ? 'alert-group-preview-series'
                        : 'alert-group-preview-empty'
                    }
                    source={source}
                    database={rule.database}
                    retentionPolicy={rule.retentionPolicy}
                    measurement={rule.measurement}
                    field={rule.field}
                    conditions={rule.conditions}
                    triggerOperator={rule.triggerOperator}
                    timeRange={DEFAULT_TIME_RANGE}
                  />
                </AlertGroupConditionSection>
                {selectedTemplateId !== 'custom' && (
                  <AlertGroupTargetSection
                    source={source}
                    rule={rule}
                    onUpdateRule={this.handleUpdateRule}
                  />
                )}
                <AlertGroupHandlersSection
                  rule={rule}
                  userGroups={userGroups}
                  source={source}
                  router={this.props.router}
                  onUpdateRule={this.handleUpdateRule}
                  onOpenTestModal={this.handleOpenTestModal}
                  isTestingSend={isTestingSend}
                />
              </div>
            </div>
          </Spinner>

          <OverlayTechnology visible={isTestModalOpen}>
            <OverlayContainer maxWidth={480}>
              <OverlayHeading
                title="수신 테스트"
                onDismiss={this.handleCloseTestModal}
              />
              <OverlayBody>
                <Form>
                  <Form.Element label="테스트 제목">
                    <Input
                      value={testTitle}
                      onChange={this.handleTestTitleChange}
                      type={InputType.Text}
                      placeholder="테스트 메일 제목을 입력하세요"
                    />
                  </Form.Element>
                  <Form.Element label="테스트 메시지">
                    <Input
                      value={testMessage}
                      onChange={this.handleTestMessageChange}
                      type={InputType.Text}
                      placeholder="테스트 메일 메시지를 입력하세요"
                    />
                  </Form.Element>
                  <Form.Element label="내 이메일에 발송">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '0 10px',
                      }}
                    >
                      <SlideToggle
                        active={testIncludeSelf}
                        onChange={this.handleTestIncludeSelfChange}
                        size={ComponentSize.ExtraSmall}
                        color={ComponentColor.Primary}
                        disabled={!auth?.me?.email}
                      />
                      <span
                        style={{
                          marginLeft: '12px',
                          fontSize: '13px',
                          color: '#f6f6f8',
                        }}
                      >
                        {auth?.me?.email
                          ? auth.me.email
                          : '로그인 사용자의 이메일이 없어 사용할 수 없습니다.'}
                      </span>
                    </div>
                  </Form.Element>
                  <Form.Element label="수신 그룹 선택 (선택)">
                    {userGroups.length > 0 ? (
                      <MultiSelectDropdown
                        selectedIDs={testUserGroupIds}
                        onChange={this.handleTestUserGroupIdsChange}
                        buttonColor={ComponentColor.Default}
                        buttonSize={ComponentSize.Small}
                        menuColor={DropdownMenuColors.Onyx}
                        emptyText="그룹 선택 안 함"
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
                      <p
                        className="alert-group-test-modal-hint"
                        style={{
                          margin: '0 10px',
                          fontSize: '13px',
                          color: '#f6f6f8',
                        }}
                      >
                        등록된 수신 그룹이 없습니다.
                      </p>
                    )}
                  </Form.Element>
                  <Form.Element label="수신자 직접 입력 (선택)">
                    <Input
                      value={testRecipients}
                      onChange={this.handleTestRecipientsChange}
                      type={InputType.Text}
                      placeholder="여러 명은 쉼표로 구분"
                    />
                  </Form.Element>
                  <Form.Footer>
                    <Button
                      text={isTestingSend ? '발송 중...' : '수신 테스트'}
                      icon={IconFont.Bell}
                      onClick={this.handleTestSend}
                      color={ComponentColor.Success}
                      status={
                        !testTitle || !testMessage || isTestingSend
                          ? ComponentStatus.Disabled
                          : ComponentStatus.Default
                      }
                    />
                    <Button
                      text={t('button.cancel', '취소')}
                      onClick={this.handleCloseTestModal}
                      color={ComponentColor.Default}
                    />
                  </Form.Footer>
                </Form>
              </OverlayBody>
            </OverlayContainer>
          </OverlayTechnology>
        </Page.Contents>
      </Page>
    )
  }
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(
  null,
  mapDispatchToProps
)(withTranslation()(AlertGroupRulePage))
