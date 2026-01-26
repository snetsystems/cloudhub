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
import {BUILTIN_DASHBOARD_NAMES} from 'src/dashboards/constants'

/**
 * Type-level helper to convert SNAKE_CASE to camelCase
 * e.g., "HOST_PAGE" -> "hostPage"
 */
type ToCamelCase<S extends string> = S extends `${infer First}_${infer Rest}`
  ? `${Lowercase<First>}${Capitalize<ToCamelCase<Rest>>}`
  : Lowercase<S>

/**
 * Type-safe accessor type for builtin dashboards
 * Converts BUILTIN_DASHBOARD_NAMES keys to camelCase method names
 */
type BuiltinDashboardAccessor<T extends Record<string, string>> = {
  [K in keyof T as ToCamelCase<string & K>]: () => Promise<Dashboard | null>
}

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
const getBuiltinDashboardByName = async (
  name: string
): Promise<Dashboard | null> => {
  try {
    const {
      data: {dashboards},
    } = await getDashboards()
    
    // Debug: log all dashboards and builtin dashboards
    console.log('All dashboards:', dashboards)
    console.log('Builtin dashboards:', dashboards.filter(d => d.type === 'builtin'))
    console.log('Looking for dashboard with name:', name)
    
    const builtinDashboard = dashboards.find(
      d => d.type === 'builtin' && d.name === name
    )
    
    if (!builtinDashboard) {
      console.warn(
        `Builtin dashboard with name "${name}" not found. Available builtin dashboards:`,
        dashboards
          .filter(d => d.type === 'builtin')
          .map(d => ({name: d.name, type: d.type, organization: d.organization}))
      )
    }
    
    return builtinDashboard || null
  } catch (error) {
    console.error('Failed to get builtin dashboard:', error)
    return null
  }
}

/**
 * Get original builtin dashboard template by name from backend.
 * Returns the original JSON template (not the modified instance in the store).
 */
const getBuiltinDashboardTemplateByName = async (
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

/**
 * Helper to convert constant key to camelCase method name
 * e.g., HOST_PAGE -> hostPage
 */
const toCamelCase = (key: string): string => {
  return key
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Create type-safe accessor object from BUILTIN_DASHBOARD_NAMES
 */
const createBuiltinDashboardAccessor = (
  names: typeof BUILTIN_DASHBOARD_NAMES,
  getter: (name: string) => Promise<Dashboard | null>
): BuiltinDashboardAccessor<typeof BUILTIN_DASHBOARD_NAMES> => {
  const accessor = {} as Record<string, () => Promise<Dashboard | null>>
  
  for (const key in names) {
    const methodName = toCamelCase(key)
    const dashboardName = names[key as keyof typeof names]
    accessor[methodName] = () => getter(dashboardName)
  }
  
  return accessor as BuiltinDashboardAccessor<typeof BUILTIN_DASHBOARD_NAMES>
}

/**
 * Type-safe accessor for builtin dashboards.
 * Returns the dashboard instance stored in the store for the current organization,
 * not the JSON template. This instance may have been modified by admins.
 * 
 * Automatically generated from BUILTIN_DASHBOARD_NAMES.
 * Add new dashboards to BUILTIN_DASHBOARD_NAMES and they will be available here.
 * 
 * @example
 * const dashboard = await getBuiltinDashboard.hostPage()
 */
export const getBuiltinDashboard: BuiltinDashboardAccessor<
  typeof BUILTIN_DASHBOARD_NAMES
> = createBuiltinDashboardAccessor(
  BUILTIN_DASHBOARD_NAMES,
  getBuiltinDashboardByName
)

/**
 * Type-safe accessor for builtin dashboard templates.
 * Returns the original JSON template (not the modified instance in the store).
 * 
 * Automatically generated from BUILTIN_DASHBOARD_NAMES.
 * Add new dashboards to BUILTIN_DASHBOARD_NAMES and they will be available here.
 * 
 * @example
 * const template = await getBuiltinDashboardTemplate.hostPage()
 */
export const getBuiltinDashboardTemplate: BuiltinDashboardAccessor<
  typeof BUILTIN_DASHBOARD_NAMES
> = createBuiltinDashboardAccessor(
  BUILTIN_DASHBOARD_NAMES,
  getBuiltinDashboardTemplateByName
)

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
