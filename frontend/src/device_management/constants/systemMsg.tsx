import React from 'react'

export const MONITORING_MODAL_INFO = {
  returnMessage: (
    <>The monitoring process for the requested device has been initiated.</>
  ),
  workHeader: <>Here is the Device List you requested.</>,
  monitoringMessage: (
    <>
      This action will{' '}
      <label className="label-warning">pause data collection </label>for about 1
      minute. Would you like to{' '}
      <label className="label-warning">continue</label>?
    </>
  ),
  learningMessage: <></>,
  deleteMonitoringMessage: (
    <>
      <label className="label-warning">
        Device you selected is in monitoring status
      </label>
      . Are you sure you want to <label className="label-warning">delete</label>{' '}
      it?
    </>
  ),
  deleteGeneralMessage: (
    <>
      Are you sure you want to <label className="label-warning">delete</label>{' '}
      the selected device?
    </>
  ),
}
