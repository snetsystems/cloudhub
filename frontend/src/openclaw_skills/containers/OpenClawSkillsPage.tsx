import React, {FC, useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {
  Button,
  ComponentColor,
  ComponentSize,
  Page,
  Spinner,
} from 'src/reusable_ui'
import SkillList from 'src/openclaw_skills/components/SkillList'
import SkillDetail from 'src/openclaw_skills/components/SkillDetail'
import BaselineSkillDetail from 'src/openclaw_skills/components/BaselineSkillDetail'
import SkillAuthorOverlay from 'src/openclaw_skills/components/SkillAuthorOverlay'
import {
  approveRevision,
  getRevision,
  getSkillInventory,
  getSkill,
  getSkills,
  deleteRevision,
  deleteSkill,
  rollbackSkill,
} from 'src/openclaw_skills/apis'
import {describeError} from 'src/openclaw_skills/utils/errors'
import {
  OpenClawGatewaySkill,
  OpenClawSkill,
  OpenClawSkillDetail,
  OpenClawSkillFile,
} from 'src/types/openclawSkills'
import {RemoteDataState} from 'src/types'

const MAIN_PATH = 'SKILL.md'

interface RevisionSeed {
  main: string
  supportFiles: OpenClawSkillFile[]
}

export const OpenClawSkillsPage: FC = () => {
  const {t} = useTranslation()

  const [skills, setSkills] = useState<OpenClawSkill[]>([])
  // What the Gateway actually holds, keyed by skill name. null means the
  // Gateway could not be asked, which must not read as "the skill is gone".
  const [inventory, setInventory] = useState<Map<
    string,
    OpenClawGatewaySkill
  > | null>(null)
  const [selectedID, setSelectedID] = useState('')
  // A baseline skill has no CloudHub record, so it is held by name rather than
  // id. The two selections are exclusive: one detail pane, one thing in it.
  const [selectedBaseline, setSelectedBaseline] = useState('')
  const [detail, setDetail] = useState<OpenClawSkillDetail>(null)
  const [seed, setSeed] = useState<RevisionSeed>(null)
  const [authoring, setAuthoring] = useState(false)
  const [revising, setRevising] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadSkills = useCallback(async () => {
    try {
      setSkills(await getSkills())
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Read separately from the skill list so a Gateway outage leaves the list
  // usable instead of emptying the page.
  const loadInventory = useCallback(async () => {
    try {
      const {skills: entries} = await getSkillInventory()
      setInventory(new Map(entries.map(entry => [entry.name, entry])))
    } catch {
      setInventory(null)
    }
  }, [])

  const loadDetail = useCallback(async (skillID: string) => {
    try {
      setDetail(await getSkill(skillID))
    } catch (e) {
      setError(describeError(e))
    }
  }, [])

  useEffect(() => {
    loadSkills()
    loadInventory()
  }, [loadSkills, loadInventory])

  useEffect(() => {
    if (selectedID) {
      loadDetail(selectedID)
    } else {
      setDetail(null)
    }
  }, [selectedID, loadDetail])

  /*
    Every write can change both the list (status, active revision) and the
    open skill, so both are reloaded rather than patched in place.

    Which skill to open is passed in rather than read from state. A caller that
    moves the selection in the same closure — retiring clears it, saving moves
    it to the new skill — would otherwise refresh against the previous one,
    because a state setter is not visible to the code that follows it. Retiring
    made that visible: Get does not filter out a retired skill the way List
    does, so the stale read succeeded and put it back on screen.
  */
  const refresh = async (openID: string) => {
    await loadSkills()
    await loadInventory()
    if (openID) {
      await loadDetail(openID)
    } else {
      setDetail(null)
    }
  }

  const run = async (
    action: () => Promise<void>,
    openID: string = selectedID
  ) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await refresh(openID)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = (revision: number) =>
    run(async () => {
      await approveRevision(detail.skill.id, revision)
    })

  const handleRollback = (revision: number) =>
    run(async () => {
      await rollbackSkill(detail.skill.id, revision)
    })

  // Deleting removes the skill from the list, so nothing stays open.
  const handleDelete = () =>
    run(async () => {
      await deleteSkill(detail.skill.id)
      setSelectedID('')
    }, '')

  // The skill itself stays, so it stays open and reloads without the revision.
  const handleDeleteRevision = (revision: number) =>
    run(async () => {
      await deleteRevision(detail.skill.id, revision)
    })

  // A revision replaces the whole file set, so the editor opens on a complete
  // one. Sending a subset would drop the rest from the next revision.
  const openRevisionEditor = (files: OpenClawSkillFile[]) => {
    setSeed({
      main: files.find(file => file.path === MAIN_PATH)?.content || '',
      supportFiles: files.filter(file => file.path !== MAIN_PATH),
    })
    setRevising(true)
  }

  // The header button starts from whatever is live, which has to be read back
  // first. The revision viewer has its files already and passes them straight
  // to openRevisionEditor.
  const handleNewRevision = async () => {
    setBusy(true)
    setError('')
    try {
      const source =
        detail.skill.activeRevision || detail.revisions[0]?.revision
      openRevisionEditor(
        source ? (await getRevision(detail.skill.id, source)).files || [] : []
      )
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const handleSaved = async (skillID: string) => {
    setAuthoring(false)
    setRevising(false)
    setSelectedID(skillID)
    await refresh(skillID)
  }

  return (
    <Page className="openclaw-skills">
      <Page.Header fullWidth={false}>
        <Page.Header.Left>
          <Page.Title title={t('openclaw_skills.title')} />
        </Page.Header.Left>
        <Page.Header.Right>
          <Button
            text={t('openclaw_skills.actions.new_skill')}
            color={ComponentColor.Primary}
            size={ComponentSize.Small}
            onClick={() => setAuthoring(true)}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={false} scrollable={true}>
        {error && <div className="openclaw-skills--error">{error}</div>}

        <div className="openclaw-skills--layout">
          <div className="openclaw-skills--pane openclaw-skills--list-pane">
            <div className="openclaw-skills--pane-header">
              {t('openclaw_skills.list.title')}
              <span className="openclaw-skills--count">{skills.length}</span>
            </div>
            <div className="openclaw-skills--pane-body">
              <Spinner
                loading={
                  loading ? RemoteDataState.Loading : RemoteDataState.Done
                }
              >
                <SkillList
                  skills={skills}
                  inventory={inventory}
                  selectedID={selectedID}
                  onSelect={skillID => {
                    setSelectedBaseline('')
                    setSelectedID(skillID)
                  }}
                  selectedBaseline={selectedBaseline}
                  onSelectBaseline={name => {
                    setSelectedID('')
                    setSelectedBaseline(name)
                  }}
                />
              </Spinner>
            </div>
          </div>

          <div className="openclaw-skills--pane openclaw-skills--detail-pane">
            {detail ? (
              <SkillDetail
                // Remounting per skill drops the open revision viewer, which
                // belongs to the skill that was showing.
                key={detail.skill.id}
                detail={detail}
                inventory={inventory}
                busy={busy}
                onApprove={handleApprove}
                onRollback={handleRollback}
                onDelete={handleDelete}
                onDeleteRevision={handleDeleteRevision}
                onNewRevision={handleNewRevision}
                onEditRevision={openRevisionEditor}
              />
            ) : selectedBaseline ? (
              <BaselineSkillDetail
                // Remounting per skill drops the file selection, which belongs
                // to the skill that was showing.
                key={selectedBaseline}
                name={selectedBaseline}
              />
            ) : (
              <div className="openclaw-skills--empty">
                {t('openclaw_skills.detail.select_prompt')}
              </div>
            )}
          </div>
        </div>
      </Page.Contents>

      <SkillAuthorOverlay
        visible={authoring}
        onDismiss={() => setAuthoring(false)}
        onSaved={handleSaved}
      />
      <SkillAuthorOverlay
        visible={revising}
        skill={detail?.skill}
        initialMain={seed?.main}
        initialSupportFiles={seed?.supportFiles}
        onDismiss={() => setRevising(false)}
        onSaved={handleSaved}
      />
    </Page>
  )
}

export default OpenClawSkillsPage
