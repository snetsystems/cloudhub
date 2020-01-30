import React from 'react'
import {unitIndicator} from 'src/addon/128t/reusable'
import {TOPSOURCES_TABLE_SIZING} from 'src/addon/128t/constants'
import {TopSource} from 'src/addon/128t/types'
import {transBytes, transBps} from 'src/shared/utils/units'
import {TableBodyRowItem} from 'src/addon/128t/reusable/layout'

interface Props {
  topSources: TopSource
}

const TopSourcesTableRow = ({topSources}: Props) => {
  const {ip, tenant, currentBandwidth, totalData, sessionCount} = topSources

  const {
    IP,
    TENANT,
    CURRENTBANDWIDTH,
    TOTALDATA,
    SESSIONCOUNT,
  } = TOPSOURCES_TABLE_SIZING

  return (
    <div className={'hosts-table--tr'}>
      <TableBodyRowItem title={ip} width={IP} className={'align--start'} />
      <TableBodyRowItem title={tenant} width={TENANT} className={''} />
      <TableBodyRowItem
        title={sessionCount}
        width={SESSIONCOUNT}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={unitIndicator(transBps(currentBandwidth * 8, 2), ' ')}
        width={CURRENTBANDWIDTH}
        className={'align--end'}
      />
      <TableBodyRowItem
        title={unitIndicator(transBytes(totalData, 2), ' ')}
        width={TOTALDATA}
        className={'align--end'}
      />
    </div>
  )
}

export default TopSourcesTableRow
