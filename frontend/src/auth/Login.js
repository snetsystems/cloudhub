import React, {useState, useEffect} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {Link} from 'react-router'

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

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [activeEditorTab, setActiveEditorTab] = useState('Login')

  const onChangeEmail = e => {
    setEmail(e.target.value)
  }

  const onChangePassword = e => {
    setPassword(e.target.value)
  }

  const onChangePasswordConfirm = e => {
    setPasswordConfirm(e.target.value)
  }

  const onClickLogin = () => {
    handleLogin({url: 'url', user: {id: email, password}})
  }

  const onClickSignUp = () => {
    handleCreateUser({url: 'url', user: {id: email, password}})
  }

  const onSetActiveEditorTab = tab => {
    setActiveEditorTab(tab)
  }

  useEffect(() => {
    setEmail('')
    setPassword('')
    setPasswordConfirm('')
  }, [activeEditorTab])

  useEffect(() => {}, [passwordPolicy])

  let reg = null
  if (passwordPolicy) {
    reg = new RegExp(passwordPolicy && passwordPolicy.url, 'ig')
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

              <div className="form-group auth-form">
                <input
                  className="form-control"
                  id="user-email"
                  type="text"
                  placeholder={'yours@example.com'}
                  value={email}
                  onChange={onChangeEmail}
                  spellCheck={false}
                />
                {isSign && (
                  <div>
                    <strong>You can use letters, numbers &#38; periods </strong>
                  </div>
                )}
              </div>
              <div className="form-group auth-form">
                <input
                  className="form-control"
                  id="user-password"
                  type="password"
                  placeholder={'password'}
                  value={password}
                  onChange={onChangePassword}
                  spellCheck={false}
                />
                {isSign && !isValidPassword && passwordPolicyMessage?.url}
              </div>
              {isSign ? (
                <div className="form-group auth-form">
                  <input
                    className="form-control"
                    id="user-password-confirm"
                    type="password"
                    placeholder={'password confirm'}
                    value={passwordConfirm}
                    onChange={onChangePasswordConfirm}
                    spellCheck={false}
                  />
                  {passwordConfirm.length > 0 && !isValidPasswordConfirm && (
                    <div>
                      Your password and confirmation password do not match.
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/password-reset">
                  <span>Forgot your password?</span>
                </Link>
              )}
              <div className={'auth-button-bar'}>
                {isSign ? (
                  <button
                    className="btn btn-primary btn-sm col-md-12"
                    disabled={
                      !reg ||
                      !passwordPolicyMessage ||
                      email.length === 0 ||
                      isValidPassword === false ||
                      isValidPasswordConfirm === false
                    }
                    onClick={onClickSignUp}
                  >
                    Sign Up
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm col-md-12"
                    onClick={onClickLogin}
                  >
                    Login
                  </button>
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
