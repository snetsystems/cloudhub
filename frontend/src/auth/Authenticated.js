import {replace} from 'react-router-redux'
import {UserAuthWrapper} from 'redux-auth-wrapper'
import _ from 'lodash'
import PageSpinner from 'src/shared/components/PageSpinner'

export const UserIsAuthenticated = UserAuthWrapper({
  authSelector: ({auth, links: {passwordPolicy, passwordPolicyMessage}}) => ({
    auth,
    passwordPolicy,
    passwordPolicyMessage,
  }),
  authenticatingSelector: ({auth: {isMeLoading}}) => isMeLoading,
  LoadingComponent: PageSpinner,
  redirectAction: replace,
  wrapperDisplayName: 'UserIsAuthenticated',
  predicate: ({auth: {me, isMeLoading}}) => !isMeLoading && me !== null,
})

export const UserIsNotAuthenticated = UserAuthWrapper({
  authSelector: ({
    auth,
    links: {
      basicauth,
      basicPassword,
      basicPasswordReset,
      passwordPolicy,
      passwordPolicyMessage,
      loginAuthType,
    },
  }) => ({
    auth,
    basicauth,
    basicPassword,
    basicPasswordReset,
    passwordPolicy,
    passwordPolicyMessage,
    loginAuthType,
  }),
  authenticatingSelector: ({auth: {isMeLoading}}) => isMeLoading,
  LoadingComponent: PageSpinner,
  redirectAction: replace,
  wrapperDisplayName: 'UserIsNotAuthenticated',
  predicate: ({auth: {me, isMeLoading}}) => !isMeLoading && me === null,
  failureRedirectPath: () => '/',
  allowRedirectBack: false,
})
