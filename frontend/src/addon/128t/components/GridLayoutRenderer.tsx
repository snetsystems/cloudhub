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

// Apis
import {
  getRunnerSaltCmdDirectory,
  getLocalDeliveryToMinion,
} from 'src/shared/apis/saltStack'

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

import {SALT_FULL_DIRECTORY, SALT_MIN_DIRECTORY} from 'src/addon/128t/constants'

//type
import {
  Router,
  TopSource,
  TopSession,
  SaltDirFileInfo,
  CheckRouter,
  SaltDirFile,
} from 'src/addon/128t/types'
import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'
import {ComponentStatus} from 'src/reusable_ui/types'
import {Addon} from 'src/types/auth'

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
  addons: Addon[]
}

interface State {
  rowHeight: number
  isRoutersAllCheck: boolean
  isModalVisible: boolean
  chooseMenu: string
  checkRouters: CheckRouter[]
  firmwares: SaltDirFile
  configs: SaltDirFile
  focusedBtn: string
}

class GridLayoutRenderer extends PureComponent<Props, State> {
  private cellBackgroundColor: string = DEFAULT_CELL_BG_COLOR
  private cellTextColor: string = DEFAULT_CELL_TEXT_COLOR

  constructor(props: Props) {
    super(props)

    this.state = {
      rowHeight: this.calculateRowHeight(),
      isRoutersAllCheck: false,
      isModalVisible: false,
      checkRouters: [],
      chooseMenu: '',
      firmwares: {files: [], isLoading: true},
      configs: {files: [], isLoading: true},
      focusedBtn: '',
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

  public componentDidMount() {
    this.getSaltDirectoryItems()
  }

  public getRunnerSaltCmdDirectoryData = async (
    url: string,
    token: string,
    fullDir: string,
    dir: string
  ) => {
    let applications: SaltDirFileInfo[] = []

    const getDirectoryItems = await getRunnerSaltCmdDirectory(
      url,
      token,
      fullDir
    )

    const generatorFileInfo = (time: string, item: string): SaltDirFileInfo => {
      return {
        updateTime: time,
        updateGetTime: new Date(time).getTime(),
        application: item.replace(time, '').trim(),
        applicationFullName: item,
        fullPathDirectory: fullDir,
        pathDirectory: dir,
      }
    }

    if (getDirectoryItems.data.return[0].indexOf('\n') > -1) {
      applications = getDirectoryItems.data.return[0]
        .split('\n')
        .map((item: string) => {
          const time: string = item.substring(0, item.indexOf(' '))
          return generatorFileInfo(time, item)
        })
    } else {
      const time: string = getDirectoryItems.data.return[0].substring(
        0,
        getDirectoryItems.data.return[0].indexOf(' ')
      )
      applications = [generatorFileInfo(time, getDirectoryItems.data.return[0])]
    }

    applications.sort(function(a, b) {
      return b.updateGetTime - a.updateGetTime
    })

    return {files: applications, isLoading: false}
  }

  public getSaltDirectoryItems = async () => {
    const {addons} = this.props
    const salt = addons.find(addon => addon.name === 'salt')

    const getFirmwareData = await this.getRunnerSaltCmdDirectoryData(
      salt.url,
      salt.token,
      SALT_FULL_DIRECTORY.FIRMWARE,
      SALT_MIN_DIRECTORY.FIRMWARE
    )

    const getConfigData = await this.getRunnerSaltCmdDirectoryData(
      salt.url,
      salt.token,
      SALT_FULL_DIRECTORY.CONFIG,
      SALT_MIN_DIRECTORY.CONFIG
    )

    this.setState({
      firmwares: getFirmwareData,
      configs: getConfigData,
    })
  }

  public handleRoutersAllCheck = (): void => {
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

  public handleOnChoose = ({selectItem}: {selectItem: string}): void => {
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
    const {
      rowHeight,
      isRoutersAllCheck,
      checkRouters,
      firmwares,
      configs,
    } = this.state

    const checkRouterData: Router[] = routersData.map(
      (router, i): Router => {
        router.isCheck = checkRouters[i].isCheck
        return router
      }
    )

    const checkedList: CheckRouter[] = _.filter(checkRouters, ['isCheck', true])

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
              handleFocusedBtnName={this.handleFocusedBtnName}
              isRoutersAllCheck={isRoutersAllCheck}
              handleRoutersAllCheck={this.handleRoutersAllCheck}
              firmwares={firmwares}
              configs={configs}
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

  private handleFocusedBtnName = ({buttonName}: {buttonName: string}): void => {
    this.setState({focusedBtn: buttonName})
  }

  private handleModalConfirm = (): void => {
    const {checkRouters, chooseMenu, focusedBtn} = this.state
    const {addons} = this.props
    const salt = addons.find(addon => addon.name === 'salt')

    const checkedHostName: string = checkRouters
      .filter(router => router.isCheck === true)
      .map(router => router.assetId)
      .toString()

    const chooseMenuInfo: SaltDirFileInfo = this.state[focusedBtn].filter(
      (host: SaltDirFileInfo): boolean =>
        host.applicationFullName === chooseMenu
    )[0]

    this.handleGetDeliveryToMinion(
      salt.url,
      salt.token,
      chooseMenuInfo,
      checkedHostName
    )
  }

  private handleGetDeliveryToMinion = (
    url: string,
    token: string,
    chooseMenuInfo: SaltDirFileInfo,
    checkedHost: string
  ): void => {
    getLocalDeliveryToMinion(
      url,
      token,
      chooseMenuInfo.pathDirectory + chooseMenuInfo.application,
      checkedHost,
      chooseMenuInfo.fullPathDirectory
    )
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
