import React, {useState} from 'react'
import {TopologyNoiseFilters, VerdictFilter} from 'src/hubble/utils/filterEdges'
import {CrossNsMode} from 'src/hubble/utils/groupExternalNamespaces'

interface Props {
  hideSystemNodes: boolean
  simplifiedView: boolean
  verdictFilter: VerdictFilter
  // crossNsMode is only meaningful in drilldown. The selector hides itself in
  // overview so it doesn't suggest behavior that won't take effect.
  crossNsMode: CrossNsMode
  drilldownActive: boolean
  noiseFilters: TopologyNoiseFilters
  onHideSystemChange: (v: boolean) => void
  onSimplifiedViewChange: (v: boolean) => void
  onVerdictFilterChange: (v: VerdictFilter) => void
  onCrossNsModeChange: (v: CrossNsMode) => void
  onNoiseFiltersChange: (v: TopologyNoiseFilters) => void
}

const CROSS_NS_OPTIONS: ReadonlyArray<{
  value: CrossNsMode
  label: string
  title: string
}> = [
  {
    value: 'show',
    label: 'Show',
    title: '다른 namespace 워크로드를 그대로 모두 표시 (원본)',
  },
  {
    value: 'dim',
    label: 'Dim',
    title:
      '다른 namespace 워크로드를 옅게 표시 — focus namespace의 워크로드만 강조 (Hubble UI 스타일)',
  },
  {
    value: 'group',
    label: 'Group',
    title:
      '다른 namespace의 워크로드들을 ns 단위 그룹 카드 1장으로 묶음 — 시각 정돈에 가장 효과적',
  },
]

const VERDICT_OPTIONS: ReadonlyArray<{
  value: VerdictFilter
  label: string
  title: string
}> = [
  {value: 'all', label: 'All', title: '모든 verdict 표시 (기본값)'},
  {
    value: 'denied',
    label: 'Denied',
    title: 'DROPPED flow가 있는 엣지만 표시 — 정책 차단 확인용',
  },
  {
    value: 'allowed',
    label: 'Allowed',
    title: 'DROPPED flow가 전혀 없는 엣지만 표시 — 정상 트래픽 확인용',
  },
]

const MapViewOptions: React.FC<Props> = ({
  hideSystemNodes,
  simplifiedView,
  verdictFilter,
  crossNsMode,
  drilldownActive,
  noiseFilters,
  onHideSystemChange,
  onSimplifiedViewChange,
  onVerdictFilterChange,
  onCrossNsModeChange,
  onNoiseFiltersChange,
}) => {
  const [noiseFiltersOpen, setNoiseFiltersOpen] = useState(false)
  const activeNoiseFilterCount = Object.keys(noiseFilters).filter(
    key => noiseFilters[key as keyof TopologyNoiseFilters]
  ).length
  const updateNoiseFilter = (
    key: keyof TopologyNoiseFilters,
    checked: boolean
  ) => onNoiseFiltersChange({...noiseFilters, [key]: checked})

  return (
    <div
      className="hubble-map-options"
      role="group"
      aria-label="Map view options"
    >
      <div
        className="hubble-verdict-filter"
        role="radiogroup"
        aria-label="Verdict filter"
      >
        {VERDICT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={verdictFilter === opt.value}
            className={[
              'hubble-verdict-filter-btn',
              verdictFilter === opt.value ? 'is-active' : '',
              opt.value === 'denied' && verdictFilter === opt.value
                ? 'hubble-verdict-filter-btn--denied'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={opt.title}
            onClick={() => onVerdictFilterChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <label className="hubble-map-option">
        <input
          type="checkbox"
          checked={simplifiedView}
          onChange={e => onSimplifiedViewChange(e.target.checked)}
        />
        Top connections
      </label>
      <label className="hubble-map-option">
        <input
          type="checkbox"
          checked={hideSystemNodes}
          onChange={e => onHideSystemChange(e.target.checked)}
        />
        Hide system NS
      </label>
      <div className="hubble-noise-filter-control">
        <button
          type="button"
          className={[
            'hubble-noise-filter-trigger',
            activeNoiseFilterCount > 0 ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-expanded={noiseFiltersOpen}
          onClick={() => setNoiseFiltersOpen(open => !open)}
        >
          Noise filters
          {activeNoiseFilterCount > 0 && (
            <span className="hubble-noise-filter-count">
              {activeNoiseFilterCount}
            </span>
          )}
        </button>
        {noiseFiltersOpen && (
          <div className="hubble-noise-filter-popover">
            <label className="hubble-noise-filter-option">
              <input
                type="checkbox"
                aria-label="Hide DNS"
                checked={noiseFilters.hideDNS}
                onChange={e => updateNoiseFilter('hideDNS', e.target.checked)}
              />
              Hide DNS
            </label>
            <label className="hubble-noise-filter-option">
              <input
                type="checkbox"
                aria-label="Hide host/node"
                checked={noiseFilters.hideHostNode}
                onChange={e =>
                  updateNoiseFilter('hideHostNode', e.target.checked)
                }
              />
              Hide host/node
            </label>
            <label className="hubble-noise-filter-option">
              <input
                type="checkbox"
                aria-label="Hide monitoring"
                checked={noiseFilters.hideMonitoring}
                onChange={e =>
                  updateNoiseFilter('hideMonitoring', e.target.checked)
                }
              />
              Hide monitoring
            </label>
          </div>
        )}
      </div>
      {drilldownActive && (
        <div
          className="hubble-cross-ns-mode"
          role="radiogroup"
          aria-label="Cross-namespace presentation"
          title="drilldown focus namespace 밖 워크로드를 어떻게 표시할지"
        >
          <span className="hubble-cross-ns-mode-label">Cross-NS</span>
          {CROSS_NS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={crossNsMode === opt.value}
              className={[
                'hubble-cross-ns-mode-btn',
                crossNsMode === opt.value ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={opt.title}
              onClick={() => onCrossNsModeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default MapViewOptions
