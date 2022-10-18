// Library
import React, {PureComponent, ChangeEvent} from 'react'

// Component
import {Button, ButtonShape, IconFont, ComponentStatus} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'
import KubernetesDropdown from 'src/clouds/components/KubernetesDropdown'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

// Contants
import {autoRefreshOptions} from 'src/clouds/constants/autoRefresh'

interface Props {
  handleChooseNamespace: (select: {text: string}) => void
  handleChooseNode: (select: {text: string}) => void
  handleChooseLimit: (select: {text: string}) => void
  handleChangeLabelkey: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeLabelValue: (e: ChangeEvent<HTMLInputElement>) => void
  handleClickFilter: () => void
  selectedNamespace: string
  selectedNode: string
  selectedLimit: string
  labelKey: string
  labelValue: string
  namespaces: string[]
  nodes: string[]
  limits: string[]
  height: number
  minions: string[]
  selectMinion: string
  handleChoosMinion: (select: {text: string}) => void
  isOpenMinions: boolean
  isDisabledMinions: boolean
  minionsStatus: ComponentStatus
  handleCloseMinionsDropdown: () => void
  onClickMinionsDropdown: () => void
  selectedAutoRefresh: number
  handleChooseKubernetesAutoRefresh: (options: AutoRefreshOption) => void
  handleKubernetesRefresh: () => void
}
class KubernetesHeader extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      handleChooseNamespace,
      handleChooseNode,
      handleChooseLimit,
      handleChangeLabelkey,
      handleChangeLabelValue,
      handleClickFilter,
      selectedNamespace,
      selectedNode,
      selectedLimit,
      labelKey,
      labelValue,
      namespaces,
      nodes,
      limits,
      height,
      minions,
      selectMinion,
      handleChoosMinion,
      isOpenMinions,
      isDisabledMinions,
      handleCloseMinionsDropdown,
      onClickMinionsDropdown,
      minionsStatus,
      handleChooseKubernetesAutoRefresh,
      handleKubernetesRefresh,
      selectedAutoRefresh,
    } = this.props
    return (
      <div
        className={'content-header kubernetes-header--bar'}
        style={{height: `${height}px`}}
      >
        <div className={'kubernetes-header--left'}>
          <div className={'kubernetes-header--bar-item'}>
            <Dropdown
              items={namespaces}
              onChoose={handleChooseNamespace}
              selected={selectedNamespace}
              className="dropdown-menu"
              disabled={false}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Dropdown
              items={nodes}
              onChoose={handleChooseNode}
              selected={selectedNode}
              className="dropdown-menu"
              disabled={false}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <input
              type="text"
              className="form-control input-sm"
              placeholder="Label key..."
              onChange={handleChangeLabelkey}
              value={labelKey}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>=</div>
          <div className={'kubernetes-header--bar-item'}>
            <input
              type="text"
              className="form-control input-sm"
              placeholder="Label value..."
              onChange={handleChangeLabelValue}
              value={labelValue}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Dropdown
              items={limits}
              onChoose={handleChooseLimit}
              selected={selectedLimit}
              className="dropdown-menu"
              disabled={false}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Button
              icon={IconFont.Filter}
              onClick={handleClickFilter}
              shape={ButtonShape.Square}
              titleText="Apply Filter"
            />
          </div>
        </div>
        <div className={'kubernetes-header--right'}>
          <div className={'kubernetes-header--bar-item'}>
            <KubernetesDropdown
              items={minions}
              onChoose={handleChoosMinion}
              onClick={onClickMinionsDropdown}
              isOpen={isOpenMinions}
              selected={selectMinion}
              onClose={handleCloseMinionsDropdown}
              className="dropdown-menu"
              disabled={isDisabledMinions}
              status={minionsStatus}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <AutoRefreshDropdown
              selected={selectedAutoRefresh}
              onChoose={handleChooseKubernetesAutoRefresh}
              onManualRefresh={handleKubernetesRefresh}
              userAutoRefreshOptions={autoRefreshOptions}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default KubernetesHeader
