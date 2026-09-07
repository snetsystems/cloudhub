// The worker manager uses import.meta, which ts-jest cannot emit for CommonJS.
jest.mock('src/worker/JobManager', () => ({__esModule: true, manager: {}}))

// Capture what the cell hands the table instead of rendering the whole table.
let lastTableProps: any = null
jest.mock('src/device_management/components/TableComponent', () => ({
  __esModule: true,
  default: (props: any) => {
    lastTableProps = props
    return null
  },
}))
jest.mock('src/device_management/components/OpticsThresholdOverlay', () => ({
  __esModule: true,
  default: () => null,
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

import React from 'react'
import {mount} from 'enzyme'
import {Provider} from 'react-redux'
import {createStore} from 'redux'

import OpticsCellContent from 'src/device_management/components/OpticsCellContent'
import {executeQueries} from 'src/shared/apis/query'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'

const POLL_MS = 60000
const T2 = 1788700000000
const T1 = T2 - POLL_MS

/** One InfluxDB series of raw optics samples for a port. */
const series = (
  ifName: string,
  rows: Array<[number, number, number, number, string]>
) => ({
  tags: {
    dev_id: 'dev-1',
    sys_name: 'SW-1',
    ifName,
    opticLane: '1',
  },
  columns: ['time', 'tx', 'rx', 'temp', 'status'],
  values: rows,
})

const respond = (opticsSeries: any[]) => {
  ;(executeQueries as jest.Mock).mockResolvedValue([
    {value: {results: [{series: opticsSeries}]}, error: null},
    {value: {results: [{}]}, error: null},
    {value: {results: [{}]}, error: null},
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

const cell = {i: 'snmp-optics', name: 'Optics'} as DashboardsModels.Cell

const render = async () => {
  const wrapper = mount(
    <Provider store={store}>
      <OpticsCellContent cell={cell} context={context} />
    </Provider>
  )
  // Let the query promise and its setState settle.
  await new Promise(resolve => setImmediate(resolve))
  wrapper.update()
  return wrapper
}

const portsOf = () => lastTableProps?.data?.[0]?.ports ?? []
const portNamed = (ifName: string) =>
  portsOf().find((p: any) => p.ifName === ifName)

describe('OpticsCellContent readings', () => {
  beforeEach(() => {
    lastTableProps = null
  })

  it('shows the readings of a port whose sensor is usable', async () => {
    respond([
      series('Ethernet1/1', [
        [T1, -2.5, -3.1, 34.2, 'ok'],
        [T2, -2.6, -3.2, 34.4, 'ok'],
      ]),
    ])

    await render()

    expect(portNamed('Ethernet1/1')).toMatchObject({
      tx: -2.6,
      rx: -3.2,
      temp: 34.4,
      status: 'ok',
    })
  })

  // The device keeps returning the last number the departed module gave, so
  // the readings have to be dropped or they read as a live measurement.
  it('blanks the readings of a port the device reports as no_module', async () => {
    respond([
      series('GigabitEthernet1/1/1', [
        [T1, -6.4, -6.4, 26.3, 'ok'],
        [T2, -6.4, -6.4, 26.3, 'no_module'],
      ]),
    ])

    await render()

    expect(portNamed('GigabitEthernet1/1/1')).toMatchObject({
      tx: null,
      rx: null,
      temp: null,
      status: 'no_module',
    })
  })

  it('keeps a no_module port out of the device worst-port gauges', async () => {
    respond([
      series('Ethernet1/1', [
        [T1, -2.5, -3.1, 34.2, 'ok'],
        [T2, -2.5, -3.1, 34.2, 'ok'],
      ]),
      // Worse on every metric, but its module is gone.
      series('GigabitEthernet1/1/1', [
        [T1, -9.9, -9.9, 70.1, 'ok'],
        [T2, -9.9, -9.9, 70.1, 'no_module'],
      ]),
    ])

    await render()

    const device = lastTableProps.data[0]
    expect(device.txPort).toBe('Ethernet1/1')
    expect(device.rxPort).toBe('Ethernet1/1')
    expect(device.tempPort).toBe('Ethernet1/1')
  })
})
