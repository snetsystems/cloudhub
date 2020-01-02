import React, {ChangeEvent, PureComponent} from 'react'

interface Props {
  onLoginClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  onLogoutClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  onChangeUrl: (e: ChangeEvent<HTMLInputElement>) => void
  onChangeId: (e: ChangeEvent<HTMLInputElement>) => void
  onChangePwd: (e: ChangeEvent<HTMLInputElement>) => void
  masterUrl: string
  masterId: string
  masterPwd: string
  isTokenCheck: boolean
}

class AgentConnectForm extends PureComponent<Props> {
  public render() {
    const {
      onLoginClick,
      onLogoutClick,
      onChangeUrl,
      onChangeId,
      onChangePwd,
      masterUrl,
      masterId,
      masterPwd,
      isTokenCheck,
    } = this.props

    return (
      <>
        {isTokenCheck === false ? (
          <>
            <div className="agent-input--container">
              <input
                type="url"
                className="form-control input-sm agent--input agent--input-address"
                onChange={onChangeUrl}
                value={masterUrl}
              />
              <input
                className="form-control input-sm agent--input agent--input-id"
                placeholder="Insert Host ID"
                onChange={onChangeId}
                value={masterId}
              />
              <input
                type="password"
                className="form-control input-sm agent--input agent--input-password"
                placeholder="Insert Host Password"
                onChange={onChangePwd}
                value={masterPwd}
              />
            </div>
            <button className="btn btn-sm btn-primary" onClick={onLoginClick}>
              {' '}
              LOGIN
            </button>
            {/* <span
                className="icon icon-login agent-login"
                onClick={this.handleLogin}
              >
                LOGIN
              </span> */}
          </>
        ) : (
          <>
            <button className="btn btn-sm btn-primary" onClick={onLogoutClick}>
              LOGOUT
            </button>
          </>
        )}
      </>
    )
  }
}

export default AgentConnectForm
