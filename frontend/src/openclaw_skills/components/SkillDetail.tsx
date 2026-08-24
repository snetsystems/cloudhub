import React, {FC, useState} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'

import {
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
} from 'src/reusable_ui'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import SkillRevisionFiles from 'src/openclaw_skills/components/SkillRevisionFiles'
import {
  OpenClawGatewaySkill,
  OpenClawSkillDetail,
  OpenClawSkillFile,
  OpenClawSkillRevision,
} from 'src/types/openclawSkills'
import {syncState} from 'src/openclaw_skills/utils/gateway'

interface Props {
  detail: OpenClawSkillDetail
  inventory: Map<string, OpenClawGatewaySkill> | null
  busy: boolean
  onApprove: (revision: number) => void
  onRollback: (revision: number) => void
  onDelete: () => void
  onDeleteRevision: (revision: number) => void
  onNewRevision: () => void
  onEditRevision: (files: OpenClawSkillFile[]) => void
}

const SkillDetail: FC<Props> = ({
  detail,
  inventory,
  busy,
  onApprove,
  onRollback,
  onDelete,
  onDeleteRevision,
  onNewRevision,
  onEditRevision,
}) => {
  const {t} = useTranslation()
  // Which revision's stored files are open below the table. 0 is none.
  const [opened, setOpened] = useState(0)

  const {skill, revisions} = detail
  const sync = syncState(skill, inventory)

  /*
    One indicator per revision instead of a badge beside the number and a
    status beside it saying nearly the same thing. The distinction the two
    carried is kept in the label: a revision that was applied and later
    superseded is not the one the agent is running.
  */
  const revisionState = (revision: OpenClawSkillRevision) => {
    if (revision.reviewStatus === 'rejected') {
      return {tone: 'fault', labelKey: 'openclaw_skills.review.rejected'}
    }
    if (revision.reviewStatus !== 'approved') {
      return {tone: 'idle', labelKey: 'openclaw_skills.review.pending'}
    }
    if (revision.revision === skill.activeRevision) {
      return {tone: 'active', labelKey: 'openclaw_skills.revision.live'}
    }
    return {tone: 'idle', labelKey: 'openclaw_skills.revision.superseded'}
  }
  const status = busy ? ComponentStatus.Loading : ComponentStatus.Default

  const revisionLabel = (revision: OpenClawSkillRevision) => {
    const state = revisionState(revision)
    const selectable =
      revision.reviewStatus === 'approved' &&
      revision.revision !== skill.activeRevision

    return (
      <span className="openclaw-skills--pick-row">
        <span
          className={classnames('openclaw-skills--pick', {
            checked: state.tone === 'active',
            selectable,
          })}
        />
        <span
          className={`openclaw-skills--sync openclaw-skills--sync-${state.tone}`}
        >
          {t(state.labelKey)}
        </span>
      </span>
    )
  }

  /*
    Status and action share one column, because the action only ever changes
    the status.

    A superseded revision is the label itself: making it live again republishes
    content the agent already ran, so a click is cheap and reversible. A
    revision that has never been applied keeps an explicit button — that
    publishes to the agent for the first time, which is not something to do by
    brushing against a label.
  */
  /*
    The two revisions the backend refuses, so the control is not offered for
    them: the active one is what the agent is running and what active_revision
    points at, and the last one is the skill's only content - removing that is
    deleting the skill, which also has to clear the Gateway workspace.
  */
  const deletable = (revision: OpenClawSkillRevision) =>
    revisions.length > 1 && revision.revision !== skill.activeRevision

  const revisionCell = (revision: OpenClawSkillRevision) => {
    if (revision.reviewStatus === 'pending') {
      return (
        <span className="openclaw-skills--revision-cell">
          {revisionLabel(revision)}
          <Button
            text={t('openclaw_skills.actions.approve')}
            color={ComponentColor.Success}
            size={ComponentSize.ExtraSmall}
            status={status}
            onClick={() => onApprove(revision.revision)}
          />
        </span>
      )
    }

    if (
      revision.reviewStatus === 'approved' &&
      revision.revision !== skill.activeRevision
    ) {
      return (
        <button
          className="openclaw-skills--revision-action"
          role="radio"
          aria-checked={false}
          title={t('openclaw_skills.actions.rollback')}
          disabled={busy}
          onClick={() => onRollback(revision.revision)}
        >
          {revisionLabel(revision)}
        </button>
      )
    }

    return revisionLabel(revision)
  }

  return (
    <div className="openclaw-skills--detail">
      <div className="openclaw-skills--detail-header">
        <div>
          <h3 className="openclaw-skills--detail-name">{skill.name}</h3>
          <span className="openclaw-skills--detail-meta">
            <span
              className={`openclaw-skills--dot openclaw-skills--dot-${sync.tone}`}
            />
            <span
              className={`openclaw-skills--sync openclaw-skills--sync-${sync.tone}`}
            >
              {t(sync.labelKey, sync.labelValues)}
            </span>
          </span>
        </div>
        <div className="openclaw-skills--detail-actions">
          <Button
            text={t('openclaw_skills.actions.new_revision')}
            color={ComponentColor.Primary}
            size={ComponentSize.Small}
            status={status}
            onClick={onNewRevision}
          />
          {/*
            Deleting takes the Gateway files and the whole revision history,
            and nothing here can put either back, so it asks first.
          */}
          <ConfirmButton
            text={t('openclaw_skills.actions.delete')}
            confirmText={t('openclaw_skills.actions.delete_confirm')}
            type="btn-danger"
            size="btn-sm"
            disabled={busy}
            confirmAction={onDelete}
          />
        </div>
      </div>

      <table className="table v-center table-highlight openclaw-skills--revisions">
        <thead>
          <tr>
            <th>{t('openclaw_skills.revision.number')}</th>
            <th>{t('openclaw_skills.revision.goal')}</th>
            <th>{t('openclaw_skills.revision.review')}</th>
            <th>{t('openclaw_skills.revision.created')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {revisions.map(revision => (
            <tr
              key={revision.id}
              className={classnames('openclaw-skills--revision-row', {
                active: revision.revision === opened,
              })}
              onClick={() =>
                setOpened(opened === revision.revision ? 0 : revision.revision)
              }
            >
              <td>{revision.revision}</td>
              <td>{revision.goal}</td>
              <td onClick={e => e.stopPropagation()}>
                {revisionCell(revision)}
              </td>
              <td>{new Date(revision.createdAt).toLocaleString()}</td>
              <td className="openclaw-skills--revision-delete">
                {deletable(revision) && (
                  <ConfirmButton
                    icon="trash"
                    square={true}
                    type="btn-danger"
                    size="btn-xs"
                    confirmText={t('openclaw_skills.actions.delete_confirm')}
                    disabled={busy}
                    isEventStopPropagation={true}
                    confirmAction={() => onDeleteRevision(revision.revision)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {opened > 0 ? (
        <SkillRevisionFiles
          skillID={skill.id}
          revision={opened}
          onEdit={onEditRevision}
        />
      ) : (
        <p className="openclaw-skills--hint">
          {t('openclaw_skills.detail.view_hint')}
        </p>
      )}
    </div>
  )
}

export default SkillDetail
