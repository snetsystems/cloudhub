import {
  ETHERNET_CSMACD,
  LONG_DOWN_TICKS,
  PORT_LINK_LABEL,
  UNUSED_MARGIN_TICKS,
  interfaceInitTicks,
  judgePortLink,
  longDownDaysToTicks,
  portLinkRank,
  portLinkSeverity,
} from 'src/device_management/constants/portLinkStatus'

// Raw values read from 6F_WG_L2_01 (C9200L-48P-4G) on 2026-09-15, 143 days
// after boot. Unused ports sit at the interface-init tick, not at zero.
const SIX_F = {
  mgmt: {ifAdminStatus: 'down', ifOperStatus: 'down', ifType: 6, ifLastChange: 14798},
  unused: {ifAdminStatus: 'up', ifOperStatus: 'down', ifType: 6, ifLastChange: 15038},
  unusedLast: {ifAdminStatus: 'up', ifOperStatus: 'down', ifType: 6, ifLastChange: 15055},
  ap: {ifAdminStatus: 'up', ifOperStatus: 'up', ifType: 6, ifLastChange: 26960},
  uplink: {ifAdminStatus: 'up', ifOperStatus: 'up', ifType: 6, ifLastChange: 105984},
  wentDown: {ifAdminStatus: 'up', ifOperStatus: 'down', ifType: 6, ifLastChange: 778392045},
  vlan: {ifAdminStatus: 'up', ifOperStatus: 'up', ifType: 53, ifLastChange: 100},
}

// sys_uptime read from 2F_WG_L2_01 on the same day: 1236911816 ticks
// (143.2 days). Gi1/0/8 on 6F_WG_L2_01 sits at the same ~32.1-day-old
// ifLastChange used in the real fault list.
const UPTIME_143D = 1236911816

describe('device_management/portLinkStatus', () => {
  describe('interfaceInitTicks', () => {
    it('takes the earliest change among ethernet ports', () => {
      expect(interfaceInitTicks(Object.values(SIX_F))).toBe(14798)
    })

    it('ignores ports that are not ethernetCsmacd', () => {
      expect(
        interfaceInitTicks([SIX_F.vlan, SIX_F.unused])
      ).toBe(15038)
    })

    it('ignores the -1 the collector writes for a missing value', () => {
      expect(
        interfaceInitTicks([{...SIX_F.unused, ifLastChange: -1}, SIX_F.ap])
      ).toBe(26960)
    })

    it('has no baseline when no ethernet port carries a value', () => {
      expect(interfaceInitTicks([SIX_F.vlan])).toBeNull()
      expect(interfaceInitTicks([{ifOperStatus: 'down'}])).toBeNull()
      expect(interfaceInitTicks([])).toBeNull()
    })
  })

  describe('judgePortLink', () => {
    const init = interfaceInitTicks(Object.values(SIX_F))

    it('lets an operator shutdown explain the port first', () => {
      expect(judgePortLink(SIX_F.mgmt, init)).toBe('shutdown')
    })

    it('reports missing hardware as not present', () => {
      expect(
        judgePortLink({ifAdminStatus: 'up', ifOperStatus: 'notPresent'}, init)
      ).toBe('not_present')
    })

    it('reads an up link as up', () => {
      expect(judgePortLink(SIX_F.ap, init)).toBe('up')
      expect(judgePortLink(SIX_F.uplink, init)).toBe('up')
    })

    it('separates an upstream outage', () => {
      expect(
        judgePortLink({ifAdminStatus: 'up', ifOperStatus: 'lowerLayerDown'}, init)
      ).toBe('upstream')
    })

    it('calls a port that never changed since interface init unused', () => {
      expect(judgePortLink(SIX_F.unused, init)).toBe('unused')
      expect(judgePortLink(SIX_F.unusedLast, init)).toBe('unused')
    })

    it('calls a port that went down after boot down', () => {
      expect(judgePortLink(SIX_F.wentDown, init)).toBe('down')
    })

    it('stops calling it unused once the margin is passed', () => {
      const edge = init + UNUSED_MARGIN_TICKS
      expect(judgePortLink({...SIX_F.unused, ifLastChange: edge}, init)).toBe('unused')
      expect(judgePortLink({...SIX_F.unused, ifLastChange: edge + 1}, init)).toBe('down')
    })

    it('keeps a port down when the value or the baseline is unknown', () => {
      expect(judgePortLink({...SIX_F.unused, ifLastChange: undefined}, init)).toBe('down')
      expect(judgePortLink({...SIX_F.unused, ifLastChange: null}, init)).toBe('down')
      expect(judgePortLink({...SIX_F.unused, ifLastChange: -1}, init)).toBe('down')
      expect(judgePortLink(SIX_F.unused, null)).toBe('down')
    })

    it('has nothing to say about other oper states', () => {
      expect(judgePortLink({ifAdminStatus: 'up', ifOperStatus: 'dormant'}, init)).toBe('unknown')
      expect(judgePortLink({ifAdminStatus: 'up', ifOperStatus: 'testing'}, init)).toBe('unknown')
      expect(judgePortLink({}, init)).toBe('unknown')
    })

    it('calls a down port older than 7 days long_down', () => {
      // 2F_WG_L2_01's real fault list: ~53 days old against a 143-day uptime.
      expect(judgePortLink(SIX_F.wentDown, init, UPTIME_143D)).toBe('long_down')
    })

    it('keeps a down port younger than 7 days plain down', () => {
      const recent = UPTIME_143D - 3 * 24 * 3600 * 100 // 3 days old
      expect(
        judgePortLink(
          {...SIX_F.wentDown, ifLastChange: recent},
          init,
          UPTIME_143D
        )
      ).toBe('down')
    })

    it('draws the long_down line at exactly 7 days', () => {
      const atBoundary = UPTIME_143D - LONG_DOWN_TICKS
      const pastBoundary = atBoundary - 1
      expect(
        judgePortLink(
          {...SIX_F.wentDown, ifLastChange: atBoundary},
          init,
          UPTIME_143D
        )
      ).toBe('down')
      expect(
        judgePortLink(
          {...SIX_F.wentDown, ifLastChange: pastBoundary},
          init,
          UPTIME_143D
        )
      ).toBe('long_down')
    })

    it('calls a port at the init tick unused even on a long-running device, not long_down', () => {
      // Ordering regression guard: if age were tested before unused, this
      // 143-day-old unused port would misjudge as long_down instead.
      expect(judgePortLink(SIX_F.unused, init, UPTIME_143D)).toBe('unused')
      expect(judgePortLink(SIX_F.unusedLast, init, UPTIME_143D)).toBe('unused')
    })

    it('never calls it long_down when uptime or the change time is unknown', () => {
      expect(judgePortLink(SIX_F.wentDown, init, null)).toBe('down')
      expect(
        judgePortLink(
          {...SIX_F.wentDown, ifLastChange: undefined},
          init,
          UPTIME_143D
        )
      ).toBe('down')
      expect(
        judgePortLink({...SIX_F.wentDown, ifLastChange: -1}, init, UPTIME_143D)
      ).toBe('down')
    })

    describe('with a configured threshold', () => {
      // 40 days old against the 143-day uptime.
      const fortyDaysOld = UPTIME_143D - 40 * 24 * 3600 * 100

      it('changes the verdict when the operator moves the threshold', () => {
        expect(
          judgePortLink(
            {...SIX_F.wentDown, ifLastChange: fortyDaysOld},
            init,
            UPTIME_143D,
            LONG_DOWN_TICKS // 7 days
          )
        ).toBe('long_down')
        expect(
          judgePortLink(
            {...SIX_F.wentDown, ifLastChange: fortyDaysOld},
            init,
            UPTIME_143D,
            longDownDaysToTicks(60)
          )
        ).toBe('down')
      })

      it('disables the verdict entirely at 0', () => {
        expect(judgePortLink(SIX_F.wentDown, init, UPTIME_143D, 0)).toBe('down')
      })

      it('disables the verdict for a negative threshold too', () => {
        expect(judgePortLink(SIX_F.wentDown, init, UPTIME_143D, -1)).toBe(
          'down'
        )
      })
    })
  })

  describe('longDownDaysToTicks', () => {
    it('converts days to ticks, matching the shipped default', () => {
      expect(longDownDaysToTicks(7)).toBe(LONG_DOWN_TICKS)
    })

    it('turns 0 days into 0 ticks', () => {
      expect(longDownDaysToTicks(0)).toBe(0)
    })
  })

  describe('labels, severity and rank', () => {
    it('labels every status', () => {
      expect(PORT_LINK_LABEL).toEqual({
        up: 'UP',
        down: 'DOWN',
        long_down: 'LONG DOWN',
        shutdown: 'SHUTDOWN',
        unused: 'UNUSED',
        upstream: 'UPSTREAM',
        not_present: 'NOT PRESENT',
        unknown: 'UNKNOWN',
      })
    })

    it('fails only the links that should carry traffic and do not', () => {
      expect(portLinkSeverity('up')).toBe('ok')
      expect(portLinkSeverity('down')).toBe('fail')
      expect(portLinkSeverity('upstream')).toBe('fail')
      expect(portLinkSeverity('long_down')).toBe('none')
      expect(portLinkSeverity('shutdown')).toBe('none')
      expect(portLinkSeverity('unused')).toBe('none')
      expect(portLinkSeverity('not_present')).toBe('none')
      expect(portLinkSeverity('unknown')).toBe('none')
    })

    it('ranks faults above healthy ports above the rest', () => {
      expect(portLinkRank('down')).toBeLessThan(portLinkRank('up'))
      expect(portLinkRank('upstream')).toBeLessThan(portLinkRank('up'))
      expect(portLinkRank('up')).toBeLessThan(portLinkRank('unused'))
      expect(portLinkRank('shutdown')).toBe(portLinkRank('unused'))
    })

    it('uses the IANA number for ethernet', () => {
      expect(ETHERNET_CSMACD).toBe(6)
    })
  })
})
