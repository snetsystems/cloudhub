import http from 'node:http'
import https from 'node:https'

const APPROVAL_PATH = '/api/v1/openclaw/managed-approvals'
const POLL_INTERVAL_MS = 250
const APPROVAL_DEADLINE_MS = 120000
const VALID_STATES = new Set(['pending', 'allowed', 'denied', 'expired'])

export async function awaitCloudHubApproval({
  baseURL,
  token,
  sessionKey,
  toolName,
  toolCallId,
  idempotencyKey,
  approval,
  insecureSkipVerify = false,
  fetchImpl,
  sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds)),
  now = Date.now,
}) {
  const normalizedURL = normalizeBaseURL(baseURL)
  const requestImpl =
    fetchImpl ??
    (insecureSkipVerify === true ? insecureCloudHubFetch : globalThis.fetch)
  if (
    !normalizedURL ||
    !nonEmpty(token) ||
    !nonEmpty(sessionKey) ||
    !nonEmpty(toolName) ||
    (!nonEmpty(toolCallId) && !nonEmpty(idempotencyKey)) ||
    !validApproval(approval) ||
    typeof requestImpl !== 'function'
  ) {
    throw new Error('CloudHub approval configuration is incomplete')
  }

  const controller = new AbortController()
  const deadlineTimer = setTimeout(
    () => controller.abort(),
    APPROVAL_DEADLINE_MS
  )
  const startedAt = now()
  const collectionURL = `${normalizedURL}${APPROVAL_PATH}`
  try {
    let status = await requestJSON(requestImpl, collectionURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionKey,
        toolName,
        toolCallId: nonEmpty(toolCallId) ? toolCallId : '',
        idempotencyKey: nonEmpty(idempotencyKey) ? idempotencyKey : '',
        title: approval.title,
        description: approval.description,
        severity: approval.severity,
        timeoutMs: APPROVAL_DEADLINE_MS,
      }),
      signal: controller.signal,
    })
    validateStatus(status)
    const approvalID = status.id

    while (status.state === 'pending') {
      await waitForPoll(sleep, POLL_INTERVAL_MS, controller.signal)
      if (now() - startedAt >= APPROVAL_DEADLINE_MS) {
        return 'expired'
      }
      status = await requestJSON(
        requestImpl,
        `${collectionURL}/${encodeURIComponent(approvalID)}`,
        {
          method: 'GET',
          headers: {Authorization: `Bearer ${token}`},
          signal: controller.signal,
        }
      )
      validateStatus(status, approvalID)
    }

    if (status.state === 'allowed') {
      return 'allow-once'
    }
    if (status.state === 'denied') {
      return 'deny'
    }
    return 'expired'
  } catch (error) {
    if (controller.signal.aborted) {
      return 'expired'
    }
    throw error
  } finally {
    clearTimeout(deadlineTimer)
  }
}

function insecureCloudHubFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError())
      return
    }
    const parsed = new URL(url)
    const isHTTPS = parsed.protocol === 'https:'
    let settled = false
    const cleanup = () => options.signal?.removeEventListener('abort', onAbort)
    const resolveOnce = value => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }
    const rejectOnce = error => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const request = (isHTTPS ? https : http).request(
      parsed,
      {
        method: options.method,
        headers: options.headers,
        ...(isHTTPS ? {rejectUnauthorized: false} : {}),
      },
      response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('error', rejectOnce)
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          resolveOnce({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            async json() {
              return JSON.parse(body)
            },
          })
        })
      }
    )
    const onAbort = () => {
      const error = abortError()
      rejectOnce(error)
      request.destroy(error)
    }
    request.on('error', rejectOnce)
    options.signal?.addEventListener('abort', onAbort, {once: true})
    request.setTimeout(APPROVAL_DEADLINE_MS, () => request.destroy())
    request.end(options.body)
  })
}

function abortError() {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

function waitForPoll(sleep, milliseconds, signal) {
  if (signal.aborted) {
    return Promise.reject(abortError())
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const resolveOnce = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const rejectOnce = error => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => rejectOnce(abortError())
    signal.addEventListener('abort', onAbort, {once: true})
    Promise.resolve()
      .then(() => sleep(milliseconds))
      .then(resolveOnce, rejectOnce)
  })
}

function normalizeBaseURL(value) {
  if (!nonEmpty(value)) {
    return ''
  }
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }
  } catch {
    return ''
  }
  return value.replace(/\/+$/, '')
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function validApproval(approval) {
  return (
    approval &&
    typeof approval === 'object' &&
    nonEmpty(approval.title) &&
    typeof approval.description === 'string' &&
    typeof approval.severity === 'string' &&
    approval.timeoutMs === APPROVAL_DEADLINE_MS
  )
}

async function requestJSON(fetchImpl, url, options) {
  let response
  try {
    response = await fetchImpl(url, options)
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('CloudHub approval request failed')
  }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status)
      ? ` (${response.status})`
      : ''
    throw new Error(`CloudHub approval request failed${status}`)
  }
  try {
    return await response.json()
  } catch {
    throw new Error('CloudHub approval response is invalid')
  }
}

function validateStatus(status, expectedID) {
  if (
    !status ||
    typeof status !== 'object' ||
    !nonEmpty(status.id) ||
    !status.id.startsWith('cloudhub:') ||
    (expectedID !== undefined && status.id !== expectedID) ||
    !VALID_STATES.has(status.state) ||
    !Number.isFinite(status.createdAt) ||
    !Number.isFinite(status.expiresAt)
  ) {
    throw new Error('CloudHub approval response is invalid')
  }
}
