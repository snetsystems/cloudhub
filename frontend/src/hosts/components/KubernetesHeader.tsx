import React, {PureComponent, ChangeEvent} from 'react'
import {Button, ButtonShape, IconFont} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'

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
    } = this.props
    return (
      <div
        className={'content-header kubernetes-header--bar'}
        style={{height: `${height}px`}}
      >
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
    )
  }
}

export default KubernetesHeader
