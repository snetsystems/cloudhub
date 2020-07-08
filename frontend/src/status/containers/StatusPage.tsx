// Libraries
import React, {Component} from 'react'

// Components
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {Page} from 'src/reusable_ui'
import ShellModal from 'src/status/components/ShellModal'

// Constants
import {STATUS_PAGE_TIME_RANGE} from 'src/shared/data/timeRanges'
import {fixtureStatusPageCells} from 'src/status/fixtures'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'

// Types
import {
  Source,
  Template,
  Cell,
  TemplateType,
  TemplateValueType,
} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface State {
  cells: Cell[]
  shellModalVisible: boolean
}

interface Props {
  source: Source
}

const timeRange = STATUS_PAGE_TIME_RANGE

@ErrorHandling
class StatusPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      cells: fixtureStatusPageCells,
      shellModalVisible: false,
    }
  }

  private onClickShellModalOpen = () => {
    this.setState({shellModalVisible: true})
  }

  private onClickShellModalClose = () => {
    this.setState({shellModalVisible: false})
  }

  public render() {
    const {source} = this.props
    const {cells} = this.state

    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="Status" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
            <button
              className="btn btn-sm btn-primary"
              onClick={this.onClickShellModalOpen}
            >
              open SSH
            </button>
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="dashboard container-fluid full-width">
            <ShellModal
              visible={this.state.shellModalVisible}
              headingTitle={'Terminal'}
              onCancel={this.onClickShellModalClose}
            />
            {cells.length ? (
              <LayoutRenderer
                host=""
                sources={[]}
                cells={cells}
                source={source}
                manualRefresh={0}
                isEditable={false}
                isStatusPage={true}
                isStaticPage={false}
                timeRange={timeRange}
                templates={this.templates}
              />
            ) : (
              <span>Loading Status Page...</span>
            )}
          </div>
        </Page.Contents>
      </Page>
    )
  }

  private get templates(): Template[] {
    const dashboardTime = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type: TemplateType.Constant,
      label: '',
      values: [
        {
          value: timeRange.lower,
          type: TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    }

    const upperDashboardTime = {
      id: 'upperdashtime',
      tempVar: TEMP_VAR_UPPER_DASHBOARD_TIME,
      type: TemplateType.Constant,
      label: '',
      values: [
        {
          value: 'now()',
          type: TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    }

    return [dashboardTime, upperDashboardTime]
  }
}

export default StatusPage
