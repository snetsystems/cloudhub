// libraries
import React from 'react'
import {PureComponent} from 'react'
import _ from 'lodash'

// types
import {OpenStackCspInput} from 'src/types/providerConf'
import {RemoteDataState} from 'src/types'

// constants
import {HandleType} from 'src/admin/constants/providerConf'
import {ComponentColor, ComponentSize, SlideToggle} from 'src/reusable_ui'

// components
import PageSpinner from 'src/shared/components/PageSpinner'

interface Props {
  onHandleSubmit: (properties: object, handleType) => Promise<void>
  cspInput: OpenStackCspInput
  pageStatus: RemoteDataState
}

interface State {
  isActiveToggle: boolean
}
export class ProviderOpenStackConfigs extends PureComponent<Props, State> {
  private projectName: HTMLInputElement
  private authUrl: HTMLInputElement
  private userName: HTMLInputElement
  private password: HTMLInputElement
  private projectDomain: HTMLInputElement
  private userDomain: HTMLInputElement

  constructor(props) {
    super(props)

    this.handleSubmit = this.handleSubmit.bind(this)

    this.state = {
      isActiveToggle: this.props.cspInput.hasProjectOption,
    }
  }

  public render() {
    const {
      cspInput: {
        id,
        projectName,
        authUrl,
        userName,
        password,
        projectDomain,
        userDomain,
      },
      pageStatus,
    } = this.props
    const {isActiveToggle} = this.state

    return (
      <div className="provider-conf-api-credentials config-endpoint--tab-contents">
        {(pageStatus === RemoteDataState.Loading ||
          pageStatus === RemoteDataState.NotStarted) && (
          <div className={'loading-box'}>
            <PageSpinner />
          </div>
        )}
        <form className="container-fluid h-100">
          <div className="form-group col-xs-12 col-md-6">
            <label htmlFor="projectName">Project Name</label>

            <input
              placeholder="Project Name"
              type="text"
              className="form-control"
              disabled={true}
              key={projectName}
              ref={r => (this.projectName = r)}
              defaultValue={projectName || ''}
            />
          </div>
          <div className="form-group col-xs-12 col-md-6">
            <label htmlFor="authUrl">Auth URL</label>
            <input
              type="text"
              placeholder="Auth URL"
              className="form-control"
              disabled={true}
              key={authUrl}
              ref={r => (this.authUrl = r)}
              defaultValue={authUrl || ''}
            />
          </div>
          <div className="form-group col-xs-12 col-md-6">
            <label htmlFor="userName">User Name</label>
            <input
              type="text"
              placeholder="User Name"
              className="form-control"
              disabled={true}
              key={userName}
              ref={r => (this.userName = r)}
              defaultValue={userName || ''}
            />
          </div>
          <div className="form-group col-xs-12 col-md-6">
            <label htmlFor="password">Pawssord</label>
            <input
              type="password"
              placeholder="Pawssord"
              className="form-control"
              disabled={true}
              key={password}
              ref={r => (this.password = r)}
              defaultValue={password || ''}
            />
          </div>
          <div className="form-group col-xs-12 col-md-6">
            <label htmlFor="projectDomain">Project Domain</label>

            <input
              type="text"
              placeholder="Project Domain"
              className="form-control"
              key={projectDomain}
              disabled={true}
              ref={r => (this.projectDomain = r)}
              defaultValue={projectDomain || ''}
            />
          </div>
          <div className="form-group col-xs-12 col-md-6">
            <label htmlFor="userDomain">User Domain</label>
            <input
              type="text"
              placeholder="User Domain"
              className="form-control"
              disabled={true}
              key={userDomain}
              ref={r => (this.userDomain = r)}
              defaultValue={userDomain || ''}
            />
          </div>
          <div
            style={{display: 'flex', justifyContent: 'center'}}
            className="form-group form-group-submit col-xs-12 text-center"
          >
            <button
              style={{marginLeft: '13em'}}
              className="btn btn-primary"
              onClick={this.handleSubmit}
              type="button"
            >
              <span className="icon checkmark"></span>
              {id ? HandleType.Delete : HandleType.Create}
            </button>

            <div style={{marginLeft: '1em'}} className="all-users-admin-toggle">
              <SlideToggle
                active={isActiveToggle}
                onChange={this.handleToggleClick}
                size={ComponentSize.ExtraSmall}
                color={ComponentColor.Success}
              />
              <span
                onClick={this.handleToggleClick}
                className="wizard-checkbox--label"
              >
                in OpenStack, too.
              </span>
            </div>
          </div>
        </form>
      </div>
    )
  }
  private handleToggleClick = () => {
    const {isActiveToggle} = this.state
    this.setState(prevState => ({
      ...prevState,
      isActiveToggle: !isActiveToggle,
    }))
  }
  private handleSubmit = async e => {
    e.preventDefault()

    const {id} = this.props.cspInput

    const properties = {
      id: id || '',
      projectName: this.projectName.value,
      authUrl: this.authUrl.value,
      userName: this.userName.value,
      password: this.password.value,
      projectDomain: this.projectDomain.value,
      userDomain: this.userDomain.value,
      hasProjectOption: this.state.isActiveToggle,
    }
    const handleType = id ? HandleType.Delete : HandleType.Create
    await this.props.onHandleSubmit(properties, handleType)
  }
}
