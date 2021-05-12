import _ from 'lodash'

import {authExpired} from 'src/shared/actions/auth'
import {notify} from 'src/shared/actions/notifications'

import {HTTP_FORBIDDEN} from 'src/shared/constants'
import {
  notifySessionTimedOut,
  notifyHttpErrorRespose,
  notifyErrorWithAltText,
  notifyOrgIsPrivate,
  notifyCurrentOrgDeleted,
} from 'src/shared/copy/notifications'

const actionsAllowedDuringBlackout = [
  '@@',
  'AUTH_',
  'ME_',
  'PUBLISH_NOTIFICATION',
  'DISMISS_NOTIFICATION',
  'ERROR_',
  'LINKS_',
]
const errorsMiddleware = store => next => action => {
  const {
    auth: {me},
  } = store.getState()

  if (action.type === 'ERROR_THROWN') {
    const {
      error,
      error: {status, statusText, auth},
      altText,
      alertType = 'info',
    } = action

    if (error.message === 'locked') {
      store.dispatch(authExpired(auth))
    }

    if (status === HTTP_FORBIDDEN) {
      const message = _.get(error, 'data.message', '')

      const organizationWasRemoved =
        message === `user's current organization was not found` // eslint-disable-line quotes
      const wasSessionTimeout = me !== null

      store.dispatch(authExpired(auth))

      if (
        message ===
        `This organization is private. To gain access, you must be explicitly added by an administrator.` // eslint-disable-line quotes
      ) {
        store.dispatch(notify(notifyOrgIsPrivate()))
      }

      if (organizationWasRemoved) {
        store.dispatch(notify(notifyCurrentOrgDeleted()))
      } else if (wasSessionTimeout) {
        store.dispatch(notify(notifyHttpErrorRespose(status, statusText)))
        store.dispatch(notify(notifySessionTimedOut()))
      }
    } else if (altText) {
      store.dispatch(notify(notifyErrorWithAltText(alertType, altText)))
    } else {
      store.dispatch(
        notify(
          notifyHttpErrorRespose(
            status,
            `${statusText}: Cannot communicate with server.`
          )
        )
      )
    }
  }

  // If auth has expired, do not execute any further actions or redux state
  // changes not related to routing and auth. This allows the error notification
  // telling the user why they've been logged out to persist in the UI. It also
  // prevents further changes to redux state by actions that may have triggered
  // AJAX requests pre-auth expiration and whose response returns post-logout
  if (
    me === null &&
    !actionsAllowedDuringBlackout.some(allowedAction =>
      action.type.includes(allowedAction)
    )
  ) {
    return
  }
  next(action)
}

export default errorsMiddleware
