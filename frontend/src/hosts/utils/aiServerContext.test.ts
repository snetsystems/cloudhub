import {
  buildServerContextPayload,
  buildServerContextSummary,
} from 'src/hosts/utils/aiServerContext'
import {Host} from 'src/shared/apis/host'

const hosts = ([
  {minionId: 'web-01', privateIps: ['10.20.2.11']},
] as unknown) as Host[]

const alertStatusMap = {'web-01': {currentLevel: 'danger'}} as any

describe('server list row to AI context', () => {
  it('reads a gauge row and pairs it with the host record and alert level', () => {
    const payload = buildServerContextPayload(
      'web-01',
      {'CPU Usage': 94.2, 'Mem Usage': 61.5, 'Disk Usage': 40},
      hosts,
      alertStatusMap
    )

    expect(payload).toMatchObject({
      name: 'web-01',
      ip: '10.20.2.11',
      status: 'danger',
      cpu: 94.2,
      memory: 61.5,
      disk: 40,
    })
  })

  it('reports the latest point when the row holds a line series', () => {
    const payload = buildServerContextPayload('web-01', {
      'CPU Usage': [
        {time: 1, value: 10},
        {time: 2, value: 77},
      ],
    })

    expect(payload.cpu).toBe(77)
  })

  it('omits a measurement it cannot read rather than reporting a wrong one', () => {
    const payload = buildServerContextPayload('web-01', {
      'CPU Usage': null,
      'Mem Usage': 'n/a',
      'Disk Usage': [],
    })

    expect(payload.cpu).toBeUndefined()
    expect(payload.memory).toBeUndefined()
    expect(payload.disk).toBeUndefined()
  })

  it('summarizes only the measurements that are present', () => {
    expect(
      buildServerContextSummary({'CPU Usage': 94.2, 'Mem Usage': 61.5})
    ).toBe('CPU 94%, MEM 62%')

    expect(buildServerContextSummary({'CPU Usage': 94.2})).toBe('CPU 94%')
    expect(buildServerContextSummary({})).toBe('')
  })
})
