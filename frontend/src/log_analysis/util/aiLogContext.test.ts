import {
  buildLogAnalysisPrompt,
  buildLogContextPayload,
} from 'src/log_analysis/util/aiLogContext'
import {SyslogTableRows} from 'src/types/logAnalysis'

const row = (fields: Record<string, any>): SyslogTableRows =>
  ({id: 'row-1', ...fields} as SyslogTableRows)

describe('one syslog row handed to AI Chat', () => {
  it('reads the fields OpenSearch returns as arrays, with the labels the table resolved', () => {
    const payload = buildLogContextPayload(
      row({
        '@timestamp': ['2026-08-27T04:10:22.000Z'],
        'log.syslog.severity.code': [3],
        'log.syslog.facility.code': [3],
        'service.type': ['system'],
        deviceType: ['baremetal'],
        'host.hostname': ['web-01'],
        'host.ip': ['10.20.2.11'],
        'process.name': ['sshd'],
        'process.pid': [1234],
        message: ['Failed password for root'],
      }),
      {severity: 'err', facility: 'daemon'}
    )

    expect(payload).toEqual({
      timestamp: '2026-08-27T04:10:22.000Z',
      severity: 'err',
      severityCode: 3,
      facility: 'daemon',
      facilityCode: 3,
      serviceType: 'system',
      deviceType: 'baremetal',
      hostname: 'web-01',
      hostIp: '10.20.2.11',
      processName: 'sshd',
      processPid: 1234,
      message: 'Failed password for root',
    })
  })

  it('sends the message once, not again as tokens or as the raw event', () => {
    const payload = buildLogContextPayload(
      row({
        message: ['link down on eth0'],
        message_tokens: ['link', 'down', 'eth0'],
        'event.original': ['<27>1 2026-08-27 web-01 link down on eth0'],
      })
    )

    expect(payload.message).toBe('link down on eth0')
    expect(JSON.stringify(payload)).not.toContain('<27>')
  })

  it('falls back to the raw event when the message was not parsed out', () => {
    const payload = buildLogContextPayload(
      row({'event.original': ['<27>1 2026-08-27 web-01 link down']})
    )

    expect(payload.message).toBe('<27>1 2026-08-27 web-01 link down')
  })

  it('drops the host IP when the source logged it as the host name', () => {
    const payload = buildLogContextPayload(
      row({'host.hostname': ['10.20.2.11'], 'host.ip': ['10.20.2.11']})
    )

    expect(payload.hostname).toBe('10.20.2.11')
    expect(payload.hostIp).toBeUndefined()
  })

  it('leaves absent fields undefined rather than blank', () => {
    const payload = buildLogContextPayload(row({message: ['']}))

    expect(payload.message).toBeUndefined()
    expect(payload.severity).toBeUndefined()
    expect(payload.processPid).toBeUndefined()
  })
})

describe('the analysis report the chat asks for', () => {
  const payload = {
    timestamp: '2026-08-27T04:10:22.000Z',
    severity: 'err',
    severityCode: 3,
    facility: 'daemon',
    facilityCode: 3,
    serviceType: 'system',
    deviceType: 'baremetal',
    hostname: 'web-01',
    hostIp: '10.20.2.11',
    processName: 'sshd',
    processPid: 1234,
    message: 'Failed password for root from 10.0.0.9',
  }

  it('fills the report header with the row', () => {
    const lines = buildLogAnalysisPrompt(payload).split('\n')

    expect(lines[1]).toBe('■ 1. 로그 헤더 정보')
    expect(lines[2]).toBe('- 발생 시각: 2026-08-27T04:10:22.000Z')
    expect(lines[3]).toBe('- 대상 서버: web-01 (10.20.2.11, baremetal)')
    expect(lines[4]).toBe(
      '- 프로세스/서비스: sshd (PID 1234) / system / facility daemon'
    )
    expect(lines[5]).toBe('- 심각도(Severity): err (3)')
  })

  it('puts the message under its own heading, unaltered', () => {
    expect(buildLogAnalysisPrompt(payload)).toContain(
      '■ 2. 로그 원문 (Log Message)\nFailed password for root from 10.0.0.9'
    )
  })

  it('asks for the four report sections every time', () => {
    const sent = buildLogAnalysisPrompt({})

    expect(sent).toContain('1. [이벤트 요약]')
    expect(sent).toContain('2. [위험도 평가]')
    expect(sent).toContain('3. [예상 원인]')
    expect(sent).toContain('4. [운영자 조치 가이드]')
  })

  it('names a field the row never carried rather than leaving it blank', () => {
    const lines = buildLogAnalysisPrompt({message: 'link down'}).split('\n')

    expect(lines[2]).toBe('- 발생 시각: 미상')
    expect(lines[3]).toBe('- 대상 서버: 미상')
    expect(lines[4]).toBe('- 프로세스/서비스: 미상')
    expect(lines[5]).toBe('- 심각도(Severity): 미상')
  })

  it('does not bracket the address of a row named by its address', () => {
    const lines = buildLogAnalysisPrompt({hostIp: '10.20.2.11'}).split('\n')

    expect(lines[3]).toBe('- 대상 서버: 10.20.2.11')
  })
})
