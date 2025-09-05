// react
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

// src
import {mappingTableColumns} from 'src/admin/constants/mappingTableColumns'
import TableComponent from 'src/device_management/components/TableComponent'

// redux
import {connect} from 'react-redux'

// apis
import {
  deleteDeviceMapping,
  fetchDeviceList,
  updateDeviceMapping,
} from 'src/admin/apis/deviceMapping'

// components
import {NewDeviceTable} from './NewDeviceTable'

// utils
import _ from 'lodash'
import {orgIdToName} from 'src/admin/utils/deviceMapping'
import {useDeviceType} from 'src/log_analysis/hooks/useDeviceType'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {bindActionCreators} from 'redux'
import {
  notifyDeleteDeviceFailed,
  notifyDeleteDeviceSucceeded,
  notifyFetchDeviceListError,
  notifyUpdateDeviceFailed,
  notifyUpdateDeviceSucceeded,
} from 'src/shared/copy/notifications'
import {InjectedRouter, WithRouterProps} from 'react-router'

interface Props extends WithRouterProps {
  me: Me
  esSource: BaseElasticSearchData
  organizations?: Organization[]
  notify?: NotificationAction
  links?: any
  source?: Source
  router: InjectedRouter
}

function DevicesMappingPage({
  me,
  esSource,
  organizations,
  notify,
  links,
  source,
  router,
}: Props): JSX.Element {
  const devMode = links.addons.find(addon => addon.name == 'dev')?.url || 'off'

  const allTagValues = useDeviceType(source)

  const [newDevice, setNewDevice] = useState<DeviceMeta[]>([])

  const [mappingList, setMappingList] = useState<DeviceMapping>({
    default: [],
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
      notify(notifyFetchDeviceListError(error.data.message ?? ''))
    }
  }

  const setMappingInfo = async (device: DeviceMeta) => {
    if (!me.superAdmin) return

    try {
      const response = await updateDeviceMapping(device)
      if (response.status < 300) {
        notify(notifyUpdateDeviceSucceeded())
      } else {
        notify(notifyUpdateDeviceFailed(response.data.message ?? ''))
      }
    } catch (error) {
      notify(notifyUpdateDeviceFailed(error.data.message ?? ''))
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
    }
    setNewDevice([dummyDevice])
  }

  const deleteDevice = async (hostName: string) => {
    try {
      const response = await deleteDeviceMapping(hostName)
      if (response.status < 300) {
        notify(notifyDeleteDeviceSucceeded())
      } else {
        notify(notifyDeleteDeviceFailed(response.data.message ?? ''))
      }
    } catch (error) {
      notify(notifyDeleteDeviceFailed(error.data.message ?? ''))
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

    setMappingInfo(tempAry[rowData.orgId][rowIndex])
  }

  return (
    <>
      {!!esSource ? (
        <div className="panel panel-solid">
          <div className="panel-heading">
            <div className="panel-title-right">
              {me.superAdmin && devMode === 'on' && (
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
              if (!me.superAdmin && org !== me.currentOrganization.id) {
                return null
              }
              return (
                <div key={org + i} className="panel-body">
                  <TableComponent
                    initSort={{
                      key: 'hostname',
                      isDesc: false,
                    }}
                    isSearchDisplay={true}
                    searchPlaceholder="Search here..."
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
                    bodyClassName={`mapping-table`}
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
      ) : (
        <div className="panel panel-solid">
          <div className="panel-heading">
            <h2 className="panel-title">No ES Source Connected</h2>
          </div>
          {me.superAdmin ? (
            <div className="no-es-source">
              <button
                className="btn btn-primary"
                onClick={() =>
                  router.push(
                    `/sources/${source.id}/manage-sources?esPopup=true`
                  )
                }
              >
                Connect ElasticSearch Source
              </button>
            </div>
          ) : (
            <div className="no-es-source">
              <h2 className="panel-title">
                No connected Elasticsearch source found. Please contact your
                administrator or operator.
              </h2>
            </div>
          )}
        </div>
      )}
    </>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {esSource},
    },
    adminCloudHub: {organizations},
    links,
  } = state
  return {
    esSource,
    organizations,
    links,
  }
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(DevicesMappingPage)
