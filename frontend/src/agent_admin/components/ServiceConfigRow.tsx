// Libraries
import React, {PureComponent} from 'react'

// Components
import {TableBodyRowItem} from 'src/agent_admin/reusable/'

// Types
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

type Tenant = string

interface Props {
  focusedRowData: string
  tableRowData: Minion | Tenant
  onClickTableRow: (selectedData: any) => () => void
}

@ErrorHandling
class ServiceConfigRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    return this.TableRowEachPage
  }

  private get TableRowEachPage(): JSX.Element {
    const {tableRowData, onClickTableRow} = this.props
    const rowData = this.getTableRowData(tableRowData)

    return (
      <div
        className={this.focusedClasses(rowData)}
        onClick={onClickTableRow(rowData)}
      >
        <TableBodyRowItem title={rowData} width={'100%'} />
      </div>
    )
  }

  public focusedClasses = (rowData: string): string => {
    const {focusedRowData} = this.props

    if (rowData === focusedRowData) {
      return 'agent--row hosts-table--tr focused'
    }
    return 'agent--row hosts-table--tr'
  }

  private getTableRowData = (rowData: Minion | Tenant): string => {
    if (typeof rowData === 'string') {
      return rowData
    }

    return rowData?.host
  }
}

export default ServiceConfigRow
