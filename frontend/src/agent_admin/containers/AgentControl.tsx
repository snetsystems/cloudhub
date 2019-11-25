import React, { PureComponent } from "react";
import _ from "lodash";

// Components
import Threesizer from "src/shared/components/threesizer/Threesizer";
import AgentControlTable from "src/agent_admin/components/AgentControlTable";
import AgentControlConsole from "src/agent_admin/components/AgentControlConsole";
import PageSpinner from "src/shared/components/PageSpinner";
import { ErrorHandling } from "src/shared/decorators/errors";

// APIs
import {
  getMinionKeyListAllAsync,
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  runLocalCpGetDirTelegraf,
  runLocalPkgInstallTelegraf
} from "src/agent_admin/apis";

//const
import { HANDLE_HORIZONTAL } from "src/shared/constants";

// Types
import { Minion, RemoteDataState } from "src/types";

interface Props {
  currentUrl: string;
}

interface State {
  MinionsObject: { [x: string]: Minion };
  Minions: Minion[];
  proportions: Readonly<{}>;
  controlPageStatus: RemoteDataState;
  minionLog: string;
  isAllCheck: boolean;
}

@ErrorHandling
class AgentControl extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      minionLog: "not load log",
      proportions: [0.43, 0.57],
      MinionsObject: {},
      Minions: [],
      isAllCheck: false,
      controlPageStatus: RemoteDataState.NotStarted
    };
  }

  getWheelKeyListAll = async () => {
    const hostListObject = await getMinionKeyListAllAsync();

    this.setState({
      Minions: _.values(hostListObject),
      controlPageStatus: RemoteDataState.Done
    });
  };

  public async componentDidMount() {
    this.getWheelKeyListAll();
    this.setState({ controlPageStatus: RemoteDataState.Loading });
    console.debug("componentDidMount");
  }

  public onClickTableRowCall() {
    return console.log("row Called", this);
  }

  public handleAllCheck = () => {
    const { Minions, isAllCheck } = this.state;
    console.log("handleAllCheck");
    console.log(Minions);
    if (isAllCheck === false) {
      Minions.map(m => (m.isCheck = true));
    } else {
      Minions.map(m => (m.isCheck = false));
    }
    this.setState({ isAllCheck: !isAllCheck, Minions });
  };

  public handleMinionCheck = ({ _this }) => {
    const { minions } = _this.props;
    const { Minions } = this.state;
    const index = Minions.indexOf(minions);

    Minions[index].isCheck
      ? (Minions[index].isCheck = false)
      : (Minions[index].isCheck = true);

    this.setState({
      Minions: [...Minions],
      isAllCheck: false
    });
  };

  public onClickActionCall = (host: string, isRunning: boolean) => () => {
    if (isRunning === false) {
      const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
        host
      );

      this.setState({ controlPageStatus: RemoteDataState.Loading });

      getLocalServiceStartTelegrafPromise.then(
        pLocalServiceStartTelegrafData => {
          console.log(pLocalServiceStartTelegrafData);
          this.setState({
            minionLog: JSON.stringify(
              pLocalServiceStartTelegrafData.data.return[0],
              null,
              4
            )
          });
          this.getWheelKeyListAll();
        }
      );
    } else {
      const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
        host
      );
      this.setState({ controlPageStatus: RemoteDataState.Loading });
      getLocalServiceStopTelegrafPromise.then(pLocalServiceStopTelegrafData => {
        console.log(pLocalServiceStopTelegrafData);
        this.setState({
          minionLog: JSON.stringify(
            pLocalServiceStopTelegrafData.data.return[0],
            null,
            4
          )
        });
        this.getWheelKeyListAll();
      });
    }
    // return console.log('action Called', host, isRunning)
  };

  public onClickRunCall = () => {
    const { Minions } = this.state;
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    );

    console.log(host);

    this.setState({ controlPageStatus: RemoteDataState.Loading });
    const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
      host
    );

    getLocalServiceStartTelegrafPromise.then(pLocalServiceStartTelegrafData => {
      console.log(pLocalServiceStartTelegrafData);
      this.setState({
        minionLog: JSON.stringify(
          pLocalServiceStartTelegrafData.data.return[0],
          null,
          4
        )
      });
      this.getWheelKeyListAll();
    });
    // return console.log('Run Called', this)
  };

  public onClickStopCall = () => {
    const { Minions } = this.state;
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    );

    console.log(host);
    this.setState({ controlPageStatus: RemoteDataState.Loading });
    const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
      host
    );

    getLocalServiceStopTelegrafPromise.then(pLocalServiceStopTelegrafData => {
      console.log(pLocalServiceStopTelegrafData);
      this.setState({
        minionLog: JSON.stringify(
          pLocalServiceStopTelegrafData.data.return[0],
          null,
          4
        )
      });
      this.getWheelKeyListAll();
    });
    // return console.log('Stop Called', this)
  };

  public onClickInstallCall = () => {
    const { Minions } = this.state;
    const host = Minions.filter(m => m.isCheck === true).map(
      checkData => checkData.host
    );

    console.log(host);

    this.setState({ controlPageStatus: RemoteDataState.Loading });

    const getLocalCpGetDirTelegrafPromise = runLocalCpGetDirTelegraf(host);

    getLocalCpGetDirTelegrafPromise.then(pLocalCpGetDirTelegrafData => {
      console.log("getLocalCpGetDirTelegrafPromise");
      console.log(pLocalCpGetDirTelegrafData.data.return[0]);
      this.setState({
        minionLog: JSON.stringify(
          pLocalCpGetDirTelegrafData.data.return,
          null,
          4
        )
      });

      const getLocalPkgInstallTelegrafPromise = runLocalPkgInstallTelegraf(
        host
      );

      getLocalPkgInstallTelegrafPromise.then(pLocalPkgInstallTelegrafData => {
        console.log(pLocalPkgInstallTelegrafData.data.return[0]);
        this.setState({
          minionLog: JSON.stringify(
            pLocalPkgInstallTelegrafData.data.return[0],
            null,
            4
          )
        });
      });

      this.getWheelKeyListAll();
    });

    //return console.log('Install Called', this)
  };

  render() {
    const { isUserAuthorized } = this.props;
    return (
      <>
        {isUserAuthorized ? (
          <div className="panel panel-solid">
            <Threesizer
              orientation={HANDLE_HORIZONTAL}
              divisions={this.horizontalDivisions}
              onResize={this.handleResize}
            />
          </div>
        ) : (
            <div
              className="generic-empty-state"
              style={{ backgroundColor: "#292933" }}
            >
              <h4>Not Allowed User</h4>
            </div>
          )}
      </>
    );
  }

  private handleResize = (proportions: number[]) => {
    this.setState({ proportions });
  };

  private renderAgentPageTop = () => {
    const { Minions, controlPageStatus, isAllCheck } = this.state;

    console.log("MinionsObject", Minions);

    return (
      <AgentControlTable
        minions={Minions}
        controlPageStatus={controlPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickAction={this.onClickActionCall}
        onClickRun={this.onClickRunCall}
        onClickStop={this.onClickStopCall}
        onClickInstall={this.onClickInstallCall}
        isAllCheck={isAllCheck}
        handleAllCheck={this.handleAllCheck}
        handleMinionCheck={this.handleMinionCheck}
      />
    );
  };

  private renderAgentPageBottom = () => {
    const { minionLog } = this.state;
    return <AgentControlConsole res={minionLog} />;
  };

  private get horizontalDivisions() {
    const { proportions } = this.state;
    const [topSize, bottomSize] = proportions;

    return [
      {
        name: "",
        handleDisplay: "none",
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentPageTop,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize
      },
      {
        name: "",
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentPageBottom,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize
      }
    ];
  }
}

export default AgentControl;
