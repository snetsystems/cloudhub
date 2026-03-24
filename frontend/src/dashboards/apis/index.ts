import AJAX from 'src/utils/ajax'

import {manager} from 'src/worker/JobManager'

import {
  linksFromDashboards,
  updateDashboardLinks,
} from 'src/dashboards/utils/dashboardSwitcherLinks'
import {instantiateProtoboard} from 'src/dashboards/utils/protoboardToDashboard'

import {AxiosResponse} from 'axios'
import {
  DashboardsResponse,
  GetDashboards,
  LoadLinksOptions,
} from 'src/types/apis/dashboards'
import {
  Cell,
  Dashboard,
  LibraryCell,
  DashboardSwitcherLinks,
} from 'src/types/dashboards'
import {Source, Protoboard} from 'src/types'

export const getDashboards: GetDashboards = () => {
  return AJAX<DashboardsResponse>({
    method: 'GET',
    resource: 'dashboards',
  }) as Promise<AxiosResponse<DashboardsResponse>>
}

export const getDefaultDashboards = (): Promise<
  AxiosResponse<DashboardsResponse>
> => {
  return AJAX<DashboardsResponse>({
    method: 'GET',
    url: '/cloudhub/v1/dashboards?isDefault=true',
  }) as Promise<AxiosResponse<DashboardsResponse>>
}

export const loadDashboardLinks = async (
  source: Source,
  {activeDashboard, dashboardsAJAX = getDashboards}: LoadLinksOptions
): Promise<DashboardSwitcherLinks> => {
  const {
    data: {dashboards},
  } = await dashboardsAJAX()

  const links = linksFromDashboards(dashboards, source)
  const dashboardLinks = updateDashboardLinks(links, activeDashboard)

  return dashboardLinks
}

export const getDashboard = async dashboardID => {
  try {
    const url = `/cloudhub/v1/dashboards/${dashboardID}`
    return manager.get(url)
  } catch (error) {
    console.error(error)
    throw error
  }
}

/** Response of GET /cloudhub/v1/fixed-cells (list of available fixed-cell names) */
export interface FixedCellListResponse {
  templates: Array<{name: string; version?: string}>
}

export const getFixedCellList = (): Promise<
  AxiosResponse<FixedCellListResponse>
> => {
  return AJAX<FixedCellListResponse>({
    method: 'GET',
    url: '/cloudhub/v1/fixed-cells',
  }) as Promise<AxiosResponse<FixedCellListResponse>>
}

/** Fetches one fixed-cell by name. GET /cloudhub/v1/fixed-cells/:name/template */
export const getFixedCell = async (
  name: string
): Promise<AxiosResponse<Dashboard>> => {
  return AJAX<Dashboard>({
    method: 'GET',
    url: `/cloudhub/v1/fixed-cells/${encodeURIComponent(name)}/template`,
  }) as Promise<AxiosResponse<Dashboard>>
}

/** Fetches current org's fixed-cell dashboard by name (has version, latestVersion, updateAvailable). GET /cloudhub/v1/fixed-cells/:name */
export const getFixedCellDashboardByName = async (
  name: string
): Promise<AxiosResponse<Dashboard> | null> => {
  try {
    return (await AJAX<Dashboard>({
      method: 'GET',
      // includeHidden=true so Fixed Cell management UI can see all builtin cells,
      // regardless of their visible/hidden state on the dashboard.
      url: `/cloudhub/v1/fixed-cells/${encodeURIComponent(
        name
      )}?includeHidden=true`,
    })) as AxiosResponse<Dashboard>
  } catch {
    return null
  }
}

/** Applies the latest fixed-cell to the current org's dashboard. POST /cloudhub/v1/fixed-cells/:name/apply */
export const applyFixedCell = async (name: string): Promise<void> => {
  await AJAX({
    method: 'POST',
    url: `/cloudhub/v1/fixed-cells/${encodeURIComponent(name)}/apply`,
  })
}

export const updateDashboard = dashboard => {
  return AJAX({
    method: 'PUT',
    url: dashboard.links.self,
    data: dashboard,
  })
}

export const updateDashboardCell = cell => {
  return AJAX({
    method: 'PUT',
    url: cell.links.self,
    data: cell,
  })
}

export const createDashboard = async dashboard => {
  try {
    return await AJAX({
      method: 'POST',
      resource: 'dashboards',
      data: dashboard,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export interface GetLibraryCellsResponse {
  libraryCells: LibraryCell[]
}

export const getLibraryCells = (): Promise<
  AxiosResponse<GetLibraryCellsResponse>
> => {
  return AJAX<GetLibraryCellsResponse>({
    method: 'GET',
    url: '/cloudhub/v1/cell-library',
  }) as Promise<AxiosResponse<GetLibraryCellsResponse>>
}

export const createLibraryCell = async (
  libraryCell: Partial<LibraryCell>
) => {
  try {
    return await AJAX({
      method: 'POST',
      url: '/cloudhub/v1/cell-library',
      data: libraryCell,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateLibraryCell = async (
  id: string,
  patch: Partial<Pick<LibraryCell, 'name' | 'description' | 'type' | 'content'>>
) => {
  try {
    return await AJAX({
      method: 'PATCH',
      url: `/cloudhub/v1/cell-library/${encodeURIComponent(id)}`,
      data: patch,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteLibraryCell = async (id: string) => {
  try {
    return await AJAX({
      method: 'DELETE',
      url: `/cloudhub/v1/cell-library/${encodeURIComponent(id)}`,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createDashboardFromProtoboard = async (
  protoboard: Protoboard,
  source: Source
) => {
  const dashboard = instantiateProtoboard(protoboard, source)
  try {
    return await AJAX({
      method: 'POST',
      resource: 'dashboards',
      data: dashboard,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteDashboard = async dashboard => {
  try {
    return await AJAX({
      method: 'DELETE',
      url: dashboard.links.self,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const addDashboardCell = async (dashboard, cell) => {
  try {
    return await AJAX({
      method: 'POST',
      url: dashboard.links.cells,
      data: cell,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const addDashboardCells = async (dashboard, cells) => {
  try {
    return await AJAX({
      method: 'POST',
      url: `/cloudhub/v1/dashboards/${dashboard.id}`,
      data: {
        cells: cells,
      },
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const patchDashboardByID = async (
  dashboardID: string,
  cells: Cell[]
) => {
  try {
    return await AJAX({
      method: 'PATCH',
      url: `/cloudhub/v1/dashboards/${dashboardID}`,
      data: {
        cells: cells,
      },
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateDashboardDefault = async (
  dashboardID: string,
  isDefault: boolean
) => {
  try {
    return await AJAX({
      method: 'PATCH',
      url: `/cloudhub/v1/dashboards/${dashboardID}`,
      data: {
        isDefault,
      },
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteDashboardCell = async (
  dashboard: {id: string},
  cell: {i: string; links?: {self?: string}}
) => {
  const url =
    cell.links?.self ||
    `/cloudhub/v1/dashboards/${dashboard.id}/cells/${cell.i}`
  try {
    return await AJAX({
      method: 'DELETE',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const editTemplateVariables = async templateVariable => {
  try {
    return await AJAX({
      method: 'PUT',
      url: templateVariable.links.self,
      data: templateVariable,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

/** Fetches a dashboard by its fixed-cell/page name (e.g. server-details, host_page). Returns null when not found or on error.
 * Uses includeHidden=true so the full cell list (including hidden) is available for import merge; visibility is handled by the UI. */
export const getDashboardByTemplateName = async (
  name: string
): Promise<Dashboard | null> => {
  try {
    const {data} = await AJAX<AxiosResponse<Dashboard>>({
      url: `/cloudhub/v1/fixed-cells/${encodeURIComponent(name)}?includeHidden=true`,
      method: 'GET',
    })
    return data as Dashboard
  } catch (error) {
    console.error(error)
    return null
  }
}
