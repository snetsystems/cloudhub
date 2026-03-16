import React, {useEffect, useState} from 'react'
import TableLineChartCell from 'src/dashboards/components/TableLineChartCell'
import {toNumericPoint} from 'src/dashboards/utils/tableLineChart'
import {executeQueries} from 'src/shared/apis/query'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {generateForHosts} from 'src/utils/tempVars'
import {Template, TemplateType, TemplateValueType} from 'src/types'
import type {Source} from 'src/types/sources'
import {UsageDetailBlock} from '../UsageDetailBlock'
import type {UsageDetailServerContext} from '../types'

function CpuTotalUsageChart({
  host,
  source,
}: {
  host: string | null
  source: Source | null
}) {
  const [values, setValues] = useState<Array<number | null>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!source || !host) {
      setValues([])
      setError(null)
      return
    }

    let cancelled = false

    const fetchSeries = async () => {
      setLoading(true)
      setError(null)

      const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
        lower: 'now() - 20m',
        upper: 'now()',
      })

      const hostTemplate: Template = {
        tempVar: ':host:',
        id: 'host',
        type: TemplateType.Constant,
        label: '',
        values: [
          {
            value: host,
            type: TemplateValueType.Constant,
            selected: true,
            localSelected: true,
          },
        ],
      }

      const templates = [
        ...generateForHosts(source),
        dashboardTime,
        upperDashboardTime,
        hostTemplate,
      ]

      const queryText = `SELECT mean("usage_system") + mean("usage_user") AS "cpu_usage"
FROM ":db:".":rp:"."cpu"
WHERE time > :dashboardTime: AND time < :upperDashboardTime: AND "cpu"='cpu-total' AND "host"=":host:"
GROUP BY time(:interval:)
FILL(null)`

      try {
        const [{value}] = await executeQueries(
          source,
          [
            {
              id: 'cpu-total-usage-detail',
              text: queryText,
              db: 'Default',
            },
          ],
          templates
        )

        if (cancelled) return

        const series = value?.results?.[0]?.series?.[0]
        const nextValues = (series?.values ?? []).map(row =>
          toNumericPoint(row?.[1] ?? null)
        )

        setValues(nextValues)
      } catch (err) {
        if (!cancelled) {
          setError('데이터를 불러오지 못했습니다.')
          setValues([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSeries()

    return () => {
      cancelled = true
    }
  }, [host, source])

  if (!source) {
    return (
      <div className="process-detail-modal__placeholder">
        Source가 없습니다.
      </div>
    )
  }

  if (!host) {
    return (
      <div className="process-detail-modal__placeholder">
        호스트를 선택하세요.
      </div>
    )
  }

  if (error) {
    return <div className="process-detail-modal__placeholder">{error}</div>
  }

  return (
    <div className="process-detail-modal__chart">
      <TableLineChartCell
        values={values}
        height={160}
        strokeWidth={1.5}
        options={{
          isShowLine: true,
          isShowPoint: false,
          isFillArea: true,
          isConnectSeparatedPoints: true,
          isZeroBaseline: true,
          valueLabel: 'last',
          decimalPlaces: 1,
        }}
      />
      {loading && (
        <div className="process-detail-modal__placeholder">Loading...</div>
      )}
    </div>
  )
}

export function CpuDetailContent({
  serverContext,
}: {
  serverContext: UsageDetailServerContext
}) {
  return (
    <div className="process-detail-modal__body">
      <div className="process-detail-modal__grid process-detail-modal__grid--top">
        <UsageDetailBlock title="CPU Usage">
          <CpuTotalUsageChart
            host={serverContext.selectedHost}
            source={serverContext.source}
          />
        </UsageDetailBlock>
        <UsageDetailBlock title="CPU Idle">코어별 사용률 요약</UsageDetailBlock>
        <UsageDetailBlock title="CPU Nice">
          현재 시점 CPU 요약 카드
        </UsageDetailBlock>
      </div>

      <div className="process-detail-modal__grid process-detail-modal__grid--middle">
        <UsageDetailBlock title="CPU I/O Wait">
          상위 프로세스 목록 (CPU 사용률 순)
        </UsageDetailBlock>
        <UsageDetailBlock title="CPU Steal">
          선택된 프로세스 CPU 타임라인
        </UsageDetailBlock>
        <UsageDetailBlock title="CPU IRQ(Interrupt Request)">
          사용자/서비스별 CPU 사용률 요약
        </UsageDetailBlock>
      </div>

      <div className="process-detail-modal__grid process-detail-modal__grid--bottom">
        <UsageDetailBlock title="CPU Soft IRQ(Software Interrupt Request)">
          Load Average와 CPU 사용률 비교
        </UsageDetailBlock>
        <UsageDetailBlock
          title="CPU Load"
          blockClassName="process-detail-modal__block--span-2"
        >
          인터럽트 / 컨텍스트 스위치 등 시스템 메트릭
        </UsageDetailBlock>
      </div>
    </div>
  )
}
