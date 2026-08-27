import {describeAiContext} from 'src/ai_chat/utils/aiContextRegistry'
// Registration is an import side effect; this import is what arms the registry.
import 'src/ai_chat/utils/aiContextTypes'
import {AiContextCapsule} from 'src/types/aiChatContext'

const serverCapsule = (payload: Record<string, any>): AiContextCapsule => ({
  id: 'host:web-01',
  type: 'server',
  sourcePage: 'server-list',
  title: 'web-01',
  summary: 'CPU 94%, MEM 62%',
  payload,
  capturedAt: 0,
})

describe('server context sent to the agent', () => {
  it('sends only the host name, never a measurement that goes stale', () => {
    const described = describeAiContext(
      serverCapsule({
        name: 'web-01',
        ip: '10.20.2.11',
        status: 'danger',
        cpu: 94.2,
        memory: 61.5,
        disk: 71.1,
      })
    )

    expect(described).toBe('web-01')
    expect(described).not.toMatch(/94|61|71|danger/)
  })

  it('withholds the IP, which is known only for hosts that run a salt minion', () => {
    // Absent here would read as "this host has no address" rather than
    // "CloudHub has no record of one", so it is never sent either way.
    expect(
      describeAiContext(serverCapsule({name: 'web-01', ip: '10.20.2.11'}))
    ).toBe('web-01')
    expect(describeAiContext(serverCapsule({name: 'web-02'}))).toBe('web-02')
  })
})
