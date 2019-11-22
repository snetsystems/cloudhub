import React, { PureComponent } from "react";

import _ from "lodash";
import memoize from "memoize-one";

import SearchBar from "src/hosts/components/SearchBar";
import AgentConfigurationTableRow from "src/agent_admin/components/AgentConfigurationTableRow";
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
  configPageStatus: RemoteDataState;
  onClickTableRow: () => void;
  onClickAction: () => void;
  focusedHost: string;
  // onClickRun: () => void
  // onClickStop: () => void
  // onClickInstall: () => void
  // handleWheelKeyCommand: () => void
}
interface State {
  searchTerm: string;
  sortDirection: SortDirection;
  sortKey: string;
}

@ErrorHandling
class AgentConfigurationTable extends PureComponent<Props, State> {
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
      return h.host.toLowerCase().includes(filterText);
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

  private get AgentTableContents() {
    const { minions, configPageStatus } = this.props;
    const { sortKey, sortDirection, searchTerm } = this.state;

    const sortedHosts = this.getSortedHosts(
      minions,
      searchTerm,
      sortKey,
      sortDirection
    );

    // if (configPageStatus === RemoteDataState.Loading) {
    //   return this.LoadingState
    // }

    if (configPageStatus === RemoteDataState.Error) {
      return this.ErrorState;
    }
    if (configPageStatus === RemoteDataState.Done && minions.length === 0) {
      return this.NoHostsState;
    }
    if (configPageStatus === RemoteDataState.Done && sortedHosts.length === 0) {
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
    const { configPageStatus } = this.props;

    return (
      <div className="panel">
        {configPageStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2 className="panel-title">{this.AgentTitle}</h2>
          <SearchBar
            placeholder="Filter by Host..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div className="panel-body">{this.AgentTableContents}</div>
      </div>
    );
  }

  private get AgentTitle() {
    const { minions } = this.props;
    const { sortKey, sortDirection, searchTerm } = this.state;

    const filteredMinion = minions.filter(m => m.isInstall === true);

    const sortedHosts = this.getSortedHosts(
      filteredMinion,
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
    const { IPWidth, HostWidth, StatusWidth } = AGENT_TABLE_SIZING;
    return (
      <div className="hosts-table--thead">
        <div className="hosts-table--tr">
          <div
            onClick={this.updateSort("name")}
            className={this.sortableClasses("name")}
            style={{ width: HostWidth }}
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
            className={this.sortableClasses("cpu")}
            style={{ width: StatusWidth }}
          >
            Action
          </div>
        </div>
      </div>
    );
  }

  private get AgentTableHeader() {
    return this.AgentTableHeaderEachPage;
  }

  private get AgentTableWithHosts() {
    const { minions, onClickTableRow, onClickAction, focusedHost } = this.props;
    const { sortKey, sortDirection, searchTerm } = this.state;

    const filteredMinion = minions.filter(m => m.isInstall === true);

    const sortedHosts = this.getSortedHosts(
      filteredMinion,
      searchTerm,
      sortKey,
      sortDirection
    );

    return (
      <div className="hosts-table">
        {this.AgentTableHeader}
        <FancyScrollbar
          children={sortedHosts.map((m, i) => (
            <AgentConfigurationTableRow
              key={i}
              minions={m}
              onClickTableRow={onClickTableRow}
              onClickAction={onClickAction}
              focusedHost={focusedHost}
            />
          ))}
          itemHeight={26}
          className="hosts-table--tbody"
        />
      </div>
    );
  }
}

export default AgentConfigurationTable;
