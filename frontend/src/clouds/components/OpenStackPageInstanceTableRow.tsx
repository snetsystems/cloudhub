// libraries
import React, {FunctionComponent} from 'react'
import _ from 'lodash'
import {Link} from 'react-router'

// types
import {OPENSATCK_TABLE_SIZING} from 'src/clouds/constants/tableSizing'
import {OpenStackInstance} from 'src/clouds/types/openstack'

// components
import {OpenStackPage} from 'src/clouds/containers/OpenStackPage'

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
    availabilityZone,
    task,
    powerState,
    age,
    flaverDetail,
  } = instance

  const {
    InstanceNameWidth,
    ImageNameWidth,
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
          data-instance-id={flaverDetail.id}
          data-vcpus={flaverDetail.vcpus}
          data-ram={flaverDetail.ram}
          data-size={flaverDetail.size}
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
        {age}
      </div>
    </div>
  )
}

export default OpenStackPageInstanceTableRow