import React from 'react'

// Components
import TableBase from 'src/device_management/components/TableBase'

// Type
import {ColumnInfo, DataTableObject, TimeZones} from 'src/types'

interface Props {
  tableData: DataTableObject[]
  accordionColumns: ColumnInfo[]
  timeZone: TimeZones
}
function AccordionTable({tableData, accordionColumns, timeZone}: Props) {
  return (
    <TableBase
      data={tableData}
      columns={accordionColumns}
      timeZone={timeZone}
    />
  )
}

export default AccordionTable
