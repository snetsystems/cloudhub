// library
import React, {PureComponent} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

// component
import TopologyDetailsSectionItem from 'src/hosts/components/TopologyDetailsSectionItem'
import {AWSInstanceData} from 'src/hosts/types/cloud'
import TopologySecurityTable from 'src/hosts/components/TopologySecurityTable'
import {RemoteDataState} from 'src/types'
import TopologyStorageTable from 'src/hosts/components/TopologyStorageTable'
import TopologyNetworkTable from 'src/hosts/components/TopologyNetworkTable'
import TopologyDiskTable from 'src/hosts/components/TopologyDiskTable'
import TopologyHostDetailTable from 'src/hosts/components/TopologyHostDetailTable'

// types
import {HostDetailTable} from 'src/hosts/types/agent'

interface Props {
  title: string
  selectInstanceData:
    | AWSInstanceData['instanceID']['info']
    | Partial<HostDetailTable['tableHeader']>
  instanceTypeModal: () => void
}

interface State {
  isActive: boolean
}

class TopologyDetailsSection extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      isActive: true,
    }
  }

  public render() {
    const {title, selectInstanceData} = this.props
    const {isActive} = this.state

    const isTable = selectInstanceData?.['role'] === 'table'

    return (
      <>
        <div className={'tab-pannel-contents'}>
          <div className={this.styleClassnames}>
            <span
              className={classnames('expandable-sectional-button icon', {
                'caret-down': isActive,
                'caret-right': !isActive,
              })}
              onClick={this.toggleActive}
            />
            <div className={'expandable-sectional-title'}>{title}</div>
          </div>
          {this.state.isActive ? (
            <div className={'section-wrap'}>
              {isTable
                ? this.renderTable
                : _.map(_.keys(selectInstanceData), infoKey => {
                    return (
                      <TopologyDetailsSectionItem
                        key={infoKey}
                        label={infoKey.replaceAll('_', ' ')}
                        contents={selectInstanceData[infoKey]}
                        instanceTypeModal={this.props.instanceTypeModal}
                      />
                    )
                  })}
            </div>
          ) : null}
        </div>
      </>
    )
  }

  private get renderTable() {
    const {selectInstanceData} = this.props

    if (selectInstanceData['name'] === 'security') {
      return (
        <TopologySecurityTable
          key={'security'}
          tableData={selectInstanceData['data']}
          pageStatus={RemoteDataState.Done}
        />
      )
    }

    if (selectInstanceData['name'] === 'storage') {
      return (
        <TopologyStorageTable
          key={'storage'}
          tableData={selectInstanceData['data']}
          pageStatus={RemoteDataState.Done}
        />
      )
    }

    if (selectInstanceData['name'] === 'network') {
      return (
        <TopologyNetworkTable
          key={'network'}
          tableData={selectInstanceData['data']}
          pageStatus={RemoteDataState.Done}
        />
      )
    }

    if (selectInstanceData['name'] === 'disk') {
      return (
        <TopologyDiskTable
          key={'disk'}
          tableData={selectInstanceData['data']}
          pageStatus={RemoteDataState.Done}
        />
      )
    }

    if (selectInstanceData['name'] === 'host') {
      return _.map(_.keys(selectInstanceData['data']), infoKey => {
        return (
          <TopologyHostDetailTable
            key={`detail_${infoKey}`}
            label={infoKey.replaceAll('_', ' ')}
            contents={selectInstanceData['data'][infoKey]}
          />
        )
      })
    }

    return <>no State</>
  }

  private toggleActive = () => {
    this.setState({isActive: !this.state.isActive})
  }

  private get styleClassnames() {
    const {isActive} = this.state
    return classnames('expandable-sectional', {
      'expandable-sectional-expand': isActive,
    })
  }
}

export default TopologyDetailsSection
