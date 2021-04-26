import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {withRouter, InjectedRouter, WithRouterProps} from 'react-router'

import _ from 'lodash'

import ConfirmButton from 'src/shared/components/ConfirmButton'
import Dropdown from 'src/shared/components/Dropdown'
import InputClickToEdit from 'src/shared/components/InputClickToEdit'

import {meChangeOrganizationAsync} from 'src/shared/actions/auth'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {DEFAULT_ORG_ID} from 'src/admin/constants/cloudhubAdmin'
import {USER_ROLES} from 'src/admin/constants/cloudhubAdmin'
import {Organization} from 'src/types'
import {Links} from 'src/types'

import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyCloudHubOrgInvalidName} from 'src/shared/copy/notifications'
import {Notification, NotificationFunc} from 'src/types'

interface CurrentOrganization {
  name: string
  id: string
}

interface Props extends WithRouterProps {
  organization: Organization
  currentOrganization: CurrentOrganization
  onDelete: (Organization) => void
  onRename: (Organization, newName: string) => void
  onChooseDefaultRole: (Organization, roleName: string) => void
  meChangeOrganization: (me: string, id) => void
  links: Links
  router: InjectedRouter
  notify: (message: Notification | NotificationFunc) => void
}

@ErrorHandling
class OrganizationsTableRow extends Component<Props, Record<string, never>> {
  public shouldComponentUpdate(nextProps: Props) {
    return !_.isEqual(this.props, nextProps)
  }

  public render() {
    const {organization, currentOrganization} = this.props

    const dropdownRolesItems = USER_ROLES.map(role => ({
      ...role,
      text: role.name,
    }))

    return (
      <div className="fancytable--row">
        <div className="fancytable--td orgs-table--active">
          {organization.id === currentOrganization.id ? (
            <button className="btn btn-sm btn-success">
              <span className="icon checkmark" /> Current
            </button>
          ) : (
            <button
              className="btn btn-sm btn-default"
              onClick={this.handleChangeCurrentOrganization}
            >
              <span className="icon shuffle" /> Switch to
            </button>
          )}
        </div>
        <InputClickToEdit
          value={organization.name}
          wrapperClass="fancytable--td orgs-table--name"
          onBlur={this.handleUpdateOrgName}
        />
        <div className="fancytable--td orgs-table--default-role">
          <Dropdown
            items={dropdownRolesItems}
            onChoose={this.handleChooseDefaultRole}
            selected={organization.defaultRole}
            className="dropdown-stretch"
          />
        </div>
        <ConfirmButton
          confirmAction={this.handleDeleteOrg}
          confirmText="Delete Organization?"
          size="btn-sm"
          square={true}
          icon="trash"
          disabled={organization.id === DEFAULT_ORG_ID}
        />
      </div>
    )
  }

  public handleChangeCurrentOrganization = async () => {
    const {router, links, meChangeOrganization, organization} = this.props

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await meChangeOrganization(links.me, {organization: organization.id})
    router.push('')
  }

  public handleUpdateOrgName = (newName: string) => {
    const {organization, onRename, notify} = this.props

    const extract = newName.match(/^\w+$/)
    if (!extract) {
      notify(notifyCloudHubOrgInvalidName())
      return
    }
    onRename(organization, newName)
  }

  public handleDeleteOrg = () => {
    const {onDelete, organization} = this.props
    onDelete(organization)
  }

  public handleChooseDefaultRole = role => {
    const {organization, onChooseDefaultRole} = this.props
    onChooseDefaultRole(organization, role.name)
  }
}

const mapStateToProps = ({links}) => ({
  links,
})

const mapDispatchToProps = dispatch => ({
  meChangeOrganization: bindActionCreators(meChangeOrganizationAsync, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(OrganizationsTableRow))
