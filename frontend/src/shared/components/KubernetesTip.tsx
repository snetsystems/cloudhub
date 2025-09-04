import React, {FunctionComponent} from 'react'
import ReactTooltip from 'react-tooltip'

const kubernetesTipsText = `
 <h1>Graph Tips:</h1><p><code>Click + Drag</code> Zoom in (X or Y)<br/><code>Shift + Click</code> Pan Graph Window<br/><code>Double Click</code> Reset Graph Window</p>
 <h1>Static Legend Tips:</h1><p><code>Click</code>Focus on single Series<br/><code>Shift + Click</code> Show/Hide single Series</p>
 <h1>Kubernetes Tips:</h1><p><code>Click</code> Marks the selected element with a check icon.<br/>
 Detailed information appears on the right panel, and a chart is displayed at the bottom.<br/>
 ※ No check mark appears when clicking on <b>Namespace</b> or <b>Node</b> areas.<br/><br/>
 <code>Double Click</code> Highlights elements related to the selected one.<br/>
 - <b>Yellow</b>: Parent–Child relationship<br/>
 - <b>Blue</b>: Pod → PVC → PV relationship<br/><br/>
 <code>Hover</code> Shows the name and status of the element on mouse over.<br/><br/></p>
`

const KubernetesTip: FunctionComponent = () => (
  <div
    className="graph-tips"
    data-for="graph-tips-tooltip"
    data-tip={kubernetesTipsText}
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

export default KubernetesTip
