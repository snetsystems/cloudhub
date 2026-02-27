import React, {useEffect, useState} from 'react'
import TableComponent from 'src/device_management/components/TableComponent'
import {AlignType, DataTableObject} from 'src/types/tableType'
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
  // 상위 컴포넌트에서 데이터를 Props로 넘겨서 사용하는게 좋을 듯함.
  // data: DataTableObject[]
  //
  source: Source
}

const ProcessLineChartTable: React.FC<Props> = ({source}) => {
  const [dummyData, setDummyData] = useState<DataTableObject[]>([])

  useEffect(() => {
    const querySet = serverListDummyLineQueries.map(query => ({
      id: query.id,
      text: query.text,
      db: 'Default',
    }))

    const fetchDummyData = async () => {
      const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
        lower: 'now() - 20m',
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

      console.log('tableData', mergedData)
    }

    fetchDummyData()
  }, [])

  return (
    <div>
      {/* Data에 맞게 Column Key값 변경해야 함. */}
      <TableComponent data={dummyData} columns={lineChartTableColumn} />
    </div>
  )
}

export default ProcessLineChartTable
