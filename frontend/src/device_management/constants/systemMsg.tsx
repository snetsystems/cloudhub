import React from 'react'

export const MONITORING_MODAL_INFO = {
  returnMessage: (
    <>The monitoring process for the requested device has been initiated.</>
  ),
  monitoringMessage: (
    <>
      This action will{' '}
      <label className="label-warning">pause data collection </label>for around
      1 minute. Would you like to{' '}
      <label className="label-info--apply">apply</label>?
    </>
  ),
  learningMessage: <></>,
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
      <label className="label-warning">No kapacitors are available</label> for
      configuration.
    </>
  ),
  ML_DL_SettingKapacitorInvalid: (
    <>
      The selected organization
      <label className="label-warning">
        {' '}
        has no devices available for learning.{' '}
      </label>
    </>
  ),
}
