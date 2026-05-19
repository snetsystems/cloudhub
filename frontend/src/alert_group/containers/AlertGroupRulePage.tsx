// frontend/src/alert_group/containers/AlertGroupRulePage.tsx
import React, {PureComponent} from 'react'
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
  AlertKapacitor,
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
import AlertGroupBasicSection from 'src/alert_group/components/AlertGroupBasicSection'

// APIs
import {
  getAlertGroupRule,
  createAlertGroupRule,
  updateAlertGroupRule,
  testDraftAlertGroupNotification,
  getAlertKapacitors,
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

interface Props {
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
  kapacitors: AlertKapacitor[]
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
      kapacitors: [],
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
    const {params} = this.props
    this.setState({loading: RemoteDataState.Loading})

    try {
      const isEdit = params.id && params.id !== 'new'

      const [
        kapacitors,
        userGroups,
        activeKapacitor,
        templates,
        availableMeasurements,
      ] = await Promise.all([
        getAlertKapacitors(),
        getUserGroups(),
        getActiveKapacitor(this.props.source).catch(() => null),
        getAlertTemplates().catch(() => [] as AlertTemplate[]),
        fetchAvailableMeasurements(this.props.source).catch(
          () => new Set<string>()
        ),
      ])

      if (isEdit) {
        const rule = await getAlertGroupRule(params.id)

        let builderMode: 'template' | 'raw' = 'raw'
        let selectedTemplateId = 'custom'

        const matchedTemplate = templates.find(
          t => t.measurement === rule.measurement && t.field === rule.field
        )
        if (matchedTemplate) {
          builderMode = 'template'
          selectedTemplateId = matchedTemplate.id
        }

        this.setState({
          rule,
          savedRule: rule,
          kapacitors,
          userGroups,
          templates,
          availableMeasurements,
          loading: RemoteDataState.Done,
          builderMode,
          selectedTemplateId,
        })
      } else {
        const preferredKapacitorID = this.findPreferredKapacitorID(
          kapacitors,
          activeKapacitor
        )
        this.setState({
          rule:
            preferredKapacitorID !== ''
              ? {...this.state.rule, kapacitorId: preferredKapacitorID}
              : this.state.rule,
          kapacitors,
          userGroups,
          templates,
          availableMeasurements,
          loading: RemoteDataState.Done,
        })
      }
    } catch (e) {
      this.setState({loading: RemoteDataState.Error})
      this.props.notify(notifyError('데이터를 불러오는 데 실패했습니다.'))
    }

    document.addEventListener('visibilitychange', this.handleVisibilityRefetch)
  }

  public componentWillUnmount(): void {
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityRefetch
    )
  }

  private handleVisibilityRefetch = (): void => {
    if (document.visibilityState !== 'visible') {
      return
    }
    this.refreshKapacitors()
  }

  private refreshKapacitors = async (): Promise<void> => {
    try {
      const kapacitors = await getAlertKapacitors()
      const activeKapacitor = await getActiveKapacitor(this.props.source).catch(
        () => null
      )
      const preferredKapacitorID = this.findPreferredKapacitorID(
        kapacitors,
        activeKapacitor
      )
      this.setState(prev => ({
        kapacitors,
        rule:
          prev.rule.kapacitorId || preferredKapacitorID === ''
            ? prev.rule
            : {...prev.rule, kapacitorId: preferredKapacitorID},
      }))
    } catch {
      // Ignore - separate from initial load failure
    }
  }

  private normalizeKapacitorURL(url: string = ''): string {
    return url.trim().replace(/\/+$/, '').toLowerCase()
  }

  private findPreferredKapacitorID(
    kapacitors: AlertKapacitor[],
    activeKapacitorFromAPI?: {url?: string; name?: string} | null
  ): string {
    const sourceKapacitors = this.props.source?.kapacitors || []
    const activeKapacitor =
      activeKapacitorFromAPI || sourceKapacitors.find(k => k.active)
    if (activeKapacitor) {
      const activeURL = this.normalizeKapacitorURL(activeKapacitor.url)
      if (activeURL) {
        const byURL = kapacitors.find(
          k => this.normalizeKapacitorURL(k.url) === activeURL
        )
        if (byURL?.id) {
          return byURL.id
        }
      }

      const activeName = (activeKapacitor.name || '').trim().toLowerCase()
      if (activeName) {
        const byName = kapacitors.find(
          k => (k.name || '').trim().toLowerCase() === activeName
        )
        if (byName?.id) {
          return byName.id
        }
      }
    }

    // If there is only one Kapacitor in the organization, select it automatically.
    if (kapacitors.length === 1 && kapacitors[0].id) {
      return kapacitors[0].id
    }

    return ''
  }

  private get isNew(): boolean {
    const {params} = this.props
    return !params.id || params.id === 'new'
  }

  private handleUpdateRule = (patch: Partial<AlertGroupRule>): void => {
    this.setState(prev => ({rule: {...prev.rule, ...patch}}))
  }

  private handleSelectTemplate = (templateId: string): void => {
    if (templateId === 'custom') {
      this.setState({
        selectedTemplateId: 'custom',
        builderMode: 'template', // 'New' default is empty category in template UI
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
      rule: {
        ...prev.rule,
        name: prev.rule.name || template.name,
        database: template.database || prev.rule.database,
        retentionPolicy: template.retentionPolicy || prev.rule.retentionPolicy,
        measurement: template.measurement,
        field: template.field,
        derivative: template.derivative,
        eval: template.eval,
        trigger: template.trigger || 'threshold',
        triggerOperator: template.triggerOperator,
        triggerValues: template.values || prev.rule.triggerValues,
        taskType: template.taskType,
        every: template.every,
        occurrenceType: template.occurrenceType,
        occurrenceCount: template.occurrenceCount,
        occurrenceWindow: template.occurrenceWindow,
        pauseSeconds: template.pauseSeconds,
        notifyRecovery: template.notifyRecovery,
        message: template.message,
        conditions:
          template.conditions && template.conditions.length > 0
            ? template.conditions
            : prev.rule.conditions,
      },
    }))
  }

  private handleSwitchToRawMode = (): void => {
    this.setState({builderMode: 'raw'})
  }

  private handleSave = async (): Promise<void> => {
    const {source, params, router, notify} = this.props
    const {rule} = this.state

    this.setState({isSaving: true})

    try {
      if (this.isNew) {
        await createAlertGroupRule(rule)
      } else {
        await updateAlertGroupRule(params.id, rule)
      }
      router.push(`/sources/${source.id}/server-monitoring/server-alert`)
    } catch (e) {
      notify(
        notifyError(this.getRequestErrorMessage(e, '저장에 실패했습니다.'))
      )
      this.setState({isSaving: false})
    }
  }

  private handleCancel = (): void => {
    const {source, router} = this.props
    router.push(`/sources/${source.id}/server-monitoring/server-alert`)
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

  private parseTestRecipients = (value: string): string[] => {
    return value
      .split(/[\n,]/)
      .map(recipient => recipient.trim())
      .filter(Boolean)
  }

  private handleTestSend = async (): Promise<void> => {
    const {auth, notify} = this.props
    const {
      rule,
      testTitle,
      testMessage,
      testRecipients,
      testIncludeSelf,
      testUserGroupIds,
    } = this.state
    const manualRecipients = this.parseTestRecipients(testRecipients)
    const selfEmail = auth?.me?.email
    const recipients = [
      ...(testIncludeSelf && selfEmail ? [selfEmail] : []),
      ...manualRecipients,
    ]

    if (!rule.kapacitorId) {
      notify(notifyError('테스트 발송 전에 Kapacitor를 먼저 선택해주세요.'))
      return
    }

    if (!testTitle) {
      notify(notifyError('테스트 제목을 입력해주세요.'))
      return
    }
    if (!testMessage) {
      notify(notifyError('테스트 메시지를 입력해주세요.'))
      return
    }
    if (recipients.length === 0 && testUserGroupIds.length === 0) {
      notify(notifyError('수신 대상을 선택하거나 직접 입력해주세요.'))
      return
    }

    this.setState({isTestingSend: true})

    try {
      // Modal lets the user pick recipient_groups + recipients explicitly, so the draft
      // endpoint covers both new and saved rules — no need for the by-id path.
      // NOTE: backend test-notification no longer accepts free-form `recipients[]`;
      // manual entries from `testRecipients` are only used FE-side for the empty-check
      // (kept here so the UX warning still triggers) and ignored at the request boundary.
      void recipients
      const result = await testDraftAlertGroupNotification({
        kapacitorId: rule.kapacitorId,
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
      kapacitors,
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

    const pageTitle = this.isNew
      ? '이벤트 그룹 규칙 생성'
      : '이벤트 그룹 규칙 수정'
    const hasPreview = !!(rule.measurement && rule.field)
    const basicSectionProps = {
      rule,
      kapacitors,
      organizationId: auth?.me?.currentOrganization?.id || '',
      me: auth ? auth.me : null,
      onUpdateRule: this.handleUpdateRule,
      onOpenTestModal: this.handleOpenTestModal,
      isTestingSend,
    }

    return (
      <Page className="alert-group-rule-page">
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title={pageTitle} />
          </Page.Header.Left>
          <Page.Header.Right>
            <Button
              text="취소"
              onClick={this.handleCancel}
              color={ComponentColor.Default}
              size={ComponentSize.Small}
            />
            <Button
              text={isSaving ? '저장 중...' : '저장'}
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
                <AlertGroupTargetSection
                  source={source}
                  rule={rule}
                  onUpdateRule={this.handleUpdateRule}
                />
                <AlertGroupBasicSection {...basicSectionProps} />
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
                      text="취소"
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

export default connect(null, mapDispatchToProps)(AlertGroupRulePage)
