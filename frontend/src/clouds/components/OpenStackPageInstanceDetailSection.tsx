// libraries
import React, {PureComponent} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

// component
import {AWSInstanceData} from 'src/hosts/types/cloud'
import OpenStackPageInstanceDetailSectionItem from 'src/clouds/components/OpenStackPageInstanceDetailSectionItem'
import OpenStackSecurityGroup from 'src/clouds/components/OpenStackSecurityGroup'

interface Props {
  title: string
  selectInstanceData: AWSInstanceData['instanceID']['info']
}

interface State {
  isActive: boolean
}

class OpenStackPageInstanceDetailSection extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      isActive: true,
    }
  }

  public render() {
    const {title, selectInstanceData} = this.props
    const {isActive} = this.state

    return (
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
          <div className={'section-wrap'} style={{flexDirection: 'column'}}>
            {this.renderItem(title, selectInstanceData)}
          </div>
        ) : null}
      </div>
    )
  }

  private toggleActive = () => {
    this.setState({isActive: !this.state.isActive})
  }

  private renderItem = (title, selectInstanceData) => {
    if (title == 'securityGroups') {
      return (
        <OpenStackSecurityGroup
          key={`detail_${title}`}
          securityGroupRules={selectInstanceData}
        />
      )
    } else {
      return _.map(_.keys(selectInstanceData), infoKey => {
        return (
          <OpenStackPageInstanceDetailSectionItem
            key={`detail_${infoKey}`}
            label={infoKey.replaceAll('_', ' ')}
            contents={selectInstanceData[infoKey]}
          />
        )
      })
    }
  }

  private get styleClassnames() {
    const {isActive} = this.state
    return classnames('expandable-sectional', {
      'expandable-sectional-expand': isActive,
    })
  }
}

export default OpenStackPageInstanceDetailSection
