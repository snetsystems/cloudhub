import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import {OverlayTechnology, Input, IconFont} from 'src/reusable_ui'
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from 'src/shared/components/Tabs'

// APIs
import {getDashboardItems, getDashboards} from 'src/dashboards/apis'

// Types
import {DashboardItem, Dashboard} from 'src/types/dashboards'

// Styles
import 'src/dashboards/components/ImportOverlay.scss'

interface Props {
  isVisible: boolean
  onDismiss: () => void
  onImportItems?: (items: DashboardItem[]) => void
}

interface State {
  dashboardItems: DashboardItem[]
  dashboards: Dashboard[]
  selectedItemIds: Set<string>
  selectedDashboardCells: Map<string, DashboardItem> // ID -> keys to construct item
  expandedDashboardIds: Set<string>
  searchTerm: string
  loading: boolean
}

class ImportOverlay extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      dashboardItems: [],
      dashboards: [],
      selectedItemIds: new Set(),
      selectedDashboardCells: new Map(),
      expandedDashboardIds: new Set(),
      searchTerm: '',
      loading: false,
    }
  }

  public async componentDidMount() {
    if (this.props.isVisible) {
      this.loadData()
    }
  }

  public async componentDidUpdate(prevProps: Props) {
    if (this.props.isVisible && !prevProps.isVisible) {
      this.loadData()
      // Reset selection and expansion when reopening
      this.setState({
        selectedItemIds: new Set(),
        selectedDashboardCells: new Map(),
        expandedDashboardIds: new Set(),
      })
    }
  }

  private loadData = async () => {
    this.setState({loading: true})
    try {
      const [itemsResp, dashboardsResp] = await Promise.all([
        getDashboardItems(),
        getDashboards(),
      ])

      const items = _.get(itemsResp, 'data.dashboardItems', [])
      const dashboards = _.get(dashboardsResp, 'data.dashboards', [])

      this.setState({
        dashboardItems: items,
        dashboards: dashboards,
        loading: false,
      })
    } catch (error) {
      console.error('Failed to load import data:', error)
      this.setState({loading: false})
    }
  }

  private handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({searchTerm: e.target.value})
  }

  private handleItemClick = (item: DashboardItem) => {
    const {selectedItemIds} = this.state
    const newSelectedIds = new Set(selectedItemIds)

    if (newSelectedIds.has(item.id)) {
      newSelectedIds.delete(item.id)
    } else {
      newSelectedIds.add(item.id)
    }

    this.setState({selectedItemIds: newSelectedIds})
  }

  private handleDashboardExpand = (dashboardId: string) => {
    const {expandedDashboardIds} = this.state
    const newExpandedResponse = new Set(expandedDashboardIds)

    if (newExpandedResponse.has(dashboardId)) {
      newExpandedResponse.delete(dashboardId)
    } else {
      newExpandedResponse.add(dashboardId)
    }

    this.setState({expandedDashboardIds: newExpandedResponse})
  }

  private handleDashboardCellClick = (dashboard: Dashboard, cell: any) => {
    // Construct a pseudo DashboardItem for the cell
    // Use a unique ID combination of dashboardID and cellID to track selection
    const uniqueId = `${dashboard.id}-${cell.i}`
    const {selectedDashboardCells} = this.state
    const newSelectedCells = new Map(selectedDashboardCells)

    if (newSelectedCells.has(uniqueId)) {
      newSelectedCells.delete(uniqueId)
    } else {
      const item: DashboardItem = {
        id: uniqueId, // Temporary ID
        name: cell.name || 'Untitled Cell',
        type: cell.type,
        content: cell,
        description: `From dashboard: ${dashboard.name}`,
      }
      newSelectedCells.set(uniqueId, item)
    }

    this.setState({selectedDashboardCells: newSelectedCells})
  }

  private getDashboardSelectionState = (
    dashboard: Dashboard
  ): {
    allSelected: boolean
    someSelected: boolean
    selectedCount: number
  } => {
    if (!dashboard.cells || dashboard.cells.length === 0) {
      return {allSelected: false, someSelected: false, selectedCount: 0}
    }

    const {selectedDashboardCells} = this.state
    let selectedCount = 0

    dashboard.cells.forEach(cell => {
      const uniqueId = `${dashboard.id}-${cell.i}`
      if (selectedDashboardCells.has(uniqueId)) {
        selectedCount++
      }
    })

    const allSelected = selectedCount === dashboard.cells.length
    const someSelected =
      selectedCount > 0 && selectedCount < dashboard.cells.length

    return {allSelected, someSelected, selectedCount}
  }

  private handleDashboardSelectAll = (
    e: React.MouseEvent,
    dashboard: Dashboard
  ) => {
    e.stopPropagation() // Prevent expanding/collapsing

    const {selectedDashboardCells} = this.state
    const newSelectedCells = new Map(selectedDashboardCells)
    const {allSelected} = this.getDashboardSelectionState(dashboard)

    if (allSelected) {
      // Deselect all cells from this dashboard
      dashboard.cells?.forEach(cell => {
        const uniqueId = `${dashboard.id}-${cell.i}`
        newSelectedCells.delete(uniqueId)
      })
    } else {
      // Select all cells from this dashboard
      dashboard.cells?.forEach(cell => {
        const uniqueId = `${dashboard.id}-${cell.i}`
        const item: DashboardItem = {
          id: uniqueId,
          name: cell.name || 'Untitled Cell',
          type: cell.type,
          content: cell,
          description: `From dashboard: ${dashboard.name}`,
        }
        newSelectedCells.set(uniqueId, item)
      })
    }

    this.setState({selectedDashboardCells: newSelectedCells})
  }

  private handleImportClick = () => {
    const {onImportItems, onDismiss} = this.props
    const {dashboardItems, selectedItemIds, selectedDashboardCells} = this.state

    // Merge library items and dashboard cells
    let itemsToImport: DashboardItem[] = []

    // Library Items
    if (selectedItemIds.size > 0) {
      itemsToImport = itemsToImport.concat(
        dashboardItems.filter(item => selectedItemIds.has(item.id))
      )
    }

    // Dashboard Cells
    if (selectedDashboardCells.size > 0) {
      itemsToImport = itemsToImport.concat(
        Array.from(selectedDashboardCells.values())
      )
    }

    if (onImportItems && itemsToImport.length > 0) {
      onImportItems(itemsToImport)
      onDismiss()
    }
  }

  private get filteredItems(): DashboardItem[] {
    const {dashboardItems, searchTerm} = this.state
    if (!searchTerm.trim()) {
      return dashboardItems
    }
    const term = searchTerm.toLowerCase()
    return dashboardItems.filter(
      item =>
        item.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    )
  }

  private get filteredDashboards(): Dashboard[] {
    const {dashboards, searchTerm} = this.state
    // Filter to only normal dashboards (exclude builtin)
    const normalDashboards = dashboards.filter(
      d => !d.type || d.type === 'normal'
    )
    
    if (!searchTerm.trim()) {
      return normalDashboards
    }
    const term = searchTerm.toLowerCase()
    // Filter dashboards that match name OR have cells that match name
    return normalDashboards.filter(d => {
      const dashMatch = d.name.toLowerCase().includes(term)
      const cellMatch = d.cells.some(
        c => c.name && c.name.toLowerCase().includes(term)
      )
      return dashMatch || cellMatch
    })
  }

  private getCellTypeIcon = (type: string): string => {
    const iconMap: {[key: string]: string} = {
      line: IconFont.GraphLine,
      'line-stacked': IconFont.GraphLine,
      'line-stepplot': IconFont.GraphLine,
      bar: IconFont.BarChart,
      'line-plus-single-stat': IconFont.GraphLine,
      'single-stat': IconFont.SingleStat,
      gauge: 'gauge',
      table: IconFont.Table,
    }
    return iconMap[type] || IconFont.GraphLine
  }

  public render() {
    const {isVisible, onDismiss} = this.props
    const {
      loading,
      searchTerm,
      selectedItemIds,
      expandedDashboardIds,
      selectedDashboardCells,
    } = this.state

    // Calculations
    const filteredItems = this.filteredItems
    const filteredDashboards = this.filteredDashboards

    const totalSelectionCount =
      selectedItemIds.size + selectedDashboardCells.size

    return (
      <OverlayTechnology visible={isVisible}>
        <div className="import-panel-drawer">
          <div className="import-panel-drawer--header">
            <span>Import Panel</span>
            <button
              className="import-panel-drawer--dismiss"
              onClick={onDismiss}
            >
              <span className="icon remove" />
            </button>
          </div>
          <div className="import-panel-drawer--body">
            <Tabs>
              <TabList customClass="import-tabs">
                <Tab>Library</Tab>
                <Tab>Dashboard</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <div className="import-content">
                    <div className="import-filter-bar">
                      <div className="import-search-input">
                        <Input
                          placeholder="Search by name, description or folder"
                          icon={IconFont.Search}
                          value={searchTerm}
                          onChange={this.handleSearchChange}
                        />
                      </div>
                      <div className="import-filter-btn">
                        <div className="icon">
                          <span className={`icon ${IconFont.Filter}`} />
                        </div>{' '}
                        Filter by type
                      </div>
                    </div>
                    <div className="import-item-list">
                      {loading ? (
                        <div className="import-loading">Loading...</div>
                      ) : filteredItems.length === 0 ? (
                        <div className="import-empty">
                          {searchTerm
                            ? 'No items found matching your search'
                            : 'No dashboard items available'}
                        </div>
                      ) : (
                        filteredItems.map(item => {
                          const isSelected = selectedItemIds.has(item.id)
                          return (
                            <div
                              key={item.id}
                              className={`import-list-item ${
                                isSelected ? 'selected' : ''
                              }`}
                              onClick={() => this.handleItemClick(item)}
                            >
                              <div
                                className={`import-select-box ${
                                  isSelected ? 'checked' : ''
                                }`}
                              >
                                {isSelected && (
                                  <span className="icon checkmark" />
                                )}
                              </div>
                              <div className="import-item-icon">
                                <span
                                  className={`icon ${this.getCellTypeIcon(
                                    item.type
                                  )}`}
                                />
                              </div>
                              <div className="import-item-details">
                                <div className="item-name">{item.name}</div>
                                <div className="item-meta">
                                  <div className="icon">
                                    <span className={`icon ${IconFont.Cube}`} />
                                  </div>{' '}
                                  {item.type}
                                  {item.description && (
                                    <>
                                      {' • '}
                                      {item.description}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </TabPanel>
                <TabPanel>
                  <div className="import-content">
                    <div className="import-filter-bar">
                      <div className="import-search-input">
                        <Input
                          placeholder="Search dashboards or cells..."
                          icon={IconFont.Search}
                          value={searchTerm}
                          onChange={this.handleSearchChange}
                        />
                      </div>
                    </div>
                    <div className="import-dashboard-list">
                      {loading ? (
                        <div className="import-loading">Loading...</div>
                      ) : filteredDashboards.length === 0 ? (
                        <div className="import-empty">
                          {searchTerm
                            ? 'No dashboards found matching your search'
                            : 'No dashboards available'}
                        </div>
                      ) : (
                        filteredDashboards.map(dashboard => {
                          const isExpanded = expandedDashboardIds.has(
                            dashboard.id
                          )
                          const cellCount = dashboard.cells
                            ? dashboard.cells.length
                            : 0

                          return (
                            <div
                              key={dashboard.id}
                              className="import-dashboard-group"
                            >
                              <div
                                className="import-dashboard-header"
                                onClick={() =>
                                  this.handleDashboardExpand(dashboard.id)
                                }
                              >
                                <div
                                  className={`import-select-box ${
                                    this.getDashboardSelectionState(dashboard)
                                      .allSelected
                                      ? 'checked'
                                      : this.getDashboardSelectionState(
                                          dashboard
                                        ).someSelected
                                      ? 'indeterminate'
                                      : ''
                                  }`}
                                  onClick={e =>
                                    this.handleDashboardSelectAll(e, dashboard)
                                  }
                                >
                                  {this.getDashboardSelectionState(dashboard)
                                    .allSelected && (
                                    <span className="icon checkmark" />
                                  )}
                                  {this.getDashboardSelectionState(dashboard)
                                    .someSelected &&
                                    !this.getDashboardSelectionState(dashboard)
                                      .allSelected && (
                                      <span className="indeterminate-line" />
                                    )}
                                </div>
                                <div className="dashboard-icon">
                                  <span
                                    className={`icon ${
                                      isExpanded
                                        ? IconFont.CaretDown
                                        : IconFont.CaretRight
                                    }`}
                                  />
                                  <span
                                    className={`icon ${IconFont.GraphLine}`}
                                  />
                                </div>
                                <div className="dashboard-name">
                                  {dashboard.name}
                                </div>
                                <div className="dashboard-meta">
                                  {cellCount} cells
                                  {this.getDashboardSelectionState(dashboard)
                                    .selectedCount > 0 &&
                                    ` (${
                                      this.getDashboardSelectionState(dashboard)
                                        .selectedCount
                                    } selected)`}
                                </div>
                              </div>
                              {isExpanded && dashboard.cells && (
                                <div className="import-dashboard-cells">
                                  {dashboard.cells.map(cell => {
                                    const uniqueId = `${dashboard.id}-${cell.i}`
                                    const isSelected = selectedDashboardCells.has(
                                      uniqueId
                                    )
                                    return (
                                      <div
                                        key={cell.i}
                                        className={`import-list-item cell-item ${
                                          isSelected ? 'selected' : ''
                                        }`}
                                        onClick={() =>
                                          this.handleDashboardCellClick(
                                            dashboard,
                                            cell
                                          )
                                        }
                                      >
                                        <div
                                          className={`import-select-box ${
                                            isSelected ? 'checked' : ''
                                          }`}
                                        >
                                          {isSelected && (
                                            <span className="icon checkmark" />
                                          )}
                                        </div>
                                        <div className="import-item-icon">
                                          <span
                                            className={`icon ${this.getCellTypeIcon(
                                              cell.type
                                            )}`}
                                          />
                                        </div>
                                        <div className="import-item-details">
                                          <div className="item-name">
                                            {cell.name || 'Untitled Cell'}
                                          </div>
                                          <div className="item-meta">
                                            {cell.type}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {cellCount === 0 && (
                                    <div className="empty-cells">
                                      No cells in this dashboard
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
          <div className="import-panel-drawer--footer">
            <div className="selection-status">
              {totalSelectionCount > 0
                ? `${totalSelectionCount} items selected`
                : 'Select items to import'}
            </div>
            <button
              className={`btn btn-primary ${
                totalSelectionCount === 0 ? 'disabled' : ''
              }`}
              disabled={totalSelectionCount === 0}
              onClick={this.handleImportClick}
            >
              Import Selected
            </button>
          </div>
        </div>
      </OverlayTechnology>
    )
  }
}

export default ImportOverlay
