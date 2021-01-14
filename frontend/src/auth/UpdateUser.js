import React, {useState, useEffect} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {InjectedRouter} from 'react-router'

import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

import {updateUserAsync} from 'src/auth/actions'

const UpdateUser = ({router, auth, links, handleUpdateUser}) => {
  // console.log(props)
  // useEffect(() => {
  //   console.log('passwordPolicy: ', passwordPolicy)
  //   if (!passwordPolicy) {
  //     router.push('/')
  //   }
  // }, [passwordPolicy])
  const [id] = useState(auth.me.name)
  const [email, setEmail] = useState(auth.me.name)
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

  const passwordPolicy = _.find(
    links.addons,
    addon => addon.name === 'password-policy'
  )

  const passwordPolicyMessage = _.find(
    links.addons,
    addon => addon.name === 'password-policy-message'
  )

  const reg = new RegExp(passwordPolicy?.url, 'ig')
  const isValidPassword = password.length > 0 && reg.test(password)
  const isValidPasswordConfirm = password === passwordConfirm

  const onClickUpdateUser = e => {
    let user = {
      id,
      email,
    }

    if (isValidPassword && isValidPasswordConfirm) {
      user = {
        ...user,
        password,
        currentOrganization: auth.me.currentOrganization.id,
      }
    }
    handleUpdateUser({url: `/cloudhub/v1/users/:id`, user})
  }
  return (
    <div>
      <SplashPage router={router}>
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
              <h2 className="panel-title">Modify Member Information</h2>
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
                <label>Password</label>
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'password'}
                    spellCheck={false}
                    value={password}
                    onChange={onChangePassword}
                  />

                  {!isValidPassword && (
                    <div className="form-message fm--danger">
                      {passwordPolicyMessage?.url}
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
                    placeholder={'password confirm'}
                    spellCheck={false}
                    value={passwordConfirm}
                    onChange={onChangePasswordConfirm}
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
                  disabled={
                    !isValidPassword || !isValidPasswordConfirm
                    // 기존 메일과 다르면 활성화 시킬 것
                  }
                  onClick={onClickUpdateUser}
                >
                  Change Password
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
    passwordPolicy: shape(),
    passwordPolicyMessage: shape(),
  }),
  handlePasswordChange: func,
}

export default connect(null, mapDispatchToProps)(UpdateUser)
