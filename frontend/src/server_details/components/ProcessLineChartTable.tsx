import React, {useEffect, useMemo, useState} from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import {DataTableObject} from 'src/types/tableType'
import {
  lineChartTableColumn,
  serverListDummyLineQueries,
} from '../constants/lineChartTableColumn'
import {executeQueries} from 'src/shared/apis/query'
import {Source} from 'src/types/sources'
import {mergeResultsByHost} from 'src/dashboards/utils/tableLineChart'
import {generateForHosts} from 'src/utils/tempVars'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'

interface Props {
  source: Source
  onProcessNameClick?: (row: DataTableObject) => void
}

const ProcessLineChartTable: React.FC<Props> = ({
  source,
  onProcessNameClick,
}) => {
  const [dummyData, setDummyData] = useState<DataTableObject[]>([])

  const columns = useMemo(() => {
    if (!onProcessNameClick) return lineChartTableColumn
    return lineChartTableColumn.map(col => {
      if (col.key !== 'host') return col
      return {
        ...col,
        render: (value: unknown, rowData: DataTableObject) => (
          <button
            type="button"
            onClick={() => onProcessNameClick(rowData)}
            className="process-name-link"
          >
            {String(value ?? '')}
          </button>
        ),
      }
    })
  }, [onProcessNameClick])

  useEffect(() => {
    console.log('columns', columns)
  }, [columns])

  useEffect(() => {
    const querySet = serverListDummyLineQueries.map(query => ({
      id: query.id,
      text: query.text,
      db: 'Default',
    }))

    const fetchDummyData = async () => {
      const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
        lower: 'now() - 6h',
        upper: 'now()',
      })
      const templates = [
        ...generateForHosts(source),
        dashboardTime,
        upperDashboardTime,
      ]

      const results = await executeQueries(source, querySet, templates)

      const mergedData = mergeResultsByHost(results)
      setDummyData(mergedData)
    }

    fetchDummyData()
  }, [])

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
