// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import GridLayoutLayerCell from 'src/addon/128t/components/GridLayoutLayerCell'

// Types
import {ErrorHandling} from 'src/shared/decorators/errors'

// table
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'
import TopSessionsTable from 'src/addon/128t/components/TopSessionsTable'

//type
import {Router, TopSource, TopSession, GridCell} from 'src/addon/128t/types'

interface Props {
  isEditable: boolean
  cell: GridCell<Router[] | TopSource[] | TopSession[]>
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  focusedAssetId?: string
}

@ErrorHandling
class GridLayoutLayer extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {cell, isEditable} = this.props

    return (
      <GridLayoutLayerCell isEditable={isEditable} cell={cell}>
        {this.renderTable}
      </GridLayoutLayerCell>
    )
  }

  private get renderTable(): JSX.Element {
    const {cell, onClickTableRow, focusedAssetId} = this.props
    switch (cell.i) {
      case 'routers':
        return (
          <RouterTable
            routers={cell.sources}
            onClickTableRow={onClickTableRow}
            focusedAssetId={focusedAssetId}
          />
        )
      case 'topSources':
        return <TopSourcesTable topSources={cell.sources} />
      case 'topSessions':
        return <TopSessionsTable topSessions={cell.sources} />
    }
  }
}

export default GridLayoutLayer
