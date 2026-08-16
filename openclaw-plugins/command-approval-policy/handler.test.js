import assert from 'node:assert/strict'
import test from 'node:test'

import {createBeforeToolCallHandler} from './handler.js'

const repairEvent = {
  toolName: 'k8s_network__repair_network_policy_port',
  toolCallId: 'tool-call-1',
  params: {
    namespace: 'network-repair-demo',
    sourceWorkload: 'frontend',
    destinationService: 'backend',
    policyName: 'allow-frontend-to-backend',
    expectedCurrentPort: 8081,
    desiredPort: 8080,
    idempotencyKey: 'model-provided-key',
  },
}

const applyContext = {
  agentId: 'main',
  sessionKey:
    'agent:main:cloudhub:org-a:42:11111111-1111-4111-8111-111111111111',
}

test('allows NetworkPolicy repair only after CloudHub allow-once', async () => {
  let received
  const api = testAPI()
  api.pluginConfig.cloudHubApprovalInsecureSkipVerify = true
  const handler = createBeforeToolCallHandler(api, {
    awaitApproval: async options => {
      received = options
      return 'allow-once'
    },
    token: 'service-test-secret',
  })

  const result = await handler(repairEvent, applyContext)

  assert.equal(result, undefined)
  assert.equal(received.baseURL, 'http://cloudhub.example')
  assert.equal(received.token, 'service-test-secret')
  assert.equal(received.sessionKey, applyContext.sessionKey)
  assert.equal(received.toolName, repairEvent.toolName)
  assert.equal(received.toolCallId, 'tool-call-1')
  assert.equal(received.idempotencyKey, '')
  assert.equal(received.approval.title, 'NetworkPolicy 복구 승인')
  assert.equal(received.insecureSkipVerify, true)
})

test('enables TLS skip only for a literal true configuration', async () => {
  const received = []
  for (const configured of [undefined, false, 'true', 1, true]) {
    const api = testAPI()
    api.pluginConfig.cloudHubApprovalInsecureSkipVerify = configured
    const handler = createBeforeToolCallHandler(api, {
      awaitApproval: async options => {
        received.push(options.insecureSkipVerify)
        return 'allow-once'
      },
      token: 'service-test-secret',
    })
    await handler(repairEvent, applyContext)
  }

  assert.deepEqual(received, [false, false, false, false, true])
})

test('fails NetworkPolicy closed for deny expiry and errors', async t => {
  for (const outcome of ['deny', 'expired', new Error('secret failure')]) {
    await t.test(outcome instanceof Error ? 'error' : outcome, async () => {
      const handler = createBeforeToolCallHandler(testAPI(), {
        awaitApproval: async () => {
          if (outcome instanceof Error) {
            throw outcome
          }
          return outcome
        },
        token: 'service-test-secret',
      })

      const result = await handler(repairEvent, applyContext)

      assert.equal(result?.block, true)
      assert.match(result.blockReason, /CloudHub 승인이 완료되지 않아/)
      assert.doesNotMatch(result.blockReason, /secret failure/)
      assert.equal(result.requireApproval, undefined)
    })
  }
})

test('missing CloudHub configuration blocks only NetworkPolicy repair', async () => {
  const api = testAPI()
  api.pluginConfig = {}
  const handler = createBeforeToolCallHandler(api, {token: ''})

  const networkResult = await handler(repairEvent, applyContext)
  const readResult = await handler(
    {toolName: 'k8s_network__inspect_network_policy_path', params: {}},
    applyContext
  )

  assert.equal(networkResult?.block, true)
  assert.equal(networkResult.requireApproval, undefined)
  assert.equal(readResult, undefined)
})

test('preserves native shell approval and blocking behavior', async () => {
  let managedCalls = 0
  const handler = createBeforeToolCallHandler(testAPI(), {
    awaitApproval: async () => {
      managedCalls += 1
      return 'allow-once'
    },
    token: 'service-test-secret',
  })

  const approval = await handler(
    {toolName: 'shell', params: {command: 'rm old-file'}},
    applyContext
  )
  const blocked = await handler(
    {toolName: 'bash', params: {command: 'rm -rf /'}},
    applyContext
  )

  assert.ok(approval?.requireApproval)
  assert.equal(approval.requireApproval.title, '명령 실행 승인')
  assert.equal(typeof approval.requireApproval.onResolution, 'function')
  assert.equal(blocked?.block, true)
  assert.equal(managedCalls, 0)
})

function testAPI() {
  return {
    pluginConfig: {cloudHubApprovalURL: 'http://cloudhub.example'},
    logger: {info() {}, warn() {}},
  }
}
