import React from 'react'
import {connect} from 'react-redux'
import {withRouter, WithRouterProps} from 'react-router'
import {Button, ButtonShape, IconFont} from 'src/reusable_ui'
import {toggleAiAgentsDrawer} from 'src/shared/actions/aiAgentsDrawer'
import {OrgNavMenuState} from 'src/shared/actions/orgNavMenu'
import {isAiChatVisible} from 'src/ai_chat/utils/aiAccess'
import {AiAgentsDrawerState} from 'src/shared/reducers/aiAgentsDrawer'
import Tooltip from 'src/shared/components/Tooltip'
import {Source} from 'src/types'
import {Me} from 'src/types/auth'

interface Props extends WithRouterProps {
  source: Source | undefined
  orgNavMenu: OrgNavMenuState
  me: Me | null
  isUsingAuth: boolean
  isDrawerOpen: boolean
  onToggle: () => void
}

const AiAgentsButton: React.FC<Props> = ({
  source,
  orgNavMenu,
  me,
  isUsingAuth,
  isDrawerOpen,
  onToggle,
}) => {
  if (!source || !isAiChatVisible(me, isUsingAuth, orgNavMenu?.selection)) {
    return null
  }

  return (
    <Tooltip tip="AI Assistant">
      <Button
        icon={IconFont.AiRobot}
        onClick={onToggle}
        active={isDrawerOpen}
        shape={ButtonShape.Square}
        customClass="dashboard-ai-agents-button"
      />
    </Tooltip>
  )
}

const mapStateToProps = (
  {
    sources,
    orgNavMenu,
    aiAgentsDrawer,
    auth,
  }: {
    sources: Source[]
    orgNavMenu: OrgNavMenuState
    aiAgentsDrawer: AiAgentsDrawerState
    auth: {me: Me | null; isUsingAuth: boolean}
  },
  ownProps: WithRouterProps
) => ({
  source: sources.find(s => s.id === ownProps.params.sourceID),
  orgNavMenu: orgNavMenu || {orgId: null, selection: {}},
  me: auth?.me ?? null,
  isUsingAuth: auth?.isUsingAuth,
  isDrawerOpen: aiAgentsDrawer.isOpen,
})

export default withRouter(
  connect(mapStateToProps, {onToggle: toggleAiAgentsDrawer})(AiAgentsButton)
)
