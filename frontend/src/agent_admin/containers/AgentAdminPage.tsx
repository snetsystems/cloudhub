import React, { PureComponent } from "react";
import { connect } from "react-redux";

import { Page } from "src/reusable_ui";
import SubSections from "src/shared/components/SubSections";

import AgentMinions from "src/agent_admin/containers/AgentMinions";
import AgentConfiguration from "src/agent_admin/containers/AgentConfiguration";
import AgentControl from "src/agent_admin/containers/AgentControl";
// import AgentLog from "src/agent_admin/containers/AgentLog";
// import TestAPI from "src/agent_admin/test/TestAPI";

import {
  isUserAuthorized,
  ADMIN_ROLE,
  SUPERADMIN_ROLE
} from "src/auth/Authorized";

// Types
import {
  Source,
  Links,
  NotificationAction,
  RemoteDataState,
  Host,
  Layout,
  TimeRange
} from "src/types";

interface Props {
  me: {};
  source: {};
  params: {};
}

class AgentAdminPage extends PureComponent<Props> {
  constructor(props) {
    super(props);

    this.state = {
      hostsPageStatus: RemoteDataState.NotStarted,
      minion: [],
      isSelectBoxView: true
    };
  }

  public sections = me => {
    const { minions } = this.state;
    return [
      {
        url: "agent-minions",
        name: "Minions",
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentMinions
            me={me}
            compareAuthRore={SUPERADMIN_ROLE}
            currentUrl={"agent-minions"}
            minions={minions}
          />
        )
      },
      {
        url: "agent-control",
        name: "Collector Control",
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentControl
            meID={me.id}
            currentUrl={"agent-control"}
            minions={minions}
          />
        )
      },
      {
        url: "agent-configuration",
        name: "Collector Config",
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentConfiguration
            meID={me.id}
            currentUrl={"agent-configuration"}
            minions={minions}
          />
        )
      }
      // {
      //   url: 'agent-log',
      //   name: 'Log',
      //   enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      //   component: <AgentLog currentUrl={'agent-log'} minions={minions} />,
      // },
      // {
      //   url: 'agent-TestAPI',
      //   name: 'TestAPI',
      //   enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      //   component: <TestAPI currentUrl={'agent-TestAPI'} minions={minions} />,
      // },
    ];
  };

  public componentWillMount() {
    this.setState({
      minions: [
        {
          host: "host1",
          os: "ubuntu",
          osVersion: "19.1",
          ip: "192.168.0.1",
          isRunning: true,
          isInstall: false,
          isSaveFile: false,
          isAccept: true
        },
        {
          host: "host2",
          os: "debian",
          osVersion: "9.1",
          ip: "192.168.0.2",
          isRunning: true,
          isInstall: true,
          isSaveFile: true,
          isAccept: true
        },
        {
          host: "host3",
          os: "window",
          osVersion: "Server",
          ip: "192.168.0.3",
          isRunning: false,
          isInstall: true,
          isSaveFile: true,
          isAccept: true
        },
        {
          host: "host4",
          os: "window",
          osVersion: "Server",
          ip: "",
          isRunning: false,
          isInstall: false,
          isSaveFile: false,
          isAccept: false
        },
        {
          host: "host5",
          os: "window",
          osVersion: "Server",
          ip: "",
          isRunning: false,
          isInstall: false,
          isSaveFile: false,
          isAccept: false
        }
      ]
    });
  }

  render() {
    const {
      me,
      source,
      params: { tab }
    } = this.props;
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Agent Configuration" />
          </Page.Header.Left>
          <Page.Header.Right />
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="container-fluid full-height">
            <SubSections
              sections={this.sections(me)}
              activeSection={tab}
              parentUrl="agent-admin"
              sourceID={source.id}
            />
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = ({ auth: { me } }) => ({
  me
});

export default connect(mapStateToProps, null)(AgentAdminPage);
