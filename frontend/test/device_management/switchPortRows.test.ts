import {
  SwitchDeviceMeta,
  SwitchPortSeries,
  buildSwitchPortRows,
  formatSinceChange,
} from 'src/device_management/utils/switchPortRows'
import {longDownDaysToTicks} from 'src/device_management/constants/portLinkStatus'

const T2 = 1788700000000
const DAY = 100 * 86400

// 6F_WG_L2_01 on 2026-09-15: 143.04 days up, raw ticks read over SNMP.
const UPTIME = 1235891422

const port = (
  ifName: string,
  admin: string,
  oper: string,
  ifLastChange: number | null,
  ifType: number | null = 6,
  devID = 'dev-6f'
): SwitchPortSeries => ({
  devID,
  ifName,
  alias: '',
  admin,
  oper,
  ifType,
  ifLastChange,
  checkedAt: T2,
})

const meta: Record<string, SwitchDeviceMeta> = {
  'dev-6f': {
    devID: 'dev-6f',
    sysName: '6F_WG_L2_01',
    agentHost: '10.10.250.61',
    model: 'C9200L-48P-4G',
    uptimeTicks: UPTIME,
  },
}

const sixF = [
  port('Gi0/0', 'down', 'down', 14798),
  port('Gi1/0/1', 'up', 'up', 26991),
  port('Gi1/0/6', 'up', 'down', 15038),
  port('Gi1/0/7', 'up', 'down', 15038),
  // ~52.9 days old against UPTIME: past the 7-day long_down threshold.
  port('Gi1/0/8', 'up', 'down', 778392045),
  // 3 days old: a genuine, still-active fault, to show long_down and down
  // are counted apart.
  port('Gi1/0/9', 'up', 'down', UPTIME - 3 * DAY),
  port('Gi1/1/1', 'up', 'up', 105984),
  port('Vl250', 'up', 'up', 30000, 53),
]

describe('device_management/switchPortRows', () => {
  it('counts a switch by link status, physical ports only', () => {
    const {rows} = buildSwitchPortRows(sixF, meta, {})

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'dev-6f',
      sysName: '6F_WG_L2_01',
      model: 'C9200L-48P-4G',
      ip: '10.10.250.61',
      up: 2,
      down: 1,
      longDown: 1,
      shutdown: 1,
      unused: 2,
      other: 0,
      severity: 'fail',
      checkedAt: new Date(T2).toISOString(),
    })
    expect(rows[0].ports.map(p => p.ifName)).not.toContain('Vl250')
  })

  it('lists faults first, then healthy ports, then the rest by name', () => {
    const {rows} = buildSwitchPortRows(sixF, meta, {})

    expect(rows[0].ports.map(p => `${p.ifName}:${p.status}`)).toEqual([
      'Gi1/0/9:down',
      'Gi1/0/1:up',
      'Gi1/1/1:up',
      'Gi0/0:shutdown',
      'Gi1/0/6:unused',
      'Gi1/0/7:unused',
      'Gi1/0/8:long_down',
    ])
  })

  it('counts a long-down port as longDown, not down', () => {
    const {rows} = buildSwitchPortRows(sixF, meta, {})

    const gi108 = rows[0].ports.find(p => p.ifName === 'Gi1/0/8')
    expect(gi108.status).toBe('long_down')
    expect(rows[0].down).toBe(1)
    expect(rows[0].longDown).toBe(1)
  })

  it('lets a configured threshold change the verdict', () => {
    // Gi1/0/8 is ~52.9 days old: long_down at the shipped 7-day default,
    // but plain down against a 60-day threshold.
    const {rows} = buildSwitchPortRows(sixF, meta, {}, longDownDaysToTicks(60))

    const gi108 = rows[0].ports.find(p => p.ifName === 'Gi1/0/8')
    expect(gi108.status).toBe('down')
    expect(rows[0].longDown).toBe(0)
    expect(rows[0].down).toBe(2)
  })

  it('turns long_down off entirely when the threshold is 0', () => {
    const {rows} = buildSwitchPortRows(sixF, meta, {}, 0)

    const gi108 = rows[0].ports.find(p => p.ifName === 'Gi1/0/8')
    expect(gi108.status).toBe('down')
    expect(rows[0].longDown).toBe(0)
  })

  it('reads how long ago each link changed from the device uptime', () => {
    const {rows} = buildSwitchPortRows(sixF, meta, {})
    const gi108 = rows[0].ports.find(p => p.ifName === 'Gi1/0/8')

    expect(gi108.sinceChangeTicks).toBe(UPTIME - 778392045)
  })

  it('leaves the age unknown without an uptime', () => {
    const {rows} = buildSwitchPortRows(
      sixF,
      {'dev-6f': {...meta['dev-6f'], uptimeTicks: null}},
      {}
    )

    expect(rows[0].ports[0].sinceChangeTicks).toBeNull()
  })

  it('reads a switch with no fault as ok', () => {
    const {rows} = buildSwitchPortRows(
      // Gi1/0/8 is long_down (severity none), so only Gi1/0/9 needs removing.
      sixF.filter(p => p.ifName !== 'Gi1/0/9'),
      meta,
      {}
    )

    expect(rows[0].severity).toBe('ok')
  })

  it('prefers the registered device for address and location, but keeps the SNMP sysName', () => {
    const {rows} = buildSwitchPortRows(sixF, meta, {
      'dev-6f': {
        id: 'dev-6f',
        device_ip: '10.10.250.99',
        hostname: 'registered',
        location: 'HQ 6F',
      } as any,
    })

    expect(rows[0]).toMatchObject({
      sysName: '6F_WG_L2_01',
      ip: '10.10.250.99',
      location: 'HQ 6F',
    })
  })

  it('counts a switch whose collector has not sent ifType yet, and skips it', () => {
    const {rows, devicesWithoutIfType} = buildSwitchPortRows(
      [port('Gi1/0/1', 'up', 'up', 26991, null, 'dev-old')],
      {},
      {}
    )

    expect(rows).toHaveLength(0)
    expect(devicesWithoutIfType).toBe(1)
  })

  it('treats the -1 a collector writes for a missing type as missing', () => {
    const {rows, devicesWithoutIfType} = buildSwitchPortRows(
      [port('Gi1/0/1', 'up', 'up', 26991, -1, 'dev-old')],
      {},
      {}
    )

    expect(rows).toHaveLength(0)
    expect(devicesWithoutIfType).toBe(1)
  })

  it('treats the 0 an unresolved template field coerces to as missing', () => {
    const {rows, devicesWithoutIfType} = buildSwitchPortRows(
      [port('Gi1/0/1', 'up', 'up', 26991, 0, 'dev-old')],
      {},
      {}
    )

    expect(rows).toHaveLength(0)
    expect(devicesWithoutIfType).toBe(1)
  })

  it('keeps each device baseline separate when two devices share one call', () => {
    const {rows} = buildSwitchPortRows(
      [
        port('Gi1/0/1', 'up', 'up', 500, 6, 'dev-a'),
        port('Gi1/0/1', 'up', 'up', 5000000, 6, 'dev-b'),
        port('Gi1/0/2', 'up', 'down', 5003000, 6, 'dev-b'),
      ],
      {
        'dev-a': {
          devID: 'dev-a',
          sysName: 'dev-a',
          agentHost: '10.0.0.1',
          model: 'x',
          uptimeTicks: null,
        },
        'dev-b': {
          devID: 'dev-b',
          sysName: 'dev-b',
          agentHost: '10.0.0.2',
          model: 'x',
          uptimeTicks: null,
        },
      },
      {}
    )

    const devA = rows.find(r => r.id === 'dev-a')
    const devB = rows.find(r => r.id === 'dev-b')

    // dev-b's own baseline (5,000,000) puts Gi1/0/2's change within the
    // unused margin. A baseline shared across devices would fall to
    // dev-a's much smaller value (500) and read this port as 'down'.
    expect(devB.ports.find(p => p.ifName === 'Gi1/0/2').status).toBe('unused')
    expect(devA.ports.find(p => p.ifName === 'Gi1/0/1').status).toBe('up')
    expect(devA).toMatchObject({up: 1, down: 0, unused: 0})
    expect(devB).toMatchObject({up: 1, down: 0, unused: 1})
  })

  describe('formatSinceChange', () => {
    it('reads days, hours and minutes', () => {
      expect(formatSinceChange(53 * DAY)).toBe('53.0d ago')
      expect(formatSinceChange(3 * 3600 * 100)).toBe('3.0h ago')
      expect(formatSinceChange(5 * 60 * 100)).toBe('5m ago')
    })

    it('has nothing to say without a value', () => {
      expect(formatSinceChange(null)).toBe('-')
    })
  })
})
