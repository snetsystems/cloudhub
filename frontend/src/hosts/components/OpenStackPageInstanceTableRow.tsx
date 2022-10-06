// libraries
import React, {FunctionComponent} from 'react'
import _ from 'lodash'
import {Link} from 'react-router'

// types
import {OPENSATCK_TABLE_SIZING} from 'src/hosts/constants/tableSizing'
import {OpenStackInstance} from 'src/hosts/types/openstack'

// components
import {OpenStackPage} from 'src/hosts/containers/OpenStackPage'

interface Props {
  sourceID: string
  instance: Partial<OpenStackInstance>
  focusedInstance: Partial<OpenStackInstance>
  onClickTableRow: OpenStackPage['handleClickInstanceTableRow']
  onMouseOver: any
  onMouseLeave: any
}

const OpenStackPageInstanceTableRow: FunctionComponent<Props> = ({
  instance,
  sourceID,
  focusedInstance,
  onClickTableRow,
  onMouseOver,
  onMouseLeave,
}) => {
  const {
    instanceId,
    instanceName,
    imageName,
    ipAddress,
    flavor,
    keyPair,
    status,
    availability,
    zone,
    task,
    powerState,
    age,
  } = instance

  const {
    InstanceNameWidth,
    ImageNameWidth,
    IpAddressWidth,
    FlavorWidth,
    KeyPairWidth,
    StatusWidth,
    AvailabilityWidth,
    ZoneWidth,
    TaskWidth,
    PowerStateWidth,
    AgeWidth,
  } = OPENSATCK_TABLE_SIZING

  const focusedClasses = (): string => {
    if (instanceId === _.get(focusedInstance, 'instanceId'))
      return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  return (
    <div
      className={focusedClasses()}
      onClick={onClickTableRow(instance as OpenStackInstance)}
    >
      <div className="hosts-table--td" style={{width: InstanceNameWidth}}>
        <Link
          to={`/sources/${sourceID}/infrastructure/details/${instanceName}`}
        >
          {instanceName}
        </Link>
      </div>

      <div className="hosts-table--td" style={{width: ImageNameWidth}}>
        {imageName}
      </div>
      <div className="hosts-table--td" style={{width: IpAddressWidth}}>
        {ipAddress}
      </div>
      <div className="hosts-table--td" style={{width: FlavorWidth}}>
        <span
          data-instance-id={instanceId}
          data-vcpus={1}
          data-ram={1024}
          data-size={500}
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
      <div className="hosts-table--td" style={{width: AvailabilityWidth}}>
        {availability}
      </div>
      <div className="hosts-table--td" style={{width: ZoneWidth}}>
        {zone}
      </div>
      <div className="hosts-table--td" style={{width: TaskWidth}}>
        {task}
      </div>
      <div className="hosts-table--td" style={{width: PowerStateWidth}}>
        {powerState}
      </div>
      <div className="hosts-table--td" style={{width: AgeWidth}}>
        {age}
      </div>
    </div>
  )
}

export default OpenStackPageInstanceTableRow
