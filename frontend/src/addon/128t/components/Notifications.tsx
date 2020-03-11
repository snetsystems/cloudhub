// All copy for notifications should be stored here for easy editing
// and ensuring stylistic consistency
import {Notification} from 'src/types'

type NotificationExcludingMessage = Pick<
  Notification,
  Exclude<keyof Notification, 'message'>
>

import {FIVE_SECONDS, TEN_SECONDS} from 'src/shared/constants/index'

const defaultErrorNotification: NotificationExcludingMessage = {
  type: 'error',
  icon: 'alert-triangle',
  duration: TEN_SECONDS,
}

const defaultSuccessNotification: NotificationExcludingMessage = {
  type: 'success',
  icon: 'checkmark',
  duration: FIVE_SECONDS,
}

//  Cloud Smart Hub Addon/128T Sources Notifications
//  ----------------------------------------------------------------------------
export const notify_128TGetMasterDirFiles_Successed = (sourceName: string) => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `SWAN Get Master Files Successfully. ${sourceName}`,
})

export const notify_128TGetMasterDirFiles_Failed = (
  error: string
): Notification => ({
  ...defaultErrorNotification,
  message: `SWAN Get Master Files Failed, ${error}`,
})

export const notify_128TSendFilesToCollector_Successed = (
  sourceName: string
) => ({
  ...defaultSuccessNotification,
  icon: 'server2',
  message: `SWAN Send Files To Collector Successfully. ${sourceName} file`,
})

export const notify_128TSendFilesToCollector_Failed = (
  error: string
): Notification => ({
  ...defaultErrorNotification,
  message: `SWAN Send Files To Collector Failed, ${error} file`,
})
