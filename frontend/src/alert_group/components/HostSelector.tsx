// frontend/src/alert_group/components/HostSelector.tsx
import React, {PureComponent, ChangeEvent} from 'react'
import {withTranslation, WithTranslation} from 'react-i18next'
import {Input, InputType, ComponentSize} from 'src/reusable_ui'
import {HostCandidate} from 'src/alert_group/types'

interface Props extends WithTranslation {
  hosts: HostCandidate[]
  selectedHostnames: string[]
  onChange: (selectedHostnames: string[]) => void
}

interface State {
  search: string
}

class HostSelector extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {search: ''}
  }

  private handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({search: e.target.value})
  }

  private handleToggle = (hostname: string): void => {
    const {selectedHostnames, onChange} = this.props
    if (selectedHostnames.includes(hostname)) {
      onChange(selectedHostnames.filter(h => h !== hostname))
    } else {
      onChange([...selectedHostnames, hostname])
    }
  }

  private handleToggleAll = (): void => {
    const {selectedHostnames, onChange} = this.props
    const filtered = this.filteredHosts
    const filteredNames = filtered.map(h => h.hostname)
    const allSelected =
      filteredNames.length > 0 &&
      filteredNames.every(n => selectedHostnames.includes(n))
    if (allSelected) {
      onChange(selectedHostnames.filter(n => !filteredNames.includes(n)))
    } else {
      onChange(Array.from(new Set([...selectedHostnames, ...filteredNames])))
    }
  }

  private get filteredHosts(): HostCandidate[] {
    const {hosts} = this.props
    const search = this.state.search.toLowerCase()
    if (!search) return hosts
    return hosts.filter(h => h.hostname.toLowerCase().includes(search))
  }

  public render() {
    const {selectedHostnames, t} = this.props
    const {search} = this.state
    const filtered = this.filteredHosts
    const filteredNames = filtered.map(h => h.hostname)
    const allSelected =
      filtered.length > 0 &&
      filteredNames.every(n => selectedHostnames.includes(n))
    const someSelected =
      filteredNames.some(n => selectedHostnames.includes(n)) && !allSelected

    return (
      <div className="device-group-host-selector">
        <div className="device-group-host-selector--search">
          <Input
            value={search}
            onChange={this.handleSearchChange}
            type={InputType.Text}
            size={ComponentSize.Small}
            placeholder={t('alert_group_rule.search_hosts', '호스트 검색...')}
          />
          <span className="device-group-host-selector--count">
            {t('alert_group_rule.n_hosts_selected', {
              count: selectedHostnames.length,
              defaultValue: '{{count}}개 선택됨',
            })}
          </span>
        </div>
        <div className="device-group-host-selector--list">
          {filtered.length === 0 ? (
            <div className="device-group-host-selector--empty">
              {search
                ? t('alert_group_rule.no_hosts_search_results', '검색 결과가 없습니다.')
                : t('alert_group_rule.no_target_hosts', '대상 호스트가 없습니다.')}
            </div>
          ) : (
            <>
              <div
                className="device-group-host-selector--item device-group-host-selector--item__all"
                onClick={this.handleToggleAll}
              >
                <span
                  className={`device-group-host-selector--checkbox${
                    allSelected
                      ? ' checked'
                      : someSelected
                      ? ' indeterminate'
                      : ''
                  }`}
                />
                <span className="device-group-host-selector--hostname">
                  {search
                    ? t('alert_group_rule.select_all_search_results', {
                        count: filtered.length,
                        defaultValue: '검색 결과 전체 선택 ({{count}}개)',
                      })
                    : t('alert_group_rule.select_all_with_count', {
                        count: filtered.length,
                        defaultValue: '전체 선택 ({{count}}개)',
                      })}
                </span>
              </div>
              {filtered.map(host => {
                const isSelected = selectedHostnames.includes(host.hostname)
                return (
                  <div
                    key={host.hostname}
                    className={`device-group-host-selector--item${
                      isSelected ? ' selected' : ''
                    }`}
                    onClick={() => this.handleToggle(host.hostname)}
                  >
                    <span
                      className={`device-group-host-selector--checkbox${
                        isSelected ? ' checked' : ''
                      }`}
                    />
                    <span className="device-group-host-selector--hostname">
                      {host.hostname}
                    </span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    )
  }
}

export default withTranslation()(HostSelector)

