export type OpenClawSkillStatus = 'draft' | 'approved'

export type OpenClawReviewStatus = 'pending' | 'approved' | 'rejected'

export interface OpenClawSkillFile {
  path: string
  content: string
}

export interface OpenClawSkill {
  id: string
  name: string
  status: OpenClawSkillStatus
  activeRevision: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface OpenClawSkillRevision {
  id: string
  skillId: string
  revision: number
  treeHash: string
  goal: string
  authorId: string
  reviewStatus: OpenClawReviewStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  gatewayProposalId?: string
  // The Gateway's own security scan, stored verbatim. CloudHub does not
  // interpret it, so neither does this screen.
  gatewayScan?: Record<string, unknown>
  createdAt: string
  // Only present when a single revision is fetched, never in history listings.
  files?: OpenClawSkillFile[]
}

export interface OpenClawSkillDetail {
  skill: OpenClawSkill
  revisions: OpenClawSkillRevision[]
}

export interface OpenClawSkillDraft {
  main: string
  supportFiles: OpenClawSkillFile[]
  sessionId: string
}

export interface OpenClawSkillRequest {
  main: string
  supportFiles?: OpenClawSkillFile[]
  goal?: string
}

/**
 * One skill as the Gateway reports it.
 *
 * The field set is the Gateway's to define and changes between versions, so
 * nothing here is modelled beyond the name CloudHub matches on. Read anything
 * else defensively.
 */
export interface OpenClawGatewaySkill {
  name: string
  [field: string]: unknown
}

export interface OpenClawSkillInventory {
  agentId: string
  skills: OpenClawGatewaySkill[]
}

/**
 * One workspace skill's files, read live from the Gateway.
 *
 * Baseline skills are copied into an agent's workspace as files and have no
 * CloudHub record, so this is the only place their content comes from.
 */
export interface OpenClawWorkspaceSkill {
  agentId: string
  name: string
  files: OpenClawSkillFile[]
}
