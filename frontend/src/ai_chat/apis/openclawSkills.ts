/**
 * The skill list behind the chat composer's "/" menu.
 *
 * Reads through src/openclaw_skills/apis rather than calling the endpoints
 * again, so the URLs and the AJAX basepath handling stay in one place. This
 * module only turns the two answers into the single list the menu renders.
 */

import {getSkillInventory, getSkills} from 'src/openclaw_skills/apis'
import {OpenClawGatewaySkill, OpenClawSkill} from 'src/types/openclawSkills'

/** One row of the slash menu. */
export interface AiChatSkill {
  name: string
  command: string
  description: string
  category: string
}

// Shown when the Gateway entry carries no category of its own. Its fields are
// the Gateway's to define, so a missing one is normal rather than an error.
const DEFAULT_CATEGORY = 'Skill'

const readText = (entry: OpenClawGatewaySkill, field: string): string => {
  const value = entry[field]
  return typeof value === 'string' ? value.trim() : ''
}

const toMenuItem = (
  entry: OpenClawGatewaySkill,
  record?: OpenClawSkill
): AiChatSkill => ({
  name: entry.name,
  command: `/${entry.name}`,
  description:
    readText(entry, 'description') ||
    readText(entry, 'summary') ||
    (record ? `revision ${record.activeRevision}` : ''),
  category: readText(entry, 'category') || DEFAULT_CATEGORY,
})

const byName = (a: AiChatSkill, b: AiChatSkill) => a.name.localeCompare(b.name)

/**
 * List the skills the chat agent can be asked for by name.
 *
 * The Gateway inventory is what the agent actually holds, so it decides which
 * skills are offered; CloudHub's own records only fill in what an inventory
 * entry does not carry. The two are read independently because they fail
 * independently — a Gateway outage still leaves CloudHub's approved skills to
 * offer, and an empty answer from both simply leaves the menu closed.
 */
export const getAiChatSkills = async (): Promise<AiChatSkill[]> => {
  const [inventory, records] = await Promise.all([
    getSkillInventory().catch(() => null),
    getSkills().catch(() => [] as OpenClawSkill[]),
  ])

  const recordsByName = new Map(records.map(record => [record.name, record]))

  if (!inventory) {
    // Without the Gateway's answer, offer what CloudHub published: a draft
    // was never applied, so naming it would only fail in the chat.
    return records
      .filter(record => record.status === 'approved')
      .map(record => ({
        name: record.name,
        command: `/${record.name}`,
        description: `revision ${record.activeRevision}`,
        category: DEFAULT_CATEGORY,
      }))
      .sort(byName)
  }

  return (inventory.skills || [])
    .filter(entry => entry && entry.name)
    .map(entry => toMenuItem(entry, recordsByName.get(entry.name)))
    .sort(byName)
}
