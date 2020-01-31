import React, {SFC} from 'react'
import ReactTooltip from 'react-tooltip'

const resetLayoutTipsText =
  '<p>Press this button to reset to the default layout.</p>'

const ResetLayoutTips: SFC = () => (
  <div
    className="reset-layout-tips"
    data-for="reset-layout-tips-tooltip"
    data-tip={resetLayoutTipsText}
  >
    <span className="button-icon icon _reset-layout _reset-layout-align" />
    <ReactTooltip
      id="reset-layout-tips-tooltip"
      effect="solid"
      html={true}
      place="bottom"
      class="influx-tooltip"
    />
  </div>
)

export default ResetLayoutTips
