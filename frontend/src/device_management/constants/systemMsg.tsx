import React from 'react'

export const MONITORING_MODAL_INFO = {
  returnMessage: (
    <>The monitoring process for the requested device has been initiated.</>
  ),
  monitoringMessage: (
    <>
      This action will{' '}
      <label className="label-warning">pause data collection </label>for about 1
      minute. Would you like to{' '}
      <label className="label-info--apply">apply</label>?
    </>
  ),
  learningMessage: (
    <>
      If you click the <label className="label-info--apply">Apply</label>{' '}
      button, <label className="label-warning">Learning Enable Status</label>{' '}
      will be updated.
    </>
  ),
  deleteMonitoringMessage: (
    <span className="span-header">
      <label className="label-warning">
        Device you selected is in monitoring status
      </label>
      . Are you sure you want to <label className="label-warning">delete</label>{' '}
      it?
    </span>
  ),
  deleteGeneralMessage: (
    <span className="span-header">
      Are you sure you want to <label className="label-warning">delete</label>{' '}
      the selected device?
    </span>
  ),
  ML_DL_SettingNetworkDeviceOrganizationNotCreated: (
    <>
      <>
        You need to create a
        <label className="label-warning"> network device organization </label>
        first.
      </>
    </>
  ),
  ML_DL_SettingKapacitorEmpty: (
    <>
      There is <label className="label-warning">0 kapacitor </label>to configure
      ML/DL Setting.
    </>
  ),
  ML_DL_SettingKapacitorInvalid: (
    <>
      Kapacitor
      <label className="label-warning">
        {' '}
        has been deleted or not registered.{' '}
      </label>
      Please
      <label className="label-warning"> update </label>
      the Kapacitor.
    </>
  ),
}
