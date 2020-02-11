// Libraries
import React, {PureComponent, CSSProperties} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'

import _ from 'lodash'

const GridLayout = WidthProvider(ReactGridLayout)

// Components
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'
import TopSessionsTable from 'src/addon/128t/components/TopSessionsTable'
import RouterMaps from 'src/addon/128t/components/RouterMaps'
import RouterModal from 'src/addon/128t/components/RouterModal'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Constants
import {
  STATUS_PAGE_ROW_COUNT,
  PAGE_HEADER_HEIGHT,
  PAGE_CONTAINER_MARGIN,
  LAYOUT_MARGIN,
} from 'src/shared/constants'

import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

//type
import {Router, TopSource, TopSession} from 'src/addon/128t/types'
import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'
import {ComponentStatus} from 'src/reusable_ui/types'

interface Props {
  layout: cellLayoutInfo[]
  focusedAssetId: string
  routersData: Router[]
  topSessionsData: TopSession[]
  topSourcesData: TopSource[]
  isSwanSdplexStatus: boolean
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  onPositionChange: (cellsLayout: cellLayoutInfo[]) => void
  onClickMapMarker: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => void
}

interface State {
  rowHeight: number
  isRoutersAllCheck: boolean
  isModalVisible: boolean
  chooseMenu: string
  checkRouters: {assetId: string; isCheck: boolean}[]
}

class GridLayoutRenderer extends PureComponent<Props, State> {
  private cellBackgroundColor: string = DEFAULT_CELL_BG_COLOR
  private cellTextColor: string = DEFAULT_CELL_TEXT_COLOR
  private firmwareVersion: string[] = [
    'firmware-v4.7.5',
    'firmware-v4.7.6',
    'firmware-v4.7.9',
  ]

  private configVersion: string[] = ['config-v1', 'config-v2', 'config-v3']

  constructor(props: Props) {
    super(props)

    this.state = {
      rowHeight: this.calculateRowHeight(),
      isRoutersAllCheck: false,
      isModalVisible: false,
      checkRouters: [],
      chooseMenu: '',
    }
  }

  public componentWillMount() {
    const checkRoutersData = this.props.routersData.map(router => {
      return {
        assetId: router.assetId,
        isCheck: false,
      }
    })

    this.setState({
      checkRouters: checkRoutersData,
    })
  }

  public handleRoutersAllCheck = () => {
    const {isRoutersAllCheck, checkRouters} = this.state

    if (!isRoutersAllCheck) {
      checkRouters.map(checkRouter => {
        checkRouter.isCheck = true
        return checkRouter
      })
    } else {
      checkRouters.map(checkRouter => {
        checkRouter.isCheck = false
        return checkRouter
      })
    }
    this.setState({
      isRoutersAllCheck: !isRoutersAllCheck,
      checkRouters: [...checkRouters],
    })
  }

  public handleRouterCheck = ({router}: {router: Router}): void => {
    const {checkRouters} = this.state
    const index = checkRouters.indexOf(
      checkRouters.find(checkRouter => checkRouter.assetId === router.assetId)
    )

    checkRouters[index].isCheck
      ? (checkRouters[index].isCheck = false)
      : (checkRouters[index].isCheck = true)

    this.setState({
      isRoutersAllCheck: false,
      checkRouters: [...checkRouters],
    })
  }

  public handleOnChoose = ({selectItem}: {selectItem: string}) => {
    this.setState({
      isModalVisible: !this.state.isModalVisible,
      chooseMenu: selectItem,
    })
  }

  public render() {
    const {
      layout,
      routersData,
      isSwanSdplexStatus,
      onClickTableRow,
      focusedAssetId,
      topSourcesData,
      topSessionsData,
      onClickMapMarker,
    } = this.props
    const {rowHeight, isRoutersAllCheck, checkRouters} = this.state

    const checkRouterData: Router[] = routersData.map((router, i) => {
      router.isCheck = checkRouters[i].isCheck
      return router
    })
    const checkedList = _.filter(checkRouters, ['isCheck', true])

    return (
      <>
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={rowHeight}
          margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
          containerPadding={[0, 0]}
          useCSSTransforms={true}
          onLayoutChange={this.handleLayoutChange}
          draggableHandle={'.grid-layout--draggable'}
          isDraggable={isSwanSdplexStatus}
          isResizable={isSwanSdplexStatus}
        >
          <div key="routers" className="dash-graph" style={this.cellStyle}>
            <RouterTable
              routers={checkRouterData}
              onClickTableRow={onClickTableRow}
              focusedAssetId={focusedAssetId}
              isEditable={isSwanSdplexStatus}
              cellTextColor={this.cellTextColor}
              cellBackgroundColor={this.cellBackgroundColor}
              handleOnChoose={this.handleOnChoose}
              handleRouterCheck={this.handleRouterCheck}
              isRoutersAllCheck={isRoutersAllCheck}
              handleRoutersAllCheck={this.handleRoutersAllCheck}
              firmwareVersion={this.firmwareVersion}
              configVersion={this.configVersion}
            />
          </div>
          <div key="leafletMap" className="dash-graph" style={this.cellStyle}>
            <RouterMaps
              layout={layout}
              routers={routersData}
              focusedAssetId={focusedAssetId}
              onClickMapMarker={onClickMapMarker}
              isEditable={isSwanSdplexStatus}
              cellTextColor={this.cellTextColor}
              cellBackgroundColor={this.cellBackgroundColor}
            />
          </div>
          <div key="topSources" className="dash-graph" style={this.cellStyle}>
            <TopSourcesTable
              topSources={topSourcesData}
              isEditable={isSwanSdplexStatus}
              cellTextColor={this.cellTextColor}
              cellBackgroundColor={this.cellBackgroundColor}
            />
          </div>
          <div key="topSessions" className="dash-graph" style={this.cellStyle}>
            <TopSessionsTable
              topSessions={topSessionsData}
              isEditable={isSwanSdplexStatus}
              cellTextColor={this.cellTextColor}
              cellBackgroundColor={this.cellBackgroundColor}
            />
          </div>
        </GridLayout>
        <RouterModal
          headingTitle={'Order List'}
          onCancel={() => {
            this.setState({isModalVisible: !this.state.isModalVisible})
          }}
          onConfirm={() => {
            this.handleModalConfirm()
            this.setState({isModalVisible: !this.state.isModalVisible})
          }}
          message={<this.userSelectOrderList />}
          cancelText={'Cancel'}
          confirmText={'Go Run'}
          isVisible={this.state.isModalVisible}
          isUseButton={false}
          confirmButtonStatus={
            checkedList.length > 0
              ? ComponentStatus.Default
              : ComponentStatus.Disabled
          }
          buttonClassName={'btn btn-inline_block btn-default agent--btn'}
          buttonDisabled={false}
          buttonName={''}
        />
      </>
    )
  }

  private userSelectOrderList = (): JSX.Element => {
    const {checkRouters, chooseMenu} = this.state
    const checkedList = _.filter(checkRouters, ['isCheck', true])

    return (
      <>
        <div className="list-section-container">
          <h4 className="list-section-title"> Selected Version</h4>
          <div className="list-section--row list-section--row-first list-section--row-last">
            {chooseMenu}
          </div>
        </div>
        <hr />
        {checkedList.length > 0 ? (
          <>
            <h4 className="list-section-title">
              {checkedList.length} Selected Host List
            </h4>
            <div
              className="list-section-container"
              style={{
                height:
                  checkedList.length < 1
                    ? '36px'
                    : checkedList.length < 3
                    ? '72px'
                    : checkedList.length > 5
                    ? '150px'
                    : checkedList.length * 31 + 'px',
              }}
            >
              <FancyScrollbar
                children={
                  <ol className="list-section--row list-section--row-first list-section--row-last">
                    {checkedList.map(list => (
                      <li key={list.assetId}>{list.assetId}</li>
                    ))}
                  </ol>
                }
              />
            </div>
          </>
        ) : (
          <>
            <h4 className="list-section-title">Host not selected</h4>
            <div className="list-section-container">
              <div className="list-section--row list-section--row-first list-section--row-last">
                Empty
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  private handleModalConfirm = (): void => {
    const {checkRouters, chooseMenu} = this.state
    const checkedList = _.flattenDeep(
      _.filter(checkRouters, ['isCheck', true]).map(checkRouter =>
        _.valuesIn(_.pick(checkRouter, _.keys({assetId: null})))
      )
    )

    //
    console.log({chooseMenu, checkedList})
  }

  private handleLayoutChange = (cellsLayout: cellLayoutInfo[]): void => {
    if (!this.props.onPositionChange) return
    let changed = false
    const newCellsLayout = this.props.layout.map(lo => {
      const l = cellsLayout.find(cellLayout => cellLayout.i === lo.i)

      if (lo.x !== l.x || lo.y !== l.y || lo.h !== l.h || lo.w !== l.w) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }

      return {
        ...lo,
        ...newLayout,
      }
    })

    if (changed) {
      this.props.onPositionChange(newCellsLayout)
    }
  }

  private get cellStyle(): CSSProperties {
    return {
      backgroundColor: this.cellBackgroundColor,
      borderColor: this.cellBackgroundColor,
    }
  }

  private calculateRowHeight = (): number => {
    return (
      (window.innerHeight -
        STATUS_PAGE_ROW_COUNT * LAYOUT_MARGIN -
        PAGE_HEADER_HEIGHT -
        PAGE_CONTAINER_MARGIN -
        PAGE_CONTAINER_MARGIN) /
      STATUS_PAGE_ROW_COUNT
    )
  }
}

export default GridLayoutRenderer
