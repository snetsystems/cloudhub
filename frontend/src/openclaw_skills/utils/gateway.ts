import {OpenClawGatewaySkill, OpenClawSkill} from 'src/types/openclawSkills'

/**
 * What the Gateway says about one skill, as far as CloudHub needs to care.
 *
 * `unknown` is not "not there" — it means the Gateway could not be asked, and
 * has to read differently from `missing` so a Gateway outage is never
 * presented as a skill having vanished.
 */
export type GatewayState = 'unknown' | 'missing' | 'blocked' | 'registered'

/**
 * Read the Gateway's verdict for one skill name.
 *
 * `inventory` is null when the Gateway could not be reached. The entry's field
 * set is the Gateway's to define, so each flag is checked defensively: only an
 * explicit `false`/`true` counts, and an absent field is not treated as a
 * problem.
 */
export const gatewayState = (
  inventory: Map<string, OpenClawGatewaySkill> | null,
  name: string
): GatewayState => {
  if (!inventory) {
    return 'unknown'
  }

  const entry = inventory.get(name)
  if (!entry) {
    return 'missing'
  }

  const blocked =
    entry.disabled === true ||
    entry.eligible === false ||
    entry.modelVisible === false ||
    entry.blockedByAllowlist === true ||
    entry.blockedByAgentFilter === true

  return blocked ? 'blocked' : 'registered'
}

/**
 * One indicator for a skill's whole state, because the three CloudHub used to
 * show — record status, active revision, Gateway presence — say the same thing
 * in the ordinary case and only diverge when something is wrong.
 *
 * `active` and `idle` are the two normal outcomes. `fault` exists so the case
 * the Gateway read was added for — CloudHub believes a revision is live but the
 * agent does not have it — cannot hide behind the same grey as a draft.
 */
export type SyncTone = 'active' | 'idle' | 'fault' | 'unknown'

export interface SyncState {
  tone: SyncTone
  // i18n key for the short label beside the dot.
  labelKey: string
  labelValues?: Record<string, string | number>
}

export const syncState = (
  skill: OpenClawSkill,
  inventory: Map<string, OpenClawGatewaySkill> | null
): SyncState => {
  if (skill.activeRevision <= 0) {
    return {tone: 'idle', labelKey: 'openclaw_skills.list.not_published'}
  }

  const live = {revision: skill.activeRevision}

  switch (gatewayState(inventory, skill.name)) {
    case 'registered':
      return {
        tone: 'active',
        labelKey: 'openclaw_skills.list.live_revision',
        labelValues: live,
      }
    case 'blocked':
      return {tone: 'fault', labelKey: 'openclaw_skills.gateway.blocked'}
    case 'missing':
      return {tone: 'fault', labelKey: 'openclaw_skills.gateway.missing'}
    default:
      // The Gateway could not be asked. What CloudHub recorded is still worth
      // showing; the hollow dot is what says it is unconfirmed.
      return {
        tone: 'unknown',
        labelKey: 'openclaw_skills.list.live_revision',
        labelValues: live,
      }
  }
}

/**
 * The skills an agent holds that this organization did not author.
 *
 * A new organization's agent is provisioned with a set of baseline skills,
 * copied into its workspace as files. They deliberately have no CloudHub
 * record: the organization did not write them, and recording them would
 * produce a skill whose next revision the editor would refuse over a
 * description nobody here wrote. So the Gateway is the only place they are
 * known, and "in the inventory, absent from the list" is what identifies them.
 *
 * Anything an administrator placed in the workspace by hand lands here too.
 * That is the same kind of thing - a skill the organization did not author -
 * so it is shown the same way rather than hidden.
 */
export const baselineSkills = (
  inventory: Map<string, OpenClawGatewaySkill> | null,
  skills: OpenClawSkill[]
): OpenClawGatewaySkill[] => {
  if (!inventory) {
    return []
  }
  const authored = new Set(skills.map(skill => skill.name))
  return [...inventory.values()]
    .filter(entry => !authored.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The Gateway's own summary of a skill, when it supplied one. */
export const gatewayDescription = (entry: OpenClawGatewaySkill): string =>
  typeof entry.description === 'string' ? entry.description : ''
