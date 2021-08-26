import React, {PureComponent} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

// component
import TopologyDetailsSectionItem from 'src/hosts/components/TopologyDetailsSectionItem'
import {AWSInstanceData} from 'src/hosts/types/cloud'

interface Props {
  title: string
  selectInstanceData: AWSInstanceData['instanceID']['info']
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
              {_.map(_.keys(selectInstanceData), infoKey => {
                return (
                  <TopologyDetailsSectionItem
                    key={infoKey}
                    label={infoKey.replaceAll('_', ' ')}
                    contents={selectInstanceData[infoKey]}
                  />
                )
              })}
            </div>
          ) : null}
        </div>
      </>
    )
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
