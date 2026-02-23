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
import {Cell, Dashboard, DashboardSwitcherLinks} from 'src/types/dashboards'
import {Source, Protoboard} from 'src/types'

export const getDashboards: GetDashboards = () => {
  return AJAX<DashboardsResponse>({
    method: 'GET',
    resource: 'dashboards',
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

/** Response of GET /cloudhub/v1/builtin/dashboards (list of available builtin template names) */
export interface BuiltinDashboardListResponse {
  templates: Array<{name: string; version?: string}>
}

export const getBuiltinDashboardList = (): Promise<
  AxiosResponse<BuiltinDashboardListResponse>
> => {
  return AJAX<BuiltinDashboardListResponse>({
    method: 'GET',
    url: '/cloudhub/v1/builtin/dashboards',
  }) as Promise<AxiosResponse<BuiltinDashboardListResponse>>
}

/** Fetches one builtin template by name. GET /cloudhub/v1/builtin/dashboards/:name/template */
export const getBuiltinDashboardTemplate = async (
  name: string
): Promise<AxiosResponse<Dashboard>> => {
  return AJAX<Dashboard>({
    method: 'GET',
    url: `/cloudhub/v1/builtin/dashboards/${encodeURIComponent(name)}/template`,
  }) as Promise<AxiosResponse<Dashboard>>
}

/** Fetches current org's builtin dashboard by name (has version, latestVersion, updateAvailable, recentlyUpdated). GET /cloudhub/v1/templates/:name */
export const getTemplateDashboardByName = async (
  name: string
): Promise<AxiosResponse<Dashboard> | null> => {
  try {
    return (await AJAX<Dashboard>({
      method: 'GET',
      url: `/cloudhub/v1/templates/${encodeURIComponent(name)}`,
    })) as AxiosResponse<Dashboard>
  } catch {
    return null
  }
}

/** Applies the latest builtin template to the current org's dashboard (full replace). POST /cloudhub/v1/builtin/dashboards/:name/apply */
export const applyBuiltinDashboard = async (name: string): Promise<void> => {
  await AJAX({
    method: 'POST',
    url: `/cloudhub/v1/builtin/dashboards/${encodeURIComponent(name)}/apply`,
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

export const deleteDashboardCell = async cell => {
  try {
    return await AJAX({
      method: 'DELETE',
      url: cell.links.self,
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

export const getHostsListApi = async (id: string) => {
  try {
    const {data} = await AJAX<AxiosResponse<Dashboard>>({
      url: `/cloudhub/v1/templates/${id}`,
      method: 'GET',
    })
    // /cloudhub/v1/builtin/dashboards/host_page/template
    return data as Dashboard
  } catch (error) {
    console.error(error)
    throw error
  }
}
