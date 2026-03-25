import React, {PureComponent} from 'react'
import {Page} from 'src/reusable_ui'
import {Link} from 'react-router'
import OrgDropdown from 'src/shared/components/OrgDropdown'

interface Props {
  reason?: 'no-telegraf' | 'no-hosts' | 'no-dashboards'
  sourceID?: string
}

class WelcomePage extends PureComponent<Props> {
  public render() {
    const {reason = 'no-hosts', sourceID = '0'} = this.props

    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="Welcome" />
          </Page.Header.Left>
          <Page.Header.Right>
            <OrgDropdown />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true} scrollable={true}>
          <div className="panel dashboards-page-panel welcome-page-panel">
            <div className="auth-logo" />
            <h1>Welcome to Cloudhub</h1>

            <div className="welcome-page-content">
              {reason === 'no-telegraf' && (
                <>
                  <p>
                    Cloudhub requires an agent to collect metrics. You currently
                    do not have Telegraf installed.
                  </p>
                  <div className="welcome-page-instructions">
                    <h3>Install Telegraf</h3>
                    <ul>
                      <li>
                        Navigate to <strong>Agent Admin</strong> or{' '}
                        <strong>Manage Sources</strong> to install and configure
                        Minions.
                      </li>
                      <li>
                        Ensure <strong>Telegraf</strong> is installed on your
                        host machines.
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {reason === 'no-hosts' && (
                <>
                  <p>
                    Telegraf is installed, but Cloudhub cannot detect any hosts.
                    This usually happens when the agent fails to connect to the
                    database.
                  </p>
                  <div className="welcome-page-instructions">
                    <h3>Configure DB Connection</h3>
                    <ul>
                      <li>
                        Check your <strong>Telegraf configuration</strong> to
                        ensure the output plugin is pointing to the correct
                        database instance.
                      </li>
                      <li>
                        Verify the authentication credentials in the Telegraf
                        config.
                      </li>
                      <li>
                        Once the database connection is established and metrics
                        are arriving, your hosts will appear.
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {reason === 'no-dashboards' && (
                <>
                  <p>
                    You currently do not have any dashboards configured to view
                    your metrics.
                  </p>
                  <div className="welcome-page-instructions">
                    <h3>Create a Dashboard</h3>
                    <p className="dashboard-link-container">
                      Navigate to the{' '}
                      <Link
                        to={`/sources/${sourceID}/dashboards`}
                      >
                        Dashboards
                      </Link>{' '}
                      page to create your first dashboard and start visualizing
                      your data.
                    </p>
                  </div>
                </>
              )}
            </div>

            {this.renderStepIndicator(reason)}
          </div>
        </Page.Contents>
      </Page>
    )
  }

  private renderStepIndicator(reason: string) {
    const steps = [
      {id: 1, title: 'Cloudhub 설치', status: 'completed'},
      {
        id: 2,
        title: 'Telegraf 설치',
        status: reason === 'no-telegraf' ? 'active' : 'completed',
      },
      {
        id: 3,
        title: 'DB 연결',
        status:
          reason === 'no-hosts'
            ? 'active'
            : reason === 'no-telegraf'
            ? 'pending'
            : 'completed',
      },
      {
        id: 4,
        title: 'Dashboard 생성',
        status: reason === 'no-dashboards' ? 'active' : 'pending',
      },
    ]

    return (
      <div className="welcome-step-indicator">
        <h3>
          Getting Started with Cloudhub
        </h3>
        <div className="welcome-step-indicator-container">
          {/* Connecting Line Background */}
          <div className="welcome-step-line-bg"></div>

          {/* Active Connecting Line (Blue) */}
          <div
            className="welcome-step-line-active"
            style={{
              width: `calc((100% - 120px) * ${
                reason === 'no-telegraf'
                  ? 0.3333
                  : reason === 'no-hosts'
                  ? 0.6666
                  : 1
              })`,
            }}
          ></div>

          {/* Completed Connecting Line (Green) */}
          <div
            className="welcome-step-line-completed"
            style={{
              width: `calc((100% - 120px) * ${
                reason === 'no-telegraf'
                  ? 0
                  : reason === 'no-hosts'
                  ? 0.3333
                  : 0.6666
              })`,
            }}
          ></div>

          {steps.map(step => {
            const isCompleted = step.status === 'completed'
            const isActive = step.status === 'active'

            return (
              <div key={step.id} className="welcome-step-item">
                <div
                  className={`welcome-step-circle ${
                    isCompleted ? 'completed' : isActive ? 'active' : ''
                  }`}
                >
                  {isCompleted ? '✓' : step.id}
                </div>
                <div
                  className={`welcome-step-title ${
                    isCompleted ? 'completed' : isActive ? 'active' : ''
                  }`}
                >
                  {step.title}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}

export default WelcomePage
