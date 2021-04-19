import React, {FunctionComponent} from 'react'
import ReactTooltip from 'react-tooltip'
import {Addon} from 'src/types/auth'

interface Props {
  addons: Addon[]
}

const RouterSourceIndicator: FunctionComponent<Props> = ({
  addons,
}): JSX.Element => {
  let routerConnectTipsText = ''

  if (addons) {
    let swan = addons.find(addon => addon.name.toUpperCase() === 'SWAN')
    if (swan !== undefined) {
      routerConnectTipsText = `<h1>${swan.name.toUpperCase()} URL:</h1><p><code>${
        swan.url
      }</code></p>`
    } else {
      routerConnectTipsText = `<p>not connected</p>`
    }
  } else {
    routerConnectTipsText = `<p>not connected</p>`
  }

  return (
    <div
      className="router-connect-tips"
      data-for="router-connect-tips-tooltip"
      data-tip={routerConnectTipsText}
    >
      <span className="icon disks"></span>
      <ReactTooltip
        id="router-connect-tips-tooltip"
        effect="solid"
        html={true}
        place="left"
        class="influx-tooltip"
      />
    </div>
  )
}

export default RouterSourceIndicator
