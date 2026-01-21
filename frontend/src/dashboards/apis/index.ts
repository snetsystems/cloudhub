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
import {DashboardSwitcherLinks, Dashboard} from 'src/types/dashboards'
import {Source, Protoboard} from 'src/types'

export const getDashboards: GetDashboards = () => {
  return AJAX<DashboardsResponse>({
    method: 'GET',
    resource: 'dashboards',
  }) as Promise<AxiosResponse<DashboardsResponse>>
}

/**
 * Get builtin dashboard by name from the store.
 * Returns the dashboard instance stored in the store for the current organization,
 * not the JSON template. This instance may have been modified by admins.
 */
export const getBuiltinDashboardByName = async (
  name: string
): Promise<Dashboard | null> => {
  try {
    const {
      data: {dashboards},
    } = await getDashboards()
    const builtinDashboard = dashboards.find(
      d => d.type === 'builtin' && d.name === name
    )
    return builtinDashboard || null
  } catch (error) {
    console.error('Failed to get builtin dashboard:', error)
    return null
  }
}

/**
 * Get original builtin dashboard template by name from backend.
 * Returns the original JSON template (not the modified instance in the store).
 * @param name Dashboard name (unique identifier, e.g., "Host Page")
 */
export const getBuiltinDashboardTemplate = async (
  name: string
): Promise<Dashboard | null> => {
  try {
    const response = await (AJAX<Dashboard>({
      method: 'GET',
      url: `/cloudhub/v1/builtin/dashboards/${encodeURIComponent(name)}/template`,
    }) as Promise<AxiosResponse<Dashboard>>)
    return response.data
  } catch (error) {
    console.error('Failed to get builtin dashboard template:', error)
    return null
  }
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

export const updateDashboard = dashboard => {
  // links.self가 있으면 사용하고, 없으면 dashboardID로 URL 구성
  const url =
    dashboard.links?.self || `/cloudhub/v1/dashboards/${dashboard.id}`
  return AJAX({
    method: 'PUT',
    url,
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

export const getDashboardItems = async () => {
  try {
    return await AJAX({
      method: 'GET',
      url: '/cloudhub/v1/dashboard-items',
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createDashboardItem = async (dashboardItem: {
  name: string
  description?: string
  type: string
  content: any
}) => {
  try {
    return await AJAX({
      method: 'POST',
      url: '/cloudhub/v1/dashboard-items',
      data: dashboardItem,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}
