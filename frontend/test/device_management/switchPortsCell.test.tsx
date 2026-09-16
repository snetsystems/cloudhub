jest.mock('src/worker/JobManager', () => ({__esModule: true, manager: {}}))

let lastTableProps: any = null
jest.mock('src/device_management/components/TableComponent', () => ({
  __esModule: true,
  default: (props: any) => {
    lastTableProps = props
    return null
  },
}))
jest.mock('src/shared/apis/query', () => ({
  __esModule: true,
  executeQueries: jest.fn(),
}))
jest.mock('src/device_management/apis', () => ({
  __esModule: true,
  getDeviceList: jest.fn().mockResolvedValue({data: {devices: []}}),
  getAllDevicesOrg: jest.fn().mockResolvedValue({data: {organizations: []}}),
}))
jest.mock('src/dashboards/apis', () => ({
  __esModule: true,
  getDashboards: jest.fn().mockResolvedValue({data: {dashboards: []}}),
  applyFixedCell: jest.fn(),
}))
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({t: (_k: string, d?: string) => d ?? _k}),
}))
jest.mock('src/i18n', () => ({
  __esModule: true,
  default: {t: (_k: string, d?: string) => d ?? _k},
}))

import React from 'react'
import {mount} from 'enzyme'
import {Provider} from 'react-redux'
import {createStore} from 'redux'

import SwitchPortsCellContent from 'src/device_management/components/SwitchPortsCellContent'
import {executeQueries} from 'src/shared/apis/query'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'

const T2 = 1788700000000

const linkSeries = (
  ifName: string,
  admin: string,
  oper: string,
  ifType: number | null,
  lastChange: number | null
) => ({
  tags: {dev_id: 'dev-6f', ifName, ifAlias: 'unknown'},
  columns: ['time', 'admin', 'oper', 'type', 'lastChange'],
  values: [[T2, admin, oper, ifType, lastChange]],
})

const deviceSeries = {
  tags: {dev_id: 'dev-6f', sys_name: '6F_WG_L2_01', agent_host: '10.10.250.61'},
  columns: ['time', 'model', 'uptime'],
  values: [[T2, 'C9200L-48P-4G', '1235891422']],
}

const respond = (links: any[], devices: any[] = [deviceSeries]) => {
  ;(executeQueries as jest.Mock).mockResolvedValue([
    {value: {results: [{series: links}]}, error: null},
    {value: {results: [{series: devices}]}, error: null},
  ])
}

const store = createStore(() => ({
  app: {persisted: {timeZone: 'Local', autoRefresh: 0}},
  auth: {me: {currentOrganization: {id: 'org-1'}}},
}))

const context = ({
  source: {id: '1', telegraf: 'Default', links: {proxy: '/proxy'}},
  sources: [],
  host: '',
  templates: [],
  timeRange: {lower: 'now() - 15m', upper: null},
  isEditable: false,
  manualRefresh: 0,
} as unknown) as RenderCellContext

const cell = {i: 'snmp-ports', name: 'Switch Ports'} as DashboardsModels.Cell

const render = async () => {
  const wrapper = mount(
    <Provider store={store}>
      <SwitchPortsCellContent cell={cell} context={context} />
    </Provider>
  )
  await new Promise(resolve => setImmediate(resolve))
  wrapper.update()
  return wrapper
}

describe('SwitchPortsCellContent', () => {
  beforeEach(() => {
    lastTableProps = null
  })

  it('hands the table one row per switch with its ports judged', async () => {
    respond([
      linkSeries('Gi1/0/1', 'up', 'up', 6, 26991),
      linkSeries('Gi1/0/6', 'up', 'down', 6, 15038),
      // ~52.9 days old against the device's uptime: past the 7-day
      // long_down threshold, so this is retired cabling, not a fault.
      linkSeries('Gi1/0/8', 'up', 'down', 6, 778392045),
      // 3 days old: a genuine, still-active fault.
      linkSeries('Gi1/0/9', 'up', 'down', 6, 1209971422),
      linkSeries('Gi0/0', 'down', 'down', 6, 14798),
    ])

    await render()

    expect(lastTableProps.data).toHaveLength(1)
    expect(lastTableProps.data[0]).toMatchObject({
      sysName: '6F_WG_L2_01',
      model: 'C9200L-48P-4G',
      up: 1,
      down: 1,
      longDown: 1,
      shutdown: 1,
      unused: 1,
      severity: 'fail',
    })
    expect(lastTableProps.initSort).toEqual({key: 'down', isDesc: true})
  })

  it('asks for a collector update when no switch sends ifType', async () => {
    respond([linkSeries('Gi1/0/1', 'up', 'up', -1, -1)])

    await render()

    expect(lastTableProps.data).toHaveLength(0)
    expect(lastTableProps.options.noDataMessage).toMatch(/ifType/)
  })
})
