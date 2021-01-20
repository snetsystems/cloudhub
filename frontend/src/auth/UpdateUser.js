import React, {useState, useEffect} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {InjectedRouter} from 'react-router'

import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

import {getUserAsync, updateUserAsync} from 'src/auth/actions'
import {notify} from 'src/shared/actions/notifications'
import {notifyUserPasswordInputError} from 'src/shared/copy/notifications'

const UpdateUser = ({
  router,
  auth: {me},
  links: {passwordPolicy, passwordPolicyMessage},
  handleGetUser,
  handleUpdateUser,
  notify,
}) => {
  const [id] = useState(me.name)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const onChangeEmail = e => {
    setEmail(e.target.value)
  }

  const onChangePassword = e => {
    setPassword(e.target.value)
  }

  const onChangePasswordConfirm = e => {
    setPasswordConfirm(e.target.value)
  }

  const getUser = () => {
    return handleGetUser({url: `/cloudhub/v1/users/${me.id}`})
  }

  const reg = new RegExp(passwordPolicy, 'ig')
  const isValidPassword = password.length > 0 && reg.test(password)
  const isValidPasswordConfirm = password === passwordConfirm

  const onClickUpdateUser = e => {
    if (password.length > 0) {
      if (!isValidPassword) {
        notify(notifyUserPasswordInputError())
        return
      }

      if (!isValidPasswordConfirm) {
        notify(notifyUserPasswordInputError())
        return
      }
    }

    getUser().then(({data}) => {
      let user = {
        email,
        roles: data.roles,
        superAdmin: data.superAdmin,
      }

      if (isValidPassword && isValidPasswordConfirm) {
        user = {
          ...user,
          password,
        }
      }

      handleUpdateUser({url: `/cloudhub/v1/users/${me.id}`, user}).then(
        ({data}) => {
          if (data?.email) {
            setEmail(data.email)
          } else {
            setEmail('')
          }
        }
      )
    })
  }

  useEffect(() => {
    if (me.provider !== 'cloudhub' || !passwordPolicy) {
      router.path('/')
    }

    getUser().then(({data}) => {
      if (data?.email) {
        setEmail(data.email)
      }
    })
  }, [])

  return (
    <div>
      <SplashPage isShowCopy={false} isShowLogo={false} router={router}>
        <h1
          className="auth-text-logo"
          style={{position: 'absolute', top: '-9999px', left: '-9999px'}}
        >
          CloudHub
        </h1>
        <div
          className={'auth-area'}
          style={{backgroundColor: '#292933', padding: '20px'}}
        >
          <div className="panel" style={{marginBottom: '0px'}}>
            <div
              className="panel-heading"
              style={{justifyContent: 'center', padding: '0 0 15px 0'}}
            >
              <h2 className="panel-title">Change Account</h2>
            </div>
            <div className="panel-body" style={{padding: '0px'}}>
              <div className="form-group">
                <label>User ID</label>
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="text"
                    spellCheck={false}
                    value={id}
                    disabled={true}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'new password'}
                    spellCheck={false}
                    value={password}
                    onChange={onChangePassword}
                  />

                  {password && !isValidPassword && (
                    <div className="form-message fm--danger">
                      {passwordPolicyMessage}
                    </div>
                  )}
                  {isValidPassword && (
                    <span className="form-input-checkmark icon checkmark" />
                  )}
                </div>
              </div>
              <div className="form-group">
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'new password confirm'}
                    spellCheck={false}
                    value={passwordConfirm}
                    onChange={onChangePasswordConfirm}
                  />
                  {passwordConfirm && !isValidPasswordConfirm && (
                    <div className={`form-message fm--danger`}>
                      Your password and confirmation password do not match.
                    </div>
                  )}
                  {isValidPassword && isValidPasswordConfirm && (
                    <span className="form-input-checkmark icon checkmark" />
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="email"
                    placeholder={'yours@email.com'}
                    spellCheck={false}
                    value={email}
                    onChange={onChangeEmail}
                  />
                  <div className="form-message fm--info">
                    It is used for OTP delivery when initializing password.
                  </div>
                </div>
              </div>
              <div className={'auth-button-bar'}>
                <button
                  className="btn btn-primary btn-sm col-md-8"
                  onClick={onClickUpdateUser}
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
      </SplashPage>
    </div>
  )
}

const mapDispatchToProps = {
  handleUpdateUser: updateUserAsync,
  handleGetUser: getUserAsync,
  notify,
}

const {array, bool, shape, string, func} = PropTypes

UpdateUser.prototype = {
  router: shape(),
  authData: shape({
    auth: shape({
      me: shape(),
      links: array,
      isLoading: bool,
    }),
    passwordPolicy: string,
    passwordPolicyMessage: string,
  }),
  handlePasswordChange: func,
  handleGetUser: func,
  notify: func,
}

export default connect(null, mapDispatchToProps)(UpdateUser)
