import React, {FunctionComponent} from 'react'
import ReactTooltip from 'react-tooltip'

const serverDetailTipsContent = `
  <div class="server-detail-tips-tooltip__inner">
    <div class="server-detail-tips-tooltip__title">Cell Manager Guide</div>
    <div class="server-detail-tips-tooltip__description">Manage charts and data rows displayed on the dashboard.</div>
    <div class="server-detail-tips-tooltip__item"><strong>• Template:</strong> Built-in items (cannot be deleted)</div>
    <div class="server-detail-tips-tooltip__item"><strong>• Custom:</strong> User-defined items (can be added/deleted)</div>
  </div>
`

const ServerDetailTips: FunctionComponent = () => (
  <div
    className="server-detail-tips-container"
    data-for="server-detail-tips"
    data-tip={serverDetailTipsContent}
  >
    <div className="server-detail-tips-container__icon">?</div>
    <ReactTooltip
      id="server-detail-tips"
      effect="solid"
      html={true}
      place="bottom"
      class="influx-tooltip server-detail-tips-tooltip"
    />
  </div>
)

export default ServerDetailTips
