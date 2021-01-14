import React, {useState, useEffect} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {InjectedRouter} from 'react-router'
import {Subscribe} from 'unstated'

import {AuthContainer} from 'src/auth/AuthContainer'
import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

import {otpChangeAsync} from 'src/auth/actions'

const PasswordOTP = props => {
  const passwordPolicy = props.authData.passwordPolicy
  const passwordPolicyMessage = props.authData.passwordPolicyMessage

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const onChangePassword = e => {
    setPassword(e.target.value)
  }

  const onChangePasswordConfirm = e => {
    setPasswordConfirm(e.target.value)
  }

  const onClickOTPChange = userID => () => {
    let user = {
      name: userID,
    }

    if (isValidPassword && isValidPasswordConfirm) {
      user = {
        ...user,
        password,
      }
    }

    props.handleOTPChange({url: '/basic/password', user})
  }

  let reg = null
  if (passwordPolicy) {
    reg = new RegExp(passwordPolicy && passwordPolicy, 'ig')
  }

  const isValidPassword = reg && password.length > 0 && reg.test(password)
  const isValidPasswordConfirm = reg && password === passwordConfirm

  return (
    <div>
      <Notifications />
      <SplashPage router={props.router}>
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
              <h2 className="panel-title">Password Change</h2>
            </div>
            <div className="panel-body" style={{padding: '0px'}}>
              <div className="form-group">
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'New password'}
                    value={password}
                    onChange={onChangePassword}
                    spellCheck={false}
                  />
                  {!isValidPassword && (
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
                    placeholder={'New password confirm'}
                    value={passwordConfirm}
                    onChange={onChangePasswordConfirm}
                    spellCheck={false}
                  />
                  {passwordConfirm.length > 0 && !isValidPasswordConfirm && (
                    <div className={`form-message fm--danger`}>
                      Your password and confirmation password do not match.
                    </div>
                  )}
                  {isValidPassword && isValidPasswordConfirm && (
                    <span className="form-input-checkmark icon checkmark" />
                  )}
                </div>
              </div>
              <Subscribe to={[AuthContainer]}>
                {container => (
                  <button
                    className="btn btn-primary btn-sm col-md-12"
                    disabled={!isValidPassword || !isValidPasswordConfirm}
                    onClick={onClickOTPChange(container.state.userID)}
                  >
                    Change Password
                  </button>
                )}
              </Subscribe>
            </div>
          </div>
        </div>
      </SplashPage>
    </div>
  )
}

const mapDispatchToProps = {
  handleOTPChange: otpChangeAsync,
}

const {array, bool, shape, string, func} = PropTypes

PasswordOTP.prototype = {
  router: shape(),
  authData: shape({
    auth: shape({
      me: shape(),
      links: array,
      isLoading: bool,
    }),
    passwordPolicy: shape(),
    passwordPolicyMessage: shape(),
  }),
  handleOTPChange: func,
}

export default connect(null, mapDispatchToProps)(PasswordOTP)
