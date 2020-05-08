// All copy for notifications should be stored here for easy editing
// and ensuring stylistic consistency
import {Notification} from 'src/types'
import {
  defaultErrorNotification,
  defaultSuccessNotification,
} from 'src/shared/copy/notifications'

//  CloudHub Addon/SWAN Sources Notifications
//  ----------------------------------------------------------------------------
export const notify_128TGetMasterDirFiles_Failed = (
  error: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Getting file list is failed on the Master, ${error}`,
})

export const notify_128TSendFilesToCollector_Successed = (
  sourceName: string
) => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `Sending ${sourceName} is successful`,
})

export const notify_128TSendFilesToCollector_Failed = (
  error: string
): Notification => ({
  ...defaultErrorNotification,
  message: `Sending ${error} is failed`,
})
