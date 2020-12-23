import React, {useState, useEffect} from 'react'
import {InjectedRouter} from 'react-router'

import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

const PasswordChange = ({router, authData: {auth, regexp}}) => {
  const [email] = useState(auth.me.name)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const onChangePassword = e => {
    setPassword(e.target.value)
  }

  const onChangePasswordConfirm = e => {
    setPasswordConfirm(e.target.value)
  }

  const onClickPasswordChange = e => {
    console.log('onClickPasswordChange')
    // success  or failed
    // success
    // success notification and router.goBack()
    // failed
    // failed notification
  }

  const reg = new RegExp(regexp.url, 'ig')
  const isValidPassword = password.length > 0 && reg.test(password)
  const isValidPasswordConfirm = password === passwordConfirm

  return (
    <div>
      <Notifications />
      <SplashPage>
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
              <h2 className="panel-title">Change Password</h2>
            </div>
            <div className="panel-body" style={{padding: '0px'}}>
              <div className="form-group">
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="text"
                    spellCheck={false}
                    value={email}
                    disabled={true}
                  />
                </div>
              </div>
              <div className="form-group">
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'password'}
                    spellCheck={false}
                    value={password}
                    onChange={onChangePassword}
                  />
                  {!isValidPassword ? <div>password policy message</div> : null}
                </div>
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'password Confirm'}
                    spellCheck={false}
                    value={passwordConfirm}
                    onChange={onChangePasswordConfirm}
                  />
                  {!isValidPasswordConfirm ? (
                    <div>
                      Your password and confirmation password do not match.
                    </div>
                  ) : null}
                </div>
              </div>
              {/* <div style={{paddingBottom: '15px'}}>
                Use 8 &#38; or more characters with a mix of letters. member
                &#38; symbols
              </div> */}
              <div className={'auth-button-bar'}>
                <button
                  className="btn btn-primary btn-sm col-md-12"
                  disabled={
                    isValidPassword === false ||
                    isValidPasswordConfirm === false
                  }
                  onClick={onClickPasswordChange}
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

export default PasswordChange
