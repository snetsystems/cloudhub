import React, {FC} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'

import {OpenClawGatewaySkill, OpenClawSkill} from 'src/types/openclawSkills'
import {syncState} from 'src/openclaw_skills/utils/gateway'

interface Props {
  skills: OpenClawSkill[]
  // What the Gateway holds, keyed by skill name; null when it could not be
  // reached.
  inventory: Map<string, OpenClawGatewaySkill> | null
  selectedID: string
  onSelect: (skillID: string) => void
}

const SkillList: FC<Props> = ({skills, inventory, selectedID, onSelect}) => {
  const {t} = useTranslation()

  if (!skills.length) {
    return (
      <div className="openclaw-skills--empty">
        {t('openclaw_skills.list.empty')}
      </div>
    )
  }

  return (
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
  )
}

export default SkillList
