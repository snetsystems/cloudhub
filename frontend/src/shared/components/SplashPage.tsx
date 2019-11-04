import React, {SFC, ReactElement} from 'react'

interface Props {
  children: ReactElement<any>
}

const SplashPage: SFC<Props> = ({children}) => (
  <div className="auth-page">
    <div className="auth-box">
      <div className="auth-logo" />
      {children}
    </div>
    <p className="auth-credits">
      Copyright by &copy;Snetsystems (Derived by{' '}
      <span className="icon cubo-uniform" />Chronograf)
    </p>
    <div className="auth-image" />
  </div>
)

export default SplashPage
