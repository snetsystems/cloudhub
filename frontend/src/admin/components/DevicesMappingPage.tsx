import React, {useEffect, useMemo, useState} from 'react'
import {
  Me,
  Organization,
  DeviceMapping,
  BaseElasticSearchData,
  DeviceMeta,
  Source,
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
import {orgIdToName} from '../utils/deviceMapping'
import {useDeviceType} from 'src/log_analysis/hooks/useDeviceType'
import useDebounce from 'src/hooks/useDebounce'

interface Props {
  me: Me
  meCurrentOrganization: Organization
  esSource: BaseElasticSearchData
  organizations?: Organization[]
  currentSource?: Source
}

function DevicesMappingPage({
  me,
  meCurrentOrganization,
  esSource,
  organizations,
  currentSource,
}: Props) {
  const allTagValues = useDeviceType(currentSource)

  const [isStyleChanged, setIsStyleChanged] = useState(false)

  const [newDevice, setNewDevice] = useState<DeviceMeta[]>([])

  const [mappingList, setMappingList] = useState<DeviceMapping>({
    default: [],
  })

  const debouncedSetOrg = useDebounce({
    callback: (device: DeviceMeta) => {
      setMappingInfo(device)
    },
    delay: 1000,
  })

  useEffect(() => {
    if (esSource) {
      getDeviceList(esSource.id)
    }
  }, [esSource])

  const getDeviceList = async (esSourceId: string) => {
    const response = await fetchDeviceList(esSourceId)

    // Object.keys(response).forEach(org => {
    //   if (org === 'default') {
    //     tempAry['unmappedDevices'] = response[org]
    //   } else {
    //     tempAry['mappedDevices'] = [
    //       ...(tempAry?.['mappedDevices'] || []),
    //       ...response[org],
    //     ]
    //   }
    // })

    // const reordered = (({unmappedDevices, mappedDevices}) => ({
    //   mappedDevices,
    //   unmappedDevices,
    // }))(tempAry)

    // console.log('reordered', reordered)

    setMappingList(response)
  }

  const setMappingInfo = async (device: DeviceMeta) => {
    if (!me.superAdmin) return

    //todo: 빈배열 지우기
    await updateDeviceMapping(device)

    await getDeviceList(esSource.id)
  }

  const addDevice = async () => {
    const dummyDevice = {
      hostname: '',
      aliasName: '',
      deviceType: '',
      ip: '',
      orgId: 'default',
      isDeletable: false,
      vendor: '',
    }
    setNewDevice([dummyDevice])
  }

  const deleteDevice = async (hostName: string) => {
    await deleteDeviceMapping(hostName)
    getDeviceList(esSource.id)
  }

  const onChangeAlias = (
    value: string,
    rowData: DeviceMeta,
    rowIndex: number,
    key: string
  ) => {
    const tempAry = _.cloneDeep(mappingList)

    tempAry[rowData.orgId][rowIndex][key] = value

    setMappingList(tempAry)

    debouncedSetOrg(tempAry[rowData.orgId][rowIndex])
  }

  return (
    <div className="panel panel-solid">
      <div className="panel-heading">
        <div className="panel-title-right">
          {me.superAdmin && (
            <button className="btn btn-primary" onClick={() => addDevice()}>
              Add Device
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setIsStyleChanged(!isStyleChanged)}
          >
            Change Style
          </button>
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
        Object.keys(mappingList).map((org, i) => {
          if (
            !me.superAdmin &&
            org !== orgIdToName(me.currentOrganization.id, organizations || [])
          ) {
            return null
          }
          return (
            <div key={org + i} className="panel-body">
              <TableComponent
                initSort={{
                  key: 'hostname',
                  isDesc: false,
                }}
                tableTitle={orgIdToName(org, organizations || [])}
                columns={mappingTableColumns(
                  me,
                  setMappingInfo,
                  deleteDevice,
                  onChangeAlias,
                  organizations || [],
                  allTagValues
                )}
                data={mappingList[org]}
                isSearchDisplay={false}
                bodyClassName={`${
                  isStyleChanged ? 'mapping-table-2' : 'mapping-table'
                }`}
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
    sources: {sourceID},
    adminCloudHub: {organizations},
    logs: {currentSource},
  } = state
  return {
    esSource,
    organizations,
    sourceID,
    currentSource,
  }
}

export default connect(mstp, null)(DevicesMappingPage)
