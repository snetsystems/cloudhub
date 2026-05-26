// frontend/src/alert_group/components/AlertGroupConditionSection.tsx
import React, {PureComponent} from 'react'
import uuid from 'uuid'
import {withTranslation, WithTranslation} from 'react-i18next'
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

import {SHIFTS, PERIODS} from 'src/kapacitor/constants'

import DatabaseList from 'src/shared/components/DatabaseList'
import MeasurementList from 'src/shared/components/MeasurementList'
import FieldList from 'src/shared/components/FieldList'

import {
  ApplyFuncsToFieldArgs,
  Field,
  Me,
  Namespace,
  QueryConfig,
  Source,
  Tag,
} from 'src/types'

import {
  AlertGroupRule,
  AlertTemplate,
  TRIGGER_OPERATORS,
  PAUSE_SECONDS_OPTIONS,
} from 'src/alert_group/types'
import {findSelectedAlertTemplate} from 'src/alert_group/utils/alertTemplates'

interface Props extends WithTranslation {
  source: Source
  me: Me
  isUsingAuth: boolean
  rule: AlertGroupRule
  templates?: AlertTemplate[]
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
  builderMode?: 'template' | 'raw'
  onSwitchToRawMode?: () => void
  children?: React.ReactNode
}

interface State {
  queryConfig: QueryConfig
}

const EMPTY_QUERY_CONFIG: Partial<QueryConfig> = {
  tags: {},
  areTagsAccepted: false,
  groupBy: {time: '', tags: []},
  fill: 'null',
  rawText: null,
  range: null,
  shifts: [],
}

class AlertGroupConditionSection extends PureComponent<Props, State> {
  private conditionToggleColor = (level: string): ComponentColor => {
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

  private conditionLabel = (level: string): string => {
    switch (level) {
      case 'critical':
        return 'Critical'
      case 'warning':
        return 'Warning'
      case 'info':
        return 'Info'
      default:
        return level
    }
  }

  private readonly instanceId = uuid.v4()

  private getRelativeOperatorOptions = (t: any) => [
    {label: t('alert_group_rule.op_gt'), value: 'greater than'},
    {label: t('alert_group_rule.op_gte'), value: 'equal to or greater'},
    {label: t('alert_group_rule.op_lt'), value: 'less than'},
    {label: t('alert_group_rule.op_lte'), value: 'equal to or less than'},
    {label: t('alert_group_rule.op_eq'), value: 'equal to'},
    {label: t('alert_group_rule.op_neq'), value: 'not equal to'},
  ]

  private getChangesOptions = (t: any) => [
    {label: t('alert_group_rule.opt_change'), value: 'change'},
    {label: t('alert_group_rule.opt_pct_change'), value: '% change'},
  ]

  private getTranslatedTriggerOperators = (t: any) =>
    TRIGGER_OPERATORS.map(o => {
      const tKeyMap: Record<string, string> = {
        greater: 'op_gt',
        greater_equal: 'op_gte',
        less: 'op_lt',
        less_equal: 'op_lte',
        equal: 'op_eq',
        not_equal: 'op_neq',
      }
      return {
        label: t(`alert_group_rule.${tKeyMap[o.value] || o.value}`),
        value: o.value,
      }
    })

  private getTranslatedPauseOptions = (t: any) =>
    PAUSE_SECONDS_OPTIONS.map(o => {
      const tKeyMap: Record<number, string> = {
        0: 'do_not_use',
        300: 'pause_300',
        600: 'pause_600',
        1800: 'pause_1800',
        3600: 'pause_3600',
      }
      return {
        label: t(`alert_group_rule.${tKeyMap[o.value] || o.value}`),
        value: o.value,
      }
    })

  constructor(props: Props) {
    super(props)

    const {source, rule} = props
    // Edit mode: pre-populate from saved rule. New mode: auto-select default DB.
    this.state = {
      queryConfig: {
        ...EMPTY_QUERY_CONFIG,
        id: this.instanceId,
        database: rule.database || source.telegraf || 'telegraf',
        retentionPolicy: rule.retentionPolicy || 'autogen',
        measurement: rule.measurement || '',
        fields: rule.field
          ? [{value: rule.field, type: 'field', alias: '', args: []}]
          : [],
      } as QueryConfig,
    }
  }

  public componentDidMount() {
    const {rule, source, onUpdateRule} = this.props
    if (!rule.database) {
      onUpdateRule({
        database: source.telegraf || 'telegraf',
        retentionPolicy: 'autogen',
      })
    }
  }

  public componentDidUpdate(prevProps: Props) {
    const {rule, source} = this.props
    if (
      prevProps.rule.database !== rule.database ||
      prevProps.rule.retentionPolicy !== rule.retentionPolicy ||
      prevProps.rule.measurement !== rule.measurement ||
      prevProps.rule.field !== rule.field
    ) {
      this.setState({
        queryConfig: {
          ...EMPTY_QUERY_CONFIG,
          id: this.instanceId,
          database: rule.database || source.telegraf || 'telegraf',
          retentionPolicy: rule.retentionPolicy || 'autogen',
          measurement: rule.measurement || '',
          fields: rule.field
            ? [{value: rule.field, type: 'field', alias: '', args: []}]
            : [],
        } as QueryConfig,
      })
    }
  }

  // ── QueryConfig handlers ───────────────────────────────────────────────────

  private handleChooseNamespace = (namespace: Namespace): void => {
    this.setState(prev => ({
      queryConfig: {
        ...prev.queryConfig,
        database: namespace.database,
        retentionPolicy: namespace.retentionPolicy,
        measurement: '',
        fields: [],
      },
    }))
    this.props.onUpdateRule({
      database: namespace.database,
      retentionPolicy: namespace.retentionPolicy,
      measurement: '',
      field: '',
    })
  }

  private handleChooseMeasurement = (measurement: string): void => {
    this.setState(prev => ({
      queryConfig: {
        ...prev.queryConfig,
        measurement,
        fields: [],
      },
    }))
    this.props.onUpdateRule({measurement, field: ''})
  }

  private handleToggleField = (field: Field): void => {
    const {queryConfig} = this.state
    const currentFields = queryConfig.fields || []
    const isSelected = currentFields.some(f => f.value === field.value)
    const nextFields = isSelected ? [] : [field]
    this.setState(prev => ({
      queryConfig: {...prev.queryConfig, fields: nextFields},
    }))
    this.props.onUpdateRule({field: isSelected ? '' : field.value})
  }

  private handleApplyFuncsToField = ({field}: ApplyFuncsToFieldArgs): void => {
    const nextFields = [field]
    this.setState(prev => ({
      queryConfig: {...prev.queryConfig, fields: nextFields},
    }))
    this.props.onUpdateRule({field: field.value})
  }

  private handleChooseTag = (tag: Tag): void => {
    const {queryConfig} = this.state
    const existingValues: string[] = (queryConfig.tags || {})[tag.key] || []
    const hasValue = existingValues.includes(tag.value)
    const nextValues = hasValue
      ? existingValues.filter(v => v !== tag.value)
      : [...existingValues, tag.value]
    this.setState(prev => ({
      queryConfig: {
        ...prev.queryConfig,
        tags: {...(prev.queryConfig.tags || {}), [tag.key]: nextValues},
      },
    }))
  }

  private handleGroupByTag = (tagKey: string): void => {
    const {queryConfig} = this.state
    const currentTags: string[] = (queryConfig.groupBy || {tags: []}).tags || []
    const hasTag = currentTags.includes(tagKey)
    const nextTags = hasTag
      ? currentTags.filter(t => t !== tagKey)
      : [...currentTags, tagKey]
    this.setState(prev => ({
      queryConfig: {
        ...prev.queryConfig,
        groupBy: {
          ...(prev.queryConfig.groupBy || {time: 'auto', tags: []}),
          tags: nextTags,
        },
      },
    }))
  }

  private handleToggleTagAcceptance = (): void => {
    this.setState(prev => ({
      queryConfig: {
        ...prev.queryConfig,
        areTagsAccepted: !prev.queryConfig.areTagsAccepted,
      },
    }))
  }

  private handleGroupByTime = (time: string): void => {
    this.setState(prev => ({
      queryConfig: {
        ...prev.queryConfig,
        groupBy: {
          ...(prev.queryConfig.groupBy || {time: 'auto', tags: []}),
          time,
        },
      },
    }))
  }

  private handleRemoveFuncs = (fields: Field[]): void => {
    this.setState(prev => ({queryConfig: {...prev.queryConfig, fields}}))
  }

  // ── Condition handlers ─────────────────────────────────────────────────────

  private handleToggleCondition = (idx: number, enabled: boolean): void => {
    const next = this.props.rule.conditions.map((c, i) =>
      i === idx ? {...c, enabled} : c
    )
    this.props.onUpdateRule({conditions: next})
  }

  private handleTriggerTypeChange = (
    trigger: 'threshold' | 'relative' | 'deadman'
  ) => {
    // Deadman is meaningful only on Kapacitor stream tasks (matches legacy TICK generation).
    if (trigger === 'deadman') {
      this.props.onUpdateRule({trigger, taskType: 'stream'})
      return
    }
    this.props.onUpdateRule({trigger})
  }

  private handleTriggerValueChange = (key: string, value: string) => {
    const {rule, onUpdateRule} = this.props
    onUpdateRule({
      triggerValues: {
        ...(rule.triggerValues || {}),
        [key]: value,
      },
    })
  }

  private handleConditionValue = (idx: number, value: string): void => {
    const next = this.props.rule.conditions.map((c, i) =>
      i === idx ? {...c, value} : c
    )
    this.props.onUpdateRule({conditions: next})
  }

  // ── Render Template UI ─────────────────────────────────────────────────────

  private renderTemplateUI(): JSX.Element {
    const {rule, templates, onUpdateRule, t} = this.props
    const selectedTemplate = findSelectedAlertTemplate(templates, rule)

    return (
      <div className="alert-group-template-container">
        {this.props.children}
        <div className="alert-group-setting-row alert-group-setting-row--template-summary">
          <div className="alert-group-setting-label alert-group-setting-label--aligned">
            {t('alert_group_rule.metric_setting')}
          </div>
          <div className="alert-group-setting-control">
            <div className="alert-group-selected-template-name">
              {selectedTemplate
                ? selectedTemplate.name
                : t('alert_group_rule.select_template')}
            </div>

            {/* Alert Type Selector */}
            <div className="alert-group-setting-row child-component">
              <div className="alert-group-setting-label alert-group-setting-label--aligned">
                {t('alert_group_rule.alert_type')}
              </div>
              <div className="alert-group-setting-control">
                <div className="alert-group-condition-flex-row-12">
                  <span className="alert-group-condition-text-light-sm">
                    {t('alert_group_rule.choose_one')}
                  </span>
                  <Radio color={ComponentColor.Success}>
                    <Radio.Button
                      id="trigger-threshold"
                      value="threshold"
                      active={!rule.trigger || rule.trigger === 'threshold'}
                      onClick={() => this.handleTriggerTypeChange('threshold')}
                    >
                      {t('alert_group_rule.threshold')}
                    </Radio.Button>
                    <Radio.Button
                      id="trigger-relative"
                      value="relative"
                      active={rule.trigger === 'relative'}
                      onClick={() => this.handleTriggerTypeChange('relative')}
                    >
                      {t('alert_group_rule.relative')}
                    </Radio.Button>
                    <Radio.Button
                      id="trigger-deadman"
                      value="deadman"
                      active={rule.trigger === 'deadman'}
                      onClick={() => this.handleTriggerTypeChange('deadman')}
                    >
                      {t('alert_group_rule.deadman')}
                    </Radio.Button>
                  </Radio>
                </div>
              </div>
            </div>

            {/* Threshold Rows */}
            {(!rule.trigger || rule.trigger === 'threshold') && (
              <div className="alert-group-template-thresholds">
                {rule.conditions.map((cond, idx) => {
                  const translatedTriggerOperators = this.getTranslatedTriggerOperators(
                    t
                  )
                  const selectedOperator = translatedTriggerOperators.find(
                    o => o.value === rule.triggerOperator
                  )
                  return (
                    <div
                      key={idx}
                      className="alert-group-condition-flex-row-12"
                    >
                      <SlideToggle
                        active={cond.enabled}
                        onChange={() =>
                          this.handleToggleCondition(idx, !cond.enabled)
                        }
                        size={ComponentSize.ExtraSmall}
                        color={this.conditionToggleColor(cond.level)}
                      />
                      <span
                        className={`alert-group-threshold--badge alert-group-condition-w80 ${
                          cond.level
                        }${!cond.enabled ? ' disabled' : ''}`}
                      >
                        {this.conditionLabel(cond.level)}
                      </span>

                      {cond.enabled && (
                        <>
                          <Dropdown
                            menuWidth="100px"
                            selected={
                              selectedOperator
                                ? selectedOperator.label
                                : translatedTriggerOperators[0].label
                            }
                            onChoose={(item: any) =>
                              onUpdateRule({triggerOperator: item.value as any})
                            }
                            buttonColor="btn-default"
                            buttonSize="btn-sm"
                            items={translatedTriggerOperators.map(o => ({
                              text: o.label,
                              value: o.value,
                            }))}
                          />
                          <div className="alert-group-condition-w100">
                            <Input
                              value={cond.value}
                              onChange={e =>
                                this.handleConditionValue(idx, e.target.value)
                              }
                              type={InputType.Number}
                              size={ComponentSize.Small}
                              placeholder={t(
                                'alert_group_rule.threshold_placeholder'
                              )}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {rule.trigger === 'relative' && (
              <div className="alert-group-setting-row">
                <div className="alert-group-setting-label alert-group-setting-label--aligned">
                  {t('alert_group_rule.metric_setting')}
                </div>
                <div className="alert-group-setting-control alert-group-condition-flex-col-16">
                  <div className="alert-group-condition-flex-wrap">
                    <span className="alert-group-condition-text-light">
                      {t('alert_group_rule.cond_prev')}
                    </span>
                    <Dropdown
                      menuWidth="80px"
                      selected={rule.triggerValues?.shift || '1m'}
                      onChoose={(item: any) =>
                        this.handleTriggerValueChange('shift', item.value)
                      }
                      buttonColor="btn-default"
                      buttonSize="btn-sm"
                      items={SHIFTS.map(t => ({text: t, value: t}))}
                    />
                    <span className="alert-group-condition-text-light">
                      {t('alert_group_rule.cond_vs')}
                    </span>
                    <Dropdown
                      menuWidth="120px"
                      selected={
                        this.getChangesOptions(t).find(
                          o =>
                            o.value === (rule.triggerValues?.change || 'change')
                        )?.label || 'change'
                      }
                      onChoose={(item: any) =>
                        this.handleTriggerValueChange('change', item.value)
                      }
                      buttonColor="btn-default"
                      buttonSize="btn-sm"
                      items={this.getChangesOptions(t).map(o => ({
                        text: o.label,
                        value: o.value,
                      }))}
                    />
                    <span className="alert-group-condition-text-light">
                      {t('alert_group_rule.cond_is')}
                    </span>
                  </div>

                  <div className="alert-group-template-thresholds">
                    {rule.conditions.map((cond, idx) => {
                      const relativeOpOptions = this.getRelativeOperatorOptions(
                        t
                      )
                      const selectedOperator =
                        rule.triggerValues?.operator || 'greater than'
                      const selectedOpObj = relativeOpOptions.find(
                        o => o.value === selectedOperator
                      )
                      return (
                        <div
                          key={idx}
                          className="alert-group-condition-flex-row-12"
                        >
                          <SlideToggle
                            active={cond.enabled}
                            onChange={() =>
                              this.handleToggleCondition(idx, !cond.enabled)
                            }
                            size={ComponentSize.ExtraSmall}
                            color={this.conditionToggleColor(cond.level)}
                          />
                          <span
                            className={`alert-group-threshold--badge alert-group-condition-w80 ${
                              cond.level
                            }${!cond.enabled ? ' disabled' : ''}`}
                          >
                            {this.conditionLabel(cond.level)}
                          </span>

                          {cond.enabled && (
                            <>
                              <Dropdown
                                menuWidth="160px"
                                selected={
                                  selectedOpObj
                                    ? selectedOpObj.label
                                    : selectedOperator
                                }
                                onChoose={(item: any) =>
                                  this.handleTriggerValueChange(
                                    'operator',
                                    item.value
                                  )
                                }
                                buttonColor="btn-default"
                                buttonSize="btn-sm"
                                items={relativeOpOptions.map(o => ({
                                  text: o.label,
                                  value: o.value,
                                }))}
                              />
                              <div className="alert-group-condition-w100">
                                <Input
                                  value={cond.value}
                                  onChange={e =>
                                    this.handleConditionValue(
                                      idx,
                                      e.target.value
                                    )
                                  }
                                  type={InputType.Number}
                                  size={ComponentSize.Small}
                                  placeholder={t(
                                    'alert_group_rule.value_input'
                                  )}
                                />
                              </div>
                              {rule.triggerValues?.change === '% change' && (
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
            )}
            {rule.trigger === 'deadman' && (
              <div className="alert-group-setting-row">
                <div className="alert-group-setting-label alert-group-setting-label--aligned">
                  {t('alert_group_rule.metric_setting')}
                </div>
                <div className="alert-group-setting-control alert-group-condition-flex-col-16">
                  <div className="alert-group-condition-flex-row-8">
                    <span className="alert-group-condition-text-light">
                      {t('alert_group_rule.deadman_data_receipt')}
                    </span>
                    <Dropdown
                      menuWidth="60px"
                      selected={rule.triggerValues?.period || '1m'}
                      onChoose={(item: any) =>
                        this.handleTriggerValueChange('period', item.value)
                      }
                      buttonColor="btn-default"
                      buttonSize="btn-sm"
                      items={PERIODS.map(val => ({text: val, value: val}))}
                    />
                    <span className="alert-group-condition-text-light">
                      {t('alert_group_rule.deadman_no_data_for')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  public render() {
    const {
      rule,
      onUpdateRule,
      source,
      me,
      isUsingAuth,
      builderMode,
      templates,
      t,
    } = this.props
    const {queryConfig} = this.state

    const translatedPauseOptions = this.getTranslatedPauseOptions(t)
    const selectedPause = translatedPauseOptions.find(
      o => o.value === rule.pauseSeconds
    )
    const isTemplateMode = builderMode !== 'raw'
    const selectedTemplate = templates ? findSelectedAlertTemplate(templates, rule) : undefined

    return (
      <div className="rule-section">
        <div className="alert-group-section-header">
          <h3 className="rule-section--heading">
            {t('alert_group_rule.cond_def_title')}
          </h3>
        </div>
        <div className="rule-section--body">
          {isTemplateMode ? (
            this.renderTemplateUI()
          ) : (
            <>
              {/* ── 3-패널 Time Series 브라우저 ── */}
              <div
                className={`query-builder${selectedTemplate ? ' query-builder--disabled' : ''}`}
              >
                <DatabaseList
                  query={queryConfig}
                  onChooseNamespace={this.handleChooseNamespace}
                  me={me}
                  isUsingAuth={isUsingAuth}
                />
                <MeasurementList
                  query={queryConfig}
                  onChooseMeasurement={this.handleChooseMeasurement}
                  onChooseTag={this.handleChooseTag}
                  onGroupByTag={this.handleGroupByTag}
                  onToggleTagAcceptance={this.handleToggleTagAcceptance}
                  isKapacitorRule={true}
                />
                <FieldList
                  query={queryConfig}
                  onToggleField={this.handleToggleField}
                  applyFuncsToField={this.handleApplyFuncsToField}
                  onGroupByTime={this.handleGroupByTime}
                  removeFuncs={this.handleRemoveFuncs}
                  isKapacitorRule={true}
                  source={source}
                />
              </div>

              {this.props.children}

              {/* Alert Type Selector */}
              <div className="alert-group-setting-row">
                <div className="alert-group-setting-label alert-group-setting-label--aligned">
                  {t('alert_group_rule.alert_type')}
                </div>
                <div className="alert-group-setting-control alert-group-condition-flex-col-16">
                  <div className="alert-group-condition-flex-row-12">
                    <span className="alert-group-condition-text-light-sm">
                      {t('alert_group_rule.choose_one')}
                    </span>
                    <Radio color={ComponentColor.Success}>
                      <Radio.Button
                        id="trigger-threshold"
                        value="threshold"
                        active={!rule.trigger || rule.trigger === 'threshold'}
                        onClick={() =>
                          this.handleTriggerTypeChange('threshold')
                        }
                      >
                        {t('alert_group_rule.threshold')}
                      </Radio.Button>
                      <Radio.Button
                        id="trigger-relative"
                        value="relative"
                        active={rule.trigger === 'relative'}
                        onClick={() => this.handleTriggerTypeChange('relative')}
                      >
                        {t('alert_group_rule.relative')}
                      </Radio.Button>
                      <Radio.Button
                        id="trigger-deadman"
                        value="deadman"
                        active={rule.trigger === 'deadman'}
                        onClick={() => this.handleTriggerTypeChange('deadman')}
                      >
                        {t('alert_group_rule.deadman')}
                      </Radio.Button>
                    </Radio>
                  </div>
                </div>
              </div>

              {(!rule.trigger || rule.trigger === 'threshold') && (
                <div className="alert-group-setting-row">
                  <div className="alert-group-setting-label alert-group-setting-label--aligned">
                    {t('alert_group_rule.metric_setting')}
                  </div>
                  <div className="alert-group-setting-control alert-group-condition-flex-col-16">
                    <div className="alert-group-template-thresholds">
                      {rule.conditions.map((cond, idx) => {
                        const translatedTriggerOperators = this.getTranslatedTriggerOperators(
                          t
                        )
                        const selectedOperator = translatedTriggerOperators.find(
                          o => o.value === rule.triggerOperator
                        )
                        return (
                          <div
                            key={idx}
                            className="alert-group-condition-flex-row-12"
                          >
                            <SlideToggle
                              active={cond.enabled}
                              onChange={() =>
                                this.handleToggleCondition(idx, !cond.enabled)
                              }
                              size={ComponentSize.ExtraSmall}
                              color={this.conditionToggleColor(cond.level)}
                            />
                            <span
                              className={`alert-group-threshold--badge alert-group-condition-w80 ${
                                cond.level
                              }${!cond.enabled ? ' disabled' : ''}`}
                            >
                              {this.conditionLabel(cond.level)}
                            </span>

                            {cond.enabled && (
                              <>
                                <Dropdown
                                  menuWidth="100px"
                                  selected={
                                    selectedOperator
                                      ? selectedOperator.label
                                      : translatedTriggerOperators[0].label
                                  }
                                  onChoose={(item: any) =>
                                    onUpdateRule({
                                      triggerOperator: item.value,
                                    })
                                  }
                                  buttonColor="btn-default"
                                  buttonSize="btn-sm"
                                  items={translatedTriggerOperators.map(o => ({
                                    text: o.label,
                                    value: o.value,
                                  }))}
                                />
                                <div className="alert-group-condition-w100">
                                  <Input
                                    value={cond.value}
                                    onChange={e =>
                                      this.handleConditionValue(
                                        idx,
                                        e.target.value
                                      )
                                    }
                                    type={InputType.Number}
                                    size={ComponentSize.Small}
                                    placeholder={t(
                                      'alert_group_rule.threshold_placeholder'
                                    )}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              {rule.trigger === 'relative' && (
                <div className="alert-group-setting-row">
                  <div className="alert-group-setting-label alert-group-setting-label--aligned">
                    {t('alert_group_rule.metric_setting')}
                  </div>
                  <div className="alert-group-setting-control alert-group-condition-flex-col-16">
                    <div className="alert-group-condition-flex-wrap">
                      <span className="alert-group-condition-text-light">
                        {t('alert_group_rule.cond_prev')}
                      </span>
                      <Dropdown
                        menuWidth="60px"
                        selected={rule.triggerValues?.shift || '1m'}
                        onChoose={(item: any) =>
                          this.handleTriggerValueChange('shift', item.value)
                        }
                        buttonColor="btn-default"
                        buttonSize="btn-sm"
                        items={SHIFTS.map(val => ({text: val, value: val}))}
                      />
                      <span className="alert-group-condition-text-light">
                        {t('alert_group_rule.cond_vs')}
                      </span>
                      <Dropdown
                        menuWidth="120px"
                        selected={
                          this.getChangesOptions(t).find(
                            o =>
                              o.value ===
                              (rule.triggerValues?.change || 'change')
                          )?.label || 'change'
                        }
                        onChoose={(item: any) =>
                          this.handleTriggerValueChange('change', item.value)
                        }
                        buttonColor="btn-default"
                        buttonSize="btn-sm"
                        items={this.getChangesOptions(t).map(o => ({
                          text: o.label,
                          value: o.value,
                        }))}
                      />
                      <span className="alert-group-condition-text-light">
                        {t('alert_group_rule.cond_is')}
                      </span>
                    </div>

                    <div className="alert-group-template-thresholds">
                      {rule.conditions.map((cond, idx) => {
                        const relativeOpOptions = this.getRelativeOperatorOptions(
                          t
                        )
                        const selectedOperator =
                          rule.triggerValues?.operator || 'greater than'
                        const selectedOpObj = relativeOpOptions.find(
                          o => o.value === selectedOperator
                        )
                        return (
                          <div
                            key={idx}
                            className="alert-group-condition-flex-row-12"
                          >
                            <SlideToggle
                              active={cond.enabled}
                              onChange={() =>
                                this.handleToggleCondition(idx, !cond.enabled)
                              }
                              size={ComponentSize.ExtraSmall}
                              color={this.conditionToggleColor(cond.level)}
                            />
                            <span
                              className={`alert-group-threshold--badge alert-group-condition-w80 ${
                                cond.level
                              }${!cond.enabled ? ' disabled' : ''}`}
                            >
                              {this.conditionLabel(cond.level)}
                            </span>

                            {cond.enabled && (
                              <>
                                <Dropdown
                                  menuWidth="160px"
                                  selected={
                                    selectedOpObj
                                      ? selectedOpObj.label
                                      : selectedOperator
                                  }
                                  onChoose={(item: any) =>
                                    this.handleTriggerValueChange(
                                      'operator',
                                      item.value
                                    )
                                  }
                                  buttonColor="btn-default"
                                  buttonSize="btn-sm"
                                  items={relativeOpOptions.map(o => ({
                                    text: o.label,
                                    value: o.value,
                                  }))}
                                />
                                <div className="alert-group-condition-w100">
                                  <Input
                                    value={cond.value}
                                    onChange={e =>
                                      this.handleConditionValue(
                                        idx,
                                        e.target.value
                                      )
                                    }
                                    type={InputType.Number}
                                    size={ComponentSize.Small}
                                    placeholder={t(
                                      'alert_group_rule.value_input'
                                    )}
                                  />
                                </div>
                                {rule.triggerValues?.change === '% change' && (
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
              )}
              {rule.trigger === 'deadman' && (
                <div className="alert-group-setting-row">
                  <div className="alert-group-setting-label alert-group-setting-label--aligned">
                    {t('alert_group_rule.metric_setting')}
                  </div>
                  <div className="alert-group-setting-control alert-group-condition-flex-col-16">
                    <div className="alert-group-condition-flex-row-8">
                      <span className="alert-group-condition-text-light">
                        {t('alert_group_rule.deadman_data_receipt')}
                      </span>
                      <Dropdown
                        menuWidth="80px"
                        selected={rule.triggerValues?.period || '10m'}
                        onChoose={(item: any) =>
                          this.handleTriggerValueChange('period', item.value)
                        }
                        buttonColor="btn-default"
                        buttonSize="btn-sm"
                        items={PERIODS.map(val => ({text: val, value: val}))}
                      />
                      <span className="alert-group-condition-text-light">
                        {t('alert_group_rule.deadman_no_data_for')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Occurrence Group */}
          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label">
              {t('alert_group_rule.occurrence_count')}
            </div>
            <div className="alert-group-setting-control">
              <div className="alert-group-setting-inputs">
                <Radio
                  shape={ButtonShape.Default}
                  customClass="alert-group-rule-builder__radio"
                >
                  <Radio.Button
                    id="occ-consecutive"
                    value="consecutive"
                    active={rule.occurrenceType === 'consecutive'}
                    onClick={(_v: string) =>
                      onUpdateRule({occurrenceType: 'consecutive'})
                    }
                    titleText={t('alert_group_rule.occ_consecutive')}
                  >
                    {t('alert_group_rule.occ_consecutive')}
                  </Radio.Button>
                  <Radio.Button
                    id="occ-total"
                    value="total"
                    active={rule.occurrenceType === 'total'}
                    onClick={(_v: string) =>
                      onUpdateRule({occurrenceType: 'total'})
                    }
                    titleText={t('alert_group_rule.occ_recent')}
                  >
                    {t('alert_group_rule.occ_recent')}
                  </Radio.Button>
                </Radio>
                <Dropdown
                  menuWidth="80px"
                  selected={rule.occurrenceWindow || '1m'}
                  onChoose={(item: any) =>
                    onUpdateRule({occurrenceWindow: item.value})
                  }
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
              </div>
            </div>
          </div>

          {/* Resolved Alert Group (단발성 알림) */}
          <div className="alert-group-setting-row">
            <div
              className="alert-group-setting-label alert-group-setting-label--flex"
            >
              {t('alert_group_rule.notify_recovery')}
              <QuestionMarkTooltip
                tipID="recovery-tooltip"
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
                      pauseSeconds: nextVal ? rule.pauseSeconds : 0, // 단발성 알림이 꺼질 때 리마인드 주기를 사용 안 함으로 초기화
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

          {/* Pause Group (리마인드 주기) - 단발성 알림이 on 되었을 때만 표시 */}
          {rule.notifyRecovery && (
            <div className="alert-group-setting-row">
              <div
                className="alert-group-setting-label alert-group-setting-label--flex"
              >
                {t('alert_group_rule.pause')}
                <QuestionMarkTooltip
                  tipID="pause-tooltip"
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
          )}
        </div>
      </div>
    )
  }
}

export default withTranslation()(AlertGroupConditionSection)
