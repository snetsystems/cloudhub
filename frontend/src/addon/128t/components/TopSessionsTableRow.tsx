import React, {PureComponent} from 'react'
import {TOPSESSIONS_TABLE_SIZING} from 'src/addon/128t/constants'
import {TopSession} from 'src/addon/128t/types'

interface Props {
  topSessions: TopSession[]
}

class TopSessionsTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
    console.log(props)
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
      service,
      tenant,
      value,
      protocol,
      source,
      destination,
    } = this.props.topSessions

    const {
      TOPSESSION_SERVICE,
      TOPSESSION_TENANT,
      TOPSESSION_VALUE,
      TOPSESSION_PROTOCOL,
      TOPSESSION_SOURCE_ADDRESS,
      TOPSESSION_SOURCE_PORT,
      TOPSESSION_DESTINATION_ADDRESS,
      TOPSESSION_DESTINATION_PORT,
    } = TOPSESSIONS_TABLE_SIZING

    return (
      <div
        className={'hosts-table--tr'}
        style={{borderBottom: '1px solid #353535'}}
      >
        <this.TableItem
          title={service}
          width={TOPSESSION_SERVICE}
          className={'align--start'}
        />
        <this.TableItem
          title={tenant}
          width={TOPSESSION_TENANT}
          className={''}
        />

        <this.TableItem
          title={value}
          width={TOPSESSION_VALUE}
          className={'align--end'}
        />
        <this.TableItem
          title={protocol}
          width={TOPSESSION_PROTOCOL}
          className={'align--start'}
        />
        <this.TableItem
          title={source.address}
          width={TOPSESSION_SOURCE_ADDRESS}
          className={'align--end'}
        />
        <this.TableItem
          title={source.port}
          width={TOPSESSION_SOURCE_PORT}
          className={'align--end'}
        />
        <this.TableItem
          title={destination.address}
          width={TOPSESSION_DESTINATION_ADDRESS}
          className={'align--end'}
        />
        <this.TableItem
          title={destination.port}
          width={TOPSESSION_DESTINATION_PORT}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default TopSessionsTableRow
