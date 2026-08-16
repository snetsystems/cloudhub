import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import https from 'node:https'
import test from 'node:test'

import {awaitCloudHubApproval} from './cloudhub-approval.js'

const baseOptions = {
  baseURL: 'http://cloudhub.example/',
  token: 'service-test-secret',
  sessionKey:
    'agent:main:cloudhub:org-a:42:11111111-1111-4111-8111-111111111111',
  toolName: 'k8s_network__repair_network_policy_port',
  toolCallId: 'tool-call-1',
  idempotencyKey: '',
  approval: {
    title: 'NetworkPolicy 복구 승인',
    description: 'network-repair-demo/policy TCP 8081 → 8080',
    severity: 'warning',
    allowedDecisions: ['allow-once', 'deny'],
    timeoutMs: 120000,
  },
}

test('creates and polls until allow-once', async () => {
  const calls = []
  const responses = [
    jsonResponse(201, approvalStatus('pending')),
    jsonResponse(200, approvalStatus('pending')),
    jsonResponse(200, approvalStatus('allowed')),
  ]
  const sleeps = []

  const result = await awaitCloudHubApproval({
    ...baseOptions,
    fetchImpl: async (url, options = {}) => {
      calls.push({url, options})
      return responses.shift()
    },
    sleep: async milliseconds => sleeps.push(milliseconds),
    now: () => 0,
  })

  assert.equal(result, 'allow-once')
  assert.equal(calls.length, 3)
  assert.equal(
    calls[0].url,
    'http://cloudhub.example/api/v1/openclaw/managed-approvals'
  )
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(
    calls[0].options.headers.Authorization,
    'Bearer service-test-secret'
  )
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    sessionKey: baseOptions.sessionKey,
    toolName: baseOptions.toolName,
    toolCallId: 'tool-call-1',
    idempotencyKey: '',
    title: 'NetworkPolicy 복구 승인',
    description: 'network-repair-demo/policy TCP 8081 → 8080',
    severity: 'warning',
    timeoutMs: 120000,
  })
  assert.equal(
    calls[1].url,
    'http://cloudhub.example/api/v1/openclaw/managed-approvals/cloudhub%3Aapproval-1'
  )
  assert.deepEqual(sleeps, [250, 250])
})

test('returns deny and expired terminal states', async t => {
  for (const [state, expected] of [
    ['denied', 'deny'],
    ['expired', 'expired'],
  ]) {
    await t.test(state, async () => {
      const responses = [
        jsonResponse(201, approvalStatus('pending')),
        jsonResponse(200, approvalStatus(state)),
      ]
      const result = await awaitCloudHubApproval({
        ...baseOptions,
        fetchImpl: async () => responses.shift(),
        sleep: async () => {},
        now: () => 0,
      })
      assert.equal(result, expected)
    })
  }
})

test('rejects missing url token session or stable identity', async () => {
  for (const overrides of [
    {baseURL: ''},
    {token: ''},
    {sessionKey: ''},
    {toolCallId: '', idempotencyKey: ''},
  ]) {
    await assert.rejects(
      awaitCloudHubApproval({...baseOptions, ...overrides}),
      /CloudHub approval configuration is incomplete/
    )
  }
})

test('rejects non-cloudhub ids and invalid response bodies', async () => {
  await assert.rejects(
    awaitCloudHubApproval({
      ...baseOptions,
      fetchImpl: async () =>
        jsonResponse(201, {
          ...approvalStatus('pending'),
          id: 'plugin:approval-1',
        }),
    }),
    /CloudHub approval response is invalid/
  )

  const responses = [
    jsonResponse(201, approvalStatus('pending')),
    jsonResponse(200, {...approvalStatus('pending'), state: 'unknown'}),
  ]
  await assert.rejects(
    awaitCloudHubApproval({
      ...baseOptions,
      fetchImpl: async () => responses.shift(),
      sleep: async () => {},
      now: () => 0,
    }),
    /CloudHub approval response is invalid/
  )
})

test('sanitizes HTTP failures', async () => {
  const secretURL = 'http://private-cloudhub.example/internal'
  const secretToken = 'do-not-expose-service-secret'
  let error
  try {
    await awaitCloudHubApproval({
      ...baseOptions,
      baseURL: secretURL,
      token: secretToken,
      fetchImpl: async () =>
        jsonResponse(502, {message: 'sensitive upstream response body'}),
    })
  } catch (caught) {
    error = caught
  }
  assert.ok(error)
  assert.match(error.message, /502/)
  for (const sensitive of [
    secretURL,
    'private-cloudhub.example',
    secretToken,
    'sensitive upstream response body',
  ]) {
    assert.doesNotMatch(
      error.message,
      new RegExp(sensitive.replaceAll('.', '\\.'))
    )
  }

  await assert.rejects(
    awaitCloudHubApproval({
      ...baseOptions,
      fetchImpl: async () => {
        throw new Error(`network failure ${secretURL} ${secretToken}`)
      },
    }),
    errorValue =>
      errorValue.message === 'CloudHub approval request failed' &&
      !errorValue.message.includes(secretURL) &&
      !errorValue.message.includes(secretToken)
  )
})

test('stops at the 120 second deadline', async () => {
  let currentTime = 0
  let calls = 0
  const result = await awaitCloudHubApproval({
    ...baseOptions,
    fetchImpl: async () => {
      calls += 1
      return jsonResponse(201, approvalStatus('pending'))
    },
    sleep: async () => {
      currentTime = 120000
    },
    now: () => currentTime,
  })

  assert.equal(result, 'expired')
  assert.equal(calls, 1)
})

test('aborts a stalled request at the overall deadline', async t => {
  t.mock.timers.enable({apis: ['setTimeout']})
  let requestSignal
  const resultPromise = awaitCloudHubApproval({
    ...baseOptions,
    fetchImpl: async (_url, options = {}) => {
      requestSignal = options.signal
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          },
          {once: true}
        )
      })
    },
  })

  assert.ok(requestSignal instanceof AbortSignal)
  assert.equal(requestSignal.aborted, false)
  t.mock.timers.tick(120000)

  assert.equal(requestSignal.aborted, true)
  assert.equal(await resultPromise, 'expired')
})

test('interrupts a stalled polling wait at the overall deadline', async t => {
  t.mock.timers.enable({apis: ['setTimeout']})
  let sleepStarted = false
  const resultPromise = awaitCloudHubApproval({
    ...baseOptions,
    fetchImpl: async () => jsonResponse(201, approvalStatus('pending')),
    sleep: () => {
      sleepStarted = true
      return new Promise(() => {})
    },
  })
  for (let turn = 0; turn < 10 && !sleepStarted; turn += 1) {
    await Promise.resolve()
  }

  assert.equal(sleepStarted, true)
  t.mock.timers.tick(120000)
  assert.equal(await resultPromise, 'expired')
})

test('aborts the self-signed HTTPS transport at the overall deadline', async t => {
  t.mock.timers.enable({apis: ['setTimeout']})
  const pem = await readFile(
    new URL(
      '../../backend/cmd/cloudhub/cloudhub_self_signed.pem',
      import.meta.url
    )
  )
  let markRequestReceived
  const requestReceived = new Promise(resolve => {
    markRequestReceived = resolve
  })
  const server = https.createServer({key: pem, cert: pem}, request => {
    request.resume()
    markRequestReceived()
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise(resolve => server.close(resolve)))
  const {port} = server.address()

  const resultPromise = awaitCloudHubApproval({
    ...baseOptions,
    baseURL: `https://127.0.0.1:${port}`,
    insecureSkipVerify: true,
  })
  await requestReceived
  t.mock.timers.tick(120000)

  assert.equal(await resultPromise, 'expired')
})

test('skips verification only for the scoped self-signed HTTPS option', async t => {
  const pem = await readFile(
    new URL(
      '../../backend/cmd/cloudhub/cloudhub_self_signed.pem',
      import.meta.url
    )
  )
  const server = https.createServer(
    {key: pem, cert: pem},
    (request, response) => {
      request.resume()
      response.writeHead(201, {'Content-Type': 'application/json'})
      response.end(JSON.stringify(approvalStatus('allowed')))
    }
  )
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise(resolve => server.close(resolve)))
  const {port} = server.address()
  const options = {...baseOptions, baseURL: `https://127.0.0.1:${port}`}

  await assert.rejects(
    awaitCloudHubApproval(options),
    /CloudHub approval request failed/
  )

  const result = await awaitCloudHubApproval({
    ...options,
    insecureSkipVerify: true,
  })
  assert.equal(result, 'allow-once')
})

function approvalStatus(state) {
  return {
    id: 'cloudhub:approval-1',
    state,
    createdAt: 1786690800000,
    expiresAt: 1786690920000,
  }
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    },
  }
}
