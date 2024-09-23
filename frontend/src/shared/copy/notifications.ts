// All copy for notifications should be stored here for easy editing
// and ensuring stylistic consistency
import {Notification} from 'src/types'
import {TemplateUpdate} from 'src/types/tempVars'

type NotificationExcludingMessage = Pick<
  Notification,
  Exclude<keyof Notification, 'message'>
>

import {FIVE_SECONDS, TEN_SECONDS, INFINITE} from 'src/shared/constants/index'

export const defaultErrorNotification: NotificationExcludingMessage = {
  type: 'error',
  icon: 'alert-triangle',
  duration: TEN_SECONDS,
  isHasHTML: false,
}

export const defaultSuccessNotification: NotificationExcludingMessage = {
  type: 'success',
  icon: 'checkmark',
  duration: FIVE_SECONDS,
  isHasHTML: false,
}

export const defaultDeletionNotification: NotificationExcludingMessage = {
  type: 'primary',
  icon: 'trash',
  duration: FIVE_SECONDS,
  isHasHTML: false,
}

//  Misc Notifications
//  ----------------------------------------------------------------------------
export const notifyGenericFail = (): string =>
  'Could not communicate with server.'

export const notifyNewVersion = (version: string): Notification => ({
  type: 'info',
  icon: '_snet--logo',
  duration: INFINITE,
  message: `Welcome to the latest CloudHub (${version}). Local settings cleared.`,
})

export const notifyLoadLocalSettingsFailed = (error: string): Notification => ({
  ...defaultErrorNotification,
  message: `Loading local settings failed: ${error}`,
})

export const notifyErrorWithAltText = (
  type: string,
  message: string
): Notification => ({
  type,
  icon: 'triangle',
  duration: TEN_SECONDS,
  message,
})

export const notifyPresentationMode = (): Notification => ({
  type: 'primary',
  icon: 'expand-b',
  duration: 7500,
  message: 'Press ESC to exit Presentation Mode.',
})

export const notifyDataWritten = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Data was written successfully.',
})

export const notifyDataWriteFailed = (errorMessage: string): Notification => ({
  ...defaultErrorNotification,
  message: `Data write failed: ${errorMessage}`,
})

export const notifySessionTimedOut = (): Notification => ({
  type: 'primary',
  icon: 'triangle',
  duration: INFINITE,
  message: 'Your session has timed out. Log in again to continue.',
})

export const notifyHttpErrorRespose = (
  status: number,
  errorMessage: string = ''
): Notification => ({
  ...defaultErrorNotification,
  message: `Sever ${status} error: ${errorMessage}.`,
})

export const notifyServerError: Notification = {
  ...defaultErrorNotification,
  message: 'Internal Server Error. Check API Logs.',
}

export const notifyCouldNotRetrieveKapacitors = (
  sourceID: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Internal Server Error. Could not retrieve Kapacitor Connections for source ${sourceID}.`,
})

export const notifyCouldNotRetrieveKapacitorServices = (
  kapacitor: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Internal Server Error. Could not retrieve services for Kapacitor ${kapacitor}`,
})

export const notifyCouldNotDeleteKapacitor = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Internal Server Error. Could not delete Kapacitor Connection.',
})

export const notifyCSVDownloadFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Unable to download .CSV file',
})

export const notifyCSVUploadFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Please upload a .csv file',
})

export const analyzeQueryFailed: Notification = {
  ...defaultErrorNotification,
  message: 'Failed to analyze query.',
}

//  Hosts Page Notifications
//  ----------------------------------------------------------------------------
export const notifyUnableToGetHosts = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Unable to get Hosts.',
})

export const notifyUnableToGetApps = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Unable to get Apps for Hosts.',
})

//  InfluxDB Sources Notifications
//  ----------------------------------------------------------------------------
export const notifySourceConnectionSucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Connected to InfluxDB ${sourceName} successfully.`,
})

export const notifySourceCreationFailed = (
  sourceName: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  icon: 'server2',
  message: `Unable to connect to InfluxDB ${sourceName}: ${errorMessage}`,
})

export const notifySourceUpdateFailed = (
  sourceName: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  icon: 'server2',
  message: `Failed to update InfluxDB ${sourceName} Connection: ${errorMessage}`,
})

export const notifySourceDeleted = (sourceName: string): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `${sourceName} deleted successfully.`,
})

export const notifySourceDeleteFailed = (sourceName: string): Notification => ({
  ...defaultErrorNotification,
  icon: 'server2',
  message: `There was a problem deleting ${sourceName}.`,
})

export const notifySourceNoLongerAvailable = (
  sourceName: string
): Notification => ({
  ...defaultErrorNotification,
  icon: 'server2',
  message: `Source ${sourceName} is no longer available. Please ensure InfluxDB is running.`,
})

export const notifyErrorConnectingToSource = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  icon: 'server2',
  message: `Unable to connect to InfluxDB source: ${errorMessage}`,
})

//  Multitenancy User Notifications
//  ----------------------------------------------------------------------------
export const notifyUserRemovedFromAllOrgs = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message:
    'You have been removed from all organizations. Please contact your administrator.',
})

export const notifyUserRemovedFromCurrentOrg = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: 'You were removed from your current organization.',
})

export const notifyOrgHasNoSources = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: 'Organization has no sources configured.',
})

export const notifyUserSwitchedOrgs = (
  orgName: string,
  roleName: string
): Notification => ({
  ...defaultSuccessNotification,
  type: 'primary',
  message: `Now logged in to '${orgName}' as '${roleName}'.`,
})

export const notifyOrgIsPrivate = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message:
    'This organization is private. To gain access, you must be explicitly added by an administrator.',
})

export const notifyCurrentOrgDeleted = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: 'Your current organization was deleted.',
})

//  CloudHub Admin Notifications
//  ----------------------------------------------------------------------------
export const notifyMappingDeleted = (
  id: string,
  scheme: string
): Notification => ({
  ...defaultSuccessNotification,
  message: `Mapping ${id}/${scheme} deleted successfully.`,
})

export const notifyCloudHubUserAddedToOrg = (
  user: string,
  organization: string
): string => `${user} has been added to ${organization} successfully.`

export const notifyCloudHubUserRemovedFromOrg = (
  user: string,
  organization: string
): string => `${user} has been removed from ${organization} successfully.`

export const notifyCloudHubUserUpdated = (message: string): Notification => ({
  ...defaultSuccessNotification,
  message,
})

export const notifyCloudHubBasicUserAdd = (
  name: string,
  password: string
): Notification => {
  let message = `
    <div>Adding user is successful.</div>
    <hr class="notification-line">
    <div>User name: ${name}</div>
    <div>Password(OTP): ${password}</div>
  `
  return {
    ...defaultSuccessNotification,
    duration: INFINITE,
    isHasHTML: true,
    message,
  }
}

export const notifyCloudHubOrgDeleted = (orgName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `Organization ${orgName} deleted successfully.`,
})

export const notifyCloudHubOrgInvalidName = (): Notification => ({
  ...defaultErrorNotification,
  type: 'warning',
  message:
    'Group name must not have any blank and prevent the special symbols eg, #, $, &, ^, |, % etc. Regular Exp. pattern is applied by "/^w+$/"',
})

export const notifyCloudHubUserDeleted = (
  user: string,
  isAbsoluteDelete: boolean
): Notification => ({
  ...defaultSuccessNotification,
  message: `${user} has been removed from ${
    isAbsoluteDelete
      ? 'all organizations and deleted.'
      : 'the current organization.'
  }`,
})

export const notifyCloudHubUserMissingNameAndProvider = (): Notification => ({
  ...defaultErrorNotification,
  type: 'warning',
  message: 'User must have a Name and Provider.',
})

//  InfluxDB Admin Notifications
//  ----------------------------------------------------------------------------
export const notifyDBUserCreated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'User created successfully.',
})

export const notifyDBUserCreationFailed = (errorMessage: string): string =>
  `Failed to create User: ${errorMessage}`

export const notifyDBUserDeleted = (userName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `User "${userName}" deleted successfully.`,
})

export const notifyDBUserDeleteFailed = (errorMessage: string): string =>
  `Failed to delete User: ${errorMessage}`

export const notifyDBUserPermissionsUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'User Permissions updated successfully.',
})

export const notifyDBUserPermissionsUpdateFailed = (
  errorMessage: string
): string => `Failed to update User Permissions: ${errorMessage}`

export const notifyDBUserRolesUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'User Roles updated successfully.',
})

export const notifyDBUserRolesUpdateFailed = (errorMessage: string): string =>
  `Failed to update User Roles: ${errorMessage}`

export const notifyDBUserPasswordUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'User Password updated successfully.',
})

export const notifyDBUserPasswordUpdateFailed = (
  errorMessage: string
): string => `Failed to update User Password: ${errorMessage}`

export const notifyDatabaseCreated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Database created successfully.',
})

export const notifyDBCreationFailed = (errorMessage: string): string =>
  `Failed to create Database: ${errorMessage}`

export const notifyDBDeleted = (databaseName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `Database "${databaseName}" deleted successfully.`,
})

export const notifyDBDeleteFailed = (errorMessage: string): string =>
  `Failed to delete Database: ${errorMessage}`

export const notifyRoleCreated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Role created successfully.',
})

export const notifyRoleCreationFailed = (errorMessage: string): string =>
  `Failed to create Role: ${errorMessage}`

export const notifyRoleDeleted = (roleName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `Role "${roleName}" deleted successfully.`,
})

export const notifyRoleDeleteFailed = (errorMessage: string): string =>
  `Failed to delete Role: ${errorMessage}`

export const notifyRoleUsersUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Role Users updated successfully.',
})

export const notifyRoleUsersUpdateFailed = (errorMessage: string): string =>
  `Failed to update Role Users: ${errorMessage}`

export const notifyRolePermissionsUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Role Permissions updated successfully.',
})

export const notifyRolePermissionsUpdateFailed = (
  errorMessage: string
): string => `Failed to update Role Permissions: ${errorMessage}`

export const notifyRetentionPolicyCreated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Retention Policy created successfully.',
})

export const notifyRetentionPolicyCreationError = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Failed to create Retention Policy. Please check name and duration.',
})

export const notifyRetentionPolicyCreationFailed = (
  errorMessage: string
): string => `Failed to create Retention Policy: ${errorMessage}`

export const notifyRetentionPolicyDeleted = (rpName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `Retention Policy "${rpName}" deleted successfully.`,
})

export const notifyRetentionPolicyDeleteFailed = (
  errorMessage: string
): string => `Failed to delete Retention Policy: ${errorMessage}`

export const notifyRetentionPolicyUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Retention Policy updated successfully.',
})

export const notifyRetentionPolicyUpdateFailed = (
  errorMessage: string
): string => `Failed to update Retention Policy: ${errorMessage}`

export const notifyQueriesError = (errorMessage: string): Notification => ({
  ...defaultErrorNotification,
  message: errorMessage,
})

export const notifyRetentionPolicyCantHaveEmptyFields = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Fields cannot be empty.',
})

export const notifyDatabaseDeleteConfirmationRequired = (
  databaseName: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Type "DELETE ${databaseName}" to confirm. This action cannot be undone.`,
})

export const notifyDBUserNamePasswordInvalid = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Username and/or Password too short.',
})

export const notifyRoleNameInvalid = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Role name is too short.',
})

export const notifyDatabaseNameInvalid = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Database name cannot be blank.',
})

export const notifyDatabaseNameAlreadyExists = (): Notification => ({
  ...defaultErrorNotification,
  message: 'A Database by this name already exists.',
})

//  Dashboard Notifications
//  ----------------------------------------------------------------------------
export const notifyTempVarAlreadyExists = (
  tempVarName: string
): Notification => ({
  ...defaultErrorNotification,
  icon: 'cube',
  message: `Variable '${tempVarName}' already exists. Please enter a new value.`,
})

export const notifyDashboardNotFound = (dashboardID: string): Notification => ({
  ...defaultErrorNotification,
  icon: 'dash-h',
  message: `Dashboard ${dashboardID} could not be found`,
})

export const notifyInvalidQueryParam = (queryParam: string): Notification => ({
  ...defaultErrorNotification,
  icon: 'dash-h',
  message: `Invalid query parameter value for ${queryParam}, reverting to default`,
})

export const notifyDashboardDeleted = (name: string): Notification => ({
  ...defaultSuccessNotification,
  icon: 'dash-h',
  message: `Dashboard ${name} deleted successfully.`,
})

export const notifyDashboardCreated = (count: number): Notification => ({
  ...defaultSuccessNotification,
  icon: 'dash-h',
  message: `Selected dashboard${count > 1 ? 's have' : ' has'} been created.`,
})

export const notifyNoSuggestedDashboards = (): Notification => ({
  ...defaultErrorNotification,
  icon: 'dash-h',
  message: `There are no suggested dashboards for this source`,
})

export const notifyDashboardCreationFailed = (count: number): Notification => ({
  ...defaultErrorNotification,
  icon: 'dash-h',
  message: `Could not create selected dashboard${count > 1 ? 's' : ''}.`,
})

export const notifyDashboardExported = (name: string): Notification => ({
  ...defaultSuccessNotification,
  icon: 'dash-h',
  message: `Dashboard ${name} exported successfully.`,
})

export const notifyDashboardExportFailed = (
  name: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to export Dashboard ${name}: ${errorMessage}.`,
})

export const notifyDashboardImported = (): Notification => ({
  ...defaultSuccessNotification,
  icon: 'dash-h',
  message: `Dashboard imported successfully.`,
})

export const notifyDashboardImportFailed = (
  fileName: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to import Dashboard from file ${fileName}: ${errorMessage}.`,
})

export const notifyDashboardDeleteFailed = (
  name: string,
  errorMessage: string
): string => `Failed to delete Dashboard ${name}: ${errorMessage}.`

export const notifyCellAdded = (name: string): Notification => ({
  ...defaultSuccessNotification,
  icon: 'dash-h',
  duration: 1900,
  message: `Added "${name}" to dashboard.`,
})

export const notifyCellSent = (
  cellName: string,
  dashboardNum: number
): Notification => {
  const pluralizer = dashboardNum > 1 ? 's' : ''
  return {
    ...defaultSuccessNotification,
    icon: 'dash-h',
    message: `Added "${cellName}" to ${dashboardNum} dashboard${pluralizer}.`,
  }
}

export const notifyCellSendFailed = (
  cellName: string,
  dashboardName: string
): Notification => {
  return {
    ...defaultErrorNotification,
    icon: 'dash-h',
    message: `Could not add "${cellName}" to ${dashboardName}.`,
  }
}

export const notifyCellDeleted = (name: string): Notification => ({
  ...defaultDeletionNotification,
  icon: 'dash-h',
  duration: 1900,
  message: `Deleted "${name}" from dashboard.`,
})

//  Template Variables & URL Queries
//  ----------------------------------------------------------------------------
export const notifyInvalidTempVarValueInMetaQuery = (
  tempVar: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  icon: 'cube',
  duration: 7500,
  message: `Invalid query supplied for template variable ${tempVar}: ${errorMessage}`,
})

export const notifyInvalidTempVarValueInURLQuery = ({
  key,
  value,
}: TemplateUpdate): Notification => ({
  ...defaultErrorNotification,
  icon: 'cube',
  message: `Invalid URL query value of '${value}' supplied for template variable '${key}'.`,
})

export const notifyInvalidTimeRangeValueInURLQuery = (): Notification => ({
  ...defaultErrorNotification,
  icon: 'cube',
  message: `Invalid URL query value supplied for lower or upper time range.`,
})

export const notifyInvalidMapType = (): Notification => ({
  ...defaultErrorNotification,
  icon: 'cube',
  message: `Template Variables of map type accept two comma separated values per line`,
})

export const notifyInvalidZoomedTimeRangeValueInURLQuery = (): Notification => ({
  ...defaultErrorNotification,
  icon: 'cube',
  message: `Invalid URL query value supplied for zoomed lower or zoomed upper time range.`,
})

//  Rule Builder Notifications
//  ----------------------------------------------------------------------------
export const notifyAlertRuleCreated = (ruleName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${ruleName} created successfully.`,
})

export const notifyAlertRuleCreateFailed = (
  ruleName: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  message: `There was a problem creating ${ruleName}: ${errorMessage}`,
})

export const notifyAlertRuleUpdated = (ruleName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${ruleName} saved successfully.`,
})

export const notifyAlertRuleUpdateFailed = (
  ruleName: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  message: `There was a problem saving ${ruleName}: ${errorMessage}`,
})

export const notifyAlertRuleDeleted = (ruleName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${ruleName} deleted successfully.`,
})

export const notifyAlertRuleDeleteFailed = (
  ruleName: string
): Notification => ({
  ...defaultErrorNotification,
  message: `${ruleName} could not be deleted.`,
})

export const notifyAlertRuleStatusUpdated = (
  ruleName: string,
  updatedStatus: string
): Notification => ({
  ...defaultSuccessNotification,
  message: `${ruleName} ${updatedStatus} successfully.`,
})

export const notifyAlertRuleStatusUpdateFailed = (
  ruleName: string,
  updatedStatus: string
): Notification => ({
  ...defaultSuccessNotification,
  message: `${ruleName} could not be ${updatedStatus}.`,
})

export const notifyAlertRuleRequiresQuery = (): string =>
  'Please select a Database, Measurement, and Field.'

export const notifyAlertRuleRequiresConditionValue = (): string =>
  'Please enter a value in the Conditions section.'

export const notifyAlertRuleDeadmanInvalid = (): string =>
  'Deadman rules require a Database and Measurement.'

//  Kapacitor Configuration Notifications
//  ----------------------------------------------------------------------------
export const notifyKapacitorNameAlreadyTaken = (
  kapacitorName: string
): Notification => ({
  ...defaultErrorNotification,
  message: `There is already a Kapacitor Connection named "${kapacitorName}."`,
})

export const notifyCouldNotFindKapacitor = (): Notification => ({
  ...defaultErrorNotification,
  message: 'We could not find a Kapacitor configuration for this source.',
})

export const notifyRefreshKapacitorFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: 'There was an error getting the Kapacitor configuration.',
})

export const notifyAlertEndpointSaved = (endpoint: string): Notification => ({
  ...defaultSuccessNotification,
  message: `Alert configuration for ${endpoint} saved successfully.`,
})

export const notifyAlertEndpointSaveFailed = (
  endpoint: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  message: `There was an error saving the alert configuration for ${endpoint}: ${errorMessage}`,
})

export const notifyAlertEndpointDeleteFailed = (
  endpoint: string,
  config: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  message: `There was an error deleting the alert configuration for ${endpoint}/${config}: ${errorMessage}`,
})

export const notifyAlertEndpointDeleted = (
  endpoint: string,
  config: string
): Notification => ({
  ...defaultSuccessNotification,
  message: `Alert configuration for ${endpoint}/${config} deleted successfully.`,
})

export const notifyTestAlertSent = (endpoint: string): Notification => ({
  ...defaultSuccessNotification,
  duration: TEN_SECONDS,
  message: `Test Alert sent to ${endpoint}. If the Alert does not reach its destination, please check your endpoint configuration settings.`,
})

export const notifyTestAlertFailed = (
  endpoint: string,
  errorMessage: string = ''
): Notification => ({
  ...defaultErrorNotification,
  message: `There was an error sending a Test Alert to ${endpoint} ${errorMessage}.`,
})

export const notifyInvalidBatchSizeValue = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Batch Size cannot be empty.',
})

export const notifyKapacitorConnectionFailed = (): Notification => ({
  ...defaultErrorNotification,
  message:
    'Could not connect to Kapacitor. Check your connection settings in the Configuration page.',
})

export const notifyKapacitorCreated = (): Notification => ({
  ...defaultSuccessNotification,
  message:
    'Connected to Kapacitor successfully! Configuring endpoints is optional.',
})

export const notifyKapacitorSuccess = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Connected to Kapacitor successfully!',
})

export const notifyKapacitorCreateFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: 'There was a problem connecting to Kapacitor.',
})

export const notifyCouldNotConnectToKapacitor = (
  kapacitorName: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Could not connect to ${kapacitorName}. Please check your connection parameters.`,
})

export const notifyCouldNotConnectToUpdatedKapacitor = (
  kapacitorName: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Could not connect to updated ${kapacitorName}. Please check your connection parameters.`,
})

export const notifyKapacitorUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'Kapacitor Connection updated successfully.',
})

export const notifyKapacitorUpdateFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: 'There was a problem updating the Kapacitor Connection.',
})

//  TICKscript Notifications
//  ----------------------------------------------------------------------------
export const notifyTickScriptCreated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'TICKscript successfully created.',
})

export const notifyTickscriptCreationFailed = (): string =>
  'Failed to create TICKscript.'

export const notifyTickscriptUpdated = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'TICKscript successfully updated.',
})

export const notifyTickscriptUpdateFailed = (): string =>
  'Failed to update TICKscript.'

export const notifyTickscriptLoggingUnavailable = (): Notification => ({
  type: 'warning',
  icon: 'alert-triangle',
  duration: INFINITE,
  message: 'Kapacitor version 1.4 required to view TICKscript logs',
})

export const notifyTickscriptLoggingError = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Could not collect kapacitor logs',
})

export const notifyKapacitorNotFound = (): Notification => ({
  ...defaultErrorNotification,
  message: 'We could not find a Kapacitor configuration for this source.',
})

// Flux notifications
export const validateSuccess = (): Notification => ({
  ...defaultSuccessNotification,
  message: 'No errors found. Happy Happy Joy Joy!',
})

export const notifyCopyToClipboardSuccess = (
  text: string,
  title: string = ''
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'dash-h',
  message: `${title}'${text}' has been copied to clipboard.`,
})

export const notifyCopyToClipboardFailed = (
  text: string,
  title: string = ''
): Notification => ({
  ...defaultErrorNotification,
  message: `${title}'${text}' was not copied to clipboard.`,
})

export const notifyFluxNameAlreadyTaken = (fluxName: string): Notification => ({
  ...defaultErrorNotification,
  message: `There is already a Flux Connection named "${fluxName}."`,
})

// Service notifications
export const couldNotGetFluxService = (id: string): Notification => ({
  ...defaultErrorNotification,
  message: `Could not find Flux with id ${id}.`,
})

export const couldNotGetServices: Notification = {
  ...defaultErrorNotification,
  message: 'We could not get services',
}

export const fluxCreated: Notification = {
  ...defaultSuccessNotification,
  message: 'Flux Connection Created.  Script your heart out!',
}

export const fluxNotCreated = (message: string): Notification => ({
  ...defaultErrorNotification,
  message,
})

export const fluxNotUpdated = (message: string): Notification => ({
  ...defaultErrorNotification,
  message,
})

export const fluxUpdated: Notification = {
  ...defaultSuccessNotification,
  message: 'Connection Updated. Rejoice!',
}

export const fluxResponseTruncatedError = (
  truncatedRowCount: number
): Notification => {
  const thousands = Math.floor(truncatedRowCount / 1000)

  return {
    ...defaultErrorNotification,
    message: `Large response truncated to first ${thousands}K rows`,
  }
}

export const csvExportFailed: Notification = {
  ...defaultErrorNotification,
  message: 'CSV Export failed',
}

export const annotationsError = (message: string): Notification => ({
  ...defaultErrorNotification,
  message,
})

//  CloudHub AgentPage Sources Notifications
//  ----------------------------------------------------------------------------
export const notifyAgentConnectSucceeded = (sourceName: string) => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Agent Connect successfully. ${sourceName}`,
})

export const notifyAgentConnectFailed = (error: string): Notification => ({
  ...defaultErrorNotification,
  message: `Agent Connect Failed, ${error}`,
})

export const notifyAgentDisconnected = (): Notification => ({
  ...defaultErrorNotification,
  message: `Agent Disconnected.`,
})

export const notifyAgentSucceeded = (sourceName: string) => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector ${sourceName} successfully.`,
})

export const notifyAgentApplySucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector Configuration ${sourceName} successfully.`,
})

export const notifyAgentApplyFailed = (error: Error) => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Rewrite Telegraf Config File ${error}`,
})

export const notifyTelegrafReloadFailed = (error: Error) => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Telegraf Reload Fail ${error}`,
})

export const notifyAgentLoadedSucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector Configuration ${sourceName} successfully.`,
})

export const notifyAgentStopSucceeded = (sourceName: string): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector Configuration ${sourceName} successfully.`,
})

export const notifyAgentConfigWrong = (error: Error): Notification => ({
  ...defaultErrorNotification,
  message: `Collector Configuration is wrong, ${error}`,
})

export const notifyAgentConfigNoMatchGroup = (error: string): Notification => ({
  ...defaultErrorNotification,
  message: `There is no group as "${error}"`,
})

export const notifyAgentConfigDBNameWrong = (error: string): Notification => ({
  ...defaultErrorNotification,
  message: `Database name must be "${error}"`,
})

export const notifyAgentConfigHostNameWrong = (
  error: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Agent hostname must be "${error}"`,
})

export const notifyAgentConfigHostNameChanged = (
  before: string,
  after: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Agent hostname changed "${before}" to "${after}"`,
})

export const notifyAgentStartSucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector ${sourceName} successfully.`,
})

export const notifyAgentAcceptSucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector ${sourceName} successfully.`,
})

export const notifyAgentRejectSucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector ${sourceName} successfully.`,
})

export const notifyAgentDeleteSucceeded = (
  sourceName: string
): Notification => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Collector ${sourceName} successfully.`,
})

export const notifyAgentLoadFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  message: `Agent Load Failed, ${error}`,
})

export const notifyAgentAcceptFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  message: `Agent Accept Failed, ${error}`,
})

export const notifyAgentRejectFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  message: `Agent Reject Failed, ${error}`,
})

export const notifyAgentDeleteFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  message: `Agent Delete Failed, ${error}`,
})

export const notifyAgentConfigTempDirectoryMakeFailed = (
  error: Error
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Make Temp Directory ${error}`,
})

export const notifyAgentConfigTempFileWriteFailed = (
  error: Error
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Make Temp Config File ${error}`,
})

export const notifyMinionNotSelected = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Please Select a Minion`,
})

export const notifyTelegrafDubugFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Debug Telegraf ${error}`,
})

export const notifyConfigFileSaveFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Save File ${error}`,
})

export const notifyConfigFileSaveFailedByNoTenant = (): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Please Select a Tenant`,
})

export const notifyConfigFileReadFailed = (error: string): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Read File ${error}`,
})

export const notifyGetProjectFileFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Get File ${error}`,
})

//  CloudHub Shell Sources Notifications
//  ----------------------------------------------------------------------------

export const notifyConnectShellFailed = (close: CloseEvent): Notification => ({
  ...defaultErrorNotification,
  message: `CODE: ${close.code}, REASON: ${close.reason}`,
})

//  CloudHub infrastructure VM Host Notifications
//  ----------------------------------------------------------------------------
export const notifyConnectVCenterFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  message: `VCenter Connection Failed, ${error}`,
})

export const notifyUpdateVCenterFailed = (host: string): Notification => ({
  ...defaultErrorNotification,
  message: `VCenter ${host} Update Failed. remove this inventory`,
})

//  CloudHub infrastructure VM Host Remote Console Notifications
//  ----------------------------------------------------------------------------
export const notifyConnectRemoteConsoleFailed = (
  error: Error
): Notification => ({
  ...defaultErrorNotification,
  message: `Remote Console Run Failed, ${error}`,
})

//  CloudHub User Auth Notifications
//  ----------------------------------------------------------------------------

export const notifyLoginFailed = (
  error: {
    code: number
    message: string
    retryCount: number
    locked: boolean
    lockedTime: string
  },
  retryPolicysObj: {[k: string]: any}
): Notification => {
  const {message, retryCount, locked} = error
  const {count, delaytime} = retryPolicysObj
  let temp = `Login is failed.
  <hr class="notification-line">
  <div>${message}</div>
  `

  if (retryCount && retryCount !== 0) {
    if (locked) {
      temp += `<hr class="notification-line">
    <div>Please try again in ${delaytime} minutes.</div>
    `
    } else {
      temp += `<hr class="notification-line">
    <div>${count - retryCount} time[s] left.</div>
      `
    }
  }

  return {
    ...defaultErrorNotification,
    isHasHTML: true,
    message: temp,
  }
}

export const notifyLoginCheck = (): Notification => ({
  ...defaultErrorNotification,
  message: `Check out your ID or password , please.`,
})

export const notifyUserAddCompleted = (): Notification => ({
  ...defaultSuccessNotification,
  message: `Sign up is successful.`,
})

export const notifyUserAddFailed = (error: {
  code: number
  message: string
}): Notification => ({
  ...defaultErrorNotification,
  isHasHTML: true,
  message: `Sign up is failed.<br/>CODE: ${error.code}<br/>REASON: ${error.message}`,
})

export const notifyUserPasswordResetCompleted = ({
  name,
  password,
  sendKind,
  passwordReturn = false,
}: {
  name: string
  password: string
  sendKind: string
  passwordReturn?: boolean
}): Notification => {
  let message = `
    <div>Reset the password is successful.</div>
    <hr class="notification-line">
    <div>User name: ${name}</div>
  `
  if (password) {
    message += `<div>Password(OTP): ${password}</div>`
  }

  if (sendKind) {
    if (sendKind === 'error') {
      message += `<div>Send:[Error] Sending an OTP did not succeed.</div>`
    } else {
      message += `<div>Send: ${sendKind}</div>`
    }
  }

  return {
    ...defaultSuccessNotification,
    duration: passwordReturn ? INFINITE : TEN_SECONDS,
    isHasHTML: true,
    message,
  }
}

export const notifyUserPasswordResetFailed = (): Notification => ({
  ...defaultErrorNotification,
  isHasHTML: true,
  message: `The password reset is failed. <br/>Check out your ID or email address.`,
})

export const notifyUserUpdateCompleted = (): Notification => ({
  ...defaultSuccessNotification,
  message: `Updating user information is successful.`,
})

export const notifyUserUpdateFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `Updating user information is failed.`,
})

export const notifyUserPasswordInputError = (): Notification => ({
  ...defaultErrorNotification,
  message: `Check out your password, please.`,
})

export const notifyUserOTPChangeCompleted = (): Notification => ({
  ...defaultSuccessNotification,
  message: `Updating your password is successful.`,
})

export const notifyUserOTPChangeFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `Updating your password is failed.`,
})

export const notifyUserLockChangeSuccess = (): Notification => ({
  ...defaultSuccessNotification,
  message: `change user lock successfuly`,
})

export const notifyeUserLockChangFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `change user lock failed.`,
})

//  CloudHub infrastructure Inventory Topology Notifications
//  ----------------------------------------------------------------------------
export const notifyTopologyExported = (name: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${name} exported successfully.`,
})

export const notifyTopologyExportedFailed = (
  name: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to export ${name}: ${errorMessage}.`,
})

export const notifyTopologyImported = (fileName: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${fileName} imported successfully.`,
})

export const notifyTopologyImportFailed = (
  fileName: string,
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to import Topology from file ${fileName}: ${errorMessage}.`,
})

export const notifyRequiredFailed = (required: string): Notification => ({
  ...defaultErrorNotification,
  message: `Please enter '${required}' value.`,
})

export const notifygetCSPListInstancesFailed = (
  error: Error
): Notification => ({
  ...defaultErrorNotification,
  isHasHTML: true,
  message: `CSP Host Get Failed, ${error}`,
})

export const notifygetAWSInstancesFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  isHasHTML: true,
  message: `CSP Host Get Failed, ${error}`,
})

export const notifygetGCPInstancesFailed = (error: Error): Notification => ({
  ...defaultErrorNotification,
  isHasHTML: true,
  message: `GCP Host Get Failed, ${error}`,
})

export const notifygetCSPConfigFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `Failed to create CSP configuration file.`,
})

export const notifygetCSPKeyFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `Failed to create CSP key file.`,
})

export const notifyTopologySaved = (): Notification => ({
  ...defaultSuccessNotification,
  message: `Topology saved successfully.`,
})

export const notifyTopologySaveFailed = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  message: `There was an error saving the topology : ${errorMessage}`,
})

export const notifyTopologySaveAuthFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `User does not have authorization required to save topology.`,
})

export const notifyUnableToGetProjects = (): Notification => ({
  ...defaultErrorNotification,
  message: 'Unable to get Projects.',
})

export const notifyInvalidProperty = (errorMessage: string): Notification => ({
  ...defaultErrorNotification,
  message: errorMessage,
})

export const notifyError = (errorMessage: string): Notification => ({
  ...defaultErrorNotification,
  message: errorMessage,
})
export const notifyExceptionRunner = (): Notification => ({
  ...defaultErrorNotification,
  message: notifyGenericFail(),
})
export const notifyCreateProviderConf = (provider: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${provider}  created successfully.`,
})

export const notifyDeleteProviderConf = (provider: string): Notification => ({
  ...defaultSuccessNotification,
  message: `${provider}  deleted successfully.`,
})
export const notifygetProjectConfigFailed = (): Notification => ({
  ...defaultErrorNotification,
  message: `Failed to Deleted Project configuration file.`,
})

export const notifyPreferencesTemperatureApplySucceeded = (): Notification => ({
  ...defaultSuccessNotification,
  message: `Temperature Preferences Applied successfully.`,
})

export const notifyPreferencesTemperatureApplyFailed = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Apply Temperature Preferences : ${errorMessage}`,
})

export const notifyFetchIntervalDataFailed = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Fetch Interval Data : ${errorMessage}`,
})

export const notifyDecryptedBytesFailed = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Decrypt : ${errorMessage}`,
})

export const notifyGetDetectedHostStatusFailed = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Get Detected Host Status : ${errorMessage}`,
})

export const notifySetIpmiStatusFailed = (
  errorMessage: string
): Notification => ({
  ...defaultErrorNotification,
  duration: INFINITE,
  message: `Failed to Set IPMI Status : ${errorMessage}`,
})
