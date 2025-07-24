import React, {useEffect, useMemo, useState} from 'react'
import {
  Me,
  Organization,
  DeviceMapping,
  BaseElasticSearchData,
  DeviceMeta,
} from 'src/types'
import {mappingTableColumns} from 'src/admin/constants/mappingTableColumns'
import TableComponent from 'src/device_management/components/TableComponent'
import {connect} from 'react-redux'
import {
  deleteDeviceMapping,
  fetchDeviceList,
  updateDeviceMapping,
} from '../apis/deviceMapping'
import _ from 'lodash'
import {NewDeviceTable} from './NewDeviceTable'

interface Props {
  me: Me
  meCurrentOrganization: Organization
  esSource: BaseElasticSearchData
  organizations?: Organization[]
}

function DevicesMappingPage({
  me,
  meCurrentOrganization,
  esSource,
  organizations,
}: Props) {
  const [newDevice, setNewDevice] = useState<DeviceMeta[]>([])

  const [mappingList, setMappingList] = useState<DeviceMapping>({
    unmappedDevices: [],
    mappedDevices: [],
  })

  useEffect(() => {
    if (esSource) {
      getDeviceList(esSource.id)
    }
  }, [esSource])

  const getDeviceList = async (esSourceId: string) => {
    const response = await fetchDeviceList(esSourceId)

    let tempAry: DeviceMapping = {
      unmappedDevices: [],
      mappedDevices: [],
    }

    Object.keys(response).forEach(org => {
      if (org === 'default') {
        tempAry['unmappedDevices'] = response[org]
      } else {
        tempAry['mappedDevices'] = [
          ...(tempAry?.['mappedDevices'] || []),
          ...response[org],
        ]
      }
    })

    const reordered = (({unmappedDevices, mappedDevices}) => ({
      mappedDevices,
      unmappedDevices,
    }))(tempAry)

    console.log('reordered', reordered)

    setMappingList(reordered)
  }

  const setMappingInfo = async (
    hostName: string,
    org: string,
    aliasName: string,
    deviceType: string,
    ip: string
  ) => {
    if (!me.superAdmin) return

    //todo: change org api call
    await updateDeviceMapping(
      hostName,
      {
        aliasName,
        deviceType,
        ip,
        orgId: org,
      },
      organizations
    )

    getDeviceList(esSource.id)
  }

  const addDevice = async () => {
    const dummyDevice = {
      hostname: '',
      aliasName: '',
      deviceType: '',
      ip: '',
      orgId: 'default',
      isDeletable: false,
    }
    setNewDevice([dummyDevice])
  }

  const deleteDevice = async (hostName: string) => {
    await deleteDeviceMapping(hostName)
    getDeviceList(esSource.id)
  }

  const onChangeAlias = (
    e: React.ChangeEvent<HTMLInputElement>,
    rowData: DeviceMeta,
    rowIndex: number
  ) => {
    const {value} = e.target
    const tempAry = _.cloneDeep(mappingList)

    if (rowData.orgId === 'default') {
      tempAry.unmappedDevices[rowIndex].aliasName = value
    } else {
      tempAry.mappedDevices[rowIndex].aliasName = value
    }

    setMappingList(tempAry)
    debouncedSetOrg(value, rowData)
  }

  const debouncedSetOrg = useMemo(
    () =>
      _.debounce((aliasName: string, rowData: DeviceMeta) => {
        setMappingInfo(
          rowData.hostname,
          rowData.orgId,
          aliasName,
          rowData.deviceType,
          rowData.ip
        )
      }, 1000),
    [mappingList]
  )

  return (
    <div className="panel panel-solid">
      <div className="panel-heading">
        <div className="panel-title-right">
          {me.superAdmin && (
            <button className="btn btn-primary" onClick={() => addDevice()}>
              Add Device
            </button>
          )}
        </div>
      </div>
      {newDevice.length > 0 && me.superAdmin && (
        <NewDeviceTable
          newDevice={newDevice}
          setNewDevice={setNewDevice}
          organizations={organizations || []}
          getDeviceList={() => getDeviceList(esSource.id)}
        />
      )}
      {!!mappingList &&
        Object.keys(mappingList).map((type, i) => {
          if (!me.superAdmin && type === 'unmappedDevices') {
            return null
          }
          return (
            <div key={type + i} className="panel-body">
              <TableComponent
                initSort={{
                  key: 'hostname',
                  isDesc: false,
                }}
                tableTitle={
                  type === 'unmappedDevices'
                    ? 'Unmapped Devices'
                    : 'Mapped Devices'
                }
                columns={mappingTableColumns(
                  me,
                  setMappingInfo,
                  deleteDevice,
                  onChangeAlias,
                  organizations || []
                )}
                data={mappingList[type]}
                isSearchDisplay={false}
                bodyClassName={`mapping-table`}
              />
            </div>
          )
        })}
    </div>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {esSource},
    },
    adminCloudHub: {organizations},
  } = state
  return {
    esSource,
    organizations,
  }
}

export default connect(mstp, null)(DevicesMappingPage)
