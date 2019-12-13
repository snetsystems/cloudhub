import React, {PureComponent} from 'react'
import {TOPSOURCES_TABLE_SIZING} from 'src/addon/128t/constants'
import {TopSource} from 'src/addon/128t/types'
import {transBytes, transBps} from 'src/shared/utils/units'

interface Props {
  topSources: TopSource
}

class TopSourcesTableRow extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  private TableItem = ({width, title}) => {
    return (
      <div
        className="hosts-table--td"
        style={{width: width, alignItems: 'center', lineHeight: '200%'}}
      >
        {title}
      </div>
    )
  }

  render() {
    const {
      ip,
      tenant,
      currentBandwidth,
      totalData,
      sessionCount,
    } = this.props.topSources

    const {
      IP,
      TENANT,
      CURRENTBANDWIDTH,
      TOTALDATA,
      SESSIONCOUNT,
    } = TOPSOURCES_TABLE_SIZING

    return (
      <div className={'hosts-table--tr'}>
        <this.TableItem title={ip} width={IP} />
        <this.TableItem title={tenant} width={TENANT} />
        <this.TableItem title={transBytes(totalData, 2)} width={TOTALDATA} />
        <this.TableItem title={sessionCount} width={SESSIONCOUNT} />
        <this.TableItem
          title={transBps(currentBandwidth * 8, 2)}
          width={CURRENTBANDWIDTH}
        />
      </div>
    )
  }
}

export default TopSourcesTableRow
