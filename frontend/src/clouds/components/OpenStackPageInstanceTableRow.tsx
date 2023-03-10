// libraries
import React, {FunctionComponent} from 'react'
import _ from 'lodash'

// types
import {OPENSATCK_TABLE_SIZING} from 'src/clouds/constants/tableSizing'
import {FocusedInstance, OpenStackInstance} from 'src/clouds/types/openstack'

// components
import {OpenStackPage} from 'src/clouds/containers/OpenStackPage'

interface Props {
  sourceID: string
  instance: Partial<OpenStackInstance>
  focusedInstance: Partial<FocusedInstance>
  onClickTableRow: OpenStackPage['handleClickInstanceTableRow']
  onMouseOver: any
  onMouseLeave: any
}

const OpenStackPageInstanceTableRow: FunctionComponent<Props> = ({
  instance,
  focusedInstance,
  onClickTableRow,
  onMouseOver,
  onMouseLeave,
}) => {
  const {
    instanceId,
    instanceName,
    ipAddress,
    flavor,
    keyPair,
    status,
    availabilityZone,
    task,
    powerState,
    age,
    flavorDetail,
  } = instance

  const {
    InstanceNameWidth,
    IpAddressWidth,
    FlavorWidth,
    KeyPairWidth,
    StatusWidth,
    AvailabilityZoneWidth,
    TaskWidth,
    PowerStateWidth,
    AgeWidth,
  } = OPENSATCK_TABLE_SIZING

  const focusedClasses = (): string => {
    if (instanceId === focusedInstance.instanceId)
      return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  return (
    <div
      className={focusedClasses()}
      onClick={onClickTableRow(instance as OpenStackInstance)}
    >
      <div className="hosts-table--td" style={{width: InstanceNameWidth}}>
        {instanceName}
      </div>

      <div className="hosts-table--td" style={{width: IpAddressWidth}}>
        {ipAddress}
      </div>
      <div className="hosts-table--td" style={{width: FlavorWidth}}>
        <span
          data-instance-id={flavorDetail.id}
          data-vcpus={flavorDetail.vcpus}
          data-ram={flavorDetail.ram}
          data-size={flavorDetail.size}
          data-flavor={flavor}
          className={`hosts-table-item`}
          onMouseOver={onMouseOver}
          onMouseLeave={onMouseLeave}
        >
          {flavor}
        </span>
      </div>
      <div className="hosts-table--td" style={{width: KeyPairWidth}}>
        {keyPair}
      </div>
      <div className="hosts-table--td" style={{width: StatusWidth}}>
        {status}
      </div>
      <div className="hosts-table--td" style={{width: AvailabilityZoneWidth}}>
        {availabilityZone}
      </div>
      <div className="hosts-table--td" style={{width: TaskWidth}}>
        {task}
      </div>
      <div className="hosts-table--td" style={{width: PowerStateWidth}}>
        {powerState}
      </div>
      <div className="hosts-table--td" style={{width: AgeWidth}}>
        <span style={{wordSpacing: '-3px'}}>{age}</span>
      </div>
    </div>
  )
}

export default OpenStackPageInstanceTableRow
