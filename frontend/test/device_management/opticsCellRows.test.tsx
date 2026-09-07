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

/**
 * One InfluxDB series of interface state. IOS-XE reports these under the
 * abbreviated name ("Gi1/1/1") while the optics rows carry the long one, so a
 * test that joins them has to be able to say which form it means.
 */
const linkSeries = (
  ifName: string,
  admin: string,
  oper: string,
  alias = 'unknown'
) => ({
  tags: {dev_id: 'dev-1', ifName, ifAlias: alias},
  columns: ['time', 'admin', 'oper'],
  values: [[T2, admin, oper]],
})

/**
 * One series of the baseline query: a port that reported optics at some point
 * in the last 30 days, and the last time it did.
 */
const baselineSeries = (
  ifName: string,
  seenAt: number,
  devID = 'dev-1',
  lane = '1'
) => ({
  tags: {dev_id: devID, ifName, opticLane: lane},
  columns: ['time', 'seen'],
  values: [[seenAt, -5.6]],
})

/**
 * One series of the slot query: a transceiver cage the chassis reports,
 * whether or not anything is fitted in it.
 */
const slotSeries = (ifName: string, fitted: 0 | 1, devID = 'dev-1') => ({
  tags: {dev_id: devID, ifName},
  columns: ['time', 'fitted'],
  values: [[T2, fitted]],
})

const respond = (
  opticsSeries: any[],
  links: any[] = [],
  baseline: any[] = [],
  slots: any[] = []
) => {
  ;(executeQueries as jest.Mock).mockResolvedValue([
    {value: {results: [{series: opticsSeries}]}, error: null},
    {value: {results: [{}]}, error: null},
    {value: {results: [{series: links}]}, error: null},
    {value: {results: [{series: baseline}]}, error: null},
    {value: {results: [{series: slots}]}, error: null},
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
  // IOS-XE names the same port two ways: the optics sensor rows carry
  // "GigabitEthernet1/1/1" and the interface rows "Gi1/1/1". Joining on the
  // literal string loses the alias and the link state for every Catalyst port.
  it('joins interface state onto a port the device abbreviates', async () => {
    respond(
      [
        series('GigabitEthernet1/1/1', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -5.6, 32.4, 'ok'],
        ]),
      ],
      [linkSeries('Gi1/1/1', 'up', 'up', 'uplink to core')]
    )

    await render()

    expect(portNamed('GigabitEthernet1/1/1')).toMatchObject({
      alias: 'uplink to core',
    })
  })

  // Without the join an operator shutdown is invisible, and the port is judged
  // on its thresholds as though it were in service.
  it('reads a shutdown from the abbreviated interface rows', async () => {
    respond(
      [
        series('GigabitEthernet1/1/2', [
          [T1, -5.5, -5.7, 30.2, 'ok'],
          [T2, -5.5, -5.7, 30.2, 'ok'],
        ]),
      ],
      [linkSeries('Gi1/1/2', 'down', 'down')]
    )

    await render()

    expect(portNamed('GigabitEthernet1/1/2')).toMatchObject({
      status: 'shutdown',
    })
  })

  // NX-OS uses one name on both sides. The join must keep working there.
  it('joins interface state onto a port the device names the same way', async () => {
    respond(
      [
        series('Ethernet1/1', [
          [T1, -2.5, -3.1, 34.2, 'ok'],
          [T2, -2.5, -3.1, 34.2, 'ok'],
        ]),
      ],
      [linkSeries('Ethernet1/1', 'up', 'lowerLayerDown')]
    )

    await render()

    expect(portNamed('Ethernet1/1')).toMatchObject({status: 'upstream'})
  })

  // A module pulled out stops producing sensor rows, so the port simply leaves
  // the current window and the device silently reads 1/1 instead of 1/2. The
  // baseline is what remembers the port was ever there.
  it('shows a port that vanished from the current window', async () => {
    const yesterday = T2 - 24 * 60 * 60 * 1000
    respond(
      [
        series('Gi1/1/1', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -5.6, 32.4, 'ok'],
        ]),
      ],
      [],
      [baselineSeries('Gi1/1/1', T2), baselineSeries('Gi1/1/2', yesterday)]
    )

    await render()

    expect(portNamed('Gi1/1/2')).toMatchObject({
      tx: null,
      rx: null,
      temp: null,
      status: 'no_module',
    })
    // The last time it was seen is the whole point: it says when it went.
    expect(portNamed('Gi1/1/2').checkedAt).toBe(
      new Date(yesterday).toISOString()
    )
  })

  // It is information, not a fault. A port nobody is using must not turn the
  // device red or drag its ratio down.
  it('keeps a vanished port out of the device ratio', async () => {
    respond(
      [
        series('Gi1/1/1', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -5.6, 32.4, 'ok'],
        ]),
      ],
      [],
      [baselineSeries('Gi1/1/1', T2), baselineSeries('Gi1/1/2', T2 - 3600000)]
    )

    await render()

    expect(lastTableProps.data[0]).toMatchObject({
      status: '1/1',
      isHealthy: true,
    })
  })

  // A port still reporting is already in the table; the baseline must not add
  // a second row for it.
  it('does not duplicate a port that is still reporting', async () => {
    respond(
      [
        series('Gi1/1/1', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -5.6, 32.4, 'ok'],
        ]),
      ],
      [],
      [baselineSeries('Gi1/1/1', T2)]
    )

    await render()

    expect(portsOf().filter((p: any) => p.ifName === 'Gi1/1/1')).toHaveLength(1)
  })

  // A device that stopped reporting entirely is a collection outage, not a
  // rack full of pulled transceivers. Inventing 17 removals from one silent
  // switch is the failure this guard exists to prevent.
  it('invents no ports for a device with no current readings', async () => {
    respond(
      [
        series('Gi1/1/1', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -5.6, 32.4, 'ok'],
        ]),
      ],
      [],
      [
        baselineSeries('Gi1/1/1', T2),
        baselineSeries('Eth1/1', T2 - 3600000, 'dev-2'),
        baselineSeries('Eth1/2', T2 - 3600000, 'dev-2'),
      ]
    )

    await render()

    expect(lastTableProps.data).toHaveLength(1)
    expect(lastTableProps.data[0].id).toBe('dev-1')
  })

  const oneLivePort = () =>
    series('GigabitEthernet1/1/1', [
      [T1, -5.5, -5.6, 32.4, 'ok'],
      [T2, -5.5, -5.6, 32.4, 'ok'],
    ])

  // "2/2 OK" cannot say whether the device has two cages or four. The chassis
  // reports its cages whether or not anything is fitted, and that is the only
  // thing that can.
  it('reports how many cages are fitted', async () => {
    respond(
      [oneLivePort()],
      [],
      [],
      [
        slotSeries('GigabitEthernet1/1/1', 1),
        slotSeries('GigabitEthernet1/1/2', 1),
        slotSeries('GigabitEthernet1/1/3', 0),
        slotSeries('GigabitEthernet1/1/4', 0),
      ]
    )

    await render()

    expect(lastTableProps.data[0].slots).toBe('2/4')
  })

  // The health ratio counts ports in service. Folding empty cages into it
  // would leave every device with a spare slot permanently red.
  it('leaves the health ratio alone', async () => {
    respond(
      [oneLivePort()],
      [],
      [],
      [
        slotSeries('GigabitEthernet1/1/1', 1),
        slotSeries('GigabitEthernet1/1/3', 0),
      ]
    )

    await render()

    expect(lastTableProps.data[0]).toMatchObject({
      status: '1/1',
      isHealthy: true,
    })
  })

  // An empty cage has no sensor, so it appears in no optics row at all. It is
  // still a port an operator can use, and the list is where they look.
  it('lists an empty cage as an unpopulated port', async () => {
    respond(
      [oneLivePort()],
      [],
      [],
      [
        slotSeries('GigabitEthernet1/1/1', 1),
        slotSeries('GigabitEthernet1/1/3', 0),
      ]
    )

    await render()

    expect(portNamed('GigabitEthernet1/1/3')).toMatchObject({
      status: 'no_module',
      tx: null,
    })
  })

  // NX-OS reports no transceiver cages at all, so the count is unknown rather
  // than zero. Showing 2/0 would be a lie about the hardware.
  it('leaves the count blank for a device that reports no cages', async () => {
    respond([oneLivePort()])

    await render()

    expect(lastTableProps.data[0].slots).toBe('')
  })

  // A pulled module leaves an empty cage the baseline also remembers. Both
  // describe the same port and it must appear once.
  it('lists a pulled module once', async () => {
    respond(
      [oneLivePort()],
      [],
      [baselineSeries('GigabitEthernet1/1/2', T2 - 3600000)],
      [
        slotSeries('GigabitEthernet1/1/1', 1),
        slotSeries('GigabitEthernet1/1/2', 0),
      ]
    )

    await render()

    expect(
      portsOf().filter((p: any) => p.ifName === 'GigabitEthernet1/1/2')
    ).toHaveLength(1)
  })
})
