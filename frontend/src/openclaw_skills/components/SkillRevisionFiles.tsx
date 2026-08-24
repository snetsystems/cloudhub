import React, {FC, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'

import {Button, ComponentColor, ComponentSize} from 'src/reusable_ui'
import {getRevision} from 'src/openclaw_skills/apis'
import {describeError} from 'src/openclaw_skills/utils/errors'
import {MAIN_PATH, byteLength} from 'src/openclaw_skills/utils/validation'
import {OpenClawSkillFile} from 'src/types/openclawSkills'

interface Props {
  skillID: string
  revision: number
  // Start a new revision from the files shown here. They are already loaded,
  // so the editor is seeded from them rather than fetched again.
  onEdit: (files: OpenClawSkillFile[]) => void
}

/*
  The stored file set for one revision, read only.

  The revision listing carries no file contents — a separate fetch per revision
  is what keeps the history cheap — so this loads them on demand.
*/
const SkillRevisionFiles: FC<Props> = ({skillID, revision, onEdit}) => {
  const {t} = useTranslation()

  const [files, setFiles] = useState<OpenClawSkillFile[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // A slow fetch for a revision the user has already clicked away from must
    // not overwrite the one they are looking at now.
    let current = true

    setLoading(true)
    setError('')

    getRevision(skillID, revision)
      .then(rev => {
        if (!current) {
          return
        }
        const stored = rev.files || []
        setFiles(stored)
        setSelected(
          stored.some(file => file.path === MAIN_PATH)
            ? MAIN_PATH
            : stored[0]?.path || ''
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
  }, [skillID, revision])

  const shown = files.find(file => file.path === selected)

  return (
    <div className="openclaw-skills--revision-files">
      <div className="openclaw-skills--pane-header">
        {t('openclaw_skills.detail.revision_files', {revision})}
        {!loading && !error && files.length > 0 && (
          <Button
            text={t('openclaw_skills.actions.edit_from_revision')}
            color={ComponentColor.Primary}
            size={ComponentSize.ExtraSmall}
            customClass="openclaw-skills--pane-header-action"
            onClick={() => onEdit(files)}
          />
        )}
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

          {/*
            CloudHub reports what it sent, not what the Gateway holds now. The
            Gateway's apply is additive and it re-serializes the frontmatter,
            so the two can differ.
          */}
          <p className="openclaw-skills--hint">
            {t('openclaw_skills.detail.recorded_note')}
          </p>
        </>
      )}
    </div>
  )
}

export default SkillRevisionFiles
