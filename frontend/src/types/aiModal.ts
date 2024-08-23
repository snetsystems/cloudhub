import {ReactNode} from 'react'
import {ComponentColor} from 'src/reusable_ui'

export interface AiModal {
  title?: string
  isVisible: boolean
  message?: string
  confirmText?: string
  cancelText?: string
  customClass?: string
  isOneBtn?: boolean
  childNode?: ReactNode
  btnColor?: ComponentColor
  onConfirm?: () => void
  onCancel?: () => void
}

export interface HeaderNavigationObj {
  id: string
  titleText: string
  value: string
  active: string
  label: string
}
