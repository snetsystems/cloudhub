import React, {FC} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'

import {OpenClawGatewaySkill, OpenClawSkill} from 'src/types/openclawSkills'
import {
  baselineSkills,
  gatewayDescription,
  syncState,
} from 'src/openclaw_skills/utils/gateway'

interface Props {
  skills: OpenClawSkill[]
  // What the Gateway holds, keyed by skill name; null when it could not be
  // reached.
  inventory: Map<string, OpenClawGatewaySkill> | null
  selectedID: string
  onSelect: (skillID: string) => void
  // Baseline skills are addressed by name: they have no CloudHub record and so
  // no id.
  selectedBaseline: string
  onSelectBaseline: (name: string) => void
}

const SkillList: FC<Props> = ({
  skills,
  inventory,
  selectedID,
  onSelect,
  selectedBaseline,
  onSelectBaseline,
}) => {
  const {t} = useTranslation()

  // Skills the agent holds that this organization did not author. They have no
  // CloudHub record, so there is nothing to open and nothing to edit.
  const baseline = baselineSkills(inventory, skills)

  if (!skills.length && !baseline.length) {
    return (
      <div className="openclaw-skills--empty">
        {t('openclaw_skills.list.empty')}
      </div>
    )
  }

  return (
    <>
      <ul className="openclaw-skills--list">
        {skills.map(skill => {
          // One dot rather than three labels: green once the skill is live and
          // the agent confirms it, grey while it is not meant to be, red only
          // when those two disagree.
          const sync = syncState(skill, inventory)

          return (
            <li
              key={skill.id}
              className={classnames('openclaw-skills--list-item', {
                active: skill.id === selectedID,
              })}
              onClick={() => onSelect(skill.id)}
            >
              <span
                className={`openclaw-skills--dot openclaw-skills--dot-${sync.tone}`}
                title={t(sync.labelKey, sync.labelValues)}
              />
              <span className="openclaw-skills--name">{skill.name}</span>
              <span
                className={`openclaw-skills--sync openclaw-skills--sync-${sync.tone}`}
              >
                {t(sync.labelKey, sync.labelValues)}
              </span>
            </li>
          )
        })}
      </ul>

      {baseline.length > 0 && (
        <div className="openclaw-skills--baseline">
          <div className="openclaw-skills--baseline-header">
            {t('openclaw_skills.list.baseline')}
          </div>
          <ul className="openclaw-skills--list">
            {baseline.map(entry => (
              <li
                key={entry.name}
                className={classnames('openclaw-skills--list-item', {
                  active: entry.name === selectedBaseline,
                })}
                title={gatewayDescription(entry)}
                onClick={() => onSelectBaseline(entry.name)}
              >
                {/*
                  Always live: it is in the inventory, which is the Gateway
                  saying the agent holds it.
                */}
                <span className="openclaw-skills--dot openclaw-skills--dot-active" />
                <span className="openclaw-skills--name">{entry.name}</span>
              </li>
            ))}
          </ul>
          <p className="openclaw-skills--hint">
            {t('openclaw_skills.list.baseline_hint')}
          </p>
        </div>
      )}
    </>
  )
}

export default SkillList
