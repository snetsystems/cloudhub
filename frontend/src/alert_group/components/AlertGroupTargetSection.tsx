// frontend/src/alert_group/components/AlertGroupTargetSection.tsx
import React, {PureComponent} from 'react'
import {withTranslation, WithTranslation} from 'react-i18next'
import classnames from 'classnames'
import {getDeep} from 'src/utils/wrappers'
import {ComponentColor, ComponentSize, ComponentStatus} from 'src/reusable_ui'
import DropdownButton from 'src/reusable_ui/components/dropdowns/DropdownButton'
import {ClickOutside} from 'src/shared/components/ClickOutside'
import {AlertGroupRule, HostCandidate} from 'src/alert_group/types'
import {proxy} from 'src/utils/queryUrlGenerator'
import HostSelector from 'src/alert_group/components/HostSelector'
import {RemoteDataState, Source} from 'src/types'

interface HostTagSeries {
  columns: string[]
  values: string[][]
}

interface Props extends WithTranslation {
  source: Source
  rule: AlertGroupRule
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

interface State {
  hosts: HostCandidate[]
  hostsLoad: RemoteDataState
  targetPickerOpen: boolean
}

class AlertGroupTargetSection extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hosts: [],
      hostsLoad: RemoteDataState.NotStarted,
      targetPickerOpen: false,
    }
  }

  public componentDidMount(): void {
    this.loadHosts()
  }

  public componentDidUpdate(prev: Props): void {
    if (prev.source?.id !== this.props.source?.id) {
      this.loadHosts()
    }
  }

  private loadHosts = async (): Promise<void> => {
    const {source} = this.props
    if (!source || !source.links?.proxy) {
      this.setState({hosts: [], hostsLoad: RemoteDataState.Done})
      return
    }
    this.setState({hostsLoad: RemoteDataState.Loading})
    try {
      const {data} = await proxy({
        source: source.links.proxy,
        query: 'show tag values with key = "host"',
        db: source.telegraf,
      })
      const seriesList = getDeep<HostTagSeries[]>(
        data,
        'results.[0].series',
        []
      )
      const names = new Set<string>()
      seriesList.forEach(s => {
        const valueIdx = s.columns.findIndex(c => c === 'value')
        if (valueIdx < 0) return
        s.values.forEach(v => {
          const name = v[valueIdx]
          if (typeof name === 'string' && name) {
            names.add(name)
          }
        })
      })
      const hosts = Array.from(names)
        .sort()
        .map(hostname => ({hostname}))
      this.setState({hosts, hostsLoad: RemoteDataState.Done})
    } catch {
      this.setState({hostsLoad: RemoteDataState.Error})
    }
  }

  private closeTargetPicker = (): void => {
    this.setState({targetPickerOpen: false})
  }

  private toggleTargetPicker = (): void => {
    this.setState(s => ({targetPickerOpen: !s.targetPickerOpen}))
  }

  private handleHostsChange = (selectedHostnames: string[]): void => {
    this.props.onUpdateRule({hostnames: selectedHostnames})
  }

  private renderTargetTriggerLabel(selectedCount: number): string {
    const {t} = this.props
    if (selectedCount === 0) {
      return t('alert_group_rule.select_server')
    }
    return t('alert_group_rule.n_selected', {count: selectedCount})
  }

  public render(): JSX.Element {
    const {rule, t} = this.props
    const {hosts, hostsLoad, targetPickerOpen} = this.state

    const selectedHostnames = rule.hostnames || []

    const dropdownStatus =
      hostsLoad === RemoteDataState.Loading
        ? ComponentStatus.Loading
        : hostsLoad === RemoteDataState.Error
        ? ComponentStatus.Error
        : ComponentStatus.Default

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">
          {t('alert_group_rule.target_def_title')}
        </h3>
        <div className="rule-section--body">
          <div className="alert-group-setting-row rule-section--row-first">
            <div className="alert-group-setting-label">
              {t('alert_group_rule.target_server')}
            </div>
            <div className="alert-group-setting-control">
              <div className="alert-group-setting-inputs">
                {hostsLoad === RemoteDataState.Error ? (
                  <span className="alert-group-empty-text">
                    {t('alert_group_rule.failed_to_load_hosts')}
                  </span>
                ) : (
                  <ClickOutside onClickOutside={this.closeTargetPicker}>
                    <div
                      className={classnames(
                        'dropdown dropdown-small dropdown-default',
                        'alert-group-target--dropdown-root'
                      )}
                    >
                      <DropdownButton
                        active={targetPickerOpen}
                        color={ComponentColor.Default}
                        size={ComponentSize.Small}
                        status={dropdownStatus}
                        onClick={this.toggleTargetPicker}
                        title={t('alert_group_rule.select_server_title')}
                      >
                        {this.renderTargetTriggerLabel(
                          selectedHostnames.length
                        )}
                      </DropdownButton>
                      {targetPickerOpen && hostsLoad === RemoteDataState.Done && (
                        <div className="dropdown--menu-container dropdown--onyx alert-group-target--host-dropdown-menu">
                          <div className="alert-group-target--host-dropdown-menu-inner">
                            <HostSelector
                              hosts={hosts}
                              selectedHostnames={selectedHostnames}
                              onChange={this.handleHostsChange}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </ClickOutside>
                )}
              </div>
              <p className="alert-group-setting-helper">
                {t('alert_group_rule.target_server_helper')}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default withTranslation()(AlertGroupTargetSection)
