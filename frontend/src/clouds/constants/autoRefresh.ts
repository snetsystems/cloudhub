// library
import _ from 'lodash'

// constants
import {
  AutoRefreshOptionType,
  AutoRefreshOption,
  defaultAutoRefreshOptions,
  autoRefreshHeader,
  autoRefreshOptionPaused,
} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

export const CLOUD_AUTO_REFRESH = {default: 0}

export const autoRefreshOptions: AutoRefreshOption[] = [
  {
    id: 'auto-refresh-header',
    milliseconds: 9999,
    label: 'Refresh',
    type: AutoRefreshOptionType.Header,
  },
  {
    id: 'auto-refresh-paused',
    milliseconds: 0,
    label: 'Paused',
    type: AutoRefreshOptionType.Option,
  },
  {
    id: 'auto-refresh-30s',
    milliseconds: 30000,
    label: '30s',
    type: AutoRefreshOptionType.Option,
  },
  {
    id: 'auto-refresh-60s',
    milliseconds: 60000,
    label: '60s',
    type: AutoRefreshOptionType.Option,
  },
  {
    id: 'auto-refresh-5m',
    milliseconds: 300000,
    label: '5m',
    type: AutoRefreshOptionType.Option,
  },
]

export const autoRefreshGroupDefaultOption = (
  groupName: string | undefined,
  groupKey: string
) => [
  {...autoRefreshHeader, group: groupName},
  {...autoRefreshOptionPaused, group: groupName},
  {
    id: `auto-refresh-5s-${groupKey}`,
    milliseconds: 5000,
    label: '5s',
    type: AutoRefreshOptionType.Option,
    group: groupName,
  },
  {
    id: `auto-refresh-10s-${groupKey}`,
    milliseconds: 10000,
    label: '10s',
    type: AutoRefreshOptionType.Option,
    group: groupName,
  },
  {
    id: `auto-refresh-15s-${groupKey}`,
    milliseconds: 15000,
    label: '15s',
    type: AutoRefreshOptionType.Option,
    group: groupName,
  },
  {
    id: `auto-refresh-30s-${groupKey}`,
    milliseconds: 30000,
    label: '30s',
    type: AutoRefreshOptionType.Option,
    group: groupName,
  },
  {
    id: `auto-refresh-60s-${groupKey}`,
    milliseconds: 60000,
    label: '60s',
    type: AutoRefreshOptionType.Option,
    group: groupName,
  },
]

export function getTimeOptionByGroup(groupName: string | undefined) {
  return (
    {
      host: autoRefreshGroupDefaultOption(groupName, 'host'),
      vmware: autoRefreshGroupDefaultOption(groupName, 'vmware'),
      kubernetes: autoRefreshGroupDefaultOption(groupName, 'kubernetes'),
      prediction: autoRefreshGroupDefaultOption(groupName, 'prediction'),
      queries: autoRefreshGroupDefaultOption(groupName, 'queries'),
      detailHost: autoRefreshGroupDefaultOption(groupName, 'detailHost'),
      openstackMonitor: autoRefreshGroupDefaultOption(
        groupName,
        'openstackMonitor'
      ),
      openstack: [
        {...autoRefreshHeader, group: groupName},
        {...autoRefreshOptionPaused, group: groupName},
        {
          id: 'auto-refresh-5m-osp',
          milliseconds: 300000,
          label: '5m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-10m-osp',
          milliseconds: 600000,
          label: '10m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-15m-osp',
          milliseconds: 900000,
          label: '15m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-30m-osp',
          milliseconds: 1800000,
          label: '30m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-60m-osp',
          milliseconds: 3600000,
          label: '60m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
      ],
      topology: [
        {...autoRefreshHeader, group: groupName},
        {...autoRefreshOptionPaused, group: groupName},
        {
          id: 'auto-refresh-1m-topology',
          milliseconds: 60000,
          label: '1m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-2m-topology',
          milliseconds: 120000,
          label: '2m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-3m-topology',
          milliseconds: 180000,
          label: '3m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-5m-topology',
          milliseconds: 300000,
          label: '5m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-7m-topology',
          milliseconds: 420000,
          label: '7m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
        {
          id: 'auto-refresh-10m-topology',
          milliseconds: 600000,
          label: '10m',
          type: AutoRefreshOptionType.Option,
          group: groupName,
        },
      ],

      default: _.map(defaultAutoRefreshOptions, autoRefreshOption => ({
        ...autoRefreshOption,
        group: groupName,
      })),
    }[groupName] || null
  )
}
