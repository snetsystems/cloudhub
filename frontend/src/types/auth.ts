export interface Organization {
  defaultRole: string
  id: string
  links: {
    self: string
  }
  name: string
}

export interface Me {
  currentOrganization?: Organization
  superAdmin: boolean
  role: string
  scheme: string
  provider: string
  name: string
  roles: Role[]
  organizations: Organization[]
  email?: string
  passwordResetFlag?: string
  passwordUpdateDate?: string
  retryCount?: number
  lockedTime?: string
  locked?: boolean
}

export enum InfluxDBPermissions {
  All = 'ALL',
  NoPermissions = 'NoPermissions',
  ViewAdmin = 'ViewAdmin',
  ViewCloudHub = 'ViewCloudHub',
  CreateDatabase = 'CreateDatabase',
  CreateUserAndRole = 'CreateUserAndRole',
  AddRemoveNode = 'AddRemoveNode',
  DropDatabase = 'DropDatabase',
  DropData = 'DropData',
  ReadData = 'ReadData',
  WriteData = 'WriteData',
  Rebalance = 'Rebalance',
  ManageShard = 'ManageShard',
  ManageContinuousQuery = 'ManageContinuousQuery',
  ManageQuery = 'ManageQuery',
  ManageSubscription = 'ManageSubscription',
  Monitor = 'Monitor',
  CopyShard = 'CopyShard',
  KapacitorAPI = 'KapacitorAPI',
  KapacitorConfigAPI = 'KapacitorConfigAPI',
}

export enum InfluxDBPermissionScope {
  All = 'all',
  Database = 'database',
}

export interface Permission {
  scope: string
  allowed: InfluxDBPermissions[]
}

export interface Role {
  name: string
  organization: string
}

export interface User {
  id: string
  links: {self: string}
  name: string
  provider: string
  roles: Role[]
  scheme: string
  superAdmin: boolean
}

export interface BasicUser extends User {
  email?: string
  passwordResetFlag: string
  passwordUpdateDate: string
  retryCount: number
  lockedTime: string
  locked: boolean
}

export interface AuthLink {
  callback: string
  label: string
  login: string
  logout: string
  name: string
}

export interface AuthConfig {
  auth: string
  self: string
}

export interface Links {
  allUsers: string
  auth: AuthLink[]
  config: AuthConfig
  dashboards: string
  environment: string
  external: ExternalLinks
  layouts: string
  logout: string
  mappings: string
  me: string
  organizations: string
  sources: string
  users: string
  addons: Addon[]
  basicLogout?: string
  basicPasswordReset?: string
  basicPasswordAdminReset?: string
  basicPassword?: string
  passwordPolicy?: string
  passwordPolicyMessage?: string
  loginLocked: string
  osp: OSP
}

export interface OSP {
  'admin-provider': string
  'admin-pw': string
  'admin-user': string
  'auth-url': string
  'pj-domain-id': string
  'user-domain-id': string
}

export interface ExternalLink {
  name: string
  url: string
}

export interface Addon {
  name: string
  url: string
  token: string
}

interface ExternalLinks {
  statusFeed?: string
  custom?: ExternalLink[]
}
