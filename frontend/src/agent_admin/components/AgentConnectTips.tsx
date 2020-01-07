import React, {SFC} from 'react'
import ReactTooltip from 'react-tooltip'

interface Props {
  saltMasterUrl: string
}

const AgentConnectTips: SFC<Props> = ({saltMasterUrl}) => {
  const agentConnectTipsText =
    '<h1>Salt URL:</h1><p><code>' + saltMasterUrl + '</code></p>'

  return (
    <div
      className="agent-connect-tips"
      data-for="agent-connect-tips-tooltip"
      data-tip={agentConnectTipsText}
    >
      <span className="icon disks"></span>
      <ReactTooltip
        id="agent-connect-tips-tooltip"
        effect="solid"
        html={true}
        place="left"
        class="influx-tooltip"
      />
    </div>
  )
}

export default AgentConnectTips
