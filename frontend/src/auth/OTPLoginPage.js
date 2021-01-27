import React, {PureComponent} from 'react'
import _ from 'lodash'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'

import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

import {loginAsync, otpChangeAsync} from 'src/auth/actions'

class OTPLoginPage extends PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      name: '',
      password: '',
      passwordConfirm: '',
    }
  }

  handleOTPChangeSubmit = _.debounce(
    (isValidPassword, isValidPasswordConfirm) => {
      const {
        router,
        authData: {basicauth, basicPassword},
        handleOTPChange,
        handleLogin,
      } = this.props
      const {name, password} = this.state

      let user = {
        name,
      }

      if (isValidPassword && isValidPasswordConfirm) {
        user = {
          ...user,
          password,
        }
      }

      handleOTPChange({url: basicPassword, user}).then(res => {
        if (res.status === 200) {
          setTimeout(() => {
            handleLogin({url: basicauth.login, user}).then(() => {
              router.go('/')
            })
          }, 1000)
        }
      })
    },
    250
  )

  handleInputChange = fieldName => e => {
    this.setState({[fieldName]: e.target.value.trim()})
  }

  handleOnClickPasswordResetSubmit = (
    isValidPassword,
    isValidPasswordConfirm
  ) => {
    this.handleOTPChangeSubmit(isValidPassword, isValidPasswordConfirm)
  }

  handleKeyPressSubmit = (isValidPassword, isValidPasswordConfirm) => {
    return e => {
      if (e.key === 'Enter') {
        this.handleOTPChangeSubmit(isValidPassword, isValidPasswordConfirm)
      }
    }
  }

  componentDidMount = () => {
    const {name} = this.props.location.state

    if (_.isEmpty(name)) {
      router.push('/')
    }

    this.setState({name})
  }

  render() {
    const {
      router,
      authData: {
        basicauth,
        basicPassword,
        passwordPolicy,
        passwordPolicyMessage,
      },
    } = this.props
    const {name, password, passwordConfirm} = this.state

    let reg = null
    if (passwordPolicy) {
      reg = new RegExp(passwordPolicy && passwordPolicy, 'ig')
    }
    const isValidPassword = reg && password.length > 0 && reg.test(password)
    const isValidPasswordConfirm = reg && password === passwordConfirm
    return (
      <div>
        <Notifications />
        <SplashPage router={router}>
          <h1
            className="auth-text-logo"
            style={{
              position: 'absolute',
              top: '-9999px',
              left: '-9999px',
            }}
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
                      onChange={this.handleInputChange('password')}
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
                      onChange={this.handleInputChange('passwordConfirm')}
                      onKeyPress={this.handleKeyPressSubmit(
                        isValidPassword,
                        isValidPasswordConfirm
                      )}
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
                <button
                  className="btn btn-primary btn-sm col-md-12"
                  disabled={!isValidPassword || !isValidPasswordConfirm}
                  onClick={() => {
                    this.handleOnClickPasswordResetSubmit(
                      isValidPassword,
                      isValidPasswordConfirm
                    )
                  }}
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </SplashPage>
      </div>
    )
  }
}

const mapDispatchToProps = {
  handleLogin: loginAsync,
  handleOTPChange: otpChangeAsync,
}

const {shape, string, func} = PropTypes

OTPLoginPage.propTypes = {
  router: shape().isRequired,
  authData: shape({
    basicauth: shape().isRequired,
    passwordPolicy: string.isRequired,
    passwordPolicyMessage: string.isRequired,
  }).isRequired,
  handleOTPChange: func.isRequired,
  location: shape().isRequired,
  handleLogin: func.isRequired,
}

export default connect(null, mapDispatchToProps)(OTPLoginPage)
