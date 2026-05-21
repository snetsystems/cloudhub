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

import {Source, TimeRange, RemoteDataState, AlertRule} from 'src/types'
import {QueryConfig} from 'src/types/queries'
import {AlertCondition, AlertGroupRule} from 'src/alert_group/types'

interface Props extends WithTranslation {
  source: Source
  database?: string
  retentionPolicy?: string
  measurement: string
  field: string
  conditions: AlertCondition[]
  triggerOperator: AlertGroupRule['triggerOperator']
  timeRange: TimeRange
  setHoverTime: typeof setHoverTimeAction
}

const LEVEL_LABELS: Record<string, string> = {
  critical: '위험',
  warning: '경고',
  info: '정보',
}

class AlertGroupPreviewGraph extends PureComponent<Props> {
  private readonly instanceUuid = uuid.v4()

  private get dygraphShellStyle(): CSSProperties {
    return {height: '100%'}
  }

  private get queryConfig(): QueryConfig {
    const {source, database, retentionPolicy, measurement, field} = this.props
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
      tags: {},
      areTagsAccepted: false,
      groupBy: {
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
    const {
      measurement,
      field,
      conditions,
      timeRange,
      source,
      triggerOperator,
      t,
    } = this.props
    const ready = !!(measurement && field)
    const queries = ready ? buildQueries([this.queryConfig], timeRange) : []
    const enabledConditions = ready
      ? conditions.filter(c => c.enabled && c.value !== '')
      : []

    const previewRuleValues = ready
      ? buildAlertGroupPreviewRuleValues(conditions, triggerOperator)
      : null
    const customUnderlay =
      previewRuleValues !== null
        ? buildAlertGroupPreviewUnderlay({triggerOperator, conditions})
        : undefined
    const dygraphRule = {
      trigger: 'threshold',
      values:
        previewRuleValues ?? {value: '', rangeValue: '', operator: ''},
    } as AlertRule

    return (
      <div className="alert-group-preview-graph">
        {ready && enabledConditions.length > 0 && (
          <div className="alert-group-preview-graph--thresholds">
            {enabledConditions.map((condition, i) => (
              <span
                key={i}
                className={`alert-group-preview-graph--threshold alert-group-preview-graph--threshold__${condition.level}`}
              >
                {t(`server_alert.${condition.level}`, LEVEL_LABELS[condition.level])}: {condition.value}
              </span>
            ))}
          </div>
        )}
        <div className="alert-group-preview-graph--chart">
          <div className="alert-group-preview-graph--graph-shell">
            {!ready ? (
              <div className="alert-group-preview-graph--graph-placeholder">
                <p dangerouslySetInnerHTML={{
                  __html: t(
                    'alert_group_basic.graph_placeholder',
                    '<strong>시계열</strong>을 선택하면 그래프가 이 영역에 표시됩니다.'
                  )
                }} />
              </div>
            ) : (
              <div className="dygraph graph--hasYLabel" style={this.dygraphShellStyle}>
                <TimeSeries
                   source={source}
                   uuid={this.instanceUuid}
                   queries={queries}
                   timeRange={timeRange}
                >
                  {({timeSeriesInfluxQL, loading}) => {
                    if (loading === RemoteDataState.Loading) {
                      return (
                        <div className="alert-group-preview-graph--loading">
                          {t('alert_group_basic.loading_data', '데이터를 불러오는 중...')}
                        </div>
                      )
                    }

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

                    if (!hasData) {
                      return (
                        <div className="alert-group-preview-graph--no-data">
                          <p>{t('alert_group_basic.no_data_in_range', '선택한 시간 범위에 데이터가 없습니다.')}</p>
                        </div>
                      )
                    }

                    return (
                      <RuleGraphDygraph
                        query={this.queryConfig}
                        rule={dygraphRule}
                        timeRange={timeRange}
                        loading={loading}
                        timeSeries={timeSeriesInfluxQL}
                        setHoverTime={this.props.setHoverTime}
                        yRangePad={56}
                        customUnderlay={customUnderlay}
                      />
                    )
                  }}
                </TimeSeries>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
}

const mdtp = {
  setHoverTime: setHoverTimeAction,
}

export default connect(null, mdtp)(withTranslation()(AlertGroupPreviewGraph))

