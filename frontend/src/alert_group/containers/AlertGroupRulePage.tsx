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
import {AlertGroupRule, AlertTemplate, UserGroup, DEFAULT_RULE} from 'src/types'

// Components
import {
  Page,
  Button,
  Spinner,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  IconFont,
} from 'src/reusable_ui'
import AlertGroupTemplateSidebar from 'src/alert_group/components/AlertGroupTemplateSidebar'
import AlertGroupNameSection from 'src/alert_group/components/AlertGroupNameSection'
import AlertGroupConditionSection from 'src/alert_group/components/AlertGroupConditionSection'
import AlertGroupPreviewGraph from 'src/alert_group/components/AlertGroupPreviewGraph'
import AlertGroupTargetSection from 'src/alert_group/components/AlertGroupTargetSection'
import AlertGroupHandlersSection from 'src/alert_group/components/AlertGroupHandlersSection'
import AlertGroupTestModal from 'src/alert_group/components/AlertGroupTestModal'
import {applyAlertTemplateToRule} from 'src/alert_group/utils/alertTemplates'
import {getRuleSpec, patchRuleSpec} from 'src/alert_group/utils/alertRuleSpecs'

// APIs
import {
  getAlertGroupRule,
  createAlertGroupRule,
  updateAlertGroupRule,
  getUserGroups,
  getAlertTemplates,
  fetchAvailableMeasurements,
} from 'src/alert_group/apis'
import {getActiveKapacitor} from 'src/shared/apis'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Notifications
import {notifyError} from 'src/shared/copy/notifications'

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
      builderMode: 'raw',
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
        getAlertTemplates({targetType: 'host'}).catch(
          () => [] as AlertTemplate[]
        ),
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

        const ruleSpec = rule.specs[0]
        const matchedTemplate = templates.find(t => {
          const templateSpec = getRuleSpec(t)
          return (
            templateSpec.measurement === ruleSpec.measurement &&
            templateSpec.field === ruleSpec.field
          )
        })
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
          builderMode: 'raw',
          selectedTemplateId: 'custom',
        })
      }
    } catch (e) {
      const {t} = this.props
      this.setState({loading: RemoteDataState.Error})
      this.props.notify(
        notifyError(
          t(
            'alert_group_rule.noti_load_fail',
            '데이터를 불러오는 데 실패했습니다.'
          )
        )
      )
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
        builderMode: 'raw',
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
    const {t} = this.props
    const templateSpec = getRuleSpec(template)
    if (
      availableMeasurements.size > 0 &&
      !availableMeasurements.has(templateSpec.measurement)
    ) {
      this.props.notify(
        notifyError(
          t(
            'alert_group_rule.noti_measurement_required',
            "이 알람을 사용하려면 '{{measurement}}' 데이터 수집이 필요합니다.",
            {measurement: templateSpec.measurement}
          )
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
      notify(
        notifyError(
          t(
            'alert_group_rule.noti_enter_name',
            '이벤트 그룹 규칙 이름을 입력해주세요.'
          )
        )
      )
      return
    }
    const spec = rule.specs[0]

    if (!spec.database) {
      notify(
        notifyError(
          t('alert_group_rule.noti_select_db', '데이터베이스를 선택해주세요.')
        )
      )
      return
    }
    if (!spec.measurement) {
      notify(
        notifyError(
          t(
            'alert_group_rule.noti_select_measurement',
            '측정 대상(Measurement)을 선택해주세요.'
          )
        )
      )
      return
    }
    if (!spec.field) {
      notify(
        notifyError(
          t('alert_group_rule.noti_select_field', '필드(Field)를 선택해주세요.')
        )
      )
      return
    }

    // 임계값 필수값 정합성 검사 (활성화된 조건의 임계값 입력 여부 검사)
    if (Array.isArray(spec.conditions) && spec.trigger !== 'deadman') {
      for (const cond of spec.conditions) {
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
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_tcp_address',
                  'TCP 주소를 입력해주세요.'
                )
              )
            )
            return
          }
        } else if (h.type === 'webhook') {
          const url = (cfg.url as string) || ''
          if (!url.trim()) {
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_webhook_url',
                  'Webhook URL을 입력해주세요.'
                )
              )
            )
            return
          }
        } else if (h.type === 'exec') {
          const command = (cfg.command as string[]) || []
          if (
            !command ||
            command.length === 0 ||
            command.every(c => !c.trim())
          ) {
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_command',
                  '실행 명령어를 입력해주세요.'
                )
              )
            )
            return
          }
        } else if (h.type === 'log') {
          const filePath = (cfg.filePath as string) || ''
          if (!filePath.trim()) {
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_log_path',
                  '로그 파일 경로를 입력해주세요.'
                )
              )
            )
            return
          }
        } else if (h.type === 'slack') {
          const workspace = (cfg.workspace as string) || ''
          const channel = (cfg.channel as string) || ''
          if (!workspace.trim() || !channel.trim()) {
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_slack_info',
                  'Slack 워크스페이스와 채널을 모두 입력해주세요.'
                )
              )
            )
            return
          }
        } else if (h.type === 'kafka') {
          const cluster = (cfg.cluster as string) || ''
          const topic = (cfg['kafka-topic'] as string) || ''
          if (!cluster.trim() || !topic.trim()) {
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_kafka_info',
                  'Kafka 클러스터와 토픽을 모두 입력해주세요.'
                )
              )
            )
            return
          }
        } else if (h.type === 'telegram') {
          const chatId = (cfg.chatId as string) || ''
          if (!chatId.trim()) {
            notify(
              notifyError(
                t(
                  'alert_group_rule.noti_enter_telegram_chat_id',
                  'Telegram Chat ID를 입력해주세요.'
                )
              )
            )
            return
          }
        }
      }
    }

    const ruleToSave =
      spec.trigger === 'deadman'
        ? {
            ...rule,
            ...patchRuleSpec(rule, {
              conditions: (spec.conditions || []).map(c => ({
                ...c,
                enabled: false,
              })),
            }),
          }
        : rule

    this.setState({isSaving: true})

    try {
      if (this.isNew) {
        await createAlertGroupRule(ruleToSave)
      } else {
        await updateAlertGroupRule(this.ruleId!, ruleToSave)
      }

      const returnTo = (this.props.location.state as any)?.returnTo
      if (returnTo) {
        router.push(returnTo)
      } else {
        router.push(`/sources/${source.id}/server-monitoring/server-alert`)
      }
    } catch (e) {
      notify(
        notifyError(
          this.getRequestErrorMessage(
            e,
            t('alert_group_rule.noti_save_fail', '저장에 실패했습니다.')
          )
        )
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
    this.setState({isTestModalOpen: true})
  }

  private handleCloseTestModal = (): void => {
    this.setState({isTestModalOpen: false, isTestingSend: false})
  }

  private handleTestingSendChange = (isSending: boolean): void => {
    this.setState({isTestingSend: isSending})
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
      builderMode,
      selectedTemplateId,
    } = this.state

    const {t} = this.props
    const pageTitle = this.isNew
      ? t('alert_group_rule.create_title', '이벤트 그룹 규칙 생성')
      : t('alert_group_rule.edit_title', '이벤트 그룹 규칙 수정')
    const ruleSpec = rule.specs[0]
    const hasPreview = !!(ruleSpec.measurement && ruleSpec.field)

    return (
      <Page className="alert-group-rule-page">
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title={pageTitle} />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
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
                  selectedTemplateId={selectedTemplateId}
                  onSwitchToRawMode={this.handleSwitchToRawMode}
                >
                  <AlertGroupPreviewGraph
                    key={
                      hasPreview
                        ? 'alert-group-preview-series'
                        : 'alert-group-preview-empty'
                    }
                    source={source}
                    database={ruleSpec.database}
                    retentionPolicy={ruleSpec.retentionPolicy}
                    measurement={ruleSpec.measurement}
                    field={ruleSpec.field}
                    conditions={
                      ruleSpec.trigger === 'deadman' ? [] : ruleSpec.conditions!
                    }
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
                  templates={this.state.templates}
                  selectedTemplateId={selectedTemplateId}
                  source={source}
                  router={this.props.router}
                  onUpdateRule={this.handleUpdateRule}
                  onOpenTestModal={this.handleOpenTestModal}
                  isTestingSend={isTestingSend}
                />
              </div>
            </div>
          </Spinner>

          <AlertGroupTestModal
            visible={isTestModalOpen}
            rule={rule}
            userGroups={userGroups}
            userEmail={auth?.me?.email}
            notify={this.props.notify}
            onClose={this.handleCloseTestModal}
            onTestingSendChange={this.handleTestingSendChange}
          />
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
