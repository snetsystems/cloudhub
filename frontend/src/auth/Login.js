import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import {Link, withRouter} from 'react-router'
import _ from 'lodash'
import {Radio, ButtonShape} from 'src/reusable_ui'
import Notifications from 'src/shared/components/Notifications'
import PageSpinner from 'src/shared/components/PageSpinner'
import SplashPage from 'src/shared/components/SplashPage'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {loginAsync, createUserAsync} from 'src/auth/actions'
import {notifyLoginCheck} from 'src/shared/copy/notifications'
import {LOGIN_AUTH_TYPE, BASIC_PASSWORD_RESET_TYPE} from 'src/auth/constants'

const VERSION = process.env.npm_package_version

class Login extends PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      name: '',
      password: '',
      passwordConfirm: '',
      email: '',
      activeEditorTab: 'Login',
    }
  }

  handleInputChange = fieldName => e => {
    this.setState({[fieldName]: e.target.value.trim()})
  }

  handleLoginSubmit = _.debounce(() => {
    const {router, basicauth, retryPolicys, handleLogin, notify} = this.props
    const {name, password} = this.state

    if (_.isEmpty(name) || _.isEmpty(password)) {
      notify(notifyLoginCheck())
      return
    }

    handleLogin({
      url: basicauth.login,
      user: {name, password},
      retryPolicys,
    }).then(({data}) => {
      if (data?.passwordResetFlag === 'N') {
        router.go('/')
      } else {
        router.push({
          pathname: '/otp-login',
          state: {name},
        })
      }
    })
  }, 250)

  handleSignupSubmit = _.debounce((isValidPassword, isValidPasswordConfirm) => {
    const {handleCreateUser} = this.props
    const {name, password, email} = this.state

    if (isValidPassword && isValidPasswordConfirm) {
      handleCreateUser({
        url: '/basic/users',
        user: {name, password, email},
      }).then(({status}) => {
        if (status === 201) {
          this.onClickActiveEditorTab('Login')
        }
      })
    }
  }, 250)

  onClickLoginSubmit = () => {
    this.handleLoginSubmit()
  }

  onClickSignUpSubmit = (isValidPassword, isValidPasswordConfirm) => {
    this.handleSignupSubmit(isValidPassword, isValidPasswordConfirm)
  }

  onClickActiveEditorTab = tab => {
    this.setState({
      name: '',
      password: '',
      passwordConfirm: '',
      email: '',
      activeEditorTab: tab,
    })
  }

  render() {
    const {
      router,
      auth,
      passwordPolicy,
      passwordPolicyMessage,
      loginAuthType,
      basicPasswordResetType,
    } = this.props

    const {name, password, passwordConfirm, email, activeEditorTab} = this.state
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
            {loginAuthType !== LOGIN_AUTH_TYPE.OAUTH && reg && (
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
                        value={name}
                        onChange={this.handleInputChange('name')}
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
                        onChange={this.handleInputChange('password')}
                        onKeyPress={
                          isSign
                            ? null
                            : e => {
                                if (e.key === 'Enter') {
                                  this.handleLoginSubmit()
                                }
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
                            onChange={this.handleInputChange('passwordConfirm')}
                            onKeyPress={
                              isSign
                                ? e => {
                                    if (e.key === 'Enter') {
                                      this.handleSignupSubmit(
                                        isValidPassword,
                                        isValidPasswordConfirm
                                      )
                                    }
                                  }
                                : null
                            }
                            spellCheck={false}
                          />
                          {isSign &&
                            passwordConfirm.length > 0 &&
                            !isValidPasswordConfirm && (
                              <div className={`form-message fm--danger`}>
                                Password confirmation doesn't match password.
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
                            onChange={this.handleInputChange('email')}
                            onKeyPress={
                              isSign
                                ? e => {
                                    if (e.key === 'Enter') {
                                      this.handleSignupSubmit(
                                        isValidPassword,
                                        isValidPasswordConfirm
                                      )
                                    }
                                  }
                                : null
                            }
                            spellCheck={false}
                          />
                          <div className="form-message fm--info">
                            Email will be used for OTP delivery when a password
                            reset.
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {!isSign &&
                    basicPasswordResetType !==
                      BASIC_PASSWORD_RESET_TYPE.ADMIN && (
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
                      onClick={() =>
                        this.onClickSignUpSubmit(
                          isValidPassword,
                          isValidPasswordConfirm
                        )
                      }
                    >
                      Sign Up
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm col-md-12"
                      onClick={this.onClickLoginSubmit}
                    >
                      Login
                    </button>
                  )}
                </div>
              </>
            )}
            {loginAuthType === LOGIN_AUTH_TYPE.MIX &&
              !isSign &&
              auth.links.length > 0 &&
              reg && (
                <div className="hr-label">
                  <span className="hr-label__text">OR</span>
                </div>
              )}
            {loginAuthType !== LOGIN_AUTH_TYPE.BASIC &&
              !isSign &&
              auth.links &&
              _.map(auth.links, link => (
                <a
                  key={link.name}
                  className="btn btn-primary auth-form"
                  href={link.login}
                >
                  <span className={`icon ${link.name}`} />
                  Log in with {link.label}
                </a>
              ))}
          </div>
        </SplashPage>
      </div>
    )
  }
}
const mapStatetoProps = ({
  auth,
  links: {
    basicauth,
    passwordPolicy,
    passwordPolicyMessage,
    loginAuthType,
    basicPasswordResetType,
    retryPolicys,
  },
}) => ({
  auth,
  basicauth,
  passwordPolicy,
  passwordPolicyMessage,
  loginAuthType,
  basicPasswordResetType,
  retryPolicys,
})
const mapDispatchToProps = {
  handleLogin: loginAsync,
  handleCreateUser: createUserAsync,
  notify: notifyAction,
}
const {array, bool, shape, string, func} = PropTypes
Login.propTypes = {
  router: shape().isRequired,
  auth: shape({
    me: shape(),
    links: array,
    isLoading: bool,
  }),
  links: shape({
    basicauth: shape(),
    basicauth: string,
    passwordPolicy: string,
    passwordPolicyMessage: string,
    retryPolicys: array,
  }),
  location: shape({
    pathname: string,
  }),
  handleLogin: func.isRequired,
  handleCreateUser: func.isRequired,
  notify: func.isRequired,
}
export default connect(mapStatetoProps, mapDispatchToProps)(Login)
