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

//  Cloud Smart Hub AgentPage Sources Notifications
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
