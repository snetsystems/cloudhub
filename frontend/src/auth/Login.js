import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {Link, withRouter} from 'react-router'
import _ from 'lodash'

import {Radio, ButtonShape} from 'src/reusable_ui'
import Notifications from 'src/shared/components/Notifications'
import PageSpinner from 'src/shared/components/PageSpinner'
import SplashPage from 'src/shared/components/SplashPage'

import {notify} from 'src/shared/actions/notifications'
import {loginAsync, createUserAsync} from 'src/auth/actions'

import {notifyLoginCheck} from 'src/shared/copy/notifications'

const VERSION = process.env.npm_package_version
class Login extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      id: '',
      password: '',
      passwordConfirm: '',
      email: '',
      activeEditorTab: 'Login',
    }
  }

  onChangeId = e => {
    this.setState({id: e.target.value})
  }

  onChangePassword = e => {
    this.setState({password: e.target.value})
  }

  onChangePasswordConfirm = e => {
    this.setState({passwordConfirm: e.target.value})
  }

  onChangeEmail = e => {
    this.setState({email: e.target.value})
  }

  onClickActiveEditorTab = tab => {
    this.setState({
      id: '',
      password: '',
      passwordConfirm: '',
      email: '',
      activeEditorTab: tab,
    })
  }

  onClickLogin = _.debounce(() => {
    const {
      router,
      authData: {basicauth},
      handleLogin,
      notify,
    } = this.props
    const {id, password} = this.state

    if (_.isEmpty(id) || _.isEmpty(password)) {
      notify(notifyLoginCheck())
      return
    }

    handleLogin({
      url: basicauth.login,
      user: {id, password},
    }).then(({data}) => {
      if (data?.passwordResetFlag === 'N') {
        router.go('/')
      } else {
        router.push({
          pathname: '/password-otp',
          state: {id},
        })
      }
    })
  }, 250)

  onClickSignUp = () => {
    const {handleCreateUser} = this.props
    const {id, password, email} = this.state

    handleCreateUser({url: '/basic/users', user: {id, password, email}}).then(
      ({status}) => {
        if (status === 201) {
          this.onClickActiveEditorTab('Login')
        }
      }
    )
  }

  render() {
    const {
      router,
      authData: {auth, basicauth, passwordPolicy, passwordPolicyMessage, links},
      handleLogin,
      handleCreateUser,
    } = this.props

    const {id, password, passwordConfirm, email, activeEditorTab} = this.state

    const isSign = activeEditorTab === 'SignUp'
    let reg = null
    let isValidPassword = false
    let isValidPasswordConfirm = false

    if (passwordPolicy) {
      reg = new RegExp(passwordPolicy, 'ig')
    }

    if (reg) {
      if (password) {
        isValidPassword = reg.test(password)
        isValidPasswordConfirm = password === passwordConfirm
      }
    }

    return auth.isAuthLoading ? (
      <PageSpinner />
    ) : (
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
                    onClick={this.onClickActiveEditorTab}
                  >
                    Login
                  </Radio.Button>
                  <Radio.Button
                    id="auth-sign-up"
                    titleText="SignUp"
                    value="SignUp"
                    active={activeEditorTab === 'SignUp'}
                    onClick={this.onClickActiveEditorTab}
                  >
                    Sign up
                  </Radio.Button>
                </Radio>
                <>
                  <div className="form-group">
                    {isSign && <label>User ID</label>}
                    <div className="auth-form">
                      <input
                        className="form-control"
                        type="text"
                        placeholder={'id'}
                        value={id}
                        onChange={this.onChangeId}
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
                        onChange={this.onChangePassword}
                        onKeyDown={
                          isSign
                            ? null
                            : e => {
                                e.key === 'Enter' && this.onClickLogin()
                              }
                        }
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
                  {isSign && (
                    <>
                      <div className="form-group">
                        <div className="auth-form">
                          <input
                            className="form-control"
                            type="password"
                            placeholder={'password confirm'}
                            value={passwordConfirm}
                            onChange={this.onChangePasswordConfirm}
                            spellCheck={false}
                          />

                          {isSign &&
                            passwordConfirm.length > 0 &&
                            !isValidPasswordConfirm && (
                              <div className={`form-message fm--danger`}>
                                Your password and confirmation password do not
                                match.
                              </div>
                            )}
                          {isSign &&
                            isValidPassword &&
                            isValidPasswordConfirm && (
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
                            onChange={this.onChangeEmail}
                            spellCheck={false}
                          />
                          <div className="form-message fm--info">
                            It is used for OTP delivery when initializing
                            password.
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {!isSign && (
                    <Link to="/password-reset">
                      <span>Forgot your password?</span>
                    </Link>
                  )}
                </>

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
                      onClick={this.onClickSignUp}
                    >
                      Sign Up
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm col-md-12"
                      onClick={this.onClickLogin}
                    >
                      Login
                    </button>
                  )}
                </div>
              </>
            )}
            {!isSign && auth.links && reg && (
              <div className="hr-label">
                <span className="hr-label__text">OR</span>
              </div>
            )}
            {!isSign &&
              auth.links &&
              _.map(auth.links, ({name, login, label}) => (
                <a
                  key={name}
                  className="btn btn-primary auth-form"
                  href={login}
                >
                  <span className={`icon ${name}`} />
                  Log in with {label}
                </a>
              ))}
          </div>
        </SplashPage>
      </div>
    )
  }
}

const mapDispatchToProps = {
  handleLogin: loginAsync,
  handleCreateUser: createUserAsync,
  notify,
}

const {array, bool, shape, string, func} = PropTypes

Login.propTypes = {
  authData: shape({
    auth: shape({
      me: shape(),
      links: array,
      isLoading: bool,
    }),
    passwordPolicy: string,
    passwordPolicyMessage: string,
  }),
  location: shape({
    pathname: string,
  }),
  handleLogin: func,
  handleCreateUser: func,
  notify: func.isRequired,
}

export default connect(null, mapDispatchToProps)(withRouter(Login))
