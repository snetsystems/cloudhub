import React, {FC, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'

import {getWorkspaceSkill} from 'src/openclaw_skills/apis'
import {describeError} from 'src/openclaw_skills/utils/errors'
import {MAIN_PATH, byteLength} from 'src/openclaw_skills/utils/validation'
import {OpenClawSkillFile} from 'src/types/openclawSkills'

interface Props {
  name: string
}

/*
  A baseline skill, read only.

  It has no CloudHub record - no revisions, no review, nothing to edit - so
  there is no history to show and no action to offer. What it says is still
  worth reading: it is what the agent will act on.
*/
const BaselineSkillDetail: FC<Props> = ({name}) => {
  const {t} = useTranslation()

  const [files, setFiles] = useState<OpenClawSkillFile[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // A slow read for a skill the user has already clicked away from must not
    // overwrite the one they are looking at now.
    let current = true

    setLoading(true)
    setError('')

    getWorkspaceSkill(name)
      .then(skill => {
        if (!current) {
          return
        }
        const held = skill.files || []
        setFiles(held)
        setSelected(
          held.some(file => file.path === MAIN_PATH)
            ? MAIN_PATH
            : held[0]?.path || ''
        )
      })
      .catch(e => {
        if (current) {
          setError(describeError(e))
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false)
        }
      })

    return () => {
      current = false
    }
  }, [name])

  const shown = files.find(file => file.path === selected)

  return (
    <div className="openclaw-skills--detail">
      <div className="openclaw-skills--detail-header">
        <div>
          <h3 className="openclaw-skills--detail-name">{name}</h3>
          <p className="openclaw-skills--hint">
            {t('openclaw_skills.list.baseline_hint')}
          </p>
        </div>
      </div>

      {loading && (
        <div className="openclaw-skills--empty">
          {t('openclaw_skills.detail.loading_files')}
        </div>
      )}

      {error && <div className="openclaw-skills--error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="openclaw-skills--file-tabs">
            {files.map(file => (
              <button
                key={file.path}
                className={classnames('openclaw-skills--file-tab', {
                  active: file.path === selected,
                })}
                onClick={() => setSelected(file.path)}
              >
                <span className="monotype">{file.path}</span>
                <span className="openclaw-skills--file-size">
                  {byteLength(file.content).toLocaleString()} B
                </span>
              </button>
            ))}
          </div>

          <pre className="openclaw-skills--file-content">{shown?.content}</pre>
        </>
      )}
    </div>
  )
}

export default BaselineSkillDetail
