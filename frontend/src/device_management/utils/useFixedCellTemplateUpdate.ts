import {useEffect, useState} from 'react'

import {applyFixedCell, getDashboards} from 'src/dashboards/apis'
import {
  notifyTemplateUpdated,
  notifyTemplateUpdateFailed,
} from 'src/shared/copy/notifications'
import * as DashboardsModels from 'src/types/dashboards'
import {Notification} from 'src/types/notifications'

export interface TemplateUpdate {
  from: string
  to: string
}

/**
 * Whether the organization's copy of a builtin dashboard is behind its shipped
 * template, and a way to bring it forward. Cells of one template share one
 * answer, so every cell of the dashboard shows the same badge.
 */
export const useFixedCellTemplateUpdate = (
  templateName: string,
  notify?: (message: Notification) => void
) => {
  const [update, setUpdate] = useState<TemplateUpdate | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  const load = async () => {
    try {
      const {data} = await getDashboards()
      const template = (data?.dashboards ?? []).find(
        (d: DashboardsModels.Dashboard) => d.name === templateName
      )
      setUpdate(
        template?.updateAvailable
          ? {from: template.version ?? '—', to: template.latestVersion ?? '—'}
          : null
      )
    } catch {
      // No update badge is better than a wrong one.
    }
  }

  useEffect(() => {
    load()
  }, [templateName])

  const apply = async () => {
    setIsApplying(true)
    try {
      await applyFixedCell(templateName)
      await load()
      notify?.(notifyTemplateUpdated())
    } catch (error) {
      notify?.(notifyTemplateUpdateFailed(error?.message ?? 'unknown error'))
    } finally {
      setIsApplying(false)
    }
  }

  return {update, isApplying, apply}
}
