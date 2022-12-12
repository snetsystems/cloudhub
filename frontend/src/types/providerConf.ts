export interface OpenStackCspInput {
  id?: string
  projectName: string
  authUrl: string
  userName: string
  password: string
  projectDomain: string
  userDomain: string
}

export interface GcpCspInput {
  id?: string
  projectName: string
  email: string
  privateKey: string
  disabled: boolean
}

export type CSPData = {
  id: string
  provider: string
  namespace: string
  accesskey: string
  secretkey: string
  authurl: string
  projectdomain: string
  userdomain: string
  minion: string
}
