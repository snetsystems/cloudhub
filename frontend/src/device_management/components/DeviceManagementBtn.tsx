import React from 'react'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {AiModal, DeviceConnectionStatus, DeviceData} from 'src/types'
import SystemConfirmModal from './MonitoringModal'
import {ComponentColor} from 'src/reusable_ui'
import {selectedArrayById} from '../utils'
import {bindActionCreators} from 'redux'
import {closeModal, openModal} from 'src/shared/actions/aiModal'
import {connect} from 'react-redux'
import {SYSTEM_MODAL} from '../constants'

interface Props {
  checkedArray: string[]
  connectDevice: (deviceConnectionStatus?: DeviceConnectionStatus) => () => void
  importDevice: () => void
  openModal?: (aiModal: AiModal) => void
  closeModal?: () => void
  data: DeviceData[]
  getDeviceAJAX: () => Promise<void>
  deleteDevicesAJAX: (idList: string[]) => Promise<void>
}

function DeviceManagementBtn({
  checkedArray,
  connectDevice,
  importDevice,
  openModal,
  closeModal,
  data,
  getDeviceAJAX,
  deleteDevicesAJAX,
}: Props) {
  //   const onClickMonitoring = () => {
  //     //toggle btn issue
  //     // this.setState({monitoringModalVisibility: true})
  //     //Apply Monitoring Process -> close Modal
  //   }

  //   const onClickMonitoringClose = () => {
  //     this.getDeviceAJAX()
  //     // this.setState({monitoringModalVisibility: false})
  //   }

  const openMonitoringModal = (idList: string[]) => {
    const validArray = selectedArrayById(data, idList, 'id')
    //create monitoring sql is_modeling_generated => is_monitoring

    openModal({
      isVisible: true,
      // message: MONITORING_MODAL_INFO.workHeader,
      title: 'Apply Monitoring Confirm',
      message: '',
      btnColor: ComponentColor.Warning,
      onConfirm: () => {
        getDeviceAJAX()
        closeModal()
      },
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onCancel: () => {
        getDeviceAJAX()
        closeModal()
      },
      childNode: (
        <SystemConfirmModal data={validArray} type={SYSTEM_MODAL.MONITORING} />
      ),
    })
  }

  const openLearningModelModal = (idList: string[]) => {
    const validArray = selectedArrayById(data, idList, 'id')
    //create monitoring sql is_modeling_generated => is_monitoring

    openModal({
      isVisible: true,
      // message: MONITORING_MODAL_INFO.workHeader,
      title: 'Edit Learning Model',
      message: '',
      btnColor: ComponentColor.Success,
      onConfirm: () => {
        getDeviceAJAX()
        closeModal()
      },
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onCancel: () => {
        getDeviceAJAX()
        closeModal()
      },
      childNode: (
        <SystemConfirmModal data={validArray} type={SYSTEM_MODAL.LEARNING} />
      ),
    })
  }

  const openDeleteModal = (idList: string[]) => {
    const validArray = selectedArrayById(data, idList, 'id')
    // create monitoring sql is_modeling_generated => is_monitoring

    const isMonitoringInclude = validArray.find(i => i.isMonitoring)

    openModal({
      title: 'Delete Device',
      isVisible: true,
      confirmText: 'Delete',
      btnColor: ComponentColor.Danger,
      onConfirm: () => {
        deleteDevicesAJAX(idList)
        closeModal()
      },
      cancelText: 'Cancel',
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
    <div className="device-management-top left">
      <div className="space-x">
        <Authorized requiredRole={EDITOR_ROLE}>
          <button
            onClick={() => {
              openDeleteModal(checkedArray)
            }}
            className="btn button btn-sm btn-primary"
            disabled={checkedArray.length === 0}
          >
            <span className="icon trash" /> Delete Device
          </button>
        </Authorized>
        {/* TODO Consder requiredRole */}
        <Authorized requiredRole={EDITOR_ROLE}>
          <button
            onClick={() => {
              // onClickMonitoring(checkedArray)
              openMonitoringModal(checkedArray)
            }}
            className="btn button btn-sm btn-primary"
            disabled={checkedArray.length === 0}
          >
            <span className="icon import" /> Apply Monitoring
          </button>
        </Authorized>
        <Authorized requiredRole={EDITOR_ROLE}>
          <button
            onClick={() => {
              openLearningModelModal(checkedArray)
            }}
            className="btn button btn-sm btn-primary"
            disabled={checkedArray.length === 0}
          >
            <span className="icon capacitor2" /> Learning Model
          </button>
        </Authorized>
      </div>
      <div className="space-x">
        <Authorized requiredRole={EDITOR_ROLE}>
          <div className="btn button btn-sm btn-primary">
            <span className="icon computer-desktop" /> Learning Setting
          </div>
        </Authorized>

        <Authorized requiredRole={EDITOR_ROLE}>
          <div
            onClick={connectDevice('Creating')}
            className="btn button btn-sm btn-primary"
          >
            <span className="icon plus" /> Add Device
          </div>
        </Authorized>
        {/* TODO Consder requiredRole */}
        <Authorized requiredRole={EDITOR_ROLE}>
          <div onClick={importDevice} className="btn button btn-sm btn-primary">
            <span className="icon import" /> Import Device
          </div>
        </Authorized>
      </div>
    </div>
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
