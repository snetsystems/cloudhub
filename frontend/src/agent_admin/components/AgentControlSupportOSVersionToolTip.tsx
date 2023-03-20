// Libraries
import _ from 'lodash'
import React, {PureComponent} from 'react'
import ReactTooltip from 'react-tooltip'

// Constants
import {
  SUPPORTED_OS_VERSION_ORDER,
  SUPPORTED_OS_VERSION,
} from 'src/agent_admin/constants'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {}

@ErrorHandling
class AgentControlSupportOSVersionToolTip extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public generateSupportedOSVersionText = osName => {
    const supportedOSVersions: string[] = SUPPORTED_OS_VERSION[osName]
    let supportVersionText = ''

    _.map(supportedOSVersions, osVersion => {
      supportVersionText += `<code>${osVersion}</code><br/>`
    })

    return supportVersionText
  }

  render() {
    const centosSupportVersionText = this.generateSupportedOSVersionText(
      SUPPORTED_OS_VERSION_ORDER[0]
    )
    // const ubuntuSupportVersionText = this.generateSupportedOSVersionText(
    //   SUPPORTED_OS_VERSION_ORDER[1]
    // )
    const redhatSupportVersionText = this.generateSupportedOSVersionText(
      SUPPORTED_OS_VERSION_ORDER[1]
    )
    const agentControlSupportedOSVersionText = `<h1>CentOS:</h1><p>${centosSupportVersionText}</p> <h1>RedHat:</h1><p>${redhatSupportVersionText}</p>`

    return (
      <div
        className="graph-tips"
        data-for="graph-tips-tooltip"
        data-tip={agentControlSupportedOSVersionText}
      >
        <span>?</span>
        <ReactTooltip
          id="graph-tips-tooltip"
          effect="solid"
          html={true}
          place="bottom"
          class="influx-tooltip"
        />
      </div>
    )
  }
}

export default AgentControlSupportOSVersionToolTip
