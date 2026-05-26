// frontend/src/alert_group/components/AlertGroupPreviewGraph.tsx
import React, {PureComponent, CSSProperties} from 'react'
import {connect} from 'react-redux'
import uuid from 'uuid'
import {withTranslation, WithTranslation} from 'react-i18next'

import TimeSeries from 'src/shared/components/time_series/TimeSeries'
import RuleGraphDygraph from 'src/kapacitor/components/RuleGraphDygraph'
import buildQueries from 'src/utils/buildQueriesForGraphs'
import {setHoverTime as setHoverTimeAction} from 'src/dashboards/actions'
import {
  buildAlertGroupPreviewRuleValues,
  buildAlertGroupPreviewUnderlay,
} from 'src/alert_group/utils/alertGroupPreviewUnderlay'
import {groupByTimeSeriesTransform} from 'src/utils/groupByTimeSeriesTransform'

import {Source, TimeRange, RemoteDataState, AlertRule} from 'src/types'
import {QueryConfig} from 'src/types/queries'
import {AlertCondition, AlertConditionOperator} from 'src/alert_group/types'

interface Props extends WithTranslation {
  source: Source
  database?: string
  retentionPolicy?: string
  measurement: string
  field: string
  tags?: {[key: string]: string[]}
  groupBy?: {
    time?: string
    tags: string[]
  }
  areTagsAccepted?: boolean
  conditions: AlertCondition[]
  timeRange: TimeRange
  setHoverTime: typeof setHoverTimeAction
}

const LEVEL_LABELS: Record<string, string> = {
  critical: '위험',
  warning: '경고',
  info: '정보',
}

const OPERATOR_SYMBOLS: Record<string, string> = {
  greater: '>',
  greater_equal: '>=',
  less: '<',
  less_equal: '<=',
  equal: '==',
  not_equal: '!=',
}

const checkViolation = (val: number, limit: number, op: string): boolean => {
  switch (op) {
    case 'greater':
      return val > limit
    case 'greater_equal':
      return val >= limit
    case 'less':
      return val < limit
    case 'less_equal':
      return val <= limit
    case 'equal':
      return val === limit
    case 'not_equal':
      return val !== limit
    default:
      return val > limit
  }
}

const conditionOperator = (condition: AlertCondition): AlertConditionOperator =>
  condition.operator || 'greater'

const countViolations = (
  sortedTimeSeries: any[],
  thresholdValue: number,
  op: string
): number => {
  if (!sortedTimeSeries || !Array.isArray(sortedTimeSeries)) {
    return 0
  }
  let count = 0

  sortedTimeSeries.forEach(row => {
    const values = row?.values
    if (values && Array.isArray(values)) {
      values.forEach((val: any) => {
        if (val !== null && val !== undefined && val !== '-') {
          const numVal = Number(val)
          if (!isNaN(numVal) && checkViolation(numVal, thresholdValue, op)) {
            count++
          }
        }
      })
    }
  })

  return count
}

class AlertGroupPreviewGraph extends PureComponent<Props> {
  private readonly instanceUuid = uuid.v4()

  private get dygraphShellStyle(): CSSProperties {
    return {height: '100%'}
  }

  private get queryConfig(): QueryConfig {
    const {
      source,
      database,
      retentionPolicy,
      measurement,
      field,
      tags,
      groupBy,
      areTagsAccepted,
    } = this.props
    return {
      id: this.instanceUuid,
      database: database || source.telegraf || 'telegraf',
      retentionPolicy: retentionPolicy || 'autogen',
      measurement,
      fields: [
        {
          value: field,
          type: 'field',
          alias: '',
          args: [],
        },
      ],
      tags: tags || {},
      areTagsAccepted: areTagsAccepted || false,
      groupBy: groupBy || {
        time: '',
        tags: [],
      },
      fill: 'null',
      rawText: null,
      range: null,
      shifts: [],
    }
  }

  public render() {
    const {measurement, field, conditions, timeRange, source, t} = this.props
    const ready = !!(measurement && field)
    const queries = ready ? buildQueries([this.queryConfig], timeRange) : []
    const enabledConditions = ready
      ? conditions.filter(c => c.enabled && c.value !== '')
      : []

    const previewRuleValues = ready
      ? buildAlertGroupPreviewRuleValues(conditions)
      : null
    const customUnderlay =
      previewRuleValues !== null
        ? buildAlertGroupPreviewUnderlay({conditions})
        : undefined
    const dygraphRule = {
      trigger: 'threshold',
      values: previewRuleValues ?? {value: '', rangeValue: '', operator: ''},
    } as AlertRule

    return (
      <div className="alert-group-preview-graph">
        {!ready ? (
          <div className="alert-group-preview-graph--chart">
            <div className="alert-group-preview-graph--graph-shell">
              <div className="alert-group-preview-graph--graph-placeholder">
                <p
                  dangerouslySetInnerHTML={{
                    __html: t(
                      'alert_group_basic.graph_placeholder',
                      '<strong>시계열</strong>을 선택하면 그래프가 이 영역에 표시됩니다.'
                    ),
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <TimeSeries
            source={source}
            uuid={this.instanceUuid}
            queries={queries}
            timeRange={timeRange}
          >
            {({timeSeriesInfluxQL, loading}) => {
              const hasData = Boolean(
                timeSeriesInfluxQL &&
                  timeSeriesInfluxQL.length > 0 &&
                  timeSeriesInfluxQL.some(r => {
                    const results = (r.response as any)?.results
                    return (
                      results &&
                      results.length > 0 &&
                      results.some(
                        (res: any) => res.series && res.series.length > 0
                      )
                    )
                  })
              )
              const transformed = hasData
                ? groupByTimeSeriesTransform(timeSeriesInfluxQL, false)
                : null
              const sortedTimeSeries = transformed?.sortedTimeSeries || []

              const violationCounts = enabledConditions.reduce((acc, cond) => {
                const count = hasData
                  ? countViolations(
                      sortedTimeSeries,
                      Number(cond.value),
                      conditionOperator(cond)
                    )
                  : 0
                acc[cond.level] = count
                return acc
              }, {} as Record<string, number>)

              return (
                <>
                  {enabledConditions.length > 0 && (
                    <div className="alert-group-preview-graph--header-row">
                      <div className="alert-group-preview-graph--thresholds">
                        {enabledConditions.map((condition, i) => (
                          <span
                            key={i}
                            className={`alert-group-preview-graph--threshold alert-group-preview-graph--threshold__${condition.level}`}
                          >
                            {t(
                              `server_alert.${condition.level}`,
                              LEVEL_LABELS[condition.level]
                            )}{' '}
                            {OPERATOR_SYMBOLS[conditionOperator(condition)] ||
                              '>'}
                            {condition.value}
                          </span>
                        ))}
                      </div>

                      {/* 임계치 초과 횟수 리포트 */}
                      {loading !== RemoteDataState.Loading && hasData && (
                        <div className="alert-group-preview-graph--violation-summary">
                          {enabledConditions.map((condition, i) => {
                            const count = violationCounts[condition.level] || 0
                            const isLast = i === enabledConditions.length - 1
                            const levelLabel = LEVEL_LABELS[condition.level]
                            return (
                              <React.Fragment key={condition.level}>
                                <span className="alert-group-preview-graph--violation-item">
                                  {levelLabel}{' '}
                                  <span
                                    className={`alert-group-preview-graph--violation-count alert-group-preview-graph--violation-count__${condition.level}`}
                                  >
                                    {count}
                                  </span>
                                </span>
                                {!isLast && (
                                  <span className="alert-group-preview-graph--violation-divider">
                                    /
                                  </span>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="alert-group-preview-graph--chart">
                    <div className="alert-group-preview-graph--graph-shell">
                      {loading === RemoteDataState.Loading ? (
                        <div className="alert-group-preview-graph--loading">
                          {t(
                            'alert_group_basic.loading_data',
                            '데이터를 불러오는 중...'
                          )}
                        </div>
                      ) : !hasData ? (
                        <div className="alert-group-preview-graph--no-data">
                          <p>
                            {t(
                              'alert_group_basic.no_data_in_range',
                              '선택한 시간 범위에 데이터가 없습니다.'
                            )}
                          </p>
                        </div>
                      ) : (
                        <div
                          className="dygraph graph--hasYLabel"
                          style={this.dygraphShellStyle}
                        >
                          <RuleGraphDygraph
                            query={this.queryConfig}
                            rule={dygraphRule}
                            timeRange={timeRange}
                            loading={loading}
                            timeSeries={timeSeriesInfluxQL}
                            setHoverTime={this.props.setHoverTime}
                            yRangePad={56}
                            customUnderlay={customUnderlay}
                            interactive={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )
            }}
          </TimeSeries>
        )}
      </div>
    )
  }
}

const mdtp = {
  setHoverTime: setHoverTimeAction,
}

export default connect(null, mdtp)(withTranslation()(AlertGroupPreviewGraph))
