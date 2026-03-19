import React, {useEffect, useMemo, useState} from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import {DataTableObject} from 'src/types/tableType'
import {
  lineChartTableColumn,
  serverDetailProcessQueries,
} from '../constants/lineChartTableColumn'
import {executeQueries} from 'src/shared/apis/query'
import {Source} from 'src/types/sources'
import {mergeResultsByProcessName} from 'src/dashboards/utils/tableLineChart'
import {generateForHosts} from 'src/utils/tempVars'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {Template, TemplateType, TemplateValueType} from 'src/types'
import type {TimeRange} from 'src/types'
import {TEMP_VAR_INTERVAL} from 'src/shared/constants'
import {DEFAULT_DETAIL_TIME_RANGE} from 'src/server_details/components/UsageDetailModal/utils'

interface Props {
  source: Source
  selectedHost: string | null
  timeRange?: TimeRange | null
  onProcessNameClick?: (row: DataTableObject) => void
}

const ProcessLineChartTable: React.FC<Props> = ({
  source,
  selectedHost,
  timeRange,
  onProcessNameClick,
}) => {
  const [dummyData, setDummyData] = useState<DataTableObject[]>([])

  const columns = useMemo(() => {
    if (!onProcessNameClick) return lineChartTableColumn
    return lineChartTableColumn.map(col => {
      if (col.key !== 'process_name') return col
      return {
        ...col,
        render: (value: unknown, rowData: DataTableObject) => {
          const processName = String(value ?? '')
          const user = (rowData?.user as string) ?? ''
          return (
            <button
              type="button"
              onClick={() => onProcessNameClick(rowData)}
              className="process-name-link"
            >
              <span className="process-name-with-user">
                <span className="process-name-with-user__name">{processName}</span>
                {user && (
                  <span className="process-name-with-user__user">{user}</span>
                )}
              </span>
            </button>
          )
        },
      }
    })
  }, [onProcessNameClick])

  useEffect(() => {
    if (!selectedHost) {
      setDummyData([])
      return
    }

    const querySet = serverDetailProcessQueries.map(query => ({
      id: query.id,
      text: query.text,
      db: source.telegraf ?? 'Default',
    }))

    const fetchDummyData = async () => {
      const range = timeRange ?? DEFAULT_DETAIL_TIME_RANGE
      const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
        lower: range.lower ?? 'now() - 1h',
        upper: range.upper ?? 'now()',
      })
      const hostTemplate: Template = {
        tempVar: ':host:',
        id: 'host',
        type: TemplateType.Constant,
        label: '',
        values: [
          {
            value: selectedHost,
            type: TemplateValueType.Constant,
            selected: true,
            localSelected: true,
          },
        ],
      }
      const processTemplate: Template = {
        tempVar: ':process:',
        id: 'process',
        type: TemplateType.Constant,
        label: '',
        values: [{value: '.*', type: TemplateValueType.Constant, selected: true, localSelected: true}],
      }
      const userTemplate: Template = {
        tempVar: ':user:',
        id: 'user',
        type: TemplateType.Constant,
        label: '',
        values: [{value: '.*', type: TemplateValueType.Constant, selected: true, localSelected: true}],
      }
      const intervalTemplate: Template = {
        tempVar: TEMP_VAR_INTERVAL,
        id: 'interval',
        type: TemplateType.Constant,
        label: '',
        values: [{value: '1m', type: TemplateValueType.Constant, selected: true, localSelected: true}],
      }
      const templates = [
        ...generateForHosts(source),
        dashboardTime,
        upperDashboardTime,
        intervalTemplate,
        hostTemplate,
        processTemplate,
        userTemplate,
      ]

      const results = await executeQueries(source, querySet, templates)

      const mergedData = mergeResultsByProcessName(results)
      setDummyData(mergedData)
    }

    fetchDummyData()
  }, [source, selectedHost, timeRange])

  return (
    <div>
      <TableComponent
        data={dummyData}
        columns={columns}
        isSearchDisplay={false}
        isDotKey={true}
        enableSharedChartHover={true}
        // initSort={{key: 'CPU', isDesc: true}}
      />
    </div>
  )
}

export default ProcessLineChartTable
