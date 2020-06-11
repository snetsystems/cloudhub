import React, {PureComponent, MouseEvent} from 'react'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'

import {ErrorHandling} from 'src/shared/decorators/errors'
import SlackConfig from 'src/kapacitor/components/config/SlackConfig'
import {SlackProperties} from 'src/types/kapacitor'
import {Me, Organization} from 'src/types'

interface Config {
  options: {
    url: boolean
    channel: string
    workspace: string
  }
}

interface Props {
  configs: Config[]
  onSave: (
    properties: SlackProperties,
    isNewConfigInSection: boolean,
    specificConfig: string
  ) => Promise<boolean>
  onDelete: (specificConfig: string) => void
  onTest: (
    e: MouseEvent<HTMLButtonElement>,
    specificConfigOptions: Partial<SlackProperties>
  ) => void
  onEnabled: (specificConfig: string) => boolean
  isMultipleConfigsSupported: boolean
  me: Me
  organizations: Organization[]
}

interface State {
  prevConfigs: Config[]
  configs: Config[]
}

@ErrorHandling
class SlackConfigs extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      prevConfigs: props.configs,
      configs: this.props.configs,
    }
  }

  public static getDerivedStateFromProps(props: Props, state: State) {
    if (props.configs !== state.prevConfigs)
      return {prevConfigs: props.configs, configs: props.configs}
    return null
  }

  public render() {
    const {onSave, onTest, onEnabled, me, organizations} = this.props

    return (
      <div>
        {this.configs.map(config => {
          const workspace = this.getWorkspace(config)
          const isNewConfig = this.isNewConfig(config)
          const enabled = onEnabled(workspace)
          const isDefaultConfig = this.isDefaultConfig(config)
          const workspaceID = this.getWorkspaceID(config)

          return (
            <SlackConfig
              key={workspace}
              onSave={onSave}
              config={config}
              onTest={onTest}
              onDelete={this.deleteConfig}
              enabled={enabled}
              isNewConfig={isNewConfig}
              isDefaultConfig={isDefaultConfig}
              workspaceID={workspaceID}
              me={me}
              organizations={organizations}
            />
          )
        })}
        {this.isAddingConfigsAllowed && (
          <div className="form-group col-xs-12 text-center">
            <button className="btn btn-md btn-default" onClick={this.addConfig}>
              <span className="icon plus" /> Add Another Config
            </button>
          </div>
        )}
      </div>
    )
  }

  private get configs() {
    return this.state.configs
  }

  private get isAddingConfigsAllowed(): boolean {
    const {isMultipleConfigsSupported} = this.props
    const {configs} = this.state
    const isAllConfigsPersisted = _.every(configs, c => !this.isNewConfig(c))

    return isMultipleConfigsSupported && isAllConfigsPersisted
  }

  private isNewConfig = (config: Config): boolean => {
    return getDeep(config, 'isNewConfig', false)
  }

  private isDefaultConfig = (config: Config): boolean => {
    return this.getWorkspace(config) === '' && !this.isNewConfig(config)
  }

  private getWorkspace = (config: Config): string => {
    const {isMultipleConfigsSupported} = this.props
    if (isMultipleConfigsSupported) {
      const workspace = _.get(config, 'options', {workspace: null}).workspace

      if (workspace !== null) {
        return workspace
      }

      return 'new'
    }
    return ''
  }

  private getWorkspaceID = (config: Config): string => {
    if (this.isDefaultConfig(config)) {
      return 'default'
    }

    if (this.isNewConfig(config)) {
      return 'new'
    }

    return this.getWorkspace(config)
  }

  private addConfig = () => {
    const configs = this.configs
    const {me} = this.props
    const newConfig = {
      options: {
        url: false,
        channel: '',
        workspace: me.currentOrganization.name,
      },
      isNewConfig: true,
    }
    this.setState({configs: [...configs, newConfig]})
  }

  private deleteConfig = (
    specificConfig: string,
    workspaceID: string
  ): void => {
    if (workspaceID === 'new') {
      const configs = this.configs.filter(
        c => this.getWorkspaceID(c) !== workspaceID
      )
      this.setState({configs})
    } else {
      this.props.onDelete(specificConfig)
    }
  }
}

export default SlackConfigs
