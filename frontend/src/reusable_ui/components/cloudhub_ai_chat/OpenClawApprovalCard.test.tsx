import React from 'react'
import {shallow} from 'enzyme'

import i18n from 'src/i18n'
import Button from 'src/reusable_ui/components/Button'
import {ComponentColor, ComponentStatus} from 'src/reusable_ui/types'

import OpenClawApprovalCard from './OpenClawApprovalCard'
import {OpenClawApprovalView} from './openclawApprovalState'

const approval = (
  state: OpenClawApprovalView['state'],
  allowedDecisions = [
    'allow-once',
    'deny',
  ] as OpenClawApprovalView['allowedDecisions']
): OpenClawApprovalView => ({
  id: 'cloudhub:approval/internal-id',
  source: 'managed',
  title: 'Run maintenance command',
  description: 'Restart the selected production service.',
  severity: 'high',
  toolName: 'shell',
  allowedDecisions,
  createdAt: 1_000,
  expiresAt: 61_000,
  state,
})

describe('OpenClawApprovalCard', () => {
  const onResolve = jest.fn()

  beforeEach(async () => {
    onResolve.mockReset()
    await i18n.changeLanguage('en')
  })

  it('renders fixed approval copy in English', () => {
    const pendingApproval = approval('pending')
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={pendingApproval}
        onResolve={onResolve}
        now={pendingApproval.createdAt}
      />
    )

    expect(wrapper.prop('aria-label')).toBe('Approval request')
    expect(wrapper.find('dt').at(0).text()).toBe('Tool')
    expect(wrapper.find('dt').at(1).text()).toBe('Severity')
    expect(wrapper.find('[data-testid="approval-status"]').text()).toBe(
      'Decision required.'
    )
    expect(wrapper.find('[data-testid="approval-countdown"]').text()).toBe(
      '1 minute remaining.'
    )
    expect(wrapper.find(Button).at(0).prop('text')).toBe('Allow once')
    expect(wrapper.find(Button).at(1).prop('text')).toBe('Deny')
    const buttons = wrapper.find(Button)
    expect(buttons.at(0).prop('color')).toBe(ComponentColor.Primary)
    expect(buttons.at(1).prop('color')).toBe(ComponentColor.Default)
  })

  it('renders fixed approval copy in Korean without translating payload values', async () => {
    await i18n.changeLanguage('ko')
    const pendingApproval = approval('pending')
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={pendingApproval}
        onResolve={onResolve}
        now={pendingApproval.createdAt}
      />
    )

    expect(wrapper.prop('aria-label')).toBe('승인 요청')
    expect(wrapper.find('dt').at(0).text()).toBe('도구')
    expect(wrapper.find('dt').at(1).text()).toBe('심각도')
    expect(wrapper.find('[data-testid="approval-status"]').text()).toBe(
      '결정 필요.'
    )
    expect(wrapper.find('[data-testid="approval-countdown"]').text()).toBe(
      '1분 남음.'
    )
    expect(wrapper.find(Button).at(0).prop('text')).toBe('한 번 허용')
    expect(wrapper.find(Button).at(1).prop('text')).toBe('거부')
    expect(wrapper.text()).toContain('Run maintenance command')
    expect(wrapper.text()).toContain('shell')
  })

  it('renders pending approval details, remaining time, and only offered actions', () => {
    const pendingApproval = approval('pending', ['allow-once'])
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={pendingApproval}
        onResolve={onResolve}
        now={pendingApproval.createdAt}
      />
    )

    expect(wrapper.text()).toContain('Run maintenance command')
    expect(wrapper.text()).toContain('Restart the selected production service.')
    expect(wrapper.find('dt').at(0).text()).toBe('Tool')
    expect(wrapper.find('dd').at(0).text()).toBe('shell')
    expect(wrapper.find('dt').at(1).text()).toBe('Severity')
    expect(wrapper.find('dd').at(1).text()).toBe('high')
    expect(wrapper.find('[data-testid="approval-countdown"]').text()).toContain(
      '1 minute remaining'
    )
    expect(wrapper.find('[data-testid="approval-allow-once"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="approval-deny"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain(pendingApproval.id)
  })

  it('keeps the ticking countdown outside the live status region', () => {
    const pendingApproval = approval('pending')
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={pendingApproval}
        onResolve={onResolve}
        now={pendingApproval.createdAt}
      />
    )

    const liveStatus = wrapper.find('[role="status"]')
    const countdown = wrapper.find('[data-testid="approval-countdown"]')
    expect(liveStatus).toHaveLength(1)
    expect(liveStatus.text()).toBe('Decision required.')
    expect(liveStatus.find('[data-testid="approval-countdown"]')).toHaveLength(
      0
    )
    expect(countdown.text()).toBe('1 minute remaining.')
    expect(countdown.prop('role')).toBeUndefined()
    expect(countdown.prop('aria-live')).toBeUndefined()
  })

  it('marks approval action buttons for card-scoped focus-visible styling', () => {
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={approval('pending')}
        onResolve={onResolve}
        now={1_000}
      />
    )

    expect(wrapper.find(Button)).toHaveLength(2)
    expect(
      wrapper
        .find(Button)
        .everyWhere(
          button =>
            button.prop('customClass') === 'openclaw-approval-card__action'
        )
    ).toBe(true)
  })

  it('resolves an offered decision with one click and no confirmation step', () => {
    const pendingApproval = approval('pending', ['allow-once'])
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={pendingApproval}
        onResolve={onResolve}
        now={pendingApproval.createdAt}
      />
    )

    wrapper
      .find('[data-testid="approval-allow-once"]')
      .find(Button)
      .simulate('click')

    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledWith(pendingApproval.id, 'allow-once')
  })

  it('shows resolving status and disables offered actions while resolving', () => {
    const resolvingApproval = approval('resolving')
    const wrapper = shallow(
      <OpenClawApprovalCard
        approval={resolvingApproval}
        onResolve={onResolve}
        now={resolvingApproval.createdAt}
      />
    )

    expect(wrapper.find('[data-testid="approval-status"]').text()).toContain(
      'Resolving decision'
    )
    expect(wrapper.find('[data-testid="approval-countdown"]')).toHaveLength(1)
    expect(wrapper.find(Button)).toHaveLength(2)
    expect(
      wrapper
        .find(Button)
        .everyWhere(button => button.prop('status') === ComponentStatus.Loading)
    ).toBe(true)
  })

  it.each([
    ['allowed', 'Allowed.'],
    ['denied', 'Denied.'],
    ['expired', 'Expired.'],
  ] as Array<[OpenClawApprovalView['state'], string]>)(
    'renders %s as a read-only terminal result',
    (state, expectedStatus) => {
      const terminalApproval = approval(state)
      const wrapper = shallow(
        <OpenClawApprovalCard
          approval={terminalApproval}
          onResolve={onResolve}
          now={terminalApproval.expiresAt}
        />
      )

      expect(wrapper.find('[data-testid="approval-status"]').text()).toBe(
        expectedStatus
      )
      expect(wrapper.find(Button)).toHaveLength(0)
      expect(wrapper.find('[data-testid="approval-countdown"]')).toHaveLength(0)
      expect(wrapper.hasClass(`openclaw-approval-card--${state}`)).toBe(true)
    }
  )
})
