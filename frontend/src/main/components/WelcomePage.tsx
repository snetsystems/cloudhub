import React, {PureComponent} from 'react'
import {Page} from 'src/reusable_ui'
import {Link} from 'react-router'
import OrgDropdown from 'src/shared/components/OrgDropdown'
import {withTranslation, WithTranslation, Trans} from 'react-i18next'

interface Props extends WithTranslation {
  reason?: 'no-telegraf' | 'no-hosts' | 'no-dashboards'
  sourceID?: string
}

class WelcomePage extends PureComponent<Props> {
  public render() {
    const {reason = 'no-hosts', sourceID = '0', t} = this.props

    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title={t('welcome.page_title')} />
          </Page.Header.Left>
          <Page.Header.Right>
            <OrgDropdown />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true} scrollable={true}>
          <div className="panel dashboards-page-panel welcome-page-panel">
            <div className="auth-logo" />
            <h1>{t('welcome.title')}</h1>

            <div className="welcome-page-content">
              {reason === 'no-telegraf' && (
                <>
                  <p>{t('welcome.no_telegraf_msg')}</p>
                  <div className="welcome-page-instructions">
                    <h3>{t('welcome.install_telegraf')}</h3>
                    <ul>
                      <li>
                        <Trans i18nKey="welcome.instruction_agent_admin">
                          Navigate to <strong>Agent Admin</strong> or{' '}
                          <strong>Manage Sources</strong> to install and
                          configure Minions.
                        </Trans>
                      </li>
                      <li>
                        <Trans i18nKey="welcome.instruction_ensure_telegraf">
                          Ensure <strong>Telegraf</strong> is installed on your
                          host machines.
                        </Trans>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {reason === 'no-hosts' && (
                <>
                  <p>{t('welcome.no_hosts_msg')}</p>
                  <div className="welcome-page-instructions">
                    <h3>{t('welcome.configure_db')}</h3>
                    <ul>
                      <li>
                        <Trans i18nKey="welcome.instruction_telegraf_config">
                          Check your <strong>Telegraf configuration</strong> to
                          ensure the output plugin is pointing to the correct
                          database instance.
                        </Trans>
                      </li>
                      <li>{t('welcome.instruction_verify_auth')}</li>
                      <li>{t('welcome.instruction_once_connected')}</li>
                    </ul>
                  </div>
                </>
              )}

              {reason === 'no-dashboards' && (
                <>
                  <p>{t('welcome.no_dashboards_msg')}</p>
                  <div className="welcome-page-instructions">
                    <h3>{t('welcome.create_dashboard')}</h3>
                    <p className="dashboard-link-container">
                      <Trans i18nKey="welcome.instruction_navigate_dashboard">
                        Navigate to the{' '}
                        <Link to={`/sources/${sourceID}/dashboards`}>
                          Dashboards
                        </Link>{' '}
                        page to create your first dashboard and start
                        visualizing your data.
                      </Trans>
                    </p>
                  </div>
                </>
              )}
            </div>

            {this.renderStepIndicator(reason, t)}
          </div>
        </Page.Contents>
      </Page>
    )
  }

  private renderStepIndicator(reason: string, t: any) {
    const steps = [
      {id: 1, title: t('welcome.step_install_cloudhub'), status: 'completed'},
      {
        id: 2,
        title: t('welcome.step_install_telegraf'),
        status: reason === 'no-telegraf' ? 'active' : 'completed',
      },
      {
        id: 3,
        title: t('welcome.step_connect_db'),
        status:
          reason === 'no-hosts'
            ? 'active'
            : reason === 'no-telegraf'
            ? 'pending'
            : 'completed',
      },
      {
        id: 4,
        title: t('welcome.step_create_dashboard'),
        status: reason === 'no-dashboards' ? 'active' : 'pending',
      },
    ]

    return (
      <div className="welcome-step-indicator">
        <h3>{t('welcome.getting_started')}</h3>
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

export default withTranslation()(WelcomePage)
