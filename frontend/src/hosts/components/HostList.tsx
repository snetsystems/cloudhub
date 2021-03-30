import React, {PureComponent} from 'react'
import _ from 'lodash'

import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import uuid from 'uuid'

interface Props {
  hostList: string[]
}

class HostList extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {hostList} = this.props
    return (
      <FancyScrollbar>
        <TableBody>
          <>
            {_.map(
              hostList,
              (host: string): JSX.Element => (
                <div className="hosts-table--tr" key={uuid.v4()}>
                  <TableBodyRowItem
                    title={host}
                    width={'100%'}
                    className={'align--start'}
                  />
                </div>
              )
            )}
          </>
        </TableBody>
      </FancyScrollbar>
    )
  }
}

export default HostList
