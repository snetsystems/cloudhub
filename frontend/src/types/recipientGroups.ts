import {AlertRecipientMemberPrefs} from 'src/types'

export interface RecipientMember {
  id: string
  userName: string
  email: string
  alertOn: boolean
  level: string
  isNew?: boolean
  userId?: string
  originalPrefs?: AlertRecipientMemberPrefs
  isEditing?: boolean
  isExternal?: boolean
}

export interface GroupInfo {
  isNew?: boolean
  groupId?: string
  groupName?: string
  memberCount?: number
  emailTargets?: number
}
