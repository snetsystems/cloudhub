import React, {PureComponent, ChangeEvent} from 'react'
import {
  Button,
  ButtonShape,
  IconFont,
  ComponentColor,
  ComponentStatus,
} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'
import KubernetesDropdown from 'src/hosts/components/KubernetesDropdown'

interface Props {
  handleOnChooseNamespace: (select: {text: string}) => void
  handleOnChooseNode: (select: {text: string}) => void
  handleOnChooseLimit: (select: {text: string}) => void
  handleOnChangeLabelkey: (e: ChangeEvent<HTMLInputElement>) => void
  handleOnChangeLabelValue: (e: ChangeEvent<HTMLInputElement>) => void
  handleOnClickFilter: () => void
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
  intervalTime: string[]
  selectIntervalTime: string
  handleOnChoosMinion: (select: {text: string}) => void
  handleOnChoosInterval: (select: {text: string}) => void
  isOpenMinions: boolean
  isDisabledMinions: boolean
  minionsStatus: ComponentStatus
  handleOnClose: () => void
  handleOnClick: () => void
}
class KubernetesHeader extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      handleOnChooseNamespace,
      handleOnChooseNode,
      handleOnChooseLimit,
      handleOnChangeLabelkey,
      handleOnChangeLabelValue,
      handleOnClickFilter,
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
      intervalTime,
      selectIntervalTime,
      handleOnChoosMinion,
      handleOnChoosInterval,
      isOpenMinions,
      isDisabledMinions,
      handleOnClose,
      handleOnClick,
      minionsStatus,
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
              onChoose={handleOnChooseNamespace}
              selected={selectedNamespace}
              className="dropdown-menu"
              disabled={false}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Dropdown
              items={nodes}
              onChoose={handleOnChooseNode}
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
              onChange={handleOnChangeLabelkey}
              value={labelKey}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>=</div>
          <div className={'kubernetes-header--bar-item'}>
            <input
              type="text"
              className="form-control input-sm"
              placeholder="Label value..."
              onChange={handleOnChangeLabelValue}
              value={labelValue}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Dropdown
              items={limits}
              onChoose={handleOnChooseLimit}
              selected={selectedLimit}
              className="dropdown-menu"
              disabled={false}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Button
              icon={IconFont.Filter}
              onClick={handleOnClickFilter}
              shape={ButtonShape.Square}
              titleText="Filter alert text"
            />
          </div>
        </div>
        <div className={'kubernetes-header--right'}>
          <div className={'kubernetes-header--bar-item'}>
            <KubernetesDropdown
              items={minions}
              onChoose={handleOnChoosMinion}
              onClick={handleOnClick}
              isOpen={isOpenMinions}
              selected={selectMinion}
              onClose={handleOnClose}
              className="dropdown-menu"
              disabled={isDisabledMinions}
              status={minionsStatus}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Dropdown
              items={intervalTime}
              onChoose={handleOnChoosInterval}
              selected={selectIntervalTime}
              className="dropdown-menu"
              disabled={false}
            />
          </div>
          <div className={'kubernetes-header--bar-item'}>
            <Button
              icon={IconFont.Checkmark}
              onClick={() => {
                console.log('click')
              }}
              shape={ButtonShape.Square}
              color={ComponentColor.Primary}
              titleText="Filter alert text"
            />
          </div>
        </div>
      </div>
    )
  }
}

export default KubernetesHeader
