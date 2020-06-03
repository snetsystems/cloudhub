// Libraries
import React, {
  PureComponent,
  CSSProperties,
  ChangeEvent,
  MouseEvent,
} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import {connect} from 'react-redux'
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
import {getOncueServiceStatus} from 'src/addon/128t/api/index'

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

// Middleware
import {
  setLocalStorage,
  getLocalStorage,
} from 'src/shared/middleware/localStorage'

// Authorized
import {ADMIN_ROLE, SUPERADMIN_ROLE} from 'src/auth/Authorized'

//type
import {
  RouterNode,
  TopSource,
  TopSession,
  SaltDirFileInfo,
  CheckRouter,
  SaltDirFile,
  GetSaltDirectoryInfo,
  OncueData,
} from 'src/addon/128t/types'
import {NETWORK_ACCESS, GET_STATUS} from 'src/agent_admin/constants'
import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'
import {ComponentStatus} from 'src/reusable_ui/types'
import {Addon} from 'src/types/auth'
import {Notification, NotificationFunc, Me} from 'src/types'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notify_128TGetMasterDirFiles_Failed,
  notify_128TSendFilesToCollector_Successed,
  notify_128TSendFilesToCollector_Failed,
} from 'src/addon/128t/components/Notifications'

// Error
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Auth {
  me: Me
}

interface Props {
  auth: Auth
  notify: (message: Notification | NotificationFunc) => void
  layout: cellLayoutInfo[]
  focusedNodeName: string
  routerNodesData: RouterNode[]
  topSessionsData: TopSession[]
  topSourcesData: TopSource[]
  isSwanSdplexStatus: boolean
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => () => void
  onPositionChange: (cellsLayout: cellLayoutInfo[]) => void
  onClickMapMarker: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => void
  addons: Addon[]
}

interface State {
  rowHeight: number
  isRoutersAllCheck: boolean
  isModalVisible: boolean
  isRouterDataPopupVisible: boolean
  chooseMenu: string
  checkRouters: CheckRouter[]
  firmware: SaltDirFile
  config: SaltDirFile
  focusedBtn: string
  sendToDirectory: string
  routerPopupPosition: {top: number; right: number}
  oncueData: OncueData
  routerDataPopupAutoRefresh: number
  selectedNodeName: string
}

@ErrorHandling
class GridLayoutRenderer extends PureComponent<Props, State> {
  private cellBackgroundColor: string = DEFAULT_CELL_BG_COLOR
  private cellTextColor: string = DEFAULT_CELL_TEXT_COLOR

  private DEFAULT_COLLECTOR_DIRECTORY = '/srv/salt/prod/dmt/'
  private refDataPopup = React.createRef<HTMLDivElement>()
  private routertableRef = React.createRef<HTMLDivElement>()

  private timerOncueData: NodeJS.Timer

  constructor(props: Props) {
    super(props)

    this.state = {
      rowHeight: this.calculateRowHeight(),
      isRoutersAllCheck: false,
      isModalVisible: false,
      isRouterDataPopupVisible: false,
      checkRouters: [],
      chooseMenu: '',
      firmware: {files: [], isLoading: true},
      config: {files: [], isLoading: true},
      focusedBtn: '',
      sendToDirectory: '',
      routerPopupPosition: {top: 0, right: 0},
      oncueData: {
        isOncue: false,
        nodeName: '',
        focusedInProtocolModule: '',
        focusedInDeviceConnection: '',
        oncueService: null,
      },
      routerDataPopupAutoRefresh: 0,
      selectedNodeName: '',
    }
  }

  public componentWillMount() {
    const checkRoutersData = this.props.routerNodesData.map(router => {
      return {group: router.group, nodeName: router.nodeName, isCheck: false}
    })

    const addon = getLocalStorage('addon')
    const oncueAutoRefresh: number = _.get(addon, 'T128.oncueAutoRefresh')

    const {addons} = this.props
    const oncue = _.find(addons, addon => addon.name === 'oncue')
    const isOncue = oncue === undefined ? false : true

    this.setState({
      checkRouters: checkRoutersData,
      oncueData: {
        ...this.state.oncueData,
        isOncue,
      },
      routerDataPopupAutoRefresh: oncueAutoRefresh,
    })
  }

  public componentDidMount() {
    try {
      this.getSaltDirectoryItems()
    } catch (e) {
      console.error(e)
    }
  }

  public componentDidUpdate(__: Props, prevState: State) {
    if (
      prevState.routerDataPopupAutoRefresh !==
      this.state.routerDataPopupAutoRefresh
    ) {
      const {routerDataPopupAutoRefresh} = this.state

      const addon = getLocalStorage('addon')
      setLocalStorage('addon', {
        ...addon,
        T128: {
          ...addon.T128,
          oncueAutoRefresh: routerDataPopupAutoRefresh,
        },
      })

      if (routerDataPopupAutoRefresh) {
        this.timerOncueData = setInterval(async () => {
          await this.fetchOncueServiceStatus()
        }, routerDataPopupAutoRefresh)
      } else {
        this.cleanIntervalOncueServiceStatus()
      }
    }
  }

  public componentWillUnmount() {
    this.cleanIntervalOncueServiceStatus()
  }

  public getRunnerSaltCmdDirectoryData = async (
    url: string,
    token: string,
    fullDir: string,
    dir: string
  ): Promise<SaltDirFile> => {
    let applications: SaltDirFileInfo[] = []
    const getDirectoryItems: GetSaltDirectoryInfo = await getRunnerSaltCmdDirectory(
      url,
      token,
      fullDir
    )

    if (
      getDirectoryItems.status === 200 &&
      getDirectoryItems.statusText === 'OK'
    ) {
      const getData: string = getDirectoryItems.data.return[0]
      if (
        getData.length === 0 ||
        getData.indexOf('No such file or directory') > -1
      ) {
        applications = [
          this.generatorFileInfo({
            time: '',
            item: GET_STATUS.EMPTY,
            fullDir,
            dir,
          }),
        ]
      } else {
        if (getData.indexOf('\n') > -1) {
          applications = getData.split('\n').map((item: string) => {
            const time: string = item.substring(0, item.indexOf(' '))
            return this.generatorFileInfo({time, item, fullDir, dir})
          })
        } else {
          const time: string = getData.substring(0, getData.indexOf(' '))
          applications = [
            this.generatorFileInfo({time, item: getData, fullDir, dir}),
          ]
        }

        applications.sort(function(a, b) {
          return b.updateGetTime - a.updateGetTime
        })
      }
    }

    return {
      files: applications,
      isLoading: false,
      status:
        getDirectoryItems.status === 200 &&
        getDirectoryItems.statusText === 'OK'
          ? NETWORK_ACCESS.SUCCESS
          : getDirectoryItems,
    }
  }

  public generatorFileInfo = ({
    time,
    item,
    fullDir,
    dir,
  }: {
    time: string
    item: string
    fullDir: string
    dir: string
  }): SaltDirFileInfo => {
    return {
      updateTime: time,
      updateGetTime: new Date(time).getTime(),
      application: item.replace(time, '').trim(),
      applicationFullName: item,
      fullPathDirectory: fullDir,
      pathDirectory: dir,
    }
  }

  public getSaltDirectoryItems = async () => {
    try {
      const {auth, addons, notify} = this.props
      const salt = addons.find(addon => addon.name === 'salt')
      const meRole = _.get(auth, 'me.role', '')

      if (meRole !== SUPERADMIN_ROLE && meRole !== ADMIN_ROLE) {
        return
      }

      const getFirmwareData: SaltDirFile = await this.getRunnerSaltCmdDirectoryData(
        salt.url,
        salt.token,
        SALT_FULL_DIRECTORY.FIRMWARE,
        SALT_MIN_DIRECTORY.FIRMWARE
      )

      const getConfigData: SaltDirFile = await this.getRunnerSaltCmdDirectoryData(
        salt.url,
        salt.token,
        SALT_FULL_DIRECTORY.CONFIG,
        SALT_MIN_DIRECTORY.CONFIG
      )

      const isAccess = [getFirmwareData, getConfigData]
        .map(obj => obj.status === NETWORK_ACCESS.SUCCESS)
        .includes(true)

      if (!isAccess) {
        notify(notify_128TGetMasterDirFiles_Failed('All Directory'))
      }

      this.setState({
        firmware: getFirmwareData,
        config: getConfigData,
      })
    } catch (error) {
      console.error(error)
    }
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

  public handleRouterCheck = ({routerNode}: {routerNode: RouterNode}): void => {
    const {checkRouters} = this.state
    const index = checkRouters.indexOf(
      checkRouters.find(
        checkRouter =>
          checkRouter.nodeName === routerNode.nodeName &&
          checkRouter.group === routerNode.group
      )
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
    if (selectItem !== GET_STATUS.EMPTY) {
      this.setState({
        isModalVisible: !this.state.isModalVisible,
        chooseMenu: selectItem,
      })
    }
  }

  public render() {
    const {
      auth,
      layout,
      routerNodesData,
      isSwanSdplexStatus,
      onClickTableRow,
      focusedNodeName,
      topSourcesData,
      topSessionsData,
      onClickMapMarker,
    } = this.props
    const {
      rowHeight,
      isRoutersAllCheck,
      checkRouters,
      firmware,
      config,
      sendToDirectory,
      isRouterDataPopupVisible,
      routerPopupPosition,
      oncueData,
      routerDataPopupAutoRefresh,
    } = this.state

    const checkRouterData: RouterNode[] = routerNodesData.map(
      (router, i): RouterNode => {
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
          <div
            key="routers"
            ref={this.routertableRef}
            className="dash-graph grid-item--routers"
            style={this.cellStyle}
          >
            <RouterTable
              me={auth.me}
              routerNodes={checkRouterData}
              onClickTableRow={onClickTableRow}
              focusedNodeName={focusedNodeName}
              isEditable={isSwanSdplexStatus}
              cellTextColor={this.cellTextColor}
              cellBackgroundColor={this.cellBackgroundColor}
              handleOnChoose={this.handleOnChoose}
              handleRouterCheck={this.handleRouterCheck}
              handleFocusedBtnName={this.handleFocusedBtnName}
              isRoutersAllCheck={isRoutersAllCheck}
              handleRoutersAllCheck={this.handleRoutersAllCheck}
              firmware={firmware}
              config={config}
              isRouterDataPopupVisible={isRouterDataPopupVisible}
              handleOnClickNodeName={this.onClickNodeName}
              hanldeOnDismiss={this.handleDataPopupClose}
              routerPopupPosition={routerPopupPosition}
              oncueData={oncueData}
              handleOnClickProtocolModulesRow={this.onClickProtocolModulesRow}
              handleOnClickDeviceConnectionsRow={
                this.onClickDeviceConnectionsRow
              }
              routerDataPopupAutoRefresh={routerDataPopupAutoRefresh}
              onChooseRouterDataPopupAutoRefresh={
                this.onChooseRouterDataPopupAutoRefresh
              }
              onManualRouterDataPopupRefresh={
                this.handleOnManualRouterDataPopupRefresh
              }
            />
          </div>
          <div key="leafletMap" className="dash-graph" style={this.cellStyle}>
            <RouterMaps
              layout={layout}
              routerNodes={routerNodesData}
              focusedNodeName={focusedNodeName}
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
          customClass={'agent-default-button'}
          cancelText={'Cancel'}
          confirmText={'OK'}
          isVisible={this.state.isModalVisible}
          isUseButton={false}
          confirmButtonStatus={
            checkedList.length > 0 && sendToDirectory.length > 0
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

  private handleOnManualRouterDataPopupRefresh = () => {
    event.stopPropagation()
    this.onManualRouterDataPopupRefresh()
  }

  private cleanIntervalOncueServiceStatus = () => {
    clearInterval(this.timerOncueData)
  }

  private fetchOncueServiceStatus = async (nodeName?: string) => {
    const {addons} = this.props
    const {selectedNodeName} = this.state
    const salt = addons.find(addon => addon.name === 'salt')
    const oncue = addons.find(addon => addon.name === 'oncue')
    nodeName = nodeName ? nodeName : selectedNodeName
    const response = await getOncueServiceStatus(
      salt.url,
      salt.token,
      nodeName,
      oncue.url
    )

    if (response) {
      this.setState({
        oncueData: {
          ...this.state.oncueData,
          nodeName: nodeName,
          oncueService: response,
          protocolModule: response.protocolModule,
          deviceConnection: response.protocolModule[0].deviceConnection,
          connection: response.protocolModule[0].deviceConnection[0].connection,
          focusedInProtocolModule: response.protocolModule[0].name,
          focusedInDeviceConnection:
            response.protocolModule[0].deviceConnection[0].url,
        },
      })
    } else {
      this.setState({
        oncueData: {
          ...this.state.oncueData,
          nodeName: nodeName,
          oncueService: null,
          protocolModule: [],
          deviceConnection: [],
          connection: [],
          focusedInProtocolModule: '',
          focusedInDeviceConnection: '',
        },
      })
    }
  }

  private onChooseRouterDataPopupAutoRefresh = (milliseconds: number) => {
    this.setState({routerDataPopupAutoRefresh: milliseconds})
  }

  private onManualRouterDataPopupRefresh = _.debounce(
    this.fetchOncueServiceStatus,
    1000
  )

  private onClickProtocolModulesRow = (name: string): void => {
    this.setState({
      oncueData: {
        ...this.state.oncueData,
        deviceConnection: this.state.oncueData.protocolModule
          .filter(f => f.name === name)
          .map(m => m.deviceConnection)[0],
        connection: this.state.oncueData.protocolModule
          .filter(f => f.name === name)
          .map(m => m.deviceConnection)[0][0].connection,
        focusedInProtocolModule: name,
        focusedInDeviceConnection: this.state.oncueData.protocolModule
          .filter(f => f.name === name)
          .map(m => m.deviceConnection)[0][0].url,
      },
    })
  }

  private onClickDeviceConnectionsRow = (url: string) => {
    this.setState({
      oncueData: {
        ...this.state.oncueData,
        connection: this.state.oncueData.deviceConnection
          .filter(f => f.url === url)
          .map(m => m.connection)[0],
        focusedInDeviceConnection: url,
      },
    })
  }

  private handleOnClickTableRow = (routerNode: RouterNode) => {
    const {topSources, topSessions, nodeName} = routerNode
    return this.props.onClickTableRow(topSources, topSessions, nodeName)()
  }

  private onClickNodeName = async (data: {
    _event: MouseEvent<HTMLElement>
    routerNode: RouterNode
  }) => {
    if (this.state.oncueData.isOncue === false) {
      this.handleOnClickTableRow(data.routerNode)
      return
    }

    const {_event, routerNode} = data
    const {nodeName} = routerNode

    this[nodeName] = _event.target
    this[nodeName].ref = this.refDataPopup

    const routerPosition = this[nodeName].getBoundingClientRect()

    const {top, right} = routerPosition
    const {parentTop, parentLeft} = this.getParentPosition(this[nodeName])

    await this.fetchOncueServiceStatus(nodeName)

    this.setState({
      routerPopupPosition: {top: top - parentTop, right: right - parentLeft},
      selectedNodeName: nodeName,
    })

    this.handleDataPopupOpen()
  }

  private getParentPosition = (target: HTMLElement) => {
    let currentParent = target
    while (currentParent) {
      if (
        window.getComputedStyle(currentParent).getPropertyValue('transform') !==
        'none'
      ) {
        break
      }
      currentParent = currentParent.parentElement
    }

    const parentTop =
      (currentParent && currentParent.getBoundingClientRect().top) || 0

    const parentLeft =
      (currentParent && currentParent.getBoundingClientRect().left) || 0

    return {parentTop, parentLeft}
  }

  private handleDataPopupOpen = () => {
    this.setState({isRouterDataPopupVisible: true})
  }

  private handleDataPopupClose = () => {
    this.cleanIntervalOncueServiceStatus()
    this.setState({
      isRouterDataPopupVisible: false,
      oncueData: {
        ...this.state.oncueData,
        nodeName: '',
        oncueService: null,
        protocolModule: [],
        deviceConnection: [],
        connection: [],
        focusedInProtocolModule: '',
        focusedInDeviceConnection: '',
      },
    })
  }

  private onChangeSendToDirectory = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({sendToDirectory: e.target.value})
  }

  private userSelectOrderList = (): JSX.Element => {
    const {checkRouters, chooseMenu, sendToDirectory} = this.state
    const checkedList = _.filter(checkRouters, ['isCheck', true])

    return (
      <>
        <div className="list-section-container">
          <h4 className="list-section-title">Selected Version</h4>
          <div className="list-section--row list-section--row-first list-section--row-last">
            {chooseMenu}
          </div>
          <h4 className="list-section-title">Destination Directory</h4>
          <input
            type="text"
            className={'form-control input-sm'}
            value={sendToDirectory}
            placeholder="enter"
            onChange={this.onChangeSendToDirectory}
            onBlur={this.onBlurInputValueCheck}
            spellCheck={false}
          />

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
                  autoHide={false}
                  children={
                    <ol className="list-section--row list-section--row-first list-section--row-last">
                      {checkedList.map(list => (
                        <li key={list.nodeName}>{list.nodeName}</li>
                      ))}
                    </ol>
                  }
                />
              </div>
            </>
          ) : (
            <>
              <h4 className="list-section-title caution-word">
                Host not selected
              </h4>
              <div className="list-section-container">
                <div className="list-section--row list-section--row-first list-section--row-last caution-word">
                  Empty
                </div>
              </div>
            </>
          )}
        </div>
      </>
    )
  }

  private onBlurInputValueCheck = () => {
    const {sendToDirectory} = this.state
    if (sendToDirectory[sendToDirectory.length - 1] !== '/') {
      this.setState({sendToDirectory: sendToDirectory + '/'})
    }
  }

  private handleFocusedBtnName = ({buttonName}: {buttonName: string}): void => {
    buttonName = buttonName.toLowerCase()
    this.setState({
      focusedBtn: buttonName,
      sendToDirectory: this.DEFAULT_COLLECTOR_DIRECTORY + buttonName + '/',
    })
  }

  private handleModalConfirm = (): void => {
    const {checkRouters, chooseMenu, focusedBtn, sendToDirectory} = this.state
    const {addons, notify} = this.props
    const salt = addons.find(addon => addon.name === 'salt')

    const checkedHostName: string = checkRouters
      .filter(router => router.isCheck === true)
      .map(router => router.nodeName)
      .toString()

    const chooseMenuInfo: SaltDirFileInfo = this.state[focusedBtn].files.filter(
      (host: SaltDirFileInfo): boolean =>
        host.applicationFullName === chooseMenu
    )[0]

    this.handleGetDeliveryToMinion(
      salt.url,
      salt.token,
      checkedHostName,
      sendToDirectory,
      chooseMenuInfo.pathDirectory + chooseMenuInfo.application
    ).then(res => {
      Object.keys(res.data.return[0]).length > 0
        ? notify(notify_128TSendFilesToCollector_Successed(focusedBtn))
        : notify(notify_128TSendFilesToCollector_Failed(focusedBtn))
    })
  }

  private handleGetDeliveryToMinion = (
    url: string,
    token: string,
    checkedHost: string,
    sendToCollectorDir: string,
    chooseItemInDir: string
  ): Promise<any> =>
    getLocalDeliveryToMinion(
      url,
      token,
      checkedHost,
      sendToCollectorDir,
      chooseItemInDir
    )

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

const mapStateToProps = ({auth}) => ({
  auth,
})

const mdtp = {
  notify: notifyAction,
  getRunnerSaltCmdDirectory: getRunnerSaltCmdDirectory,
}

export default connect(mapStateToProps, mdtp)(GridLayoutRenderer)
