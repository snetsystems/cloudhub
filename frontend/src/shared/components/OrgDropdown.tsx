// Libraries
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {withRouter, WithRouterProps} from 'react-router'
import _ from 'lodash'

// Components
import {Dropdown, IconFont} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'

// Actions
import {meChangeOrganizationAsync} from 'src/shared/actions/auth'

// Types
import {Me, Role, Organization} from 'src/types'
import {Links} from 'src/types/auth'

interface Props {
  me: Me
  links: Links
  meChangeOrg: (url: string, organization: Organization) => Promise<void>
}

@ErrorHandling
class OrgDropdown extends Component<Props & WithRouterProps> {
  public render() {
    const {me} = this.props
    
    // Safety check in case 'me' is not properly populated
    if (!me || !me.organizations || !me.roles || me.roles.length === 0) {
      return null
    }

    return (
      <div style={{marginRight: '8px'}}>
        <Dropdown
          icon={IconFont.Cube}
          widthPixels={220}
          onChange={this.handleDropdownChange}
          selectedID={this.selectedID}
        >
          {this.dropdownItems}
        </Dropdown>
      </div>
    )
  }

  private handleDropdownChange = async (role: Role) => {
    const {router, links, meChangeOrg} = this.props
    try {
      await meChangeOrg(links.me, {organization: role.organization} as any)
      router.push('')
    } catch (error) {
      console.error(error)
    }
  }

  private get selectedID(): string {
    const {me} = this.props
    
    if (me.currentOrganization && me.currentOrganization.id) {
      return me.currentOrganization.id
    }
    
    // Fallback if currentOrganization is not fully populated
    if (me.roles.length > 0) {
      return me.roles[0].organization
    }
    
    return ''
  }

  private get dropdownItems(): JSX.Element[] {
    const {me} = this.props

    return me.roles.map(role => {
      const orgName = this.getOrgName(role)
      return (
        <Dropdown.Item key={role.organization} id={role.organization} value={role}>
          {orgName} ({role.name})
        </Dropdown.Item>
      )
    })
  }

  private getOrgName(role: Role): string {
    const {me} = this.props
    if (!me.organizations) return ''
    const org = me.organizations.find(o => o.id === role.organization)
    return org ? org.name : ''
  }
}

const mstp = ({auth: {me}, links}) => ({
  me,
  links,
})

const mdtp = {
  meChangeOrg: meChangeOrganizationAsync,
}

export default connect(mstp, mdtp)(withRouter<Props>(OrgDropdown))
