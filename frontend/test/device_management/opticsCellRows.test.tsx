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
  useTranslation: () => ({
    t: (_k: string, d?: string) => d ?? _k,
    i18n: {language: 'en'},
  }),
}))
jest.mock('src/i18n', () => ({
  __esModule: true,
  default: {t: (_k: string, d?: string) => d ?? _k},
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

/** Interface state that also carries the IF-MIB type and last-change tick. */
const linkSeriesWithChange = (
  ifName: string,
  admin: string,
  oper: string,
  ifType: number,
  lastChange: number
) => ({
  tags: {dev_id: 'dev-1', ifName, ifAlias: 'unknown'},
  columns: ['time', 'admin', 'oper', 'type', 'lastChange'],
  values: [[T2, admin, oper, ifType, lastChange]],
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
      severity: 'ok',
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
      severity: 'ok',
    })
  })

  // A device reads as its worst port, so one degrading port has to be visible
  // from the collapsed row - otherwise it is only found by expanding it.
  it('carries the worst port severity up to the device row', async () => {
    respond([
      oneLivePort(),
      series('GigabitEthernet1/1/2', [[T2, -5.5, -30.0, 32.4, 'ok']]),
    ])

    await render()

    expect(lastTableProps.data[0]).toMatchObject({
      status: '1/2',
      severity: 'warn',
    })
  })

  // A link that never came up is worse than one that is merely dim, and the
  // device row has to say so rather than settling on the first fault it finds.
  it('lets a down port outrank a dim one', async () => {
    respond(
      [
        oneLivePort(),
        series('GigabitEthernet1/1/2', [[T2, -5.5, -30.0, 32.4, 'ok']]),
        series('GigabitEthernet1/1/3', [[T2, -5.5, -5.6, 32.4, 'ok']]),
      ],
      [linkSeries('Gi1/1/3', 'up', 'down')]
    )

    await render()

    expect(lastTableProps.data[0].severity).toBe('fail')
    expect(
      lastTableProps.data[0].ports.find(
        p => p.ifName === 'GigabitEthernet1/1/3'
      ).status
    ).toBe('down')
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
    // An empty cage is not a present module, so it must not join the
    // denominator - if it did, this device would misreport as '1/2'.
    expect(lastTableProps.data[0]).toMatchObject({
      status: '1/1',
      severity: 'ok',
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

describe('OpticsCellContent unused ports', () => {
  beforeEach(() => {
    lastTableProps = null
  })

  const livePort = (ifName: string) =>
    series(ifName, [
      [T1, -5.5, -5.6, 32.4, 'ok'],
      [T2, -5.5, -5.6, 32.4, 'ok'],
    ])

  // Core_BB_01 Gi1/0/19 on 2026-09-15: an SFP with no patch lead. The link
  // never changed after the interfaces came up, so it is not a fault. It is
  // still a fitted module, so it belongs in the denominator alongside
  // Gi1/0/3 - "1/1" would hide the very port Slots counts as fitted. Its
  // severity is `none`, so it must not turn the device red.
  it('shows a fitted port that was never linked as unused', async () => {
    respond(
      [livePort('GigabitEthernet1/0/3'), livePort('GigabitEthernet1/0/19')],
      [
        linkSeriesWithChange('Gi1/0/3', 'up', 'up', 6, 15038),
        linkSeriesWithChange('Gi1/0/19', 'up', 'down', 6, 15040),
        linkSeriesWithChange('Gi0/0', 'down', 'down', 6, 14798),
      ]
    )

    await render()

    expect(portNamed('GigabitEthernet1/0/19').status).toBe('unused')
    expect(lastTableProps.data[0]).toMatchObject({
      status: '1/2',
      severity: 'ok',
    })
  })

  it('still fails a port that went down after boot', async () => {
    respond(
      [livePort('GigabitEthernet1/0/3'), livePort('GigabitEthernet1/0/8')],
      [
        linkSeriesWithChange('Gi1/0/3', 'up', 'up', 6, 15038),
        linkSeriesWithChange('Gi1/0/8', 'up', 'down', 6, 778392045),
      ]
    )

    await render()

    expect(portNamed('GigabitEthernet1/0/8').status).toBe('down')
    expect(lastTableProps.data[0].severity).toBe('fail')
  })
})

describe('OpticsCellContent undiagnosed modules', () => {
  beforeEach(() => {
    lastTableProps = null
  })

  const oneLivePort = () =>
    series('GigabitEthernet1/1/1', [
      [T1, -5.5, -5.6, 32.4, 'ok'],
      [T2, -5.5, -5.6, 32.4, 'ok'],
    ])

  // NFVO-1 Ethernet1/10: admin up, oper up, carrying traffic, but no
  // opticalTxPower/RxPower/Temperature ever arrived for it - a DAC/twinax
  // cable or a module with no digital diagnostics. A cage the chassis calls
  // fitted but that produced no sensor row at all must surface as its own
  // row rather than vanishing between "Slots 15/54" and "Status 14/14".
  it('lists a fitted cage with no optical readings as no_diagnostics, counted in the ratio', async () => {
    respond(
      [oneLivePort()],
      [],
      [],
      [
        slotSeries('GigabitEthernet1/1/1', 1),
        slotSeries('GigabitEthernet1/1/2', 1),
      ]
    )

    await render()

    expect(portNamed('GigabitEthernet1/1/2')).toMatchObject({
      status: 'no_diagnostics',
      tx: null,
      rx: null,
      temp: null,
    })
    // Fitted, so it belongs in the denominator; not confirmed healthy, so it
    // is not in okCount. "1/2" is what makes the blind spot visible - folding
    // it into "1/1" is exactly the bug this row exists to catch.
    expect(lastTableProps.data[0]).toMatchObject({
      status: '1/2',
      severity: 'ok',
    })
  })

  // `named` is built from real sensor rows before the no_diagnostics
  // synthesis runs (`!named.has(canonicalIfName(c.ifName))` in the
  // `undiagnosed` filter), so a fitted cage whose module IS reporting - even
  // badly - keeps its real verdict instead of being overwritten or
  // duplicated by a synthesised no_diagnostics row. Drop that guard and this
  // port gets a second row: the real 'low' one from portRows plus a
  // synthesised 'no_diagnostics' one from `undiagnosed`, so
  // `toHaveLength(1)` below is what would actually catch the regression -
  // portNamed's `.find()` would still return the real row first either way,
  // since Array#sort is stable and portRows precedes undiagnosed in the
  // concatenation.
  it('keeps a fitted port that is reporting badly instead of a no_diagnostics duplicate', async () => {
    respond(
      [
        series('GigabitEthernet1/1/3', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -30.0, 32.4, 'ok'],
        ]),
      ],
      [],
      [],
      [slotSeries('GigabitEthernet1/1/3', 1)]
    )

    await render()

    expect(portNamed('GigabitEthernet1/1/3')).toMatchObject({status: 'low'})
    expect(
      portsOf().filter((p: any) => p.ifName === 'GigabitEthernet1/1/3')
    ).toHaveLength(1)
  })
})

describe('OpticsCellContent empty cage suppression', () => {
  beforeEach(() => {
    lastTableProps = null
  })

  // Nexus: every cage is a physical port (54 cages among ~55 physical ports,
  // the one extra being mgmt0). An empty cage there says nothing "Slots"
  // does not already say, so none of them are synthesised.
  it("lists no empty cages when the cage list is the device's whole port list", async () => {
    respond(
      [
        series('Ethernet1/1', [
          [T1, -2.5, -3.1, 34.2, 'ok'],
          [T2, -2.5, -3.1, 34.2, 'ok'],
        ]),
      ],
      [
        linkSeriesWithChange('Ethernet1/1', 'up', 'up', 6, 100),
        linkSeriesWithChange('Ethernet1/2', 'down', 'down', 6, 100),
        linkSeriesWithChange('Ethernet1/3', 'down', 'down', 6, 100),
        linkSeriesWithChange('mgmt0', 'up', 'up', 6, 100),
      ],
      [],
      [
        slotSeries('Ethernet1/1', 1),
        slotSeries('Ethernet1/2', 0),
        slotSeries('Ethernet1/3', 0),
      ]
    )

    await render()

    expect(portNamed('Ethernet1/2')).toBeUndefined()
    expect(portNamed('Ethernet1/3')).toBeUndefined()
    expect(portsOf()).toHaveLength(1)
  })

  // Catalyst: the cages are a small uplink module (4) among many copper
  // ports (~54). Those empty-cage rows are the only place "you have spare
  // uplink capacity" is visible, so they must still be listed.
  it('still lists empty cages when the device also has non-cage ports', async () => {
    respond(
      [
        series('GigabitEthernet1/1/1', [
          [T1, -5.5, -5.6, 32.4, 'ok'],
          [T2, -5.5, -5.6, 32.4, 'ok'],
        ]),
      ],
      [
        linkSeriesWithChange('Gi1/1/1', 'up', 'up', 6, 100),
        linkSeriesWithChange('Gi1/0/1', 'up', 'up', 6, 100),
        linkSeriesWithChange('Gi1/0/2', 'up', 'up', 6, 100),
        linkSeriesWithChange('Gi1/0/3', 'up', 'up', 6, 100),
        linkSeriesWithChange('Gi1/0/4', 'up', 'up', 6, 100),
      ],
      [],
      [
        slotSeries('GigabitEthernet1/1/1', 1),
        slotSeries('GigabitEthernet1/1/2', 0),
      ]
    )

    await render()

    expect(portNamed('GigabitEthernet1/1/2')).toMatchObject({
      status: 'no_module',
    })
  })

  // Core_BB_01/02 (C9300-24S): 24 SFP+ cages among 43 physical ports - the
  // shape a cages-to-ports ratio gets wrong. 43 is not more than double 24,
  // so a ratio-based rule would wrongly treat this as "every port is a
  // cage" and drop its 19 non-cage ports' worth of spare capacity. The
  // difference (43 - 24 = 19) is what says this device has a copper section,
  // same as the smaller Catalysts above.
  it('lists empty cages on a 24-cage/43-port device a ratio rule would wrongly suppress', async () => {
    const cageNames = Array.from(
      {length: 24},
      (_, i) => `TenGigabitEthernet1/1/${i + 1}`
    )
    const nonCageNames = Array.from(
      {length: 19},
      (_, i) => `GigabitEthernet1/0/${i + 1}`
    )
    const cageLinks = cageNames.map(name =>
      linkSeriesWithChange(name, 'up', 'up', 6, 100)
    )
    const nonCageLinks = nonCageNames.map(name =>
      linkSeriesWithChange(name, 'up', 'up', 6, 100)
    )
    // Only the first cage is fitted; the other 23 are empty.
    const slots = cageNames.map((name, i) => slotSeries(name, i === 0 ? 1 : 0))

    respond(
      [
        series(cageNames[0], [
          [T1, -2.5, -3.1, 34.2, 'ok'],
          [T2, -2.5, -3.1, 34.2, 'ok'],
        ]),
      ],
      [...cageLinks, ...nonCageLinks],
      [],
      slots
    )

    await render()

    expect(portNamed(cageNames[1])).toMatchObject({status: 'no_module'})
    expect(portsOf().filter((p: any) => p.status === 'no_module')).toHaveLength(
      23
    )
  })

  // Change 2 must not affect Change 1: an undiagnosed-but-fitted cage is
  // listed on every device, Nexus included, even while its empty cages are
  // suppressed.
  it('still lists an undiagnosed module on a device whose empty cages are suppressed', async () => {
    respond(
      [
        series('Ethernet1/1', [
          [T1, -2.5, -3.1, 34.2, 'ok'],
          [T2, -2.5, -3.1, 34.2, 'ok'],
        ]),
      ],
      [
        linkSeriesWithChange('Ethernet1/1', 'up', 'up', 6, 100),
        linkSeriesWithChange('Ethernet1/10', 'up', 'up', 6, 100),
        linkSeriesWithChange('Ethernet1/2', 'down', 'down', 6, 100),
        linkSeriesWithChange('mgmt0', 'up', 'up', 6, 100),
      ],
      [],
      [
        slotSeries('Ethernet1/1', 1),
        // Fitted, no optics series - the NFVO-1 Ethernet1/10 case.
        slotSeries('Ethernet1/10', 1),
        // Unfitted, on a device whose cages are its whole port list.
        slotSeries('Ethernet1/2', 0),
      ]
    )

    await render()

    expect(portNamed('Ethernet1/10')).toMatchObject({
      status: 'no_diagnostics',
    })
    expect(portNamed('Ethernet1/2')).toBeUndefined()
  })
})
