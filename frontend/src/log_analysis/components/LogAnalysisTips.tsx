import React, {FunctionComponent} from 'react'
import ReactTooltip from 'react-tooltip'

const logAnalysisTipsText =
  '<h1>Search Tips:</h1><p>Enter your filter using KQL (e.g. <code>message: error</code>, <code>host: "host1"</code>) and <code>click</code> the <strong>Search</strong> button to apply.</p><br/><h1>Tree Map / Tag Cloud Tips:</h1><p><code>Click</code> on keyword to apply a keyword filter.</p><br/><h1>Syslog Table Tips:</h1><p><code>Click</code> on column to apply a keyword filter.<br/><code>Clicking</code> the chart icon opens sidebar with time range ±2 hours and selected hostname.</p><br/><h1>Sidebar Tips:</h1><p><strong>App Name:</strong> Select the application to view dashboards.<br/><strong>Matching Alias:</strong> Enter device alias or hostname to filter data.<br/><code>Click</code> <strong>Apply</strong> to update device data.</p>'

const LogAnalysisTips: FunctionComponent = () => (
  <div
    className="graph-tips"
    data-for="log-analysis-tips-tooltip"
    data-tip={logAnalysisTipsText}
    style={{paddingRight: '0px'}}
  >
    <span>?</span>
    <ReactTooltip
      id="log-analysis-tips-tooltip"
      effect="solid"
      html={true}
      place="bottom"
      class="influx-tooltip"
    />
  </div>
)

export default LogAnalysisTips
