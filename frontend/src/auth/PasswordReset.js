import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import _ from 'lodash'

import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

import {passwordResetAsync} from 'src/auth/actions'
import {AlertTypes} from 'src/kapacitor/constants'
import {BASIC_PASSWORD_RESET_TYPE} from 'src/auth/constants'
class PasswordReset extends PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      name: '',
    }
  }

  handleInputChange = fieldName => e => {
    this.setState({[fieldName]: e.target.value.trim()})
  }

  handlePasswordResetSubmit = _.debounce(() => {
    const {
      handlePasswordReset,
      router,
      authData: {basicPasswordReset},
    } = this.props

    const {name} = this.state

    handlePasswordReset({
      url: basicPasswordReset,
      path: `/kapacitor/v1/service-tests/${AlertTypes.smtp}`,
      name,
    }).then(res => {
      router.push('/')
    })
  }, 250)

  handleKeyPressSubmit = e => {
    if (!_.isEmpty(this.state.name) && e.key === 'Enter') {
      this.handlePasswordResetSubmit()
    }
  }

  handleOnClickPasswordResetSubmit = () => {
    this.handlePasswordResetSubmit()
  }

  componentDidMount = () => {
    const {
      router,
      authData: {passwordPolicy, basicPasswordResetType},
    } = this.props
    if (
      !passwordPolicy ||
      basicPasswordResetType === BASIC_PASSWORD_RESET_TYPE.ADMIN
    ) {
      router.push('/')
    }
  }

  render() {
    const {router} = this.props
    const {name} = this.state

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
          <div
            className={'auth-area'}
            style={{backgroundColor: '#292933', padding: '20px'}}
          >
            <div className="panel" style={{marginBottom: '0px'}}>
              <div
                className="panel-heading"
                style={{justifyContent: 'center', padding: '0 0 15px 0'}}
              >
                <h2 className="panel-title">Reset Your Password</h2>
              </div>
              <div className="panel-body" style={{padding: '0px'}}>
                <div style={{paddingBottom: '15px'}}>
                  Please, enter your ID, then we will send your reset password
                  to your email or an external community in a while.
                </div>
                <div className="form-group auth-form">
                  <input
                    className="form-control"
                    id="password-reset-email"
                    type="text"
                    placeholder={'ID'}
                    spellCheck={false}
                    value={name}
                    onChange={this.handleInputChange('name')}
                    onKeyPress={this.handleKeyPressSubmit}
                  />
                </div>
                <div className={'auth-button-bar'}>
                  <button
                    className="btn btn-primary btn-sm col-md-12"
                    disabled={_.isEmpty(name)}
                    onClick={this.handleOnClickPasswordResetSubmit}
                  >
                    Send Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SplashPage>
      </div>
    )
  }
}

const mapDispatchToProps = {
  handlePasswordReset: passwordResetAsync,
}

const {func, shape, string} = PropTypes

PasswordReset.propTypes = {
  router: shape(),
  handlePasswordReset: func,
  authData: shape({basicPasswordReset: string, passwordPolicy: string}),
}

export default connect(null, mapDispatchToProps)(PasswordReset)
