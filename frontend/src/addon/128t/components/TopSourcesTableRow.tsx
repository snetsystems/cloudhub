import React, {PureComponent} from 'react'
import {unitIndicator} from 'src/addon/128t/reusable'
import {TOPSOURCES_TABLE_SIZING} from 'src/addon/128t/constants'
import {TopSource} from 'src/addon/128t/types'
import {transBytes, transBps} from 'src/shared/utils/units'

interface Props {
  topSources: TopSource
}

class TopSourcesTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  private TableItem = ({width, title, className}) => {
    return (
      <div className={`hosts-table--td ${className}`} style={{width: width}}>
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
        <this.TableItem title={ip} width={IP} className={'align--start'} />
        <this.TableItem title={tenant} width={TENANT} className={''} />
        <this.TableItem
          title={sessionCount}
          width={SESSIONCOUNT}
          className={'align--end'}
        />
        <this.TableItem
          title={unitIndicator(transBps(currentBandwidth * 8, 2), ' ')}
          width={CURRENTBANDWIDTH}
          className={'align--end'}
        />
        <this.TableItem
          title={unitIndicator(transBytes(totalData, 2), ' ')}
          width={TOTALDATA}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default TopSourcesTableRow
