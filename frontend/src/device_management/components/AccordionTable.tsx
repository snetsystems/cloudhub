import React from 'react'
import TableBase from './TableBase'
import {ColumnInfo, DataTableObject} from 'src/types'

interface Props {
  tableData: DataTableObject[]
  accordionColumns: ColumnInfo[]
}
function AccordionTable({tableData, accordionColumns}: Props) {
  return <TableBase data={tableData} columns={accordionColumns} />
}

export default AccordionTable
