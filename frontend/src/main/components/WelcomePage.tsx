import React, {PureComponent} from 'react'
import {Page} from 'src/reusable_ui'
import {Link} from 'react-router'

interface Props {
  reason?: 'no-hosts' | 'no-dashboards-editor' | 'no-dashboards-viewer'
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
          <Page.Header.Right />
        </Page.Header>
        <Page.Contents fullWidth={true} scrollable={true}>
          <div className="panel dashboards-page-panel welcome-page-panel">
            <div className="auth-logo" />
            <h1>Welcome to Cloudhub</h1>
            
            <div className="welcome-page-content">
              {reason === 'no-hosts' && (
                <>
                  <p>
                    Cloudhub is an infrastructure and application monitoring platform. You currently do not have any connected agents configured.
                  </p>
                  <div className="welcome-page-instructions">
                    <h3>How to Use Cloudhub</h3>
                    <ul>
                      <li>Navigate to <strong>Agent Admin</strong> or <strong>Manage Sources</strong> to install and configure Minions.</li>
                      <li>Ensure <strong>Telegraf</strong> is configured and running on your host machines to collect metrics.</li>
                      <li>Once metrics are arriving, dashboards and monitoring features will automatically become available.</li>
                    </ul>
                  </div>
                </>
              )}

              {reason === 'no-dashboards-editor' && (
                <>
                  <p>
                    You currently do not have any dashboards configured to view your metrics.
                  </p>
                  <div className="welcome-page-instructions">
                    <h3>Create a Dashboard</h3>
                    <p style={{marginTop: '10px', fontSize: '15px'}}>
                      Navigate to the <Link to={`/sources/${sourceID}/dashboards`} style={{color: '#22adf6', textDecoration: 'underline'}}>Dashboards</Link> page to create your first dashboard and start visualizing your data.
                    </p>
                  </div>
                </>
              )}

              {reason === 'no-dashboards-viewer' && (
                <>
                  <p>
                    You currently do not have any dashboards configured to view your metrics.
                  </p>
                  <div className="welcome-page-instructions" style={{textAlign: 'center', backgroundColor: 'transparent', border: '1px solid #383846'}}>
                    <h3 style={{color: '#ffb94a', marginBottom: '10px'}}><i className="icon alert-triangle" /> Contact Administrator</h3>
                    <p style={{margin: 0, fontSize: '15px'}}>
                      You do not have permission to create dashboards. Please contact your Cloudhub administrator to resolve this.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </Page.Contents>
      </Page>
    )
  }
}

export default WelcomePage
