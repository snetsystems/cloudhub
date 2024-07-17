import React, {PureComponent} from 'react'

// Components
import Dropdown from 'src/shared/components/Dropdown'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'

// Type
import {
  Kapacitor,
  KapacitorForNetworkDeviceOrganization,
  Source,
} from 'src/types'

interface Props {
  kapacitors: Kapacitor[]
  selectedKapacitor: KapacitorForNetworkDeviceOrganization
  source: Source
  kapacitorName: string
  buttonSize?: string
  setActiveKapacitor: (
    kapacitorForNetworkOrg: KapacitorForNetworkDeviceOrganization,
    kapacitor: Kapacitor
  ) => void
}

interface KapacitorItem {
  text: string
  kapacitor: Kapacitor
}

export default class DeviceManagementKapacitorDropdown extends PureComponent<Props> {
  public static defaultProps: Partial<Props> = {
    buttonSize: 'btn-xs',
  }

  public render() {
    if (this.isKapacitorsEmpty) {
      return (
        <Authorized requiredRole={EDITOR_ROLE}>
          <Dropdown
            className="dropdown-stretch"
            disabled={false}
            items={[]}
            onChoose={this.handleSetActiveKapacitor}
            selected={''}
          />
        </Authorized>
      )
    }

    return (
      <Authorized requiredRole={EDITOR_ROLE}>
        <Dropdown
          className="dropdown-stretch"
          items={this.kapacitorItems}
          onChoose={this.handleSetActiveKapacitor}
          selected={this.selected}
        />
      </Authorized>
    )
  }

  private convertKapacitor(
    kapacitor: Kapacitor
  ): KapacitorForNetworkDeviceOrganization {
    const {source} = this.props

    return {
      srcId: source.id,
      kapaId: kapacitor.id,
      url: kapacitor.url,
      username: kapacitor.username,
      password: kapacitor.password,
      insecure_skip_verify: kapacitor.insecureSkipVerify,
    }
  }

  private handleSetActiveKapacitor = (item: KapacitorItem) => {
    const {setActiveKapacitor} = this.props

    setActiveKapacitor(this.convertKapacitor(item.kapacitor), item.kapacitor)
  }

  private get isKapacitorsEmpty(): boolean {
    const {kapacitors} = this.props
    return !kapacitors || kapacitors.length === 0
  }

  private get kapacitorItems(): KapacitorItem[] {
    const {kapacitors} = this.props

    return kapacitors.map(k => {
      const kapacitorUrl = k?.url || ''
      const kapacitorName = k?.name ? `${k.name} @ ` : ''

      return {
        text: `${kapacitorName}${kapacitorUrl}`,
        kapacitor: k,
      }
    })
  }

  private get selected(): string {
    const {selectedKapacitor, kapacitorName} = this.props
    const selectedKapacitorUrl = selectedKapacitor?.url || ''
    const _kapacitorName = kapacitorName ? `${kapacitorName} @ ` : ''

    return `${_kapacitorName}${selectedKapacitorUrl}`
  }
}
