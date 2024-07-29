import React from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

import {
  AiModal,
  DeviceConnectionStatus,
  DeviceData,
  DeviceOrganizationStatus,
  Me,
} from 'src/types'
import {ADMIN_ROLE, isUserAuthorized} from 'src/auth/Authorized'
import SystemConfirmModal from 'src/device_management/components/MonitoringModal'
import {ComponentColor} from 'src/reusable_ui'
import {
  hasMonitoringDevice,
  checkNetworkDeviceOrganizationStatus,
  selectedArrayById,
} from 'src/device_management/utils'
import {closeModal, openModal} from 'src/shared/actions/aiModal'

import {SYSTEM_MODAL} from 'src/device_management/constants'

interface Props {
  checkedArray: string[]
  data: DeviceData[]
  networkDeviceOrganizationStatus: DeviceOrganizationStatus
  me: Me
  connectDevice: (deviceConnectionStatus?: DeviceConnectionStatus) => () => void
  importDevice: () => void
  openModal?: (aiModal: AiModal) => void
  closeModal?: () => void
  reLearnSetting: () => void
  deleteDevicesAJAX: (idList: string[]) => Promise<void>
  onOpenApplyMonitoringModal: () => void
  onOpenLearningModelModal: () => void
}

function DeviceManagementBtn({
  checkedArray,
  connectDevice,
  importDevice,
  openModal,
  closeModal,
  data,
  networkDeviceOrganizationStatus,
  me,
  deleteDevicesAJAX,
  reLearnSetting,
  onOpenApplyMonitoringModal,
  onOpenLearningModelModal,
}: Props) {
  const selectedDevices = selectedArrayById(data, checkedArray, 'id')
  const isSelectedOrganizationStatusValid = checkNetworkDeviceOrganizationStatus(
    selectedDevices,
    networkDeviceOrganizationStatus
  )
  const isAdminRole = isUserAuthorized(me.role, ADMIN_ROLE)

  const openDeleteModal = (idList: string[]) => {
    const validArray = selectedArrayById(data, idList, 'id')
    const isMonitoringInclude = hasMonitoringDevice(validArray)

    openModal({
      title: 'Delete Device',
      isVisible: true,
      confirmText: 'Delete',
      btnColor: ComponentColor.Danger,
      onConfirm: () => {
        deleteDevicesAJAX(idList)
        closeModal()
      },
      cancelText: 'Close',
      childNode: (
        <div className="device-modal--childNode">
          <>
            <SystemConfirmModal
              data={validArray}
              type={
                isMonitoringInclude
                  ? SYSTEM_MODAL.MONITORING_DELETE
                  : SYSTEM_MODAL.DELETE
              }
            />
          </>
        </div>
      ),
    })
  }

  return (
    <>
      {isAdminRole && (
        <div className="device-management-top left">
          <div className="space-x">
            <button
              onClick={() => {
                openDeleteModal(checkedArray)
              }}
              className="btn button btn-sm btn-primary"
              disabled={checkedArray.length === 0}
              title="Delete Device"
            >
              <span className="icon trash" /> Delete Device
            </button>

            <button
              onClick={() => {
                onOpenApplyMonitoringModal()
              }}
              className="btn button btn-sm btn-primary"
              disabled={checkedArray.length === 0}
              title="Apply Monitoring"
            >
              <span className="icon checkmark" /> Apply Monitoring
            </button>

            <button
              onClick={() => {
                onOpenLearningModelModal()
              }}
              className="btn button btn-sm btn-primary"
              disabled={
                checkedArray.length === 0 || !isSelectedOrganizationStatusValid
              }
              title="Learning Model"
            >
              <span className="icon capacitor2" /> Learning Model
            </button>

            <button
              className={`button button-sm button-default button-square ${
                isSelectedOrganizationStatusValid
                  ? ''
                  : 'learning-model--invalid'
              }`}
              title="Custom Learning Setting"
              onClick={() => {
                reLearnSetting()
              }}
            >
              <span className="button-icon icon cog-thick"></span>
            </button>
          </div>
          <div className="space-x">
            <div
              onClick={connectDevice('Creating')}
              className="btn button btn-sm btn-primary"
              title="Add Device"
            >
              <span className="icon plus" /> Add Device
            </div>

            <div
              onClick={importDevice}
              className="btn button btn-sm btn-primary"
              title="Import Device"
            >
              <span className="icon import" /> Import Device
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const mstp = ({adminCloudHub: {organizations}, auth, links}) => ({
  organizations,
  auth,
  me: auth.me,
  links,
})

const mdtp = (dispatch: any) => ({
  openModal: bindActionCreators(openModal, dispatch),
  closeModal: bindActionCreators(closeModal, dispatch),
})

export default connect(mstp, mdtp, null)(DeviceManagementBtn)
