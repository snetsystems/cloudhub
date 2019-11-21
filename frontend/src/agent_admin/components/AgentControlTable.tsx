import React, { PureComponent } from "react";

import _ from "lodash";
import memoize from "memoize-one";

import SearchBar from "src/hosts/components/SearchBar";
import AgentControlTableRow from "src/agent_admin/components/AgentControlTableRow";
import FancyScrollbar from "src/shared/components/FancyScrollbar";

import PageSpinner from "src/shared/components/PageSpinner";

import { AGENT_TABLE_SIZING } from "src/hosts/constants/tableSizing";

import { Source, RemoteDataState, Minion } from "src/types";

import { ErrorHandling } from "src/shared/decorators/errors";

enum SortDirection {
  ASC = "asc",
  DESC = "desc"
}
export interface Props {
  minions: Minion[];
  controlPageStatus: RemoteDataState;
  onClickTableRow: () => void;
  onClickAction: () => void;
  onClickRun: () => void;
  onClickStop: () => void;
  onClickInstall: () => void;
  //handleAllCheck: () => object
  // handleWheelKeyCommand: () => void
}
interface State {
  searchTerm: string;
  sortDirection: SortDirection;
  sortKey: string;
}

@ErrorHandling
class AgentControlTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      searchTerm: "",
      sortDirection: SortDirection.ASC,
      sortKey: "name"
    };
  }

  public getSortedHosts = memoize(
    (
      minions,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(minions, searchTerm), sortKey, sortDirection)
  );

  public filter(allHosts, searchTerm) {
    const filterText = searchTerm.toLowerCase();
    return allHosts.filter(h => {
      // const apps = h.apps ? h.apps.join(', ') : ''

      // let tagResult = false
      // if (h.tags) {
      //   tagResult = Object.keys(h.tags).reduce((acc, key) => {
      //     return acc || h.tags[key].toLowerCase().includes(filterText)
      //   }, false)
      // } else {
      //   tagResult = false
      // }
      return h.host.toLowerCase().includes(filterText);
      // apps.toLowerCase().includes(filterText) ||
      // tagResult
    });
  }

  public sort(hosts, key, direction) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(hosts, e => e[key]);
      case SortDirection.DESC:
        return _.sortBy(hosts, e => e[key]).reverse();
      default:
        return hosts;
    }
  }

  public updateSearchTerm = searchTerm => {
    this.setState({ searchTerm });
  };

  public updateSort = key => () => {
    const { sortKey, sortDirection } = this.state;
    if (sortKey === key) {
      const reverseDirection =
        sortDirection === SortDirection.ASC
          ? SortDirection.DESC
          : SortDirection.ASC;
      this.setState({ sortDirection: reverseDirection });
    } else {
      this.setState({ sortKey: key, sortDirection: SortDirection.ASC });
    }
  };

  public sortableClasses = key => {
    const { sortKey, sortDirection } = this.state;
    if (sortKey === key) {
      if (sortDirection === SortDirection.ASC) {
        return "hosts-table--th sortable-header sorting-ascending";
      }
      return "hosts-table--th sortable-header sorting-descending";
    }
    return "hosts-table--th sortable-header";
  };

  public componentWillMount() {}

  public componentDidMount() {}

  public componentWillUnmount() {}

  private get AgentTableHeader(): JSX.Element {
    return this.AgentTableHeaderEachPage;
  }

  private get AgentTableContents(): JSX.Element {
    const { minions, controlPageStatus } = this.props;
    const { sortKey, sortDirection, searchTerm } = this.state;

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    );

    // if (controlPageStatus === RemoteDataState.Loading) {
    //   return this.LoadingState;
    // }
    if (controlPageStatus === RemoteDataState.Error) {
      return this.ErrorState;
    }
    if (
      (controlPageStatus === RemoteDataState.Error && minions.length === 0) ||
      (controlPageStatus === RemoteDataState.Done && minions.length === 0)
    ) {
      return this.NoHostsState;
    }
    if (
      (controlPageStatus === RemoteDataState.Error &&
        sortedHosts.length === 0) ||
      (controlPageStatus === RemoteDataState.Done && minions.length === 0)
    ) {
      return this.NoSortedHostsState;
    }

    return this.AgentTableWithHosts;
  }

  private get LoadingState(): JSX.Element {
    return (
      <div
        style={{
          position: "absolute",
          zIndex: 3,
          backgroundColor: "rgba(0,0,0,0.5)",
          width: "100%",
          height: "100%"
        }}
      >
        <PageSpinner />
      </div>
    );
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{ margin: "90px 0" }}>There was a problem loading hosts</h4>
      </div>
    );
  }

  private get NoHostsState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{ margin: "90px 0" }}>No Hosts found</h4>
      </div>
    );
  }

  private get NoSortedHostsState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{ margin: "90px 0" }}>
          There are no hosts that match the search criteria
        </h4>
      </div>
    );
  }

  public render() {
    const {
      onClickRun,
      onClickStop,
      onClickInstall,
      controlPageStatus
    } = this.props;

    return (
      <div className="panel">
        {controlPageStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2 className="panel-title">{this.AgentTitle}</h2>
          <SearchBar
            placeholder="Filter by Minion..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div className="panel-body">{this.AgentTableContents}</div>
        <div
          className=""
          style={{
            padding: "20px",
            paddingTop: "0px",
            textAlign: "right"
          }}
        >
          <button
            disabled={
              controlPageStatus === RemoteDataState.Loading ? true : false
            }
            className="btn btn-inline_block btn-default"
            onClick={onClickRun.bind(this)}
          >
            RUN
          </button>
          <button
            disabled={
              controlPageStatus === RemoteDataState.Loading ? true : false
            }
            className="btn btn-inline_block btn-default"
            onClick={onClickStop.bind(this)}
            style={{
              marginLeft: "5px"
            }}
          >
            STOP
          </button>
          <button
            disabled={
              controlPageStatus === RemoteDataState.Loading ? true : false
            }
            className="btn btn-inline_block btn-default"
            onClick={onClickInstall.bind(this)}
            style={{
              marginLeft: "5px"
            }}
          >
            INSTALL
          </button>
        </div>
      </div>
    );
  }

  private getHandleAllCheck = () => {
    const { handleAllCheck } = this.props;
    return handleAllCheck({ _this: this });
  };

  private get AgentTitle() {
    const { minions } = this.props;
    const { sortKey, sortDirection, searchTerm } = this.state;
    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    );

    const hostsCount = sortedHosts.length;
    if (hostsCount === 1) {
      return `1 Minions`;
    }
    return `${hostsCount} Minions`;
  }

  private get AgentTableHeaderEachPage() {
    const { isAllCheck } = this.props;
    const {
      CheckWidth,
      NameWidth,
      IPWidth,
      HostWidth,
      StatusWidth
    } = AGENT_TABLE_SIZING;
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div style={{ width: CheckWidth }} className="hosts-table--th">
            <input
              type="checkbox"
              checked={isAllCheck}
              onClick={this.getHandleAllCheck}
              readOnly
            />
          </div>
          <div
            onClick={this.updateSort("name")}
            className={this.sortableClasses("name")}
            style={{ width: NameWidth }}
          >
            Host
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort("operatingSystem")}
            className={this.sortableClasses("operatingSystem")}
            style={{ width: IPWidth }}
          >
            OS
            <span className="icon caret-up" />
          </div>
          <div
            onClick={this.updateSort("operatingSystem")}
            className={this.sortableClasses("operatingSystem")}
            style={{ width: IPWidth }}
          >
            OS Version
            <span className="icon caret-up" />
          </div>

          <div
            onClick={this.updateSort("deltaUptime")}
            className={this.sortableClasses("deltaUptime")}
            style={{ width: IPWidth }}
          >
            IP
            <span className="icon caret-up" />
          </div>
          <div
            className="hosts-table--th list-type"
            style={{ width: StatusWidth }}
          >
            Enabled
          </div>
          <div
            className={this.sortableClasses("cpu")}
            style={{ width: StatusWidth }}
          >
            Action
          </div>
        </div>
      </div>
    );
  }

  private get AgentTableWithHosts() {
    const {
      minions,
      onClickTableRow,
      onClickAction,
      onClickRun,
      onClickStop,
      onClickInstall,
      isAllCheck,
      handleMinionCheck
    } = this.props;
    const { sortKey, sortDirection, searchTerm } = this.state;

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    );

    return (
      <>
        <div className="hosts-table">
          {this.AgentTableHeader}
          <FancyScrollbar
            children={sortedHosts.map((m, i) => (
              <AgentControlTableRow
                key={i}
                minions={m}
                onClickTableRow={onClickTableRow}
                onClickAction={onClickAction}
                onClickRun={onClickRun}
                onClickStop={onClickStop}
                onClickInstall={onClickInstall}
                isCheck={m.isCheck}
                isAllCheck={isAllCheck}
                handleMinionCheck={handleMinionCheck}
              />
            ))}
            itemHeight={26}
            className="hosts-table--tbody"
          />
        </div>
      </>
    );
  }
}

export default AgentControlTable;
