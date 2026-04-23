import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {Template, TemplateType, TemplateValueType} from 'src/types'
import type {TimeRange} from 'src/types'
import type {Source} from 'src/types/sources'

/**
 * Default time window for the Server Details "usage detail" modal when no range is
 * passed from the parent. Not stored in the fixed-cell JSON; this is a UI default only.
 */
export const DEFAULT_DETAIL_TIME_RANGE: TimeRange = {
  lower: 'now() - 1h',
  upper: null,
}

/**
 * Merges the modal's selected time range into **fixed-cell / builtin dashboard** template
 * arrays (the same `Template[]` shape that `LayoutRenderer` passes as `templatesForLayout`).
 *
 * - **What stays:** host, DB, RP, and any other template variables coming from the fixed
 *   cell or hydrated dashboard state (e.g. `:host:` from template overrides).
 * - **What is overwritten:** only the time-slice variables produced by
 *   `createTimeRangeTemplates` — typically `:dashboardTime:` and `:upperDashboardTime:` —
 *   so that `RefreshingGraph` → `executeQuery` → `replaceTemplates` applies the **modal's**
 *   local time range, not the main page's time range, when the user changes the range inside
 *   the detail modal.
 *
 * This is intentionally separate from generic dashboard template helpers so that "fixed
 * cell" usage-detail flows are easy to find and not confused with ad-hoc template utilities.
 */
export function mergeFixedCellTimeRangeIntoLayoutTemplates(
  base: Template[],
  timeRange: TimeRange
): Template[] {
  const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
    lower: timeRange.lower,
    upper: timeRange.upper ?? 'now()',
  })
  const templateMap = new Map<string, Template>()
  for (const t of base) {
    const key = t.tempVar || t.id
    if (key) templateMap.set(key, t)
  }
  templateMap.set(dashboardTime.tempVar || dashboardTime.id, dashboardTime)
  templateMap.set(
    upperDashboardTime.tempVar || upperDashboardTime.id,
    upperDashboardTime
  )
  return Array.from(templateMap.values())
}

/**
 * Builds a minimal **TagValues**-style `Template` for a single InfluxQL placeholder
 * (e.g. `:host:`, `:process_name:`, `:user:`) used in fixed-cell / Server Details detail
 * charts. The object shape must match `tempVars/utils/replace` handling for
 * `TemplateValueType.TagValue` so that `executeQuery` → `replace` → `replaceTemplates`
 * performs the same substitution as the main dashboard.
 *
 * This is **not** a full fixed-cell row from the dashboard store; it is a small, explicit
 * fragment for `replaceTemplates` only.
 */
export function buildFixedCellTagValueTemplate(
  id: string,
  tempVar: string,
  value: string
): Template {
  return {
    id,
    tempVar,
    type: TemplateType.TagValues,
    label: '',
    values: [
      {
        value,
        type: TemplateValueType.TagValue,
        selected: true,
        localSelected: true,
      },
    ],
  }
}

/**
 * Builds the **fallback** InfluxQL template set for **fixed-cell** Server Details usage
 * detail modals when we do not receive pre-hydrated `layoutTemplates` from
 * `DashboardPageWithImport` (e.g. some edge flows). Supplies:
 * - Constant `:db:` / `:rp:` from the selected `Source` (Telegraf DB + default RP),
 * - `:dashboardTime:` / `:upperDashboardTime:` from the modal (or default) time range,
 * - Optional `:host:` via {@link buildFixedCellTagValueTemplate} when a host is selected.
 *
 * Queries in `server-details` JSON use these placeholders; this bundle aligns the modal
 * with the same `replaceTemplates` contract as the main fixed-cell layout.
 */
export function buildFixedCellUsageDetailQueryTemplates(
  source: Source,
  timeRange: TimeRange,
  host: string | null
): Template[] {
  const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates({
    lower: timeRange.lower,
    upper: timeRange.upper ?? 'now()',
  })

  const base: Template[] = [
    {
      tempVar: ':db:',
      id: 'db',
      type: TemplateType.Constant,
      label: '',
      values: [
        {
          value: source.telegraf,
          type: TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    },
    {
      tempVar: ':rp:',
      id: 'rp',
      type: TemplateType.Constant,
      label: '',
      values: [
        {
          value: source.defaultRP || 'autogen',
          type: TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    },
    dashboardTime,
    upperDashboardTime,
  ]

  if (host) {
    return [
      ...base,
      buildFixedCellTagValueTemplate('usage-detail-host', ':host:', host),
    ]
  }

  return base
}
