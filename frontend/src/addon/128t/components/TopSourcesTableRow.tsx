import React, {PureComponent} from 'react'
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

  private unitIndicator = (value: string | number): JSX.Element => {
    const divider = String(value).split(' ')
    return (
      <>
        {divider[0]}
        <span
          style={{
            width: '50px',
          }}
        >
          <span
            style={{
              padding: '1px 5px',
              borderRadius: '5px',
              background: '#313131',
              textAlign: 'left',
              marginLeft: '5px',
              fontSize: '10px',
              border: '1px solid #a1a1a1',
            }}
          >
            {divider[1]}
          </span>
        </span>
      </>
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
      <div
        className={'hosts-table--tr'}
        style={{borderBottom: '1px solid #353535'}}
      >
        <this.TableItem title={ip} width={IP} className={'align--start'} />
        <this.TableItem title={tenant} width={TENANT} className={''} />
        <this.TableItem
          title={sessionCount}
          width={SESSIONCOUNT}
          className={'align--end'}
        />
        <this.TableItem
          title={this.unitIndicator(transBps(currentBandwidth * 8, 2))}
          width={CURRENTBANDWIDTH}
          className={'align--end'}
        />
        <this.TableItem
          title={this.unitIndicator(transBytes(totalData, 2))}
          width={TOTALDATA}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default TopSourcesTableRow
