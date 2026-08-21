import {useCallback, useEffect, useReducer, useRef, useState} from 'react'

import {
  getOpenClawApprovals,
  OpenClawAPIError,
  OpenClawApprovalDecision,
  OpenClawApprovalEventDTO,
  resolveOpenClawApproval,
} from 'src/ai_chat/apis/openclawApi'
import {
  activeSessionApprovals,
  openClawApprovalReducer,
} from 'src/ai_chat/utils/openclawApprovalState'

const DEMO_SESSION_ID = 'demo-markdown-session'
const SNAPSHOT_RETRY_OFFSETS_MS = [0, 500, 1_000]

const abortError = (): Error => {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

const waitForSnapshotRetry = (
  milliseconds: number,
  signal: AbortSignal
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(abortError())
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener('abort', onAbort, {once: true})
  })

export const useOpenClawApprovals = (
  activeSessionId: string,
  onError: (message: string) => void
) => {
  const [store, dispatch] = useReducer(openClawApprovalReducer, {})
  const [now, setNow] = useState(() => Date.now())
  const storeRef = useRef(store)
  const onErrorRef = useRef(onError)
  const activeSessionIdRef = useRef(activeSessionId)
  const requestGeneration = useRef(0)
  const snapshotAbort = useRef<AbortController | null>(null)
  const resolving = useRef<{[approvalId: string]: boolean}>({})
  storeRef.current = store
  onErrorRef.current = onError
  activeSessionIdRef.current = activeSessionId

  const refreshApprovals = useCallback(async () => {
    if (!activeSessionId || activeSessionId === DEMO_SESSION_ID) return
    snapshotAbort.current?.abort()
    const generation = ++requestGeneration.current
    const controller = new AbortController()
    snapshotAbort.current = controller
    const baseline = storeRef.current[activeSessionId] || {}
    const startedAt = Date.now()
    try {
      for (
        let attempt = 0;
        attempt < SNAPSHOT_RETRY_OFFSETS_MS.length;
        attempt++
      ) {
        if (attempt > 0) {
          await waitForSnapshotRetry(
            Math.max(
              0,
              SNAPSHOT_RETRY_OFFSETS_MS[attempt] -
                (Date.now() - startedAt)
            ),
            controller.signal
          )
        }
        try {
          const snapshot = await getOpenClawApprovals(
            activeSessionId,
            controller.signal
          )
          if (generation === requestGeneration.current) {
            dispatch({
              type: 'snapshot',
              sessionId: activeSessionId,
              approvals: snapshot.approvals,
              completeSources: snapshot.completeSources,
              baseline,
              now: Date.now(),
            })
          }
          return
        } catch (error) {
          if (
            controller.signal.aborted ||
            (error as Error).name === 'AbortError'
          ) {
            return
          }
          if (
            attempt === SNAPSHOT_RETRY_OFFSETS_MS.length - 1 &&
            generation === requestGeneration.current
          ) {
            onErrorRef.current('승인 목록을 불러오지 못했습니다.')
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error
    } finally {
      if (snapshotAbort.current === controller) snapshotAbort.current = null
    }
  }, [activeSessionId])

  useEffect(() => {
    void refreshApprovals()
    return () => {
      ++requestGeneration.current
      snapshotAbort.current?.abort()
      snapshotAbort.current = null
    }
  }, [refreshApprovals])

  const handleApprovalEvent = useCallback((event: OpenClawApprovalEventDTO) => {
    if (event.type === 'approval.requested') {
      dispatch({
        type: 'requested',
        sessionId: event.sessionId,
        approval: event.approval,
        now: Date.now(),
      })
      return
    }

    const {decision, resolvedAt} = event.approval
    if (!decision || resolvedAt === undefined) return
    dispatch({
      type: 'resolved',
      sessionId: event.sessionId,
      approval: {...event.approval, decision, resolvedAt},
    })
  }, [])

  const resolveApproval = useCallback(
    async (approvalId: string, decision: OpenClawApprovalDecision) => {
      const approval = (storeRef.current[activeSessionId] || {})[approvalId]
      if (
        !approval ||
        approval.state !== 'pending' ||
        resolving.current[approvalId]
      )
        return

      resolving.current[approvalId] = true
      dispatch({type: 'resolving', sessionId: activeSessionId, approvalId})
      try {
        await resolveOpenClawApproval(activeSessionId, approvalId, decision)
        const current = (storeRef.current[activeSessionId] || {})[approvalId]
        if (
          !current ||
          (current.state !== 'allowed' && current.state !== 'denied')
        ) {
          dispatch({
            type: 'resolved',
            sessionId: activeSessionId,
            approval: {...approval, decision, resolvedAt: Date.now()},
          })
        }
      } catch (error) {
        if (
          error instanceof OpenClawAPIError &&
          (error.status === 404 || error.status === 409)
        ) {
          if (activeSessionIdRef.current === activeSessionId) {
            await refreshApprovals()
          }
          return
        }
        dispatch({
          type: 'resolveFailed',
          sessionId: activeSessionId,
          approvalId,
          now: Date.now(),
        })
        onErrorRef.current('승인 요청을 처리하지 못했습니다.')
      } finally {
        delete resolving.current[approvalId]
      }
    },
    [activeSessionId, refreshApprovals]
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextNow = Date.now()
      setNow(nextNow)
      if (activeSessionId && activeSessionId !== DEMO_SESSION_ID) {
        dispatch({type: 'expire', sessionId: activeSessionId, now: nextNow})
      }
    }, 1_000)
    return () => window.clearInterval(interval)
  }, [activeSessionId])

  return {
    approvals: activeSessionApprovals(store, activeSessionId),
    now,
    refreshApprovals,
    handleApprovalEvent,
    resolveApproval,
  }
}
