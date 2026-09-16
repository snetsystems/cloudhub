import {
  DEFAULT_OPTICS_THRESHOLD,
  judgeOpticsPort,
  opticsSeverity,
  opticalPowerRange,
  temperatureRange,
  worstOpticsSeverity,
  OPTICS_STATUS_LABEL,
} from 'src/device_management/constants/opticsThreshold'
import {longDownDaysToTicks} from 'src/device_management/constants/portLinkStatus'

const ok = {
  sensorStatus: 'ok',
  adminStatus: 'up',
  operStatus: 'up',
  isReporting: true,
  tx: -2.5,
  rx: -3.1,
  temp: 35,
}

const judge = (overrides: Partial<typeof ok>) =>
  judgeOpticsPort({...ok, ...overrides}, DEFAULT_OPTICS_THRESHOLD)

describe('device_management/opticsThreshold', () => {
  describe('judgeOpticsPort', () => {
    it('passes a port inside every threshold', () => {
      expect(judge({})).toBe('ok')
    })

    it('flags optical power below the low threshold', () => {
      expect(judge({rx: -18})).toBe('low')
      expect(judge({tx: -20})).toBe('low')
    })

    it('flags temperature above the high threshold', () => {
      expect(judge({temp: 80})).toBe('hot')
    })

    it('reports a port that stopped reporting as unpopulated', () => {
      expect(judge({isReporting: false})).toBe('no_module')
    })

    it('reports a device-declared empty cage as unpopulated', () => {
      expect(judge({sensorStatus: 'no_module'})).toBe('no_module')
      expect(judge({operStatus: 'notPresent'})).toBe('no_module')
    })

    it('lets an operator shutdown explain the port before anything else', () => {
      expect(judge({adminStatus: 'down', isReporting: false, rx: -30})).toBe(
        'shutdown'
      )
    })

    it('trusts the sensor over the thresholds', () => {
      expect(judge({sensorStatus: 'error', rx: -30})).toBe('error')
    })

    it('judges a reading whose status never arrived on its numbers', () => {
      expect(judge({sensorStatus: ''})).toBe('ok')
      expect(judge({sensorStatus: '', rx: -30})).toBe('low')
    })

    it('separates an upstream outage from a fault on this port', () => {
      expect(judge({operStatus: 'lowerLayerDown'})).toBe('upstream')
    })

    it('separates a link that never came up from one below it', () => {
      expect(judge({operStatus: 'lowerLayerDown'})).toBe('upstream')
      // Admin up, oper down: the module reads fine, the link does not.
      expect(judge({operStatus: 'down'})).toBe('down')
      // A shut port explains itself, whatever oper says.
      expect(judge({adminStatus: 'down', operStatus: 'down'})).toBe('shutdown')
    })

    it('ignores a metric the device did not report', () => {
      expect(judge({rx: null, tx: null, temp: null})).toBe('ok')
    })

    // ifLastChange at the device's interface-init tick: the SFP is fitted but
    // nothing was ever patched in. Not a fault.
    it('calls a fitted port whose link never came up unused', () => {
      expect(
        judgeOpticsPort(
          {...ok, operStatus: 'down', ifLastChange: 15038},
          DEFAULT_OPTICS_THRESHOLD,
          14798
        )
      ).toBe('unused')
    })

    it('keeps a port that went down after boot down', () => {
      expect(
        judgeOpticsPort(
          {...ok, operStatus: 'down', ifLastChange: 778392045},
          DEFAULT_OPTICS_THRESHOLD,
          14798
        )
      ).toBe('down')
    })

    it('keeps a down port down without a baseline', () => {
      expect(
        judgeOpticsPort(
          {...ok, operStatus: 'down', ifLastChange: 15038},
          DEFAULT_OPTICS_THRESHOLD
        )
      ).toBe('down')
    })

    it('still trusts a failed sensor on an unused port', () => {
      expect(
        judgeOpticsPort(
          {...ok, sensorStatus: 'error', operStatus: 'down', ifLastChange: 15038},
          DEFAULT_OPTICS_THRESHOLD,
          14798
        )
      ).toBe('error')
    })

    // 2F_WG_L2_01: uptime 1236911816, initTicks 14560. Gi1/0/8 sits ~32.1
    // days down, well past the 7-day long_down threshold.
    it('calls an old down port long_down', () => {
      expect(
        judgeOpticsPort(
          {...ok, operStatus: 'down', ifLastChange: 683416322},
          DEFAULT_OPTICS_THRESHOLD,
          14560,
          1236911816
        )
      ).toBe('long_down')
    })

    it('calls a port at the init tick unused, not long_down, even with an old uptime', () => {
      expect(
        judgeOpticsPort(
          {...ok, operStatus: 'down', ifLastChange: 14700},
          DEFAULT_OPTICS_THRESHOLD,
          14560,
          1236911816
        )
      ).toBe('unused')
    })

    // Same 2F_WG_L2_01 fixture as above: ~64.06 days down against the 143-day
    // uptime. The org's configured threshold, not just the 7-day default,
    // must decide the verdict — this fails if the 5th argument were ignored.
    describe('with a configured switch port threshold', () => {
      it('changes the verdict when the operator moves the threshold', () => {
        expect(
          judgeOpticsPort(
            {...ok, operStatus: 'down', ifLastChange: 683416322},
            DEFAULT_OPTICS_THRESHOLD,
            14560,
            1236911816,
            longDownDaysToTicks(7)
          )
        ).toBe('long_down')
        expect(
          judgeOpticsPort(
            {...ok, operStatus: 'down', ifLastChange: 683416322},
            DEFAULT_OPTICS_THRESHOLD,
            14560,
            1236911816,
            longDownDaysToTicks(70)
          )
        ).toBe('down')
      })

      it('disables the verdict entirely at 0', () => {
        expect(
          judgeOpticsPort(
            {...ok, operStatus: 'down', ifLastChange: 683416322},
            DEFAULT_OPTICS_THRESHOLD,
            14560,
            1236911816,
            0
          )
        ).toBe('down')
      })
    })
  })

  describe('severity', () => {
    it('treats a shut or unpopulated port as nothing to act on', () => {
      expect(opticsSeverity('shutdown')).toBe('none')
      expect(opticsSeverity('no_module')).toBe('none')
    })

    it('warns about a port that is degrading but still passing traffic', () => {
      expect(opticsSeverity('low')).toBe('warn')
      expect(opticsSeverity('hot')).toBe('warn')
    })

    it('fails a port that is passing nothing', () => {
      expect(opticsSeverity('error')).toBe('fail')
      expect(opticsSeverity('upstream')).toBe('fail')
      expect(opticsSeverity('down')).toBe('fail')
    })

    it('reads a device as its worst port', () => {
      expect(worstOpticsSeverity(['ok', 'low', 'ok'])).toBe('warn')
      expect(worstOpticsSeverity(['ok', 'low', 'down'])).toBe('fail')
      expect(worstOpticsSeverity(['ok', 'ok'])).toBe('ok')
    })

    it('lets a port nobody acts on leave the verdict alone', () => {
      expect(worstOpticsSeverity(['ok', 'no_module', 'shutdown'])).toBe('ok')
      expect(worstOpticsSeverity([])).toBe('none')
    })

    it('treats an unused port as nothing to act on', () => {
      expect(opticsSeverity('unused')).toBe('none')
      expect(worstOpticsSeverity(['ok', 'unused'])).toBe('ok')
    })

    it('treats a long-down port as nothing to act on now', () => {
      expect(opticsSeverity('long_down')).toBe('none')
      expect(worstOpticsSeverity(['ok', 'long_down'])).toBe('ok')
    })

    // A DAC/twinax cable or a module without digital diagnostics: fitted and
    // passing traffic, just with nothing optical to read. It must never turn
    // a working link into an alarm.
    it('treats a fitted module with no optical readings as nothing to act on', () => {
      expect(opticsSeverity('no_diagnostics')).toBe('none')
      expect(worstOpticsSeverity(['ok', 'no_diagnostics'])).toBe('ok')
    })
  })

  describe('labels', () => {
    it('labels a fitted module with no optical readings', () => {
      expect(OPTICS_STATUS_LABEL.no_diagnostics).toBe('NO DIAGNOSTICS')
    })
  })

  describe('gauge scales', () => {
    it('leaves the threshold inside the scale so it can be read', () => {
      const range = opticalPowerRange(-17)
      expect(range.min).toBeLessThan(-17)
      expect(range.max).toBe(0)

      const temp = temperatureRange(75)
      expect(temp.max).toBeGreaterThan(75)
      expect(temp.min).toBe(0)
    })
  })
})
