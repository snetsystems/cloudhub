import React, {useState, useEffect} from 'react'
import PropTypes from 'prop-types'
import {Link} from 'react-router'

import {Radio, ButtonShape} from 'src/reusable_ui'
import Notifications from 'src/shared/components/Notifications'
import PageSpinner from 'src/shared/components/PageSpinner'
import SplashPage from 'src/shared/components/SplashPage'

const VERSION = process.env.npm_package_version

const Login = ({authData: {auth, regexp, passwordPolicyMessage}}) => {
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
    console.log('try log in')
  }

  const onClickSignUp = () => {
    console.log('try sign up')
  }

  const onSetActiveEditorTab = tab => {
    setActiveEditorTab(tab)
  }

  useEffect(() => {
    setEmail('')
    setPassword('')
    setPasswordConfirm('')
  }, [activeEditorTab])

  const reg = new RegExp(regexp.url, 'ig')
  const isValidPassword = password.length > 0 && reg.test(password)
  const isValidPasswordConfirm = password === passwordConfirm
  const isSign = activeEditorTab === 'SignUp'
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
        <p>
          <b>{VERSION}</b> / Real-Time Applications Monitoring
        </p>
        <div className={'auth-area'}>
          <Radio shape={ButtonShape.StretchToFit} customClass={'auth-radio'}>
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
            {isSign ? (
              <div>
                <strong>You can use letters, numbers &#38; periods </strong>
              </div>
            ) : null}
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
            {isSign && !isValidPassword ? passwordPolicyMessage.url : null}
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
              {passwordConfirm.length > 0 && !isValidPasswordConfirm ? (
                <div>Your password and confirmation password do not match.</div>
              ) : null}
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
          {isSign ? null : (
            <>
              <div className="hr-label">
                <span className="hr-label__text">OR</span>
              </div>
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

const {array, bool, shape, string} = PropTypes

Login.propTypes = {
  authData: shape({
    auth: shape({
      me: shape(),
      links: array,
      isLoading: bool,
    }),
    regexp: shape(),
    passwordPolicyMessage: shape(),
  }),
  location: shape({
    pathname: string,
  }),
}

export default Login
