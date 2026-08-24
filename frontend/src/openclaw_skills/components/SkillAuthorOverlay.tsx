import React, {FC, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import Markdown from 'react-markdown'

import {
  Button,
  ButtonShape,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
  Radio,
} from 'src/reusable_ui'
import SkillFileEditor from 'src/openclaw_skills/components/SkillFileEditor'
import SkillMainEditor from 'src/openclaw_skills/components/SkillMainEditor'
import {createRevision, createSkill, draftSkill} from 'src/openclaw_skills/apis'
import {describeError} from 'src/openclaw_skills/utils/errors'
import {
  MAX_BODY_BYTES,
  MAX_DESC_BYTES,
  MAX_SUPPORT_FILES,
  MAX_TOTAL_BYTES,
  byteLength,
  readFrontmatter,
  validateMain,
  validateSupportFiles,
} from 'src/openclaw_skills/utils/validation'
import {OpenClawSkill, OpenClawSkillFile} from 'src/types/openclawSkills'

interface Props {
  visible: boolean
  // Set when submitting a new revision of an existing skill; absent when
  // creating one.
  skill?: OpenClawSkill
  // The file set the new revision starts from, already read back from the
  // skill's current revision.
  initialMain?: string
  initialSupportFiles?: OpenClawSkillFile[]
  onDismiss: () => void
  onSaved: (skillID: string) => void
}

type Tab = 'edit' | 'preview' | 'files'

const SkillAuthorOverlay: FC<Props> = ({
  visible,
  skill,
  initialMain,
  initialSupportFiles,
  onDismiss,
  onSaved,
}) => {
  const {t} = useTranslation()

  const [goal, setGoal] = useState('')
  const [main, setMain] = useState('')
  const [supportFiles, setSupportFiles] = useState<OpenClawSkillFile[]>([])
  const [tab, setTab] = useState<Tab>('edit')
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      return
    }
    setGoal('')
    setMain(initialMain || '')
    setSupportFiles(initialSupportFiles || [])
    setTab('edit')
    setError('')
  }, [visible, initialMain, initialSupportFiles])

  const mainBytes = byteLength(main)
  const frontmatter = useMemo(() => readFrontmatter(main), [main])
  const descBytes = frontmatter ? byteLength(frontmatter.description) : 0
  const totalBytes = useMemo(
    () =>
      supportFiles.reduce(
        (sum, file) => sum + byteLength(file.content),
        mainBytes
      ),
    [supportFiles, mainBytes]
  )

  // Every rule the backend would refuse the save for, shown while typing
  // rather than after a 422 comes back.
  const issues = useMemo(
    () => [
      ...validateMain(main, skill?.name),
      ...validateSupportFiles(supportFiles, mainBytes),
    ],
    [main, supportFiles, mainBytes, skill]
  )

  // Drafting stores nothing and creates no Gateway proposal, so it can be
  // repeated until the author is satisfied.
  const handleDraft = async () => {
    setDrafting(true)
    setError('')
    try {
      // Revising sends the editor's current document so the agent edits it
      // rather than starting over under a name of its own.
      const draft = await draftSkill(
        goal,
        skill && main.trim() ? {main, name: skill.name} : undefined
      )
      setMain(draft.main)
      setSupportFiles(draft.supportFiles || [])
      setTab('edit')
    } catch (e) {
      setError(describeError(e))
    } finally {
      setDrafting(false)
    }
  }

  // Saving records a revision. Nothing reaches the Gateway until it is applied.
  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      /*
        The revision is described by its own frontmatter, not by the prompt
        that happened to produce it. Storing the description means the history
        says what each revision is, and there is one fewer sentence to write
        that says the same thing twice.
      */
      const body = {
        main,
        supportFiles,
        goal: frontmatter?.description || '',
      }
      const skillID = skill
        ? (await createRevision(skill.id, body)).skillId
        : (await createSkill(body)).id
      onSaved(skillID)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setSaving(false)
    }
  }

  const title = skill
    ? t('openclaw_skills.author.revision_title', {name: skill.name})
    : t('openclaw_skills.author.title')

  const counter = (used: number, max: number) => (
    <span className={used > max ? 'openclaw-skills--over' : ''}>
      {used.toLocaleString()} / {max.toLocaleString()}
    </span>
  )

  return (
    <OverlayTechnology visible={visible}>
      <OverlayContainer maxWidth={1400}>
        <OverlayHeading title={title} onDismiss={onDismiss} />
        <OverlayBody>
          <div className="openclaw-skills--author">
            <div className="openclaw-skills--author-brief">
              <label>{t('openclaw_skills.author.goal_label')}</label>
              <textarea
                className="form-control input-sm openclaw-skills--goal"
                value={goal}
                placeholder={t('openclaw_skills.author.goal_placeholder')}
                onChange={e => setGoal(e.target.value)}
              />
              <Button
                text={
                  main
                    ? t('openclaw_skills.author.redraft')
                    : t('openclaw_skills.author.draft')
                }
                color={ComponentColor.Secondary}
                size={ComponentSize.Small}
                shape={ButtonShape.StretchToFit}
                status={
                  drafting
                    ? ComponentStatus.Loading
                    : goal.trim()
                    ? ComponentStatus.Default
                    : ComponentStatus.Disabled
                }
                onClick={handleDraft}
              />
              <p className="openclaw-skills--hint">
                {t('openclaw_skills.author.goal_help')}
              </p>

              <dl className="openclaw-skills--facts">
                <dt>{t('openclaw_skills.author.fact_name')}</dt>
                <dd className="monotype">{frontmatter?.name || '—'}</dd>
                <dt>{t('openclaw_skills.author.fact_description')}</dt>
                <dd>{counter(descBytes, MAX_DESC_BYTES)}</dd>
                <dt>{t('openclaw_skills.author.fact_body')}</dt>
                <dd>{counter(mainBytes, MAX_BODY_BYTES)}</dd>
                <dt>{t('openclaw_skills.author.fact_files')}</dt>
                <dd>{counter(supportFiles.length, MAX_SUPPORT_FILES)}</dd>
                <dt>{t('openclaw_skills.author.fact_total')}</dt>
                <dd>{counter(totalBytes, MAX_TOTAL_BYTES)}</dd>
              </dl>

              {/*
                An empty editor is its own explanation, so the list stays quiet
                until there is something to complain about.
              */}
              {main.trim() !== '' && issues.length > 0 && (
                <ul className="openclaw-skills--issues">
                  {issues.map((issue, index) => (
                    <li key={index}>
                      {t(
                        `openclaw_skills.validation.${issue.key}`,
                        issue.values
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {error && <div className="openclaw-skills--error">{error}</div>}
            </div>

            <div className="openclaw-skills--author-work">
              <Radio
                shape={ButtonShape.Default}
                customClass="openclaw-skills--author-tabs"
              >
                <Radio.Button
                  id="openclaw-skill-tab-edit"
                  value="edit"
                  active={tab === 'edit'}
                  onClick={() => setTab('edit')}
                >
                  {t('openclaw_skills.author.tab_edit')}
                </Radio.Button>
                <Radio.Button
                  id="openclaw-skill-tab-preview"
                  value="preview"
                  active={tab === 'preview'}
                  onClick={() => setTab('preview')}
                >
                  {t('openclaw_skills.author.tab_preview')}
                </Radio.Button>
                <Radio.Button
                  id="openclaw-skill-tab-files"
                  value="files"
                  active={tab === 'files'}
                  onClick={() => setTab('files')}
                >
                  {t('openclaw_skills.author.tab_files', {
                    count: supportFiles.length,
                  })}
                </Radio.Button>
              </Radio>

              <div className="openclaw-skills--author-panel">
                {tab === 'edit' && (
                  <SkillMainEditor value={main} onChange={setMain} />
                )}
                {tab === 'preview' && (
                  <div className="openclaw-skills--preview markdown-format">
                    <Markdown source={main} />
                  </div>
                )}
                {tab === 'files' && (
                  <SkillFileEditor
                    files={supportFiles}
                    onChange={setSupportFiles}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="openclaw-skills--author-footer">
            <Button
              text={t('openclaw_skills.actions.cancel')}
              onClick={onDismiss}
            />
            <Button
              text={t('openclaw_skills.actions.save')}
              color={ComponentColor.Primary}
              status={
                saving
                  ? ComponentStatus.Loading
                  : issues.length
                  ? ComponentStatus.Disabled
                  : ComponentStatus.Default
              }
              onClick={handleSave}
            />
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default SkillAuthorOverlay
