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
      Made by &copy;Snetsystems{' '}
      {/*(Powered by{' '}
      <span className="icon cubo-uniform" />InfluxData)*/}
    </p>
    <div className="auth-image" />
  </div>
)

export default SplashPage
