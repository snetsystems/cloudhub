import React, {useCallback, useEffect, useMemo} from 'react'
import {useTranslation, TFunction} from 'react-i18next'
import {
  ComponentColor,
  ComponentSize,
  Input,
  InputType,
  Radio,
  ButtonShape,
  SlideToggle,
} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'
import {SHIFTS} from 'src/kapacitor/constants'
import {getOccurrenceTooltip} from 'src/alert_group/utils/occurrenceTooltip'
import {
  AlertGroupRule,
  AlertTemplate,
  DEFAULT_URL_ERROR_CONFIG,
  UrlErrorConfig,
  getTriggerOperators,
  getPauseSecondsOptions,
  Source,
} from 'src/types'
import {patchRuleSpec} from 'src/alert_group/utils/alertRuleSpecs'

const LEVEL_ORDER: {[key: string]: number} = {
  critical: 1,
  warning: 2,
  info: 3,
}

const sortConditions = (conditions: any[] = []) => {
  if (!conditions) {
    return []
  }
  return [...conditions].sort((a, b) => {
    const orderA = LEVEL_ORDER[a.level] || 99
    const orderB = LEVEL_ORDER[b.level] || 99
    return orderA - orderB
  })
}

const conditionToggleColor = (level: string): ComponentColor => {
  switch (level) {
    case 'critical':
      return ComponentColor.Danger
    case 'warning':
      return ComponentColor.Warning
    case 'info':
      return ComponentColor.Info
    default:
      return ComponentColor.Default
  }
}

const conditionLabel = (level: string, t: TFunction): string => {
  switch (level) {
    case 'critical':
      return t('server_alert.critical')
    case 'warning':
      return t('server_alert.warning')
    case 'info':
      return t('server_alert.info')
    default:
      return level
  }
}

const getRelativeOperatorOptions = (t: TFunction) => [
  {label: t('alert_group_rule.op_gt'), value: 'greater than'},
  {label: t('alert_group_rule.op_gte'), value: 'equal to or greater'},
  {label: t('alert_group_rule.op_lt'), value: 'less than'},
  {label: t('alert_group_rule.op_lte'), value: 'equal to or less than'},
  {label: t('alert_group_rule.op_eq'), value: 'equal to'},
  {label: t('alert_group_rule.op_neq'), value: 'not equal to'},
]

const getChangesOptions = (t: TFunction) => [
  {label: t('alert_group_rule.opt_change'), value: 'change'},
  {label: t('alert_group_rule.opt_pct_change'), value: '% change'},
]

interface Props {
  source?: Source
  rule: AlertGroupRule
  templates?: AlertTemplate[]
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
  children?: React.ReactNode
}

const URLAlertConditionSection: React.FC<Props> = ({
  source,
  rule,
  templates,
  onUpdateRule,
  children,
}) => {
  const {t} = useTranslation()
  const spec = rule.specs[0]

  const updateSpec = useCallback(
    (patch: Parameters<typeof patchRuleSpec>[1]) => {
      onUpdateRule(patchRuleSpec(rule, patch))
    },
    [rule, onUpdateRule]
  )

  useEffect(() => {
    if (!source || spec.database?.trim()) {
      return
    }

    onUpdateRule(
      patchRuleSpec(rule, {
        database: source.telegraf || 'telegraf',
        retentionPolicy: source.defaultRP || 'autogen',
      })
    )
  }, [source, spec.database, rule, onUpdateRule])

  const urlErrorConfig = useMemo(
    (): UrlErrorConfig => ({
      ...DEFAULT_URL_ERROR_CONFIG,
      ...spec.urlErrorConfig,
    }),
    [spec.urlErrorConfig]
  )

  const handleToggleCondition = useCallback(
    (idx: number, enabled: boolean): void => {
      const sorted = sortConditions(spec.conditions)
      const next = sorted.map((c, i) => (i === idx ? {...c, enabled} : c))
      updateSpec({conditions: next})
    },
    [spec.conditions, updateSpec]
  )

  const handleConditionValue = useCallback(
    (idx: number, value: string): void => {
      const sorted = sortConditions(spec.conditions)
      const next = sorted.map((c, i) => (i === idx ? {...c, value} : c))
      updateSpec({conditions: next})
    },
    [spec.conditions, updateSpec]
  )

  const handleConditionOperator = useCallback(
    (idx: number, operator: string): void => {
      const sorted = sortConditions(spec.conditions)
      const next = sorted.map((c, i) => (i === idx ? {...c, operator} : c))
      updateSpec({conditions: next})
    },
    [spec.conditions, updateSpec]
  )

  const handleTriggerTypeChange = useCallback(
    (trigger: 'threshold' | 'relative'): void => {
      updateSpec({trigger})
    },
    [updateSpec]
  )

  const handleTriggerValueChange = useCallback(
    (key: 'shift' | 'change', value: string): void => {
      updateSpec({
        values: {
          ...spec.values,
          [key]: value,
        },
      })
    },
    [spec.values, updateSpec]
  )

  const handleStatusFilterChange = useCallback(
    (key: keyof UrlErrorConfig, enabled: boolean): void => {
      updateSpec({
        urlErrorConfig: {
          ...urlErrorConfig,
          [key]: enabled,
        },
      })
    },
    [urlErrorConfig, updateSpec]
  )

  const selectedTemplate = templates?.find(t => t.id === rule.templateKey)
  const translatedPauseOptions = getPauseSecondsOptions(t)
  const selectedPause = translatedPauseOptions.find(
    o => o.value === rule.pauseSeconds
  )
  const translatedConditionOperators = getTriggerOperators(t)
  const relativeOpOptions = getRelativeOperatorOptions(t)
  const changesOptions = getChangesOptions(t)
  const isThreshold = !spec.trigger || spec.trigger === 'threshold'
  const conditionOperators = isThreshold
    ? translatedConditionOperators
    : relativeOpOptions
  const defaultOperator = isThreshold ? 'greater' : 'greater than'
  const operatorMenuWidth = isThreshold ? '100px' : '200px'
  const valuePlaceholder = isThreshold
    ? t('alert_group_rule.threshold_placeholder')
    : t('alert_group_rule.value_input')

  const renderOccurrenceControls = (): JSX.Element => (
    <div className="alert-group-setting-inputs">
      <Radio
        shape={ButtonShape.Default}
        customClass="alert-group-rule-builder__radio"
      >
        <Radio.Button
          id="url-occ-consecutive"
          value="consecutive"
          active={rule.occurrenceType === 'consecutive'}
          onClick={(_v: string) => onUpdateRule({occurrenceType: 'consecutive'})}
          titleText={t('alert_group_rule.occ_consecutive')}
        >
          {t('alert_group_rule.occ_consecutive')}
        </Radio.Button>
        <Radio.Button
          id="url-occ-total"
          value="total"
          active={rule.occurrenceType === 'total'}
          onClick={(_v: string) => onUpdateRule({occurrenceType: 'total'})}
          titleText={t('alert_group_rule.occ_recent')}
        >
          {t('alert_group_rule.occ_recent')}
        </Radio.Button>
      </Radio>
      <Dropdown
        menuWidth="80px"
        selected={rule.occurrenceWindow || '1m'}
        onChoose={(item: any) => onUpdateRule({occurrenceWindow: item.value})}
        buttonColor="btn-default"
        buttonSize="btn-sm"
        disabled={rule.occurrenceType === 'consecutive'}
        items={[
          {text: '1m', value: '1m'},
          {text: '5m', value: '5m'},
          {text: '10m', value: '10m'},
          {text: '15m', value: '15m'},
          {text: '30m', value: '30m'},
          {text: '1h', value: '1h'},
        ]}
      />
      <span className="alert-group-occurrence--sep">
        {t('alert_group_rule.duration_for')}
      </span>
      <div className="alert-group-condition-w80">
        <Input
          value={String(rule.occurrenceCount)}
          onChange={e =>
            onUpdateRule({
              occurrenceCount: parseInt(e.target.value, 10) || 1,
            })
          }
          type={InputType.Number}
          size={ComponentSize.Small}
          placeholder="0"
          customClass="alert-group-occurrence--count"
        />
      </div>
      <span className="alert-group-occurrence--sep">
        {t('alert_group_rule.occ_occurrences')}
      </span>
      <QuestionMarkTooltip
        tipID="url-occurrence-tooltip"
        tipContent={getOccurrenceTooltip(t)}
      />
    </div>
  )

  return (
    <div className="rule-section">
      <div className="alert-group-section-header">
        <h3 className="rule-section--heading">
          {t('url_alert_setting.cond_title')}
        </h3>
      </div>
      <div className="rule-section--body">
        <div className="alert-group-template-container">
          {children}

          <div className="alert-group-setting-row alert-group-setting-row--template-summary">
            <div className="alert-group-setting-label alert-group-setting-label--aligned">
              {t('url_alert_setting.metric_label')}
            </div>
            <div className="alert-group-setting-control">
              <div className="alert-group-selected-template-name">
                {selectedTemplate
                  ? selectedTemplate.name
                  : t('url_alert_setting.select_template')}
              </div>
              {selectedTemplate?.description && (
                <p className="alert-group-setting-helper">
                  {selectedTemplate.description}
                </p>
              )}
            </div>
          </div>

          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label alert-group-setting-label--aligned">
              {t('url_alert_setting.latency_label')}
            </div>
            <div className="alert-group-setting-control">
              <div className="alert-group-setting-row child-component">
                <div className="alert-group-setting-label alert-group-setting-label--aligned">
                  {t('url_alert_setting.condition_method')}
                </div>
                <div className="alert-group-setting-control">
                  <div className="alert-group-condition-flex-row-12">
                    <span className="alert-group-condition-text-light-sm">
                      {t('alert_group_rule.choose_one')}
                    </span>
                    <Radio color={ComponentColor.Success}>
                      <Radio.Button
                        id="url-trigger-threshold"
                        value="threshold"
                        active={isThreshold}
                        onClick={() => handleTriggerTypeChange('threshold')}
                      >
                        {t('alert_group_rule.threshold')}
                      </Radio.Button>
                      <Radio.Button
                        id="url-trigger-relative"
                        value="relative"
                        active={spec.trigger === 'relative'}
                        onClick={() => handleTriggerTypeChange('relative')}
                      >
                        {t('alert_group_rule.relative')}
                      </Radio.Button>
                    </Radio>
                  </div>
                </div>
              </div>

              {!isThreshold && (
                <div className="alert-group-condition-flex-wrap">
                  <span className="alert-group-condition-text-light">
                    {t('alert_group_rule.cond_prev')}
                  </span>
                  <Dropdown
                    menuWidth="80px"
                    selected={spec.values?.shift || '1m'}
                    onChoose={(item: any) =>
                      handleTriggerValueChange('shift', item.value)
                    }
                    buttonColor="btn-default"
                    buttonSize="btn-sm"
                    items={SHIFTS.map(shift => ({text: shift, value: shift}))}
                  />
                  <span className="alert-group-condition-text-light">
                    {t('alert_group_rule.cond_vs')}
                  </span>
                  <Dropdown
                    menuWidth="120px"
                    selected={
                      changesOptions.find(
                        o => o.value === (spec.values?.change || 'change')
                      )?.label || 'change'
                    }
                    onChoose={(item: any) =>
                      handleTriggerValueChange('change', item.value)
                    }
                    buttonColor="btn-default"
                    buttonSize="btn-sm"
                    items={changesOptions.map(o => ({
                      text: o.label,
                      value: o.value,
                    }))}
                  />
                  <span className="alert-group-condition-text-light">
                    {t('alert_group_rule.cond_is')}
                  </span>
                </div>
              )}

              <div className="alert-group-template-thresholds">
                {sortConditions(spec.conditions).map((cond, idx) => {
                  const selectedOperator = conditionOperators.find(
                    o => o.value === (cond.operator || defaultOperator)
                  )
                  return (
                    <div key={idx} className="alert-group-condition-flex-row-12">
                      <SlideToggle
                        active={cond.enabled}
                        onChange={() =>
                          handleToggleCondition(idx, !cond.enabled)
                        }
                        size={ComponentSize.ExtraSmall}
                        color={conditionToggleColor(cond.level)}
                      />
                      <span
                        className={`alert-group-threshold--badge alert-group-condition-w80 ${
                          cond.level
                        }${!cond.enabled ? ' disabled' : ''}`}
                      >
                        {conditionLabel(cond.level, t)}
                      </span>
                      {cond.enabled && (
                        <>
                          <Dropdown
                            menuWidth={operatorMenuWidth}
                            selected={
                              selectedOperator?.label ||
                              conditionOperators[0]?.label ||
                              ''
                            }
                            onChoose={(item: any) =>
                              handleConditionOperator(idx, item.value)
                            }
                            buttonColor="btn-default"
                            buttonSize="btn-sm"
                            items={conditionOperators.map(o => ({
                              text: o.label,
                              value: o.value,
                            }))}
                          />
                          <div className="alert-group-condition-w100">
                            <Input
                              value={cond.value}
                              onChange={e =>
                                handleConditionValue(idx, e.target.value)
                              }
                              type={InputType.Number}
                              size={ComponentSize.Small}
                              placeholder={valuePlaceholder}
                            />
                          </div>
                          {!isThreshold && spec.values?.change === '% change' && (
                            <span className="alert-group-condition-text-light">
                              %
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label alert-group-setting-label--aligned">
              {t('url_alert_setting.status_label')}
            </div>
            <div className="alert-group-setting-control">
              <div className="alert-group-template-thresholds">
                {([
                  {
                    key: 'check4xx' as const,
                    label: t('url_alert_setting.status_client4xx'),
                  },
                  {
                    key: 'check5xx' as const,
                    label: t('url_alert_setting.status_server5xx'),
                  },
                  {
                    key: 'unknown' as const,
                    label: t('url_alert_setting.status_unknown'),
                  },
                ] as const).map(({key, label}) => {
                  const enabled = urlErrorConfig[key]
                  return (
                    <div
                      key={key}
                      className="alert-group-condition-flex-row-12"
                    >
                      <SlideToggle
                        active={enabled}
                        onChange={() =>
                          handleStatusFilterChange(key, !enabled)
                        }
                        size={ComponentSize.ExtraSmall}
                        color={ComponentColor.Danger}
                      />
                      <span
                        className={`alert-group-threshold--badge url-alert-condition-status-badge critical${
                          !enabled ? ' disabled' : ''
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label alert-group-setting-label--aligned">
              {t('alert_group_rule.occurrence_count')}
            </div>
            <div className="alert-group-setting-control">
              {renderOccurrenceControls()}
            </div>
          </div>
        </div>

        <div className="alert-group-setting-row">
          <div className="alert-group-setting-label alert-group-setting-label--flex">
            {t('alert_group_rule.notify_recovery')}
            <QuestionMarkTooltip
              tipID="url-recovery-tooltip"
              tipContent={t('alert_group_rule.recovery_tooltip')}
            />
          </div>
          <div className="alert-group-setting-control">
            <div className="alert-group-setting-inputs">
              <SlideToggle
                active={rule.notifyRecovery}
                onChange={() => {
                  const nextVal = !rule.notifyRecovery
                  onUpdateRule({
                    notifyRecovery: nextVal,
                    pauseSeconds: nextVal ? rule.pauseSeconds : 0,
                  })
                }}
                size={ComponentSize.ExtraSmall}
                color={ComponentColor.Primary}
              />
            </div>
            <p className="alert-group-setting-helper">
              {t('alert_group_rule.recovery_desc1')}
            </p>
          </div>
        </div>

        <div className="alert-group-setting-row">
          <div className="alert-group-setting-label alert-group-setting-label--flex">
            {t('alert_group_rule.pause')}
            <QuestionMarkTooltip
              tipID="url-pause-tooltip"
              tipContent={t('alert_group_rule.pause_tooltip')}
            />
          </div>
          <div className="alert-group-setting-control">
            <div className="alert-group-setting-inputs">
              <Dropdown
                menuWidth="240px"
                selected={
                  selectedPause
                    ? selectedPause.label
                    : t('alert_group_rule.do_not_use')
                }
                onChoose={(item: any) =>
                  onUpdateRule({pauseSeconds: parseInt(item.value, 10)})
                }
                buttonColor="btn-default"
                buttonSize="btn-sm"
                items={translatedPauseOptions.map(o => ({
                  text: o.label,
                  value: o.value,
                }))}
              />
            </div>
            <p className="alert-group-setting-helper">
              {t('alert_group_rule.pause_desc1')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default URLAlertConditionSection
