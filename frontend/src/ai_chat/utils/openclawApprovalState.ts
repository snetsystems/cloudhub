import {
  OpenClawApprovalDecision,
  OpenClawApprovalDTO,
  OpenClawApprovalSource,
  OpenClawResolvedApprovalDTO,
} from 'src/ai_chat/apis/openclawApi'

export type OpenClawApprovalViewState =
  | 'pending'
  | 'resolving'
  | 'allowed'
  | 'denied'
  | 'expired'

export interface OpenClawApprovalView extends OpenClawApprovalDTO {
  state: OpenClawApprovalViewState
  decision?: OpenClawApprovalDecision
  resolvedAt?: number
}

export type OpenClawApprovalStore = {
  [sessionId: string]: {[approvalId: string]: OpenClawApprovalView}
}

export type OpenClawApprovalAction =
  | {
      type: 'snapshot'
      sessionId: string
      approvals: OpenClawApprovalDTO[]
      completeSources: OpenClawApprovalSource[]
      baseline: {[approvalId: string]: OpenClawApprovalView}
      now: number
    }
  | {
      type: 'requested'
      sessionId: string
      approval: OpenClawApprovalDTO
      now: number
    }
  | {
      type: 'resolving'
      sessionId: string
      approvalId: string
    }
  | {
      type: 'resolved'
      sessionId: string
      approval: OpenClawResolvedApprovalDTO
    }
  | {
      type: 'resolveFailed'
      sessionId: string
      approvalId: string
      now: number
    }
  | {
      type: 'expire'
      sessionId: string
      now: number
    }

const pendingView = (approval: OpenClawApprovalDTO, now: number): OpenClawApprovalView => ({
  ...approval,
  state: approval.expiresAt <= now ? 'expired' : 'pending',
})

const withApproval = (
  store: OpenClawApprovalStore,
  sessionId: string,
  approval: OpenClawApprovalView
): OpenClawApprovalStore => ({
  ...store,
  [sessionId]: {
    ...(store[sessionId] || {}),
    [approval.id]: approval,
  },
})

const hasCompleteDisplayMetadata = (
  approval: OpenClawResolvedApprovalDTO
): approval is OpenClawResolvedApprovalDTO & OpenClawApprovalDTO =>
  approval.title !== undefined &&
  approval.description !== undefined &&
  approval.severity !== undefined &&
  approval.toolName !== undefined &&
  approval.allowedDecisions !== undefined &&
  approval.createdAt !== undefined &&
  approval.expiresAt !== undefined

export const openClawApprovalReducer = (
  store: OpenClawApprovalStore,
  action: OpenClawApprovalAction
): OpenClawApprovalStore => {
  const session = store[action.sessionId] || {}

  switch (action.type) {
    case 'snapshot': {
      const snapshotIDs: {[approvalId: string]: boolean} = {}
      action.approvals.forEach(approval => {
        snapshotIDs[approval.id] = true
      })
      const nextSession = {...session}
      // An event replaces its view object, so only unchanged active views
      // captured before the request are eligible for omission reconciliation.
      Object.keys(action.baseline).forEach(approvalID => {
        const baselineApproval = action.baseline[approvalID]
        const current = session[approvalID]
        if (
          (baselineApproval.state === 'pending' ||
            baselineApproval.state === 'resolving') &&
          current === baselineApproval &&
          action.completeSources.indexOf(baselineApproval.source) >= 0 &&
          !snapshotIDs[approvalID]
        ) {
          delete nextSession[approvalID]
        }
      })
      action.approvals.forEach(approval => {
        const current = nextSession[approval.id]
        if (current && current.state !== 'pending') return
        nextSession[approval.id] = pendingView(approval, action.now)
      })
      return {...store, [action.sessionId]: nextSession}
    }
    case 'requested': {
      const current = session[action.approval.id]
      if (current && current.state !== 'pending') return store
      return withApproval(store, action.sessionId, pendingView(action.approval, action.now))
    }
    case 'resolving': {
      const current = session[action.approvalId]
      if (!current || current.state !== 'pending') return store
      return withApproval(store, action.sessionId, {...current, state: 'resolving'})
    }
    case 'resolved': {
      const {approval} = action
      const current = session[approval.id]
      let metadata: OpenClawApprovalDTO
      if (current) {
        metadata = {
          id: current.id,
          source: current.source,
          title: approval.title === undefined ? current.title : approval.title,
          description:
            approval.description === undefined
              ? current.description
              : approval.description,
          severity:
            approval.severity === undefined
              ? current.severity
              : approval.severity,
          toolName:
            approval.toolName === undefined
              ? current.toolName
              : approval.toolName,
          allowedDecisions:
            approval.allowedDecisions === undefined
              ? current.allowedDecisions
              : approval.allowedDecisions,
          createdAt:
            approval.createdAt === undefined
              ? current.createdAt
              : approval.createdAt,
          expiresAt:
            approval.expiresAt === undefined
              ? current.expiresAt
              : approval.expiresAt,
        }
      } else {
        if (!hasCompleteDisplayMetadata(approval)) return store
        metadata = approval
      }
      return withApproval(store, action.sessionId, {
        ...metadata,
        state: approval.decision === 'allow-once' ? 'allowed' : 'denied',
        decision: approval.decision,
        resolvedAt: approval.resolvedAt,
      })
    }
    case 'resolveFailed': {
      const current = session[action.approvalId]
      if (!current || current.state !== 'resolving') return store
      return withApproval(store, action.sessionId, {
        ...current,
        state: current.expiresAt <= action.now ? 'expired' : 'pending',
      })
    }
    case 'expire': {
      let nextStore = store
      Object.keys(session).forEach(approvalId => {
        const approval = session[approvalId]
        if (
          approval.expiresAt <= action.now &&
          (approval.state === 'pending' || approval.state === 'resolving')
        ) {
          nextStore = withApproval(nextStore, action.sessionId, {...approval, state: 'expired'})
        }
      })
      return nextStore
    }
  }
}

export const activeSessionApprovals = (
  store: OpenClawApprovalStore,
  sessionId: string
): OpenClawApprovalView[] =>
  Object.keys(store[sessionId] || {})
    .map(approvalId => store[sessionId][approvalId])
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
