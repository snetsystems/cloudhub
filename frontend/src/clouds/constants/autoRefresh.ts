import {
  AutoRefreshOptionType,
  AutoRefreshOption,
} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

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
