import React, {PureComponent} from 'react'

import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

interface Tool {}
interface Line {}

interface Props {
  siderbarRef: React.RefObject<HTMLDivElement>
  tools?: Tool[]
  lines?: Line[]
}

class Tools extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    return (
      <FancyScrollbar>
        <div ref={this.props.siderbarRef}>
          <div>Icon</div>
          <div>Line</div>
        </div>
      </FancyScrollbar>
    )
  }
}

export default Tools
