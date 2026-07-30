import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {Page} from 'src/reusable_ui'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'
import ServiceMap from 'src/hubble/components/ServiceMap'
import StatusBar from 'src/hubble/components/StatusBar'
import TopTalkersPanel from 'src/hubble/components/TopTalkersPanel'
import DetailPanel from 'src/hubble/components/DetailPanel'
import MapViewOptions from 'src/hubble/components/MapViewOptions'
import FlowTable from 'src/hubble/components/FlowTable'
import FlowDetailsModal from 'src/hubble/components/FlowDetailsModal'
import SidePanelTutorial, {
  TutorialTab,
} from 'src/hubble/components/SidePanelTutorial'
import HubbleBetaBadge from 'src/hubble/components/HubbleBetaBadge'
import PolicyImpactPanel from 'src/hubble/components/PolicyImpactPanel'
import PodConnectionsPanel from 'src/hubble/components/PodConnectionsPanel'
import {getHubbleClusters} from 'src/hubble/apis'
import {PodConnectionSummary, PodOption} from 'src/hubble/utils/podConnections'
import {podFocusFilters, podPeerFilters} from 'src/hubble/utils/podFocusFilters'
import {useHubbleSnapshot} from 'src/hubble/hooks/useHubbleSnapshot'
import {useAllFlows} from 'src/hubble/hooks/useAllFlows'
import {
  HubbleClusterInfo,
  HubbleFlowFilters,
  HubbleFlowRecord,
  PolicyImpactBaseline,
} from 'src/hubble/types'
import {
  DEFAULT_TOPOLOGY_NOISE_FILTERS,
  VerdictFilter,
} from 'src/hubble/utils/filterEdges'
import {formatHubbleError} from 'src/hubble/utils/errors'
import {
  buildPolicyBaseline,
  comparePolicyImpact,
} from 'src/hubble/utils/policyImpact'
import {
  CrossNsMode,
  groupExternalNamespaces,
} from 'src/hubble/utils/groupExternalNamespaces'
import {
  edgeDetailFilters,
  nodeFocusFilters,
} from 'src/hubble/utils/edgeFocusFilters'

// drillNamespace extracts the namespace name from a "ns:<name>" node id.
const drillNamespace = (nodeId: string): string | null => {
  if (!nodeId.startsWith('ns:')) return null
  return nodeId.slice(3) || null
}

type SidePanelTab = 'talkers' | 'policy' | 'pods' | 'edge'

const HubblePage: React.FC = () => {
  const [clusters, setClusters] = useState<HubbleClusterInfo[]>([])
  const [cluster, setCluster] = useState<string>('')
  const [drilldown, setDrilldown] = useState<string | null>(null)
  const [hideSystemNodes, setHideSystemNodes] = useState(true)
  const [simplifiedView, setSimplifiedView] = useState(true)
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all')
  const [noiseFilters, setNoiseFilters] = useState(
    DEFAULT_TOPOLOGY_NOISE_FILTERS
  )
  const [flowModal, setFlowModal] = useState<HubbleFlowRecord | null>(null)
  const [flowFilters, setFlowFilters] = useState<HubbleFlowFilters>({})
  const [
    policyBaseline,
    setPolicyBaseline,
  ] = useState<PolicyImpactBaseline | null>(null)
  const [detailEdgeId, setDetailEdgeId] = useState<string | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [activePodKey, setActivePodKey] = useState<string | null>(null)
  const [focusedPeerKey, setFocusedPeerKey] = useState<string | null>(null)
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('talkers')
  // Which tutorial modal is open. Each "?" button scopes the modal to the
  // guides for its own screen area (header / map nodes / side panel tabs).
  const [tutorial, setTutorial] = useState<{
    initial: TutorialTab
    tabs: TutorialTab[]
  } | null>(null)
  const [crossNsMode, setCrossNsMode] = useState<CrossNsMode>('group')
  const [clusterListError, setClusterListError] = useState<string>('')
  const [livePaused, setLivePaused] = useState(false)

  // Threesizer proportions — CloudHub convention: array sums to 1.0.
  // Outer split: map+sidepanels (top) vs flow table (bottom).
  // Inner split: graph area (left) vs analysis panels (right).
  const [topProps, setTopProps] = useState<number[]>([0.65, 0.35])
  const [sideProps, setSideProps] = useState<number[]>([0.78, 0.22])

  // Flow table is "hidden" when its size goes to 0. Operator can drag the
  // handle to expand it back, but as a quick affordance we also expose a
  // collapse/expand toggle.
  const flowTableHidden = topProps[1] < 0.05

  useEffect(() => {
    let cancelled = false
    getHubbleClusters()
      .then(r => {
        if (cancelled) return
        setClusters(r.clusters || [])
        if (r.clusters && r.clusters.length > 0) {
          setCluster(r.clusters[0].name)
        }
      })
      .catch(e => !cancelled && setClusterListError(formatHubbleError(e)))
    return () => {
      cancelled = true
    }
  }, [])

  // Reset drilldown + selection when cluster changes to avoid showing stale
  // selections that don't exist in the new cluster.
  useEffect(() => {
    setDrilldown(null)
    setDetailEdgeId(null)
    setActiveNodeId(null)
    setActivePodKey(null)
    setFocusedPeerKey(null)
    setFlowFilters({})
    setPolicyBaseline(null)
    setSidePanelTab('talkers')
    setLivePaused(false)
  }, [cluster])

  useEffect(() => {
    if (!drilldown && sidePanelTab === 'pods') {
      setSidePanelTab('talkers')
    }
  }, [drilldown, sidePanelTab])

  const {
    snapshot: rawSnapshot,
    connected,
    loading,
    error: streamError,
  } = useHubbleSnapshot(cluster, drilldown, livePaused)

  // Cross-ns presentation: 'group' collapses foreign-namespace workloads into
  // synthetic ns-group cards via groupExternalNamespaces; 'dim' and 'show'
  // both leave the snapshot intact and let the renderer adjust opacity.
  const snapshot = useMemo(
    () =>
      crossNsMode === 'group'
        ? groupExternalNamespaces(rawSnapshot, drilldown)
        : rawSnapshot,
    [rawSnapshot, drilldown, crossNsMode]
  )

  // Bottom flow stream. Overview is cluster-wide; drilldown is namespace-scoped.
  // Keep it alive in drilldown because PodConnectionsPanel also depends on it.
  const listViewNamespace = useMemo(
    () =>
      !detailEdgeId && activeNodeId
        ? nodeFocusFilters(activeNodeId).namespace
        : null,
    [detailEdgeId, activeNodeId]
  )

  const effectiveNamespace = drilldown || listViewNamespace

  const {
    flows: allFlows,
    connected: flowsConnected,
    loading: flowsLoading,
    error: flowsError,
  } = useAllFlows(
    cluster,
    200,
    !!cluster && (!flowTableHidden || !!drilldown),
    effectiveNamespace,
    flowFilters,
    livePaused
  )

  const policyContext = useMemo(
    () => ({cluster, namespace: drilldown || '', filters: flowFilters}),
    [cluster, drilldown, flowFilters]
  )

  const policyComparison = useMemo(
    () =>
      policyBaseline
        ? comparePolicyImpact(policyBaseline, allFlows, policyContext)
        : null,
    [policyBaseline, allFlows, policyContext]
  )

  const capturePolicyBaseline = useCallback(() => {
    setPolicyBaseline(buildPolicyBaseline(allFlows, policyContext))
  }, [allFlows, policyContext])

  const handleNodeDrillDown = useCallback(
    (nodeId: string) => {
      if (drilldown) return
      const ns = drillNamespace(nodeId)
      if (ns) {
        setDrilldown(ns)
        setDetailEdgeId(null)
        setActiveNodeId(null)
        setFlowFilters({})
      }
    },
    [drilldown]
  )

  const handleNodeSelect = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId)
    setActivePodKey(null)
    setFocusedPeerKey(null)
    setDetailEdgeId(null)
    setFlowFilters(nodeFocusFilters(nodeId).filters)
  }, [])

  const handleEdgeDetails = useCallback(
    (edgeId: string, src: string, dst: string) => {
      setDetailEdgeId(edgeId)
      setSidePanelTab('edge')
      setActiveNodeId(prev => prev ?? src)
      setActivePodKey(null)
      setFocusedPeerKey(null)
      setFlowFilters(edgeDetailFilters(src, dst))
    },
    []
  )

  const handleBackToEdgeList = useCallback(() => {
    setDetailEdgeId(null)
    setFlowFilters(activeNodeId ? nodeFocusFilters(activeNodeId).filters : {})
  }, [activeNodeId])

  const handleClearSelection = useCallback(() => {
    setActiveNodeId(null)
    setActivePodKey(null)
    setFocusedPeerKey(null)
    setDetailEdgeId(null)
    setFlowFilters({})
  }, [])

  const handlePodSelect = useCallback((pod: PodOption) => {
    setActivePodKey(pod.key)
    setFocusedPeerKey(null)
    setFlowFilters(podFocusFilters(pod.pod))
  }, [])

  const handleBackToPodList = useCallback(() => {
    setActivePodKey(null)
    setFocusedPeerKey(null)
    setFlowFilters({})
  }, [])

  const handleFocusPodPeer = useCallback(
    (pod: PodOption, peer: PodConnectionSummary) => {
      if (focusedPeerKey === peer.key) {
        setFocusedPeerKey(null)
        setFlowFilters(podFocusFilters(pod.pod))
      } else {
        setFocusedPeerKey(peer.key)
        setFlowFilters(podPeerFilters(pod.pod, peer, peer.direction))
      }
    },
    [focusedPeerKey]
  )

  const exitDrilldown = useCallback(() => {
    setDrilldown(null)
    setDetailEdgeId(null)
    setActiveNodeId(null)
    setActivePodKey(null)
    setFocusedPeerKey(null)
    setFlowFilters({})
    setSidePanelTab(tab => (tab === 'pods' ? 'talkers' : tab))
  }, [])

  const displayError = streamError || clusterListError

  // ------- Threesizer renderers -------
  const renderTopDivision = () => (
    <div className="hubble-inner-threesizer-host">
      <Threesizer
        orientation={HANDLE_VERTICAL}
        containerClass="hubble-inner-threesizer"
        divisions={[
          {
            name: '',
            handleDisplay: 'none',
            menuOptions: [],
            render: renderGraphDivision,
            size: sideProps[0],
          },
          {
            name: '',
            handlePixels: 8,
            menuOptions: [],
            render: renderSidePanelsDivision,
            size: sideProps[1],
          },
        ]}
        onResize={setSideProps}
      />
    </div>
  )

  const renderGraphDivision = () => (
    <div className="hubble-graph-area">
      {loading && !snapshot && (
        <div className="hubble-loading">
          Loading snapshot for {drilldown ?? 'overview'}…
        </div>
      )}
      {!loading && snapshot && snapshot.edges.length === 0 && (
        <div className="hubble-empty hubble-empty--with-hint">
          <div>최근 윈도우 내 관측된 flow가 없습니다.</div>
          <div className="hubble-empty-hint">
            ServiceMap은 윈도우 동안 트래픽이 있었던 노드만 표시합니다. 트래픽이
            없는 pod/workload는 맵에 나타나지 않습니다.
          </div>
        </div>
      )}
      <ServiceMap
        snapshot={snapshot}
        hideSystemNodes={hideSystemNodes}
        simplifiedView={simplifiedView}
        verdictFilter={verdictFilter}
        noiseFilters={noiseFilters}
        crossNsMode={crossNsMode}
        drilldown={drilldown}
        detailEdgeId={detailEdgeId}
        onNodeDrillDown={handleNodeDrillDown}
        onNodeSelect={handleNodeSelect}
        onEdgeDetails={handleEdgeDetails}
        onClearSelection={handleClearSelection}
        onHelp={() => setTutorial({initial: 'nodes', tabs: ['nodes']})}
      />
    </div>
  )

  const renderSidePanelsDivision = () => (
    <div className="hubble-side-panels">
      <div
        className="hubble-side-tabs"
        role="tablist"
        aria-label="Hubble details"
      >
        <SideTab
          id="talkers"
          label="Talkers"
          active={sidePanelTab === 'talkers'}
          onClick={setSidePanelTab}
        />
        <SideTab
          id="policy"
          label="Policy"
          active={sidePanelTab === 'policy'}
          onClick={setSidePanelTab}
        />
        {drilldown && (
          <SideTab
            id="pods"
            label="Pods"
            active={sidePanelTab === 'pods'}
            onClick={setSidePanelTab}
          />
        )}
        <SideTab
          id="edge"
          label="Connections"
          active={sidePanelTab === 'edge'}
          onClick={setSidePanelTab}
        />
        <button
          type="button"
          className="hubble-side-tabs-help"
          title="이 패널의 각 항목이 무엇인지 예시 데이터와 함께 단계별로 설명합니다"
          aria-label="Open panel tutorial"
          onClick={() =>
            setTutorial({
              initial: sidePanelTab,
              tabs: ['talkers', 'policy', 'pods', 'edge'],
            })
          }
        >
          ?
        </button>
      </div>
      <div className="hubble-side-panel-content">
        {sidePanelTab === 'talkers' && <TopTalkersPanel snapshot={snapshot} />}
        {sidePanelTab === 'policy' && (
          <PolicyImpactPanel
            baseline={policyBaseline}
            comparison={policyComparison}
            currentFlowCount={allFlows.length}
            onCapture={capturePolicyBaseline}
            onClear={() => setPolicyBaseline(null)}
          />
        )}
        {sidePanelTab === 'pods' && drilldown && (
          <PodConnectionsPanel
            flows={allFlows}
            namespace={drilldown}
            activePodKey={activePodKey}
            focusedPeerKey={focusedPeerKey}
            onSelectPod={handlePodSelect}
            onBack={handleBackToPodList}
            onFocusPeer={handleFocusPodPeer}
          />
        )}
        {sidePanelTab === 'edge' && (
          <DetailPanel
            cluster={cluster}
            snapshot={snapshot}
            selectedEdgeId={detailEdgeId}
            activeNodeId={activeNodeId}
            livePaused={livePaused}
            onSelectEdge={handleEdgeDetails}
            onBack={handleBackToEdgeList}
            onClose={handleClearSelection}
          />
        )}
      </div>
    </div>
  )

  const renderFlowTableDivision = () => (
    <FlowTable
      flows={allFlows}
      connected={flowsConnected}
      paused={livePaused}
      loading={flowsLoading}
      error={flowsError}
      filters={flowFilters}
      onFiltersChange={setFlowFilters}
      onSelectFlow={setFlowModal}
    />
  )

  return (
    <Page className="hubble-page">
      <Page.Header>
        <Page.Header.Left>
          <div className="hubble-page-title">
            <Page.Title title="Traffic Map" />
            <HubbleBetaBadge />
            {clusters.length > 0 && (
              <StatusBar
                wsConnected={connected}
                paused={livePaused}
                onTogglePause={() => setLivePaused(p => !p)}
              />
            )}
          </div>
          {drilldown && (
            <button className="hubble-back-button" onClick={exitDrilldown}>
              ← Overview
            </button>
          )}
          {drilldown && (
            <span className="hubble-drill-label">
              Namespace: <strong>{drilldown}</strong>
            </span>
          )}
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <MapViewOptions
            hideSystemNodes={hideSystemNodes}
            simplifiedView={simplifiedView}
            verdictFilter={verdictFilter}
            noiseFilters={noiseFilters}
            crossNsMode={crossNsMode}
            drilldownActive={!!drilldown}
            onHideSystemChange={setHideSystemNodes}
            onSimplifiedViewChange={setSimplifiedView}
            onVerdictFilterChange={setVerdictFilter}
            onNoiseFiltersChange={setNoiseFilters}
            onCrossNsModeChange={setCrossNsMode}
          />
          <button
            type="button"
            className="hubble-flow-table-toggle"
            onClick={() => setTopProps(flowTableHidden ? [0.65, 0.35] : [1, 0])}
            title={
              flowTableHidden
                ? '하단 flow table 펼치기'
                : '하단 flow table 접기'
            }
          >
            {flowTableHidden ? '▲ Flow table' : '▼ Flow table'}
          </button>
          {clusters.length > 1 && (
            <select
              className="form-control input-sm"
              value={cluster}
              onChange={e => setCluster(e.target.value)}
            >
              {clusters.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name}
                  {c.relayConnected ? '' : ' (disconnected)'}
                </option>
              ))}
            </select>
          )}
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true} scrollable={false}>
        <div className="hubble-page-content">
          {displayError && <div className="hubble-error">{displayError}</div>}
          {clusters.length === 0 && !clusterListError && (
            <div className="hubble-empty">
              Hubble is not configured. Set CLOUDHUB_HUBBLE_CLUSTERS_FILE.
            </div>
          )}
          {clusters.length > 0 && (
            <div className="hubble-threesizer-host">
              <Threesizer
                orientation={HANDLE_HORIZONTAL}
                divisions={[
                  {
                    name: '',
                    handleDisplay: 'none',
                    menuOptions: [],
                    render: renderTopDivision,
                    size: topProps[0],
                  },
                  {
                    name: '',
                    handlePixels: 8,
                    menuOptions: [],
                    render: renderFlowTableDivision,
                    size: topProps[1],
                  },
                ]}
                onResize={setTopProps}
              />
            </div>
          )}
          <FlowDetailsModal
            flow={flowModal}
            cluster={cluster}
            onClose={() => setFlowModal(null)}
          />
          {tutorial && (
            <SidePanelTutorial
              initialTab={tutorial.initial}
              tabs={tutorial.tabs}
              onClose={() => setTutorial(null)}
            />
          )}
        </div>
      </Page.Contents>
    </Page>
  )
}

const SideTab: React.FC<{
  id: SidePanelTab
  label: string
  active: boolean
  onClick: (tab: SidePanelTab) => void
}> = ({id, label, active, onClick}) => (
  <button
    type="button"
    className={`hubble-side-tab ${active ? 'is-active' : ''}`}
    role="tab"
    aria-selected={active}
    onClick={() => onClick(id)}
  >
    {label}
  </button>
)

export default HubblePage
