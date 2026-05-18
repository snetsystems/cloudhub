// frontend/src/alert_group/components/AlertGroupConditionSection.tsx
import React, {PureComponent} from 'react'
import uuid from 'uuid'
import {
  Button,
  IconFont,
  ComponentColor,
  ComponentSize,
  Dropdown,
  DropdownMode,
  DropdownMenuColors,
  Input,
  InputType,
  Radio,
  ButtonShape,
  SlideToggle,
} from 'src/reusable_ui'

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
  TRIGGER_OPERATORS,
  PAUSE_SECONDS_OPTIONS,
  ALERT_TEMPLATES,
} from 'src/alert_group/types'

const RELATIVE_OPERATOR_OPTIONS = [
  {label: '초과 (>)', value: 'greater than'},
  {label: '이상 (>=)', value: 'equal to or greater'},
  {label: '미만 (<)', value: 'less than'},
  {label: '이하 (<=)', value: 'equal to or less than'},
  {label: '같음 (=)', value: 'equal to'},
  {label: '다름 (!=)', value: 'not equal to'},
]

const CHANGES_OPTIONS = [
  {label: '변화량', value: 'change'},
  {label: '변화율(%)', value: '% change'},
]

interface Props {
  source: Source
  me: Me
  isUsingAuth: boolean
  rule: AlertGroupRule
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
        return ComponentColor.Alert
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
    const {rule, onUpdateRule} = this.props
    const selectedTemplate = ALERT_TEMPLATES.find(
      t => t.measurement === rule.measurement && t.field === rule.field
    )

    return (
      <div className="alert-group-template-container">
        {this.props.children}
        <div className="alert-group-setting-row alert-group-setting-row--template-summary">
          <div className="alert-group-setting-label alert-group-setting-label--aligned">
            지표 설정
          </div>
          <div className="alert-group-setting-control">
            <div className="alert-group-selected-template-name">
              {selectedTemplate ? selectedTemplate.name : '템플릿을 선택하세요'}
            </div>

            {/* Alert Type Selector */}
            <div className="alert-group-setting-row">
              <div className="alert-group-setting-label alert-group-setting-label--aligned">
                Alert Type
              </div>
              <div className="alert-group-setting-control">
                <div
                  style={{display: 'flex', alignItems: 'center', gap: '12px'}}
                >
                  <span style={{color: '#999', fontSize: '13px'}}>
                    Choose One:
                  </span>
                  <Radio color={ComponentColor.Success}>
                    <Radio.Button
                      id="trigger-threshold"
                      value="threshold"
                      active={!rule.trigger || rule.trigger === 'threshold'}
                      onClick={() => this.handleTriggerTypeChange('threshold')}
                    >
                      Threshold
                    </Radio.Button>
                    <Radio.Button
                      id="trigger-relative"
                      value="relative"
                      active={rule.trigger === 'relative'}
                      onClick={() => this.handleTriggerTypeChange('relative')}
                    >
                      Relative
                    </Radio.Button>
                    <Radio.Button
                      id="trigger-deadman"
                      value="deadman"
                      active={rule.trigger === 'deadman'}
                      onClick={() => this.handleTriggerTypeChange('deadman')}
                    >
                      Deadman
                    </Radio.Button>
                  </Radio>
                </div>
              </div>
            </div>

            {/* Threshold Rows */}
            {(!rule.trigger || rule.trigger === 'threshold') && (
              <div
                className="alert-group-template-thresholds"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '8px',
                }}
              >
                {rule.conditions.map((cond, idx) => {
                  const selectedOperator = TRIGGER_OPERATORS.find(
                    o => o.value === rule.triggerOperator
                  )
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
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
                        className={`alert-group-threshold--badge ${cond.level}${
                          !cond.enabled ? ' disabled' : ''
                        }`}
                        style={{width: '80px', textAlign: 'center'}}
                      >
                        {this.conditionLabel(cond.level)}
                      </span>

                      {cond.enabled && (
                        <>
                          <Dropdown
                            widthPixels={100}
                            selectedID={
                              selectedOperator
                                ? selectedOperator.value
                                : TRIGGER_OPERATORS[0].value
                            }
                            onChange={(value: string) =>
                              onUpdateRule({triggerOperator: value as any})
                            }
                            buttonColor={ComponentColor.Default}
                            buttonSize={ComponentSize.Small}
                            menuColor={DropdownMenuColors.Onyx}
                            titleText="선택"
                            mode={DropdownMode.ActionList}
                          >
                            {TRIGGER_OPERATORS.map(o => (
                              <Dropdown.Item
                                key={o.value}
                                id={o.value}
                                value={o.value}
                              >
                                {o.label}
                              </Dropdown.Item>
                            ))}
                          </Dropdown>
                          <div style={{width: '100px'}}>
                            <Input
                              value={cond.value}
                              onChange={e =>
                                this.handleConditionValue(idx, e.target.value)
                              }
                              type={InputType.Number}
                              size={ComponentSize.Small}
                              placeholder="임계값"
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
                  지표 설정
                </div>
                <div
                  className="alert-group-setting-control"
                  style={{flexDirection: 'column', gap: '16px'}}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{color: '#999'}}>이전</span>
                    <Dropdown
                      selectedID={rule.triggerValues?.shift || '1m'}
                      onChange={(v: string) =>
                        this.handleTriggerValueChange('shift', v)
                      }
                      buttonSize={ComponentSize.Small}
                      buttonColor={ComponentColor.Default}
                      widthPixels={80}
                      mode={DropdownMode.ActionList}
                      menuColor={DropdownMenuColors.Amethyst}
                      titleText={rule.triggerValues?.shift || '1m'}
                    >
                      {SHIFTS.map(t => (
                        <Dropdown.Item key={t} id={t} value={t}>
                          {t}
                        </Dropdown.Item>
                      ))}
                    </Dropdown>
                    <span style={{color: '#999'}}>대비</span>
                    <Dropdown
                      selectedID={rule.triggerValues?.change || 'change'}
                      onChange={(v: string) =>
                        this.handleTriggerValueChange('change', v)
                      }
                      buttonSize={ComponentSize.Small}
                      buttonColor={ComponentColor.Default}
                      widthPixels={120}
                      mode={DropdownMode.ActionList}
                      menuColor={DropdownMenuColors.Amethyst}
                      titleText={
                        CHANGES_OPTIONS.find(
                          o =>
                            o.value === (rule.triggerValues?.change || 'change')
                        )?.label || 'change'
                      }
                    >
                      {CHANGES_OPTIONS.map(o => (
                        <Dropdown.Item
                          key={o.value}
                          id={o.value}
                          value={o.value}
                        >
                          {o.label}
                        </Dropdown.Item>
                      ))}
                    </Dropdown>
                    <span style={{color: '#999'}}>이(가)</span>
                  </div>

                  <div
                    className="alert-group-template-thresholds"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {rule.conditions.map((cond, idx) => {
                      const selectedOperator =
                        rule.triggerValues?.operator || 'greater than'
                      const selectedOpObj = RELATIVE_OPERATOR_OPTIONS.find(
                        o => o.value === selectedOperator
                      )
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
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
                            className={`alert-group-threshold--badge ${
                              cond.level
                            }${!cond.enabled ? ' disabled' : ''}`}
                            style={{width: '80px', textAlign: 'center'}}
                          >
                            {this.conditionLabel(cond.level)}
                          </span>

                          {cond.enabled && (
                            <>
                              <Dropdown
                                widthPixels={160}
                                selectedID={selectedOperator}
                                onChange={(value: string) =>
                                  this.handleTriggerValueChange(
                                    'operator',
                                    value
                                  )
                                }
                                buttonColor={ComponentColor.Default}
                                buttonSize={ComponentSize.Small}
                                menuColor={DropdownMenuColors.Onyx}
                                titleText={
                                  selectedOpObj
                                    ? selectedOpObj.label
                                    : selectedOperator
                                }
                                mode={DropdownMode.ActionList}
                              >
                                {RELATIVE_OPERATOR_OPTIONS.map(o => (
                                  <Dropdown.Item
                                    key={o.value}
                                    id={o.value}
                                    value={o.value}
                                  >
                                    {o.label}
                                  </Dropdown.Item>
                                ))}
                              </Dropdown>
                              <div style={{width: '100px'}}>
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
                                  placeholder="값 입력"
                                />
                              </div>
                              {rule.triggerValues?.change === '% change' && (
                                <span style={{color: '#999'}}>%</span>
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
                  지표 설정
                </div>
                <div
                  className="alert-group-setting-control"
                  style={{flexDirection: 'column', gap: '16px'}}
                >
                  <div
                    style={{display: 'flex', alignItems: 'center', gap: '8px'}}
                  >
                    <span style={{color: '#999'}}>데이터 수신이</span>
                    <Dropdown
                      selectedID={rule.triggerValues?.period || '10m'}
                      onChange={(v: string) =>
                        this.handleTriggerValueChange('period', v)
                      }
                      buttonSize={ComponentSize.Small}
                      buttonColor={ComponentColor.Default}
                      widthPixels={80}
                      mode={DropdownMode.ActionList}
                      menuColor={DropdownMenuColors.Amethyst}
                      titleText={rule.triggerValues?.period || '10m'}
                    >
                      {PERIODS.map(t => (
                        <Dropdown.Item key={t} id={t} value={t}>
                          {t}
                        </Dropdown.Item>
                      ))}
                    </Dropdown>
                    <span style={{color: '#999'}}>
                      동안 없을 경우 알림 발생
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
      onSwitchToRawMode,
    } = this.props
    const {queryConfig} = this.state

    const selectedPause = PAUSE_SECONDS_OPTIONS.find(
      o => o.value === rule.pauseSeconds
    )
    const isTemplateMode = builderMode !== 'raw'

    return (
      <div className="rule-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 className="rule-section--heading">① 이벤트 조건 정의</h3>
          {isTemplateMode && onSwitchToRawMode && (
            <Button
              text="직접 입력"
              icon={IconFont.Pencil}
              size={ComponentSize.ExtraSmall}
              color={ComponentColor.Default}
              onClick={onSwitchToRawMode}
            />
          )}
        </div>
        <div className="rule-section--body">
          {isTemplateMode ? (
            this.renderTemplateUI()
          ) : (
            <>
              {/* ── 3-패널 Time Series 브라우저 ── */}
              <div className="query-builder">
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
                  Alert Type
                </div>
                <div
                  className="alert-group-setting-control"
                  style={{flexDirection: 'column', gap: '16px'}}
                >
                  <div
                    style={{display: 'flex', alignItems: 'center', gap: '12px'}}
                  >
                    <span style={{color: '#999', fontSize: '13px'}}>
                      Choose One:
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
                        Threshold
                      </Radio.Button>
                      <Radio.Button
                        id="trigger-relative"
                        value="relative"
                        active={rule.trigger === 'relative'}
                        onClick={() => this.handleTriggerTypeChange('relative')}
                      >
                        Relative
                      </Radio.Button>
                      <Radio.Button
                        id="trigger-deadman"
                        value="deadman"
                        active={rule.trigger === 'deadman'}
                        onClick={() => this.handleTriggerTypeChange('deadman')}
                      >
                        Deadman
                      </Radio.Button>
                    </Radio>
                  </div>
                </div>
              </div>

              {(!rule.trigger || rule.trigger === 'threshold') && (
                <div className="alert-group-setting-row">
                  <div className="alert-group-setting-label alert-group-setting-label--aligned">
                    지표 설정
                  </div>
                  <div
                    className="alert-group-setting-control"
                    style={{flexDirection: 'column', gap: '16px'}}
                  >
                    <div
                      className="alert-group-template-thresholds"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {rule.conditions.map((cond, idx) => {
                        const selectedOperator = TRIGGER_OPERATORS.find(
                          o => o.value === rule.triggerOperator
                        )
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
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
                              className={`alert-group-threshold--badge ${
                                cond.level
                              }${!cond.enabled ? ' disabled' : ''}`}
                              style={{width: '80px', textAlign: 'center'}}
                            >
                              {this.conditionLabel(cond.level)}
                            </span>

                            {cond.enabled && (
                              <>
                                <Dropdown
                                  widthPixels={100}
                                  selectedID={
                                    selectedOperator
                                      ? selectedOperator.value
                                      : TRIGGER_OPERATORS[0].value
                                  }
                                  onChange={(value: string) =>
                                    onUpdateRule({
                                      triggerOperator: value as any,
                                    })
                                  }
                                  buttonColor={ComponentColor.Default}
                                  buttonSize={ComponentSize.Small}
                                  menuColor={DropdownMenuColors.Onyx}
                                  titleText="선택"
                                  mode={DropdownMode.ActionList}
                                >
                                  {TRIGGER_OPERATORS.map(o => (
                                    <Dropdown.Item
                                      key={o.value}
                                      id={o.value}
                                      value={o.value}
                                    >
                                      {o.label}
                                    </Dropdown.Item>
                                  ))}
                                </Dropdown>
                                <div style={{width: '100px'}}>
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
                                    placeholder="임계값"
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
                    지표 설정
                  </div>
                  <div
                    className="alert-group-setting-control"
                    style={{flexDirection: 'column', gap: '16px'}}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{color: '#999'}}>이전</span>
                      <Dropdown
                        selectedID={rule.triggerValues?.shift || '1m'}
                        onChange={(v: string) =>
                          this.handleTriggerValueChange('shift', v)
                        }
                        buttonSize={ComponentSize.Small}
                        buttonColor={ComponentColor.Default}
                        widthPixels={80}
                        mode={DropdownMode.ActionList}
                        menuColor={DropdownMenuColors.Amethyst}
                        titleText={rule.triggerValues?.shift || '1m'}
                      >
                        {SHIFTS.map(t => (
                          <Dropdown.Item key={t} id={t} value={t}>
                            {t}
                          </Dropdown.Item>
                        ))}
                      </Dropdown>
                      <span style={{color: '#999'}}>대비</span>
                      <Dropdown
                        selectedID={rule.triggerValues?.change || 'change'}
                        onChange={(v: string) =>
                          this.handleTriggerValueChange('change', v)
                        }
                        buttonSize={ComponentSize.Small}
                        buttonColor={ComponentColor.Default}
                        widthPixels={120}
                        mode={DropdownMode.ActionList}
                        menuColor={DropdownMenuColors.Amethyst}
                        titleText={
                          CHANGES_OPTIONS.find(
                            o =>
                              o.value ===
                              (rule.triggerValues?.change || 'change')
                          )?.label || 'change'
                        }
                      >
                        {CHANGES_OPTIONS.map(o => (
                          <Dropdown.Item
                            key={o.value}
                            id={o.value}
                            value={o.value}
                          >
                            {o.label}
                          </Dropdown.Item>
                        ))}
                      </Dropdown>
                      <span style={{color: '#999'}}>이(가)</span>
                    </div>

                    <div
                      className="alert-group-template-thresholds"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        marginTop: '8px',
                      }}
                    >
                      {rule.conditions.map((cond, idx) => {
                        const selectedOperator =
                          rule.triggerValues?.operator || 'greater than'
                        const selectedOpObj = RELATIVE_OPERATOR_OPTIONS.find(
                          o => o.value === selectedOperator
                        )
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
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
                              className={`alert-group-threshold--badge ${
                                cond.level
                              }${!cond.enabled ? ' disabled' : ''}`}
                              style={{width: '80px', textAlign: 'center'}}
                            >
                              {this.conditionLabel(cond.level)}
                            </span>

                            {cond.enabled && (
                              <>
                                <Dropdown
                                  widthPixels={160}
                                  selectedID={selectedOperator}
                                  onChange={(value: string) =>
                                    this.handleTriggerValueChange(
                                      'operator',
                                      value
                                    )
                                  }
                                  buttonColor={ComponentColor.Default}
                                  buttonSize={ComponentSize.Small}
                                  menuColor={DropdownMenuColors.Onyx}
                                  titleText={
                                    selectedOpObj
                                      ? selectedOpObj.label
                                      : selectedOperator
                                  }
                                  mode={DropdownMode.ActionList}
                                >
                                  {RELATIVE_OPERATOR_OPTIONS.map(o => (
                                    <Dropdown.Item
                                      key={o.value}
                                      id={o.value}
                                      value={o.value}
                                    >
                                      {o.label}
                                    </Dropdown.Item>
                                  ))}
                                </Dropdown>
                                <div style={{width: '100px'}}>
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
                                    placeholder="값 입력"
                                  />
                                </div>
                                {rule.triggerValues?.change === '% change' && (
                                  <span style={{color: '#999'}}>%</span>
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
                    지표 설정
                  </div>
                  <div
                    className="alert-group-setting-control"
                    style={{flexDirection: 'column', gap: '16px'}}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span style={{color: '#999'}}>데이터 수신이</span>
                      <Dropdown
                        selectedID={rule.triggerValues?.period || '10m'}
                        onChange={(v: string) =>
                          this.handleTriggerValueChange('period', v)
                        }
                        buttonSize={ComponentSize.Small}
                        buttonColor={ComponentColor.Default}
                        widthPixels={80}
                        mode={DropdownMode.ActionList}
                        menuColor={DropdownMenuColors.Amethyst}
                        titleText={rule.triggerValues?.period || '10m'}
                      >
                        {PERIODS.map(t => (
                          <Dropdown.Item key={t} id={t} value={t}>
                            {t}
                          </Dropdown.Item>
                        ))}
                      </Dropdown>
                      <span style={{color: '#999'}}>
                        동안 없을 경우 알림 발생
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Occurrence Group */}
          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label">발생 횟수</div>
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
                    titleText="연속"
                  >
                    연속
                  </Radio.Button>
                  <Radio.Button
                    id="occ-total"
                    value="recent"
                    active={
                      rule.occurrenceType === 'recent' ||
                      rule.occurrenceType === 'total'
                    }
                    onClick={(_v: string) =>
                      onUpdateRule({occurrenceType: 'recent'})
                    }
                    titleText="최근"
                  >
                    최근
                  </Radio.Button>
                </Radio>
                <Dropdown
                  selectedID={rule.occurrenceWindow || '5m'}
                  onChange={(w: string) => onUpdateRule({occurrenceWindow: w})}
                  widthPixels={100}
                  buttonColor={ComponentColor.Default}
                  buttonSize={ComponentSize.Small}
                  menuColor={DropdownMenuColors.Onyx}
                  titleText={rule.occurrenceWindow || '5m'}
                >
                  <Dropdown.Item id="1m" value="1m">
                    1m
                  </Dropdown.Item>
                  <Dropdown.Item id="5m" value="5m">
                    5m
                  </Dropdown.Item>
                  <Dropdown.Item id="10m" value="10m">
                    10m
                  </Dropdown.Item>
                  <Dropdown.Item id="15m" value="15m">
                    15m
                  </Dropdown.Item>
                  <Dropdown.Item id="30m" value="30m">
                    30m
                  </Dropdown.Item>
                  <Dropdown.Item id="1h" value="1h">
                    1h
                  </Dropdown.Item>
                </Dropdown>
                <span className="alert-group-occurrence--sep">동안</span>
                <div style={{width: '80px'}}>
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
                <span className="alert-group-occurrence--sep">회 발생</span>
              </div>
            </div>
          </div>

          {/* Pause Group */}
          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label">일시 중지</div>
            <div className="alert-group-setting-control">
              <div className="alert-group-setting-inputs">
                <Dropdown
                  widthPixels={240}
                  selectedID={selectedPause ? String(selectedPause.value) : '0'}
                  onChange={(value: string) =>
                    onUpdateRule({pauseSeconds: parseInt(value, 10)})
                  }
                  buttonColor={ComponentColor.Default}
                  buttonSize={ComponentSize.Small}
                  menuColor={DropdownMenuColors.Onyx}
                  titleText="사용 안 함"
                  mode={DropdownMode.ActionList}
                >
                  {PAUSE_SECONDS_OPTIONS.map(o => (
                    <Dropdown.Item
                      key={String(o.value)}
                      id={String(o.value)}
                      value={String(o.value)}
                    >
                      {o.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown>
              </div>
              <p className="alert-group-setting-helper">
                알림 수신 후 선택한 시간 동안 이벤트가 발생하지 않습니다.
                <br />
                단, "해소된 알림" 기능을 활성화한 경우에는 RECOVERED 알림 수신
                후 선택한 시간 동안 이벤트가 발생하지 않습니다.
              </p>
            </div>
          </div>

          {/* Resolved Alert Group */}
          <div className="alert-group-setting-row">
            <div className="alert-group-setting-label">해소된 알림</div>
            <div className="alert-group-setting-control">
              <div className="alert-group-setting-inputs">
                <SlideToggle
                  active={rule.notifyRecovery}
                  onChange={() =>
                    onUpdateRule({notifyRecovery: !rule.notifyRecovery})
                  }
                  size={ComponentSize.ExtraSmall}
                  color={ComponentColor.Primary}
                />
              </div>
              <p className="alert-group-setting-helper">
                해소된 알림 옵션을 활성화하면 이벤트 기록 메뉴에서 진행 중인
                이벤트로 표시됩니다.
                <br />
                Critical과 Warning 레벨의 이벤트가 해소되면 RECOVERED 상태의
                알림을 수신합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default AlertGroupConditionSection
