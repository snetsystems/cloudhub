import React from 'react'
import {connect} from 'react-redux'
import {withRouter, WithRouterProps} from 'react-router'
import {Button, ButtonShape, IconFont} from 'src/reusable_ui'
import {toggleAiAgentsDrawer} from 'src/shared/actions/aiAgentsDrawer'
import {OrgNavMenuState} from 'src/shared/actions/orgNavMenu'
import {isOrgNavMenuEnabled} from 'src/side_nav/utils/orgNavMenuVisibility'
import {AiAgentsDrawerState} from 'src/shared/reducers/aiAgentsDrawer'
import Tooltip from 'src/shared/components/Tooltip'
import {Source} from 'src/types'

interface Props extends WithRouterProps {
  source: Source | undefined
  orgNavMenu: OrgNavMenuState
  isDrawerOpen: boolean
  onToggle: () => void
}

const AiAgentsButton: React.FC<Props> = ({
  source,
  orgNavMenu,
  isDrawerOpen,
  onToggle,
}) => {
  if (!source || !isOrgNavMenuEnabled(orgNavMenu?.selection, 'ai-chat')) {
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
  }: {
    sources: Source[]
    orgNavMenu: OrgNavMenuState
    aiAgentsDrawer: AiAgentsDrawerState
  },
  ownProps: WithRouterProps
) => ({
  source: sources.find(s => s.id === ownProps.params.sourceID),
  orgNavMenu: orgNavMenu || {orgId: null, selection: {}},
  isDrawerOpen: aiAgentsDrawer.isOpen,
})

export default withRouter(
  connect(mapStateToProps, {onToggle: toggleAiAgentsDrawer})(AiAgentsButton)
)
