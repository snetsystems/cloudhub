import React, {useState} from 'react'

import Notifications from 'src/shared/components/Notifications'
import SplashPage from 'src/shared/components/SplashPage'

const PasswordReset = () => {
  const [email, setEmail] = useState('')

  const onChangeEmail = e => {
    setEmail(e.target.value)
  }

  const onClickPasswordReset = () => {
    console.log('onClickPasswordReset')
    // success  or failed
    // success
    // success notification and router.goBack()
    // failed
    // failed notification
  }

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
              <h2 className="panel-title">Reset Your Password</h2>
            </div>
            <div className="panel-body" style={{padding: '0px'}}>
              <div style={{paddingBottom: '15px'}}>
                Please enter your email address. We will send you an email to
                reset your password.
              </div>
              <div className="form-group auth-form">
                <input
                  className="form-control"
                  id="password-reset-email"
                  type="text"
                  placeholder={'yours@example.com'}
                  spellCheck={false}
                  value={email}
                  onChange={onChangeEmail}
                />
              </div>
              <div className={'auth-button-bar'}>
                <button
                  className="btn btn-primary btn-sm col-md-12"
                  onClick={onClickPasswordReset}
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

export default PasswordReset
