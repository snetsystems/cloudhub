import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import _ from 'lodash'

import SplashPage from 'src/shared/components/SplashPage'
import PageSpinner from 'src/shared/components/PageSpinner'

import {getUserAsync, updateUserAsync} from 'src/auth/actions'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyUserPasswordInputError} from 'src/shared/copy/notifications'

class UpdateUser extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      email: '',
      password: '',
      passwordConfirm: '',
      isFetching: false,
    }
  }

  getUser = () => {
    const {
      auth: {me},
      handleGetUser,
    } = this.props

    return handleGetUser({url: `/cloudhub/v1/users/${me.id}`})
  }

  handleInputChange = fieldName => e => {
    this.setState({[fieldName]: e.target.value.trim()})
  }

  handleKeyPressSubmit = (isValidPassword, isValidPasswordConfirm) => e => {
    if (e.key === 'Enter') {
      e.target.blur()
      this.handleUpdateUserSubmit(isValidPassword, isValidPasswordConfirm)
    }
  }

  handleClickSubmit = (isValidPassword, isValidPasswordConfirm) => e => {
    e.target.blur()
    this.handleUpdateUserSubmit(isValidPassword, isValidPasswordConfirm)
  }

  handleUpdateUserSubmit = _.debounce(
    (isValidPassword, isValidPasswordConfirm) => {
      const {
        auth: {me},
        notify,
        handleUpdateUser,
      } = this.props
      const {password, email} = this.state

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
      this.setState({isFetching: true})

      this.getUser()
        .then(({data}) => {
          let user = {
            email,
            superAdmin: data.superAdmin,
          }

          if (isValidPassword && isValidPasswordConfirm) {
            user = {
              ...user,
              password,
            }
          }

          handleUpdateUser({url: `/cloudhub/v1/users/${me.id}`, user}).then(
            res => {
              this.setState({email: '', password: '', passwordConfirm: ''})
              if (res.data?.email) {
                this.setState({
                  email: res.data.email,
                })
              }
            }
          )
        })
        .finally(() => {
          this.setState({isFetching: false})
        })
    },
    250
  )

  componentDidMount = () => {
    const {
      router,
      auth: {me},
      links: {passwordPolicy},
    } = this.props
    if (me.provider !== 'cloudhub' || !passwordPolicy) {
      router.path('/')
    }

    this.getUser().then(({data}) => {
      if (data?.email) {
        this.setState({email: data.email})
      } else {
        this.setState({email: ''})
      }
    })
  }

  render() {
    const {
      router,
      links: {passwordPolicy, passwordPolicyMessage},
      auth: {me},
    } = this.props
    const {password, passwordConfirm, email, isFetching} = this.state

    const reg = new RegExp(passwordPolicy, 'ig')
    const isValidPassword = password.length > 0 && reg.test(password)
    const isValidPasswordConfirm = password === passwordConfirm
    return (
      <div>
        <SplashPage isShowCopy={false} isShowLogo={false} router={router}>
          {isFetching && (
            <div
              style={{
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  zIndex: '2',
                }}
              >
                <PageSpinner />
              </div>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  zIndex: '1',
                  background: 'rgba(0,0,0,0.6)',
                }}
              />
            </div>
          )}
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
                <h2 className="panel-title">Edit Account</h2>
              </div>
              <div className="panel-body" style={{padding: '0px'}}>
                <div className="form-group">
                  <label>User ID</label>
                  <div className="auth-form">
                    <input
                      className="form-control"
                      type="text"
                      spellCheck={false}
                      value={me.name}
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
                      onChange={this.handleInputChange('password')}
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
                      onChange={this.handleInputChange('passwordConfirm')}
                      onKeyPress={this.handleKeyPressSubmit(
                        isValidPassword,
                        isValidPasswordConfirm
                      )}
                    />
                    {passwordConfirm && !isValidPasswordConfirm && (
                      <div className={`form-message fm--danger`}>
                        Password confirmation doesn't match password.
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
                      onKeyPress={this.handleKeyPressSubmit(
                        isValidPassword,
                        isValidPasswordConfirm
                      )}
                      onChange={this.handleInputChange('email')}
                    />
                    <div className="form-message fm--info">
                      Email will be used for OTP delivery when a password reset.
                    </div>
                  </div>
                </div>
                <div className={'auth-button-bar'}>
                  <button
                    className="btn btn-primary btn-sm col-md-8"
                    onClick={this.handleClickSubmit(
                      isValidPassword,
                      isValidPasswordConfirm
                    )}
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SplashPage>
        {isFetching && (
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              zIndex: '45',
              background: 'rgba(0,0,0,0.3)',
            }}
          />
        )}
      </div>
    )
  }
}

const mapDispatchToProps = {
  handleUpdateUser: updateUserAsync,
  handleGetUser: getUserAsync,
  notify: notifyAction,
}

const {array, bool, shape, string, func} = PropTypes

UpdateUser.propTypes = {
  router: shape(),
  auth: shape({
    me: shape().isRequired,
    links: array,
    isLoading: bool,
  }),
  links: shape({
    passwordPolicy: string,
    passwordPolicyMessage: string,
  }).isRequired,
  handleGetUser: func.isRequired,
  handleUpdateUser: func.isRequired,
  notify: func.isRequired,
}

export default connect(null, mapDispatchToProps)(UpdateUser)
