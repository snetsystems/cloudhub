import AJAX from 'src/utils/ajax'
import {
  OpenClawSkill,
  OpenClawSkillDetail,
  OpenClawSkillDraft,
  OpenClawSkillInventory,
  OpenClawSkillRequest,
  OpenClawSkillRevision,
} from 'src/types/openclawSkills'

const SKILLS_URL = '/cloudhub/v2/openclaw/skills'
const SKILL_DRAFTS_URL = '/cloudhub/v2/openclaw/skill-drafts'
const SKILL_INVENTORY_URL = '/cloudhub/v2/openclaw/skill-inventory'

const skillUrl = (skillID: string) =>
  `${SKILLS_URL}/${encodeURIComponent(skillID)}`

// AJAX resolves to `any`, and it throws the raw response object rather than an
// Error, so callers read `e.status` and `e.data.message`.
const request = async <T>(params: {
  method: 'GET' | 'POST' | 'DELETE'
  url: string
  data?: object
}): Promise<T> => {
  const {data} = await AJAX(params)
  return data as T
}

/**
 * Ask the organization's authoring agent for a SKILL.md draft.
 * Stores nothing and creates no Gateway proposal, so it may be called
 * repeatedly until the author is satisfied.
 *
 * When revising, pass the document currently in the editor and the name the
 * revision has to keep. Without them the agent cannot tell a revision from a
 * new skill, and replaces the document with an unrelated one.
 */
export const draftSkill = async (
  goal: string,
  revising?: {main: string; name: string}
): Promise<OpenClawSkillDraft> => {
  return request<OpenClawSkillDraft>({
    method: 'POST',
    url: SKILL_DRAFTS_URL,
    data: revising ? {goal, ...revising} : {goal},
  })
}

/**
 * What the Gateway actually holds for the organization's execution agent.
 *
 * Separate from getSkills on purpose: that is CloudHub's own record and has to
 * render even when the Gateway is unreachable, while this is the Gateway's
 * answer and can fail on its own.
 */
export const getSkillInventory = async (): Promise<OpenClawSkillInventory> => {
  return request<OpenClawSkillInventory>({
    method: 'GET',
    url: SKILL_INVENTORY_URL,
  })
}

export const getSkills = async (): Promise<OpenClawSkill[]> => {
  const {skills} = await request<{skills: OpenClawSkill[]}>({
    method: 'GET',
    url: SKILLS_URL,
  })

  return skills || []
}

export const getSkill = async (
  skillID: string
): Promise<OpenClawSkillDetail> => {
  return request<OpenClawSkillDetail>({
    method: 'GET',
    url: skillUrl(skillID),
  })
}

/**
 * Get one revision with its files. The history listing omits file contents,
 * and a revision replaces the whole file set rather than patching it, so the
 * editor has to read the current files back before submitting a change.
 */
export const getRevision = async (
  skillID: string,
  revision: number
): Promise<OpenClawSkillRevision> => {
  return request<OpenClawSkillRevision>({
    method: 'GET',
    url: `${skillUrl(skillID)}/revisions/${revision}`,
  })
}

/**
 * Store a drafted skill as revision 1. Nothing reaches the Gateway yet.
 */
export const createSkill = async (
  body: OpenClawSkillRequest
): Promise<OpenClawSkill> => {
  return request<OpenClawSkill>({
    method: 'POST',
    url: SKILLS_URL,
    data: body,
  })
}

/**
 * Submit a new revision. A revision replaces the skill's whole file set, so
 * the request must carry every file the skill should keep.
 */
export const createRevision = async (
  skillID: string,
  body: OpenClawSkillRequest
): Promise<OpenClawSkillRevision> => {
  return request<OpenClawSkillRevision>({
    method: 'POST',
    url: `${skillUrl(skillID)}/revisions`,
    data: body,
  })
}

export const approveRevision = async (
  skillID: string,
  revision: number,
  note?: string
): Promise<OpenClawSkillRevision> => {
  return request<OpenClawSkillRevision>({
    method: 'POST',
    url: `${skillUrl(skillID)}/revisions/${revision}/approve`,
    data: note ? {note} : {},
  })
}

/**
 * Copy an earlier revision forward as a new revision and publish it, so the
 * history still shows what was live and when.
 */
export const rollbackSkill = async (
  skillID: string,
  toRevision: number
): Promise<OpenClawSkillRevision> => {
  return request<OpenClawSkillRevision>({
    method: 'POST',
    url: `${skillUrl(skillID)}/rollback`,
    data: {toRevision},
  })
}

/**
 * Remove a skill completely: its files leave the Gateway workspace and its
 * whole revision history leaves CloudHub.
 */
export const deleteSkill = async (skillID: string): Promise<void> => {
  await request<void>({
    method: 'DELETE',
    url: skillUrl(skillID),
  })
}

/**
 * Remove one revision from a skill's history.
 *
 * Nothing reaches the Gateway: it holds one file set per skill, the one the
 * active revision published, and the backend refuses to delete that revision.
 */
export const deleteRevision = async (
  skillID: string,
  revision: number
): Promise<void> => {
  await request<void>({
    method: 'DELETE',
    url: `${skillUrl(skillID)}/revisions/${revision}`,
  })
}
