import {Organization} from 'src/types'

export const orgNameToId = (orgName: string, orgList: Organization[]) => {
  return orgList.find(org => org.name === orgName)?.id
}

export const orgIdToName = (orgId: string, orgList: Organization[]) => {
  return orgList.find(org => org.id === orgId)?.name ?? 'Not Exist Org'
}
