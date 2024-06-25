import React from 'react'

export const MONITORING_MODAL_INFO = {
  returnMessage: (
    <>The monitoring process for the requested device has been initiated.</>
  ),
  workHeader: <>Here is the Device List you requested.</>,
  monitoringMessage: (
    <span className="span-header">
      This action will{' '}
      <label className="label-warning">pause data collection </label>for about 1
      minute. Would you like to <label className="label-warning">apply</label>?
    </span>
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
}
