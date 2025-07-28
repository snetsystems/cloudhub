import React, {useEffect, useState} from 'react'
import {
  Me,
  Organization,
  DeviceMapping,
  BaseElasticSearchData,
  DeviceMeta,
  Source,
  NotificationAction,
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
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {bindActionCreators} from 'redux'
import {
  notifyDeleteDeviceFailed,
  notifyDeleteDeviceSucceeded,
  notifyFetchDeviceListError,
  notifyUpdateDeviceFailed,
  notifyUpdateDeviceSucceeded,
} from 'src/shared/copy/notifications'

interface Props {
  me: Me
  meCurrentOrganization: Organization
  esSource: BaseElasticSearchData
  organizations?: Organization[]
  currentSource?: Source
  notify?: NotificationAction
}

function DevicesMappingPage({
  me,
  meCurrentOrganization,
  esSource,
  organizations,
  currentSource,
  notify,
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
    try {
      const response = await fetchDeviceList(esSourceId)
      if (response.status < 300) {
        setMappingList(response.data)
      } else {
        notify(notifyFetchDeviceListError(response.data.message))
      }
    } catch (error) {
      notify(notifyFetchDeviceListError(error.message))
    }
  }

  const setMappingInfo = async (device: DeviceMeta) => {
    if (!me.superAdmin) return

    try {
      const response = await updateDeviceMapping(device)
      if (response.status < 300) {
        notify(notifyUpdateDeviceSucceeded())
      } else {
        notify(notifyUpdateDeviceFailed(response.data.message))
      }
    } catch (error) {
      notify(notifyUpdateDeviceFailed(error.message))
    }
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
      vendor: '',
    }
    setNewDevice([dummyDevice])
  }

  const deleteDevice = async (hostName: string) => {
    try {
      const response = await deleteDeviceMapping(hostName)
      if (response.status < 300) {
        notify(notifyDeleteDeviceSucceeded())
      } else {
        console.log('response: ', response)
        notify(notifyDeleteDeviceFailed(response.data.message ?? ''))
      }
    } catch (error) {
      console.log('error: ', error)
      notify(notifyDeleteDeviceFailed(error.message ?? ''))
    }

    getDeviceList(esSource.id)
  }

  const onChangeAlias = (value: string, rowData: DeviceMeta, key: string) => {
    const tempAry = _.cloneDeep(mappingList)
    const valueText = value
    const rowIndex = tempAry[rowData.orgId].findIndex(
      (item: DeviceMeta) => item.hostname === rowData.hostname
    )

    if (rowIndex === -1) {
      return
    }

    tempAry[rowData.orgId][rowIndex][key] = valueText
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
        </div>
      </div>
      {newDevice.length > 0 && me.superAdmin && (
        <NewDeviceTable
          newDevice={newDevice}
          setNewDevice={setNewDevice}
          organizations={organizations || []}
          getDeviceList={() => getDeviceList(esSource.id)}
          notify={notify}
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
                options={{
                  tbodyRow: {
                    className: 'table-row',
                  },
                }}
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

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(DevicesMappingPage)
