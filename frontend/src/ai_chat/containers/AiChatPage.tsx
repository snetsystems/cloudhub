import React, {FC} from 'react'
import {connect} from 'react-redux'
import {Page} from 'src/reusable_ui'
import CloudhubAiChatStandalone from 'src/ai_chat/containers/CloudhubAiChatStandalone'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {setTimeZone} from 'src/shared/actions/app'
import {TimeZones} from 'src/types/app'

interface StateProps {
  timeZone: TimeZones
}

interface DispatchProps {
  onSetTimeZone: typeof setTimeZone
}

type Props = StateProps & DispatchProps

export const AiChatPage: FC<Props> = ({timeZone, onSetTimeZone}) => {
  return (
    <Page>
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="CloudHub AI Ops Assistant" />
        </Page.Header.Left>
        <Page.Header.Right>
          <TimeZoneToggle
            timeZone={timeZone}
            onSetTimeZone={onSetTimeZone}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents
        fullWidth={true}
        scrollable={false}
        className="ai-chat-page-contents"
      >
        <div className="ai-chat-page-container">
          <CloudhubAiChatStandalone
            mode="full"
            isOpen={true}
            timeZone={timeZone}
          />
        </div>
      </Page.Contents>
    </Page>
  )
}

const mstp = (state: {app?: {persisted?: {timeZone?: TimeZones}}}): StateProps => ({
  timeZone: state.app?.persisted?.timeZone ?? TimeZones.Local,
})

const mdtp: DispatchProps = {
  onSetTimeZone: setTimeZone,
}

export default connect(mstp, mdtp)(AiChatPage)
