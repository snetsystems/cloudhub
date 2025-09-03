// Library
import React, {PureComponent, ChangeEvent} from 'react'
import _ from 'lodash'

// Types
import {DropdownItem} from 'src/types'

// Component
import {Button, ButtonShape, IconFont} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'
import KubernetesDropdown from 'src/clouds/components/KubernetesDropdown'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'
import MultiSelectAutoCompleteDropdown from 'src/reusable_ui/components/dropdowns/MultiSelectAutoCompleteDropdown'

// Contants
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'

interface Props {
  handleChooseNamespace: (selectedIDs: string[], value: {id: string}) => void
  handleChooseNode: (select: {text: string}) => void
  handleChooseLimit: (select: {text: string}) => void
  handleChangeLabelkey: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeLabelValue: (e: ChangeEvent<HTMLInputElement>) => void
  handleClickFilter: () => void
  selectedNamespace: string[]
  selectedNode: string
  selectedLimit: string
  labelKey: string
  labelValue: string
  namespaces: string[]
  nodes: string[]
  limits: string[]
  height: number

  selectedAutoRefresh: number
  handleChooseKubernetesAutoRefresh: (options: AutoRefreshOption) => void
  handleKubernetesRefresh: () => void
}

interface State {
  isOpenNodesDropdown: boolean
}

class KubernetesHeader extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      isOpenNodesDropdown: false,
    }
  }

  private handleCloseNodesDropdown = () => {
    this.setState({isOpenNodesDropdown: false})
  }

  private handleClickNodesDropdown = () => {
    this.setState({isOpenNodesDropdown: !this.state.isOpenNodesDropdown})
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

      handleChooseKubernetesAutoRefresh,
      handleKubernetesRefresh,
      selectedAutoRefresh,
    } = this.props

    const {isOpenNodesDropdown} = this.state
    const namespaceItems: DropdownItem[] = namespaces.map(namespace => ({
      text: namespace,
    }))
    const nodeItems: DropdownItem[] = nodes.map(node => ({
      text: node,
    }))

    return (
      <div
        className={'content-header kubernetes-header--bar'}
        style={{height: `${height}px`}}
      >
        <div className={'kubernetes-header--left'}>
          <div
            className={'kubernetes-header--bar-item'}
            style={{width: '300px'}}
          >
            <MultiSelectAutoCompleteDropdown
              selectedIDs={selectedNamespace}
              onChange={handleChooseNamespace}
              emptyText={'Choose Namespace'}
              maxMenuHeight={145}
              maxSelections={5}
              exemptFromLimit={['All namespaces']}
              useAutoComplete={true}
              items={namespaceItems}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <KubernetesDropdown
              items={nodeItems}
              onChoose={handleChooseNode}
              onClick={this.handleClickNodesDropdown}
              isOpen={isOpenNodesDropdown}
              selected={selectedNode}
              onClose={this.handleCloseNodesDropdown}
              className="dropdown-menu"
              disabled={false}
              useAutoComplete={true}
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
            <AutoRefreshDropdown
              selected={selectedAutoRefresh}
              onChoose={handleChooseKubernetesAutoRefresh}
              onManualRefresh={handleKubernetesRefresh}
              customAutoRefreshOptions={getTimeOptionByGroup(
                'kubernetesHeader'
              )}
              customAutoRefreshSelected={{
                kubernetesHeader: selectedAutoRefresh,
              }}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default KubernetesHeader
