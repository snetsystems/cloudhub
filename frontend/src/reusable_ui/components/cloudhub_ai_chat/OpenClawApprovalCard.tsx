import React, {FC} from 'react'
import {TFunction, useTranslation} from 'react-i18next'

import Button from 'src/reusable_ui/components/Button'
import {ComponentColor, ComponentStatus} from 'src/reusable_ui/types'

import {OpenClawApprovalDecision} from './openclawApi'
import {OpenClawApprovalView} from './openclawApprovalState'

export interface OpenClawApprovalCardProps {
  approval: OpenClawApprovalView
  now: number
  onResolve: (approvalId: string, decision: OpenClawApprovalDecision) => void
}

const decisionText = (
  t: TFunction,
  decision: OpenClawApprovalDecision
): string =>
  t(
    decision === 'allow-once'
      ? 'openclaw_approval.actions.allow_once'
      : 'openclaw_approval.actions.deny'
  )

const remainingTime = (
  t: TFunction,
  expiresAt: number,
  now: number
): string => {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1_000))
  if (seconds < 60) {
    return t('openclaw_approval.countdown.seconds', {count: seconds})
  }

  const minutes = Math.ceil(seconds / 60)
  return t('openclaw_approval.countdown.minutes', {count: minutes})
}

const statusText = (t: TFunction, approval: OpenClawApprovalView): string => {
  const statusKey =
    approval.state === 'pending' ? 'decision_required' : approval.state
  return t(`openclaw_approval.status.${statusKey}`)
}

const decisionColor = (decision: OpenClawApprovalDecision): ComponentColor =>
  decision === 'allow-once' ? ComponentColor.Primary : ComponentColor.Default

const OpenClawApprovalCard: FC<OpenClawApprovalCardProps> = ({
  approval,
  now,
  onResolve,
}) => {
  const {t} = useTranslation()
  const actionable = approval.state === 'pending'
  const resolving = approval.state === 'resolving'
  const showCountdown = actionable || resolving
  const showActions = actionable || resolving
  const actionStatus = resolving
    ? ComponentStatus.Loading
    : ComponentStatus.Default

  return (
    <section
      aria-label={t('openclaw_approval.aria_label')}
      className={`openclaw-approval-card openclaw-approval-card--${approval.state}`}
    >
      <h3 className="openclaw-approval-card__title">{approval.title}</h3>
      <p className="openclaw-approval-card__description">
        {approval.description}
      </p>
      <dl className="openclaw-approval-card__metadata">
        <div>
          <dt>{t('openclaw_approval.tool')}</dt>
          <dd>{approval.toolName}</dd>
        </div>
        <div>
          <dt>{t('openclaw_approval.severity')}</dt>
          <dd>{approval.severity}</dd>
        </div>
      </dl>
      <p className="openclaw-approval-card__status">
        <span data-testid="approval-status" role="status">
          {statusText(t, approval)}
        </span>
        {showCountdown && (
          <>
            {' '}
            <span data-testid="approval-countdown">
              {remainingTime(t, approval.expiresAt, now)}
            </span>
          </>
        )}
      </p>
      {showActions && approval.allowedDecisions.length > 0 && (
        <div className="openclaw-approval-card__actions">
          {approval.allowedDecisions.map(decision => {
            const label = decisionText(t, decision)
            return (
              <span data-testid={`approval-${decision}`} key={decision}>
                <Button
                  color={decisionColor(decision)}
                  customClass="openclaw-approval-card__action"
                  onClick={
                    actionable
                      ? () => onResolve(approval.id, decision)
                      : undefined
                  }
                  status={actionStatus}
                  text={label}
                  titleText={label}
                />
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default OpenClawApprovalCard
