// frontend/src/url_monitoring/containers/URLAlertSettingPage.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
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
  AlertRuleEventHandler,
  AlertTemplate,
  UserGroup,
  DEFAULT_RULE,
  DEFAULT_URL_STATUS_FILTERS,
  normalizeAlertConditions,
  urlErrorConfigToStatusFilters,
} from 'src/types'

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
import AlertGroupNameSection from 'src/alert_group/components/AlertGroupNameSection'
import URLAlertConditionSection from 'src/url_monitoring/components/URLAlertConditionSection'
import AlertGroupTargetSection from 'src/alert_group/components/AlertGroupTargetSection'
import AlertGroupTemplateSidebar from 'src/alert_group/components/AlertGroupTemplateSidebar'
import AlertGroupPreviewGraph from 'src/alert_group/components/AlertGroupPreviewGraph'
import AlertGroupHandlersSection from 'src/alert_group/components/AlertGroupHandlersSection'
import AlertGroupTestModal from 'src/alert_group/components/AlertGroupTestModal'
import {
  getUrlAlertTemplates,
  getUrlAlertRule,
  getURLMonitoring,
} from 'src/url_monitoring/apis'
import {URLMonitoringTarget} from 'src/url_monitoring/types'

// APIs
import {
  createAlertGroupRule,
  updateAlertGroupRule,
  getUserGroups,
  fetchAvailableMeasurements,
} from 'src/alert_group/apis'
import {getActiveKapacitor} from 'src/shared/apis'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Notifications
import {notifyError, notifySuccess} from 'src/shared/copy/notifications'

const URL_ALERT_PATH = 'url-monitoring/url-alert'

const DEFAULT_TIME_RANGE: TimeRange = {lower: 'now() - 1h', upper: null}

const buildUrlPreviewGraphProps = (
  rule: AlertGroupRule,
  targets: URLMonitoringTarget[]
) => {
  const selectedIds = rule.urlTargetIds || []
  const servers = targets
    .filter(t => t.id && selectedIds.includes(t.id))
    .map(t => String(t.url ?? '').trim())
    .filter(Boolean)
  const groupBy = {time: '', tags: [] as string[]}

  if (servers.length === 0) {
    return {tags: {}, areTagsAccepted: false, groupBy}
  }

  return {
    tags: {server: servers},
    areTagsAccepted: true,
    groupBy,
  }
}

const getRequestErrorMessage = (error: any, fallback: string): string =>
  error?.data?.message || error?.message || fallback

const applyUrlAlertTemplateToRule = (
  source: Source,
  template: AlertTemplate,
  prevRule: AlertGroupRule
): AlertGroupRule => {
  const database = source.telegraf || 'telegraf'
  const retentionPolicy =
    template.retentionPolicy?.trim() || source.defaultRP || 'autogen'

  const statusTarget = template.targets?.find(
    target => target.field === 'result_code'
  )
  const latencyTarget = template.targets?.find(
    target => target.field === 'response_time'
  )

  const eventHandlers = Array.isArray(prevRule.eventHandlers)
    ? prevRule.eventHandlers
    : []
  const emailHandler = eventHandlers.find(handler => handler.type === 'email')
  const nonEmailHandlers = eventHandlers.filter(
    handler => handler.type !== 'email'
  )
  const nextEmailHandler: AlertRuleEventHandler = {
    ...(emailHandler || {}),
    type: 'email',
    enabled: emailHandler?.enabled ?? true,
    recipientGroupIds:
      emailHandler?.recipientGroupIds || prevRule.recipientGroupIds || [],
    configJson: {
      ...(emailHandler?.configJson || {to: []}),
      body:
        template.emailBody ||
        (emailHandler?.configJson?.body as string | undefined) ||
        '',
    },
  }

  const rawTrigger = latencyTarget?.trigger ?? template.trigger ?? 'threshold'
  const trigger = rawTrigger === 'deadman' ? 'threshold' : rawTrigger
  const rawConditions = latencyTarget?.conditions ?? template.conditions
  const conditions = rawConditions?.length
    ? normalizeAlertConditions(rawConditions)
    : DEFAULT_RULE.conditions

  const urlStatusFilters = statusTarget?.urlErrorConfig
    ? urlErrorConfigToStatusFilters(statusTarget.urlErrorConfig)
    : DEFAULT_URL_STATUS_FILTERS

  return {
    ...DEFAULT_RULE,
    kapacitorId: prevRule.kapacitorId,
    name: prevRule.name,
    templateId: template.id,
    targets: template.targets,
    database,
    retentionPolicy,
    measurement:
      latencyTarget?.measurement ?? template.measurement ?? DEFAULT_RULE.measurement,
    field: latencyTarget?.field ?? template.field ?? DEFAULT_RULE.field,
    derivative: template.derivative,
    eval: template.eval,
    trigger,
    values: {
      change: 'change',
      shift: '1m',
      period: '10m',
      ...prevRule.values,
      ...(template.values || {}),
    },
    taskType: template.taskType,
    every: template.every,
    occurrenceType: template.occurrenceType,
    occurrenceCount: template.occurrenceCount,
    occurrenceWindow: template.occurrenceWindow,
    pauseSeconds: template.pauseSeconds,
    notifyRecovery: template.notifyRecovery,
    message: template.message,
    conditions,
    urlErrorConfig: statusTarget?.urlErrorConfig,
    urlStatusFilters,
    eventHandlers: [...nonEmailHandlers, nextEmailHandler],
  }
}

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

const URLAlertSettingPage: React.FC<Props> = ({
  source,
  auth,
  params,
  router,
  location,
  notify,
}) => {
  const {t} = useTranslation()

  const [rule, setRule] = useState<AlertGroupRule>(DEFAULT_RULE)
  const [savedRule, setSavedRule] = useState<AlertGroupRule | null>(null)
  const [userGroups, setUserGroups] = useState<UserGroup[]>([])
  const [templates, setTemplates] = useState<AlertTemplate[]>([])
  const [urlTargets, setUrlTargets] = useState<URLMonitoringTarget[]>([])
  const [availableMeasurements, setAvailableMeasurements] = useState(
    new Set<string>()
  )
  const [loading, setLoading] = useState(RemoteDataState.NotStarted)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isTestingSend, setIsTestingSend] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom')

  const ruleId = params.id || (location as any).query?.id
  const isNew = !ruleId || ruleId === 'new'

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      setLoading(RemoteDataState.Loading)

      try {
        const currentRuleId = params.id || (location as any).query?.id
        const isEdit = currentRuleId && currentRuleId !== 'new'

        const [
          loadedUserGroups,
          loadedTemplates,
          loadedMeasurements,
          activeKapacitor,
          urlMonitoring,
        ] = await Promise.all([
          getUserGroups(),
          getUrlAlertTemplates(),
          fetchAvailableMeasurements(source).catch(() => new Set<string>()),
          getActiveKapacitor(source).catch(() => null),
          getURLMonitoring().catch(() => null),
        ])

        if (cancelled) {
          return
        }

        const loadedUrlTargets = urlMonitoring?.targets ?? []
        const activeKapacitorId = activeKapacitor?.id || ''

        if (isEdit) {
          const loadedRule = await getUrlAlertRule(currentRuleId!)
          if (cancelled) {
            return
          }

          const ruleWithKapacitor = {
            ...loadedRule,
            kapacitorId: loadedRule.kapacitorId || activeKapacitorId,
            urlStatusFilters: {
              ...DEFAULT_URL_STATUS_FILTERS,
              ...(loadedRule.urlStatusFilters || {}),
            },
          }

          setRule(ruleWithKapacitor)
          setSavedRule(ruleWithKapacitor)
          setUserGroups(loadedUserGroups)
          setTemplates(loadedTemplates)
          setUrlTargets(loadedUrlTargets)
          setAvailableMeasurements(loadedMeasurements)
          setLoading(RemoteDataState.Done)
          setSelectedTemplateId(
            loadedRule.templateId &&
              loadedTemplates.some(t => t.id === loadedRule.templateId)
              ? loadedRule.templateId
              : 'custom'
          )
        } else {
          setRule({
            ...DEFAULT_RULE,
            kapacitorId: activeKapacitorId,
          })
          setSavedRule(null)
          setUserGroups(loadedUserGroups)
          setTemplates(loadedTemplates)
          setUrlTargets(loadedUrlTargets)
          setAvailableMeasurements(loadedMeasurements)
          setLoading(RemoteDataState.Done)
          setSelectedTemplateId('custom')
        }
      } catch {
        if (cancelled) {
          return
        }
        setLoading(RemoteDataState.Error)
        notify(notifyError(t('alert_group_rule.noti_load_fail')))
        if (source?.id) {
          router.push(`/sources/${source.id}/${URL_ALERT_PATH}`)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [source])

  useEffect(() => {
    const handleVisibilityRefetch = async (): Promise<void> => {
      if (document.visibilityState === 'visible') {
        try {
          const loadedUserGroups = await getUserGroups()
          setUserGroups(loadedUserGroups)
        } catch (e) {
          console.error('Failed to refetch reference data', e)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityRefetch)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityRefetch)
    }
  }, [])

  const handleUpdateRule = useCallback((patch: Partial<AlertGroupRule>): void => {
    setRule(prev => ({...prev, ...patch}))
  }, [])

  const handleSelectTemplate = useCallback(
    (templateId: string): void => {
      if (templateId === 'custom') {
        if (savedRule) {
          setRule(savedRule)
          setSelectedTemplateId(
            savedRule.templateId &&
              templates.some(t => t.id === savedRule.templateId)
              ? savedRule.templateId
              : 'custom'
          )
          return
        }

        setRule(prev => ({
          ...DEFAULT_RULE,
          kapacitorId: prev.kapacitorId,
        }))
        setSelectedTemplateId('custom')
        return
      }

      const template = templates.find(item => item.id === templateId)
      if (!template) {
        return
      }

      setSelectedTemplateId(template.id)
      setRule(prev =>
        applyUrlAlertTemplateToRule(source, template, prev)
      )
    },
    [savedRule, templates, source]
  )

  const handleSave = useCallback(async (): Promise<void> => {
    if (!rule.name || !rule.name.trim()) {
      notify(notifyError(t('alert_group_rule.noti_enter_name')))
      return
    }
    if (!rule.database) {
      notify(notifyError(t('alert_group_rule.noti_select_db')))
      return
    }
    if (!rule.measurement) {
      notify(notifyError(t('alert_group_rule.noti_select_measurement')))
      return
    }
    if (!rule.field) {
      notify(notifyError(t('alert_group_rule.noti_select_field')))
      return
    }

    if (Array.isArray(rule.conditions)) {
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
            notify(notifyError(t('alert_group_rule.noti_enter_tcp_address')))
            return
          }
        } else if (h.type === 'webhook') {
          const url = (cfg.url as string) || ''
          if (!url.trim()) {
            notify(notifyError(t('alert_group_rule.noti_enter_webhook_url')))
            return
          }
        } else if (h.type === 'exec') {
          const command = (cfg.command as string[]) || []
          if (
            !command ||
            command.length === 0 ||
            command.every(c => !c.trim())
          ) {
            notify(notifyError(t('alert_group_rule.noti_enter_command')))
            return
          }
        } else if (h.type === 'log') {
          const filePath = (cfg.filePath as string) || ''
          if (!filePath.trim()) {
            notify(notifyError(t('alert_group_rule.noti_enter_log_path')))
            return
          }
        } else if (h.type === 'slack') {
          const workspace = (cfg.workspace as string) || ''
          const channel = (cfg.channel as string) || ''
          if (!workspace.trim() || !channel.trim()) {
            notify(notifyError(t('alert_group_rule.noti_enter_slack_info')))
            return
          }
        } else if (h.type === 'kafka') {
          const cluster = (cfg.cluster as string) || ''
          const topic = (cfg['kafka-topic'] as string) || ''
          if (!cluster.trim() || !topic.trim()) {
            notify(notifyError(t('alert_group_rule.noti_enter_kafka_info')))
            return
          }
        } else if (h.type === 'telegram') {
          const chatId = (cfg.chatId as string) || ''
          if (!chatId.trim()) {
            notify(
              notifyError(t('alert_group_rule.noti_enter_telegram_chat_id'))
            )
            return
          }
        }
      }
    }

    setIsSaving(true)

    try {
      let nextSavedRule: AlertGroupRule
      if (isNew) {
        nextSavedRule = await createAlertGroupRule(rule)
      } else {
        nextSavedRule = await updateAlertGroupRule(ruleId!, rule)
      }

      const returnTo = (location.state as any)?.returnTo
      if (returnTo) {
        router.push(returnTo)
        return
      }

      setRule(nextSavedRule)
      setSavedRule(nextSavedRule)
      setIsSaving(false)

      if (isNew && nextSavedRule.id) {
        router.replace({
          pathname: location.pathname,
          query: {...(location as any).query, id: nextSavedRule.id},
        })
      }
      notify(notifySuccess(t('alert_group_rule.noti_save_success')))
    } catch (e) {
      notify(
        notifyError(
          getRequestErrorMessage(e, t('alert_group_rule.noti_save_fail'))
        )
      )
      setIsSaving(false)
    }
  }, [rule, isNew, ruleId, location, router, notify, t])

  const handleCancel = useCallback((): void => {
    const returnTo = (location.state as any)?.returnTo
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.push(`/sources/${source.id}/${URL_ALERT_PATH}`)
    }
  }, [location, router, source.id])

  const handleOpenTestModal = useCallback((): void => {
    setIsTestModalOpen(true)
  }, [])

  const handleCloseTestModal = useCallback((): void => {
    setIsTestModalOpen(false)
    setIsTestingSend(false)
  }, [])

  const handleTestingSendChange = useCallback((isSending: boolean): void => {
    setIsTestingSend(isSending)
  }, [])

  const previewGraphProps = useMemo(
    () => buildUrlPreviewGraphProps(rule, urlTargets),
    [rule, urlTargets]
  )

  if (!source) {
    return null
  }

  const pageTitle = t('url_alert_setting.title')

  return (
    <Page className="alert-group-rule-page">
      <Page.Header>
        <Page.Header.Left>
          <Page.Title title={pageTitle} />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <Button
            text={t('button.cancel')}
            onClick={handleCancel}
            color={ComponentColor.Default}
            size={ComponentSize.Small}
          />
          <Button
            text={isSaving ? t('button.saving') : t('button.save')}
            onClick={handleSave}
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
              templates={templates}
              availableMeasurements={availableMeasurements}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={handleSelectTemplate}
              createNewText={t('url_alert_setting.reset', '초기화')}
              showCreateIcon={false}
            />
            <div className="alert-group-rule-builder">
              <AlertGroupNameSection
                rule={rule}
                onUpdateRule={handleUpdateRule}
              />
              <URLAlertConditionSection
                source={source}
                rule={rule}
                templates={templates}
                onUpdateRule={handleUpdateRule}
              >
                <AlertGroupPreviewGraph
                  key={`${rule.measurement}-${rule.field}-${(
                    rule.urlTargetIds || []
                  ).join(',')}`}
                  source={source}
                  database={rule.database || source.telegraf || 'telegraf'}
                  retentionPolicy={
                    rule.retentionPolicy || source.defaultRP || 'autogen'
                  }
                  measurement={rule.measurement}
                  field={rule.field}
                  tags={previewGraphProps.tags}
                  groupBy={previewGraphProps.groupBy}
                  areTagsAccepted={previewGraphProps.areTagsAccepted}
                  conditions={rule.conditions}
                  timeRange={DEFAULT_TIME_RANGE}
                />
              </URLAlertConditionSection>
              <AlertGroupTargetSection
                type="url"
                source={source}
                rule={rule}
                onUpdateRule={handleUpdateRule}
              />
              <AlertGroupHandlersSection
                rule={rule}
                userGroups={userGroups}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                source={source}
                router={router}
                onUpdateRule={handleUpdateRule}
                onOpenTestModal={handleOpenTestModal}
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
          notify={notify}
          onClose={handleCloseTestModal}
          onTestingSendChange={handleTestingSendChange}
        />
      </Page.Contents>
    </Page>
  )
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(null, mapDispatchToProps)(URLAlertSettingPage)
