import React, {useState, useEffect} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {Link} from 'react-router'
import {Subscribe} from 'unstated'

import {AuthContainer} from 'src/auth/AuthContainer'
import {Radio, ButtonShape} from 'src/reusable_ui'
import Notifications from 'src/shared/components/Notifications'
import PageSpinner from 'src/shared/components/PageSpinner'
import SplashPage from 'src/shared/components/SplashPage'

import {loginAsync, createUserAsync} from 'src/auth/actions'

const VERSION = process.env.npm_package_version

const Login = ({
  router,
  authData: {auth, passwordPolicy, passwordPolicyMessage},
  handleLogin,
  handleCreateUser,
}) => {
  if (auth.isAuthLoading) {
    return <PageSpinner />
  }
  console.log('router: ', router)
  const [id, setId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [activeEditorTab, setActiveEditorTab] = useState('Login')

  const onChangeId = e => {
    setId(e.target.value)
  }

  const onChangeEmail = e => {
    setEmail(e.target.value)
  }

  const onChangePassword = e => {
    setPassword(e.target.value)
  }

  const onChangePasswordConfirm = e => {
    setPasswordConfirm(e.target.value)
  }

  const onClickLogin = handleUpdateUserID => () => {
    handleLogin({
      url: '/basic/login',
      user: {id, password},
    }).then(({data}) => {
      let {passwordResetFlag} = data

      if (passwordResetFlag === 'N') {
        router.go('/')
      } else {
        router.push('/password-otp')
      }
    })
  }

  const onClickSignUp = () => {
    handleCreateUser({url: '/basic/users', user: {email, id, password}})
  }

  const onSetActiveEditorTab = tab => {
    setActiveEditorTab(tab)
  }

  useEffect(() => {
    setId('')
    setEmail('')
    setPassword('')
    setPasswordConfirm('')
  }, [activeEditorTab])

  let reg = null
  if (passwordPolicy) {
    reg = new RegExp(passwordPolicy, 'ig')
  }

  const isValidPassword = reg && password.length > 0 && reg.test(password)
  const isValidPasswordConfirm = reg && password === passwordConfirm
  const isSign = activeEditorTab === 'SignUp'
  return (
    <div>
      <Notifications />
      <SplashPage router={router}>
        <h1
          className="auth-text-logo"
          style={{position: 'absolute', top: '-9999px', left: '-9999px'}}
        >
          CloudHub
        </h1>
        <p>
          <b>{VERSION}</b> / Real-Time Applications Monitoring
        </p>
        <div className={'auth-area'}>
          {reg && (
            <>
              <Radio
                shape={ButtonShape.StretchToFit}
                customClass={'auth-radio'}
              >
                <Radio.Button
                  id="auth-log-in"
                  titleText="Login"
                  value="Login"
                  active={activeEditorTab === 'Login'}
                  onClick={onSetActiveEditorTab}
                >
                  Login
                </Radio.Button>
                <Radio.Button
                  id="auth-sign-up"
                  titleText="SignUp"
                  value="SignUp"
                  active={activeEditorTab === 'SignUp'}
                  onClick={onSetActiveEditorTab}
                >
                  Sign up
                </Radio.Button>
              </Radio>

              <div className="form-group">
                {isSign && <label>User ID</label>}
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="text"
                    placeholder={'id'}
                    value={id}
                    onChange={onChangeId}
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="form-group">
                {isSign && <label>Password</label>}
                <div className="auth-form">
                  <input
                    className="form-control"
                    type="password"
                    placeholder={'password'}
                    value={password}
                    onChange={onChangePassword}
                    spellCheck={false}
                  />
                  {isSign && !isValidPassword && (
                    <div className="form-message fm--danger">
                      {passwordPolicyMessage}
                    </div>
                  )}
                  {isSign && isValidPassword && (
                    <span className="form-input-checkmark icon checkmark" />
                  )}
                </div>
              </div>
              {isSign ? (
                <>
                  <div className="form-group">
                    <div className="auth-form">
                      <input
                        className="form-control"
                        type="password"
                        placeholder={'password confirm'}
                        value={passwordConfirm}
                        onChange={onChangePasswordConfirm}
                        spellCheck={false}
                      />

                      {passwordConfirm.length > 0 &&
                        !isValidPasswordConfirm && (
                          <div className={`form-message fm--danger`}>
                            Your password and confirmation password do not
                            match.
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
                        placeholder={'yours@example.com'}
                        value={email}
                        onChange={onChangeEmail}
                        spellCheck={false}
                      />
                      <div className="form-message fm--info">
                        It is used for OTP delivery when initializing password.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/password-reset">
                    <span>Forgot your password?</span>
                  </Link>
                  <Link to="/password-otp">
                    <span>Change Password?</span>
                  </Link>
                </>
              )}
              <div className={'auth-button-bar'}>
                {isSign ? (
                  <button
                    className="btn btn-primary btn-sm col-md-12"
                    disabled={
                      !reg ||
                      !passwordPolicyMessage ||
                      isValidPassword === false ||
                      isValidPasswordConfirm === false
                    }
                    onClick={onClickSignUp}
                  >
                    Sign Up
                  </button>
                ) : (
                  <Subscribe to={[AuthContainer]}>
                    {container => {
                      return (
                        <button
                          className="btn btn-primary btn-sm col-md-12"
                          onClick={onClickLogin(container.handleUpdateUserID)}
                        >
                          Login
                        </button>
                      )
                    }}
                  </Subscribe>
                )}
              </div>
            </>
          )}

          {!isSign && (
            <>
              {reg ? (
                <div className="hr-label">
                  <span className="hr-label__text">OR</span>
                </div>
              ) : null}
              {auth.links &&
                auth.links.map(({name, login, label}) => (
                  <a
                    key={name}
                    className="btn btn-primary auth-form"
                    href={login}
                  >
                    <span className={`icon ${name}`} />
                    Log in with {label}
                  </a>
                ))}
            </>
          )}
        </div>
      </SplashPage>
    </div>
  )
}

const mapDispatchToProps = {
  handleLogin: loginAsync,
  handleCreateUser: createUserAsync,
}

const {array, bool, shape, string, func} = PropTypes

Login.propTypes = {
  authData: shape({
    auth: shape({
      me: shape(),
      links: array,
      isLoading: bool,
    }),
    passwordPolicy: shape(),
    passwordPolicyMessage: shape(),
  }),
  location: shape({
    pathname: string,
  }),
  handleLogin: func,
  handleCreateUser: func,
}

export default connect(null, mapDispatchToProps)(Login)
