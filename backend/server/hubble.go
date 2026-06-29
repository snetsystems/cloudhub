package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bouk/httprouter"
	"github.com/gorilla/websocket"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/hubble"
	"github.com/snetsystems/cloudhub/backend/kubernetes"
)

// hubbleUpgrader upgrades Hubble snapshot HTTP requests to WebSocket. Origins
// are not restricted because EnsureViewer applied in mux.go has already
// authenticated the caller.
var hubbleUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 64 * 1024,
	CheckOrigin:     func(*http.Request) bool { return true },
}

// hubbleClustersResponse lists configured clusters and current connection state.
type hubbleClustersResponse struct {
	Clusters []hubbleClusterInfo `json:"clusters"`
}

type hubbleClusterInfo struct {
	Name           string `json:"name"`
	RelayConnected bool   `json:"relayConnected"`
}

type hubbleFlowFilter struct {
	Namespace    string
	SrcWorkload  string
	DstWorkload  string
	Verdicts     map[string]struct{}
	DropReason   string
	Protocol     string
	Port         uint32
	L7Type       string
	L7Query      string
	ExternalOnly bool
	Query        string
}

// HubbleClustersHandler returns the configured clusters and per-cluster
// relay connection state. Used by the cluster selector and as a quick
// liveness probe.
func (s *Service) HubbleClustersHandler(w http.ResponseWriter, r *http.Request) {
	mgr := s.HubbleManager
	if mgr == nil {
		encodeJSON(w, http.StatusOK, hubbleClustersResponse{Clusters: []hubbleClusterInfo{}}, s.Logger)
		return
	}
	resp := hubbleClustersResponse{Clusters: []hubbleClusterInfo{}}
	for _, name := range mgr.ClusterNames() {
		rt := mgr.Runtime(name)
		info := hubbleClusterInfo{Name: name}
		if rt != nil {
			if snap := rt.OverviewSnapshot(); snap != nil {
				info.RelayConnected = snap.Status.RelayConnected
			}
		}
		resp.Clusters = append(resp.Clusters, info)
	}
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

// HubbleClusterStatusHandler returns the latest status block (connected/edges/error)
// for one cluster. Polling fallback for the status badge.
func (s *Service) HubbleClusterStatusHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	snap := rt.OverviewSnapshot()
	if snap == nil {
		encodeJSON(w, http.StatusOK, hubble.SnapshotStatus{}, s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, snap.Status, s.Logger)
}

// HubbleOverviewSnapshotHandler returns the last published overview snapshot.
// Used on page load before the WebSocket starts streaming.
func (s *Service) HubbleOverviewSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	snap := rt.OverviewSnapshot()
	if snap == nil {
		// No data yet — return an empty-but-valid snapshot rather than 404 so
		// the UI can render the "waiting for first window" state.
		snap = &hubble.Snapshot{Kind: "overview"}
	}
	encodeJSON(w, http.StatusOK, snap, s.Logger)
}

// hubbleEdgeFlowsResponse wraps the list so the JSON envelope is consistent
// with the other Hubble endpoints (which all return objects, not arrays).
type hubbleEdgeFlowsResponse struct {
	Flows []hubble.FlowRecord `json:"flows"`
}

// defaultEdgeFlowsLimit caps a single response so clients can't accidentally
// pull the entire per-edge ring buffer in one shot. Operators usually only
// inspect the most recent handful when triaging.
const defaultEdgeFlowsLimit = 20

// HubbleEdgeFlowsHandler returns the most-recent raw flows for one
// namespace-level edge: ?src=ns:foo&dst=ns:bar&limit=20 (newest first).
func (s *Service) HubbleEdgeFlowsHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	src := r.URL.Query().Get("src")
	dst := r.URL.Query().Get("dst")
	if src == "" || dst == "" {
		Error(w, http.StatusBadRequest, "src and dst are required", s.Logger)
		return
	}
	limit := defaultEdgeFlowsLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	flows := rt.FlowBuffer().Get(src, dst, limit)
	if flows == nil {
		flows = []hubble.FlowRecord{}
	}
	encodeJSON(w, http.StatusOK, hubbleEdgeFlowsResponse{Flows: flows}, s.Logger)
}

// defaultAllFlowsLimit caps the cluster-wide flow list. 200 keeps the JSON
// payload manageable on each WS push while still giving the operator plenty
// of recent history.
const defaultAllFlowsLimit = 200

// HubbleAllFlowsHandler returns the most-recent raw flows across all edges in
// the cluster. Query parameters can narrow the raw flow set before it is sent
// to the browser; ?limit=N overrides the default cap.
func (s *Service) HubbleAllFlowsHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	limit := parseHubbleFlowLimit(r, defaultAllFlowsLimit)
	filter := parseHubbleFlowFilter(r)
	flows := hubbleAllFlows(rt, limit, filter)
	encodeJSON(w, http.StatusOK, hubbleEdgeFlowsResponse{Flows: flows}, s.Logger)
}

// HubbleAllFlowsWSHandler streams the all-flows table periodically with the
// same query filters as HubbleAllFlowsHandler.
func (s *Service) HubbleAllFlowsWSHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	limit := parseHubbleFlowLimit(r, defaultAllFlowsLimit)
	filter := parseHubbleFlowFilter(r)
	s.streamHubbleEdgeFlows(w, r, func() hubbleEdgeFlowsResponse {
		return hubbleEdgeFlowsResponse{Flows: hubbleAllFlows(rt, limit, filter)}
	})
}

// HubbleEdgeFlowsWSHandler streams the same per-edge raw flow list as
// HubbleEdgeFlowsHandler over WebSocket. Each tick pushes a fresh snapshot
// of the ring buffer so the client sees new flows as they arrive without
// needing to poll.
func (s *Service) HubbleEdgeFlowsWSHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	src := r.URL.Query().Get("src")
	dst := r.URL.Query().Get("dst")
	if src == "" || dst == "" {
		Error(w, http.StatusBadRequest, "src and dst are required", s.Logger)
		return
	}
	limit := defaultEdgeFlowsLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	s.streamHubbleEdgeFlows(w, r, func() hubbleEdgeFlowsResponse {
		flows := rt.FlowBuffer().Get(src, dst, limit)
		if flows == nil {
			flows = []hubble.FlowRecord{}
		}
		return hubbleEdgeFlowsResponse{Flows: flows}
	})
}

// HubbleDrilldownSnapshotHandler returns an on-demand workload snapshot filtered
// to one namespace. The WS variant pushes the same payload periodically.
func (s *Service) HubbleDrilldownSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	ns := httprouter.GetParamFromContext(r.Context(), "namespace")
	if ns == "" {
		Error(w, http.StatusBadRequest, "namespace is required", s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, rt.WorkloadSnapshot(ns), s.Logger)
}

// HubbleOverviewWSHandler upgrades to WebSocket and pushes overview snapshots
// at the configured snapshot interval. The connection terminates when the
// client closes the socket or the read deadline expires.
func (s *Service) HubbleOverviewWSHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	s.streamHubbleSnapshots(w, r, func() *hubble.Snapshot { return rt.OverviewSnapshot() })
}

// HubbleDrilldownWSHandler upgrades to WebSocket and pushes namespace-filtered
// workload snapshots at the snapshot interval.
func (s *Service) HubbleDrilldownWSHandler(w http.ResponseWriter, r *http.Request) {
	rt, ok := s.lookupHubbleRuntime(w, r)
	if !ok {
		return
	}
	ns := httprouter.GetParamFromContext(r.Context(), "namespace")
	if ns == "" {
		Error(w, http.StatusBadRequest, "namespace is required", s.Logger)
		return
	}
	s.streamHubbleSnapshots(w, r, func() *hubble.Snapshot { return rt.WorkloadSnapshot(ns) })
}

// hubblePolicyResponse wraps the raw K8s policy spec returned to the
// browser. The spec is whatever the Kubernetes API returned (JSON object)
// so the frontend can either pretty-print it or convert it to YAML.
type hubblePolicyResponse struct {
	Kind      string          `json:"kind"`
	Namespace string          `json:"namespace,omitempty"`
	Name      string          `json:"name"`
	APIPath   string          `json:"apiPath"`
	Spec      json.RawMessage `json:"spec"`
}

// HubblePolicyHandler resolves a CiliumNetworkPolicy / NetworkPolicy /
// CiliumClusterwideNetworkPolicy by kind + namespace + name against the
// cluster's K8s API and returns the raw spec.
//
//   GET /cloudhub/v1/hubble/clusters/:name/policy?kind=...&namespace=...&name=...
//
// Reuses CloudHub's global Kubernetes client (configured via --kubernetes=…
// flags). Returns 501 when no K8s client is configured so the frontend can
// fall back to showing the policy ref + a kubectl snippet.
func (s *Service) HubblePolicyHandler(w http.ResponseWriter, r *http.Request) {
	if s.HubbleManager == nil {
		Error(w, http.StatusServiceUnavailable, "hubble is not configured", s.Logger)
		return
	}
	cluster := httprouter.GetParamFromContext(r.Context(), "name")
	if cluster == "" {
		Error(w, http.StatusBadRequest, "cluster name is required", s.Logger)
		return
	}
	if s.HubbleManager.Runtime(cluster) == nil {
		notFound(w, cluster, s.Logger)
		return
	}

	q := r.URL.Query()
	kind := strings.TrimSpace(q.Get("kind"))
	namespace := strings.TrimSpace(q.Get("namespace"))
	name := strings.TrimSpace(q.Get("name"))
	if kind == "" || name == "" {
		Error(w, http.StatusBadRequest, "kind and name are required", s.Logger)
		return
	}

	apiPath, err := policyAPIPath(kind, namespace, name)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	if s.KubernetesClient == nil {
		Error(w, http.StatusNotImplemented,
			"Kubernetes API is not configured (start CloudHub with --kubernetes=url:… and --kubernetes=token:… to enable policy lookup)",
			s.Logger)
		return
	}

	spec, err := fetchPolicySpec(r.Context(), s.KubernetesClient, apiPath, s.Logger)
	if err != nil {
		Error(w, http.StatusBadGateway, "failed to fetch policy from Kubernetes: "+err.Error(), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, hubblePolicyResponse{
		Kind:      kind,
		Namespace: namespace,
		Name:      name,
		APIPath:   apiPath,
		Spec:      spec,
	}, s.Logger)
}

// policyAPIPath maps a policy kind + namespace + name to the K8s API URL
// path. Returns an error for unsupported kinds.
func policyAPIPath(kind, namespace, name string) (string, error) {
	switch kind {
	case "CiliumNetworkPolicy":
		if namespace == "" {
			return "", &policyKindError{Reason: "namespace is required for CiliumNetworkPolicy"}
		}
		return "/apis/cilium.io/v2/namespaces/" + namespace + "/ciliumnetworkpolicies/" + name, nil
	case "CiliumClusterwideNetworkPolicy":
		return "/apis/cilium.io/v2/ciliumclusterwidenetworkpolicies/" + name, nil
	case "NetworkPolicy":
		if namespace == "" {
			return "", &policyKindError{Reason: "namespace is required for NetworkPolicy"}
		}
		return "/apis/networking.k8s.io/v1/namespaces/" + namespace + "/networkpolicies/" + name, nil
	default:
		return "", &policyKindError{Reason: "unsupported policy kind: " + kind}
	}
}

type policyKindError struct{ Reason string }

func (e *policyKindError) Error() string { return e.Reason }

// fetchPolicySpec asks CloudHub's global Kubernetes client for one REST
// resource and returns the raw JSON body. The client is read-only here —
// only HTTP GET is ever issued.
func fetchPolicySpec(ctx context.Context, client *kubernetes.Client, apiPath string, logger cloudhub.Logger) (json.RawMessage, error) {
	resp, err := client.Do(ctx, http.MethodGet, apiPath, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil, errors.New("policy not found on the Kubernetes API")
	}
	if resp.StatusCode >= 400 {
		if logger != nil {
			logger.WithField("status", resp.StatusCode).
				WithField("path", apiPath).
				Error("hubble policy lookup: K8s returned error")
		}
		return nil, fmt.Errorf("kubernetes API returned status %d", resp.StatusCode)
	}
	return body, nil
}

// lookupHubbleRuntime resolves :name from the URL to a ClusterRuntime and
// writes 404/503 on miss. ok==false means the response has already been sent.
func (s *Service) lookupHubbleRuntime(w http.ResponseWriter, r *http.Request) (*hubble.ClusterRuntime, bool) {
	if s.HubbleManager == nil {
		Error(w, http.StatusServiceUnavailable, "hubble is not configured", s.Logger)
		return nil, false
	}
	name := httprouter.GetParamFromContext(r.Context(), "name")
	if name == "" {
		Error(w, http.StatusBadRequest, "cluster name is required", s.Logger)
		return nil, false
	}
	rt := s.HubbleManager.Runtime(name)
	if rt == nil {
		notFound(w, name, s.Logger)
		return nil, false
	}
	return rt, true
}

func parseHubbleFlowLimit(r *http.Request, def int) int {
	limit := def
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	return limit
}

func parseHubbleFlowFilter(r *http.Request) hubbleFlowFilter {
	q := r.URL.Query()
	filter := hubbleFlowFilter{
		Namespace:    strings.TrimSpace(q.Get("namespace")),
		SrcWorkload:  strings.TrimSpace(q.Get("srcWorkload")),
		DstWorkload:  strings.TrimSpace(q.Get("dstWorkload")),
		DropReason:   strings.TrimSpace(q.Get("dropReason")),
		Protocol:     strings.TrimSpace(q.Get("protocol")),
		L7Type:       strings.TrimSpace(q.Get("l7Type")),
		L7Query:      strings.TrimSpace(q.Get("l7Query")),
		Query:        strings.TrimSpace(q.Get("q")),
		ExternalOnly: parseBoolQuery(q.Get("externalOnly")),
	}
	if raw := q.Get("port"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			filter.Port = uint32(n)
		}
	}
	filter.Verdicts = parseCSVSet(q.Get("verdict"))
	return filter
}

func hubbleAllFlows(rt *hubble.ClusterRuntime, limit int, filter hubbleFlowFilter) []hubble.FlowRecord {
	if filter.empty() {
		flows := rt.FlowBuffer().GetAll(limit)
		if flows == nil {
			return []hubble.FlowRecord{}
		}
		return flows
	}
	flows := filterHubbleFlows(rt.FlowBuffer().GetAll(0), filter)
	flows = limitHubbleFlows(flows, limit)
	if flows == nil {
		return []hubble.FlowRecord{}
	}
	return flows
}

func filterHubbleFlowsByNamespace(flows []hubble.FlowRecord, namespace string) []hubble.FlowRecord {
	return filterHubbleFlows(flows, hubbleFlowFilter{Namespace: namespace})
}

func filterHubbleFlows(flows []hubble.FlowRecord, filter hubbleFlowFilter) []hubble.FlowRecord {
	if filter.empty() {
		return flows
	}
	out := make([]hubble.FlowRecord, 0, len(flows))
	for _, f := range flows {
		if filter.matches(f) {
			out = append(out, f)
		}
	}
	return out
}

func limitHubbleFlows(flows []hubble.FlowRecord, limit int) []hubble.FlowRecord {
	if limit > 0 && len(flows) > limit {
		return flows[:limit]
	}
	return flows
}

func (f hubbleFlowFilter) empty() bool {
	return f.Namespace == "" &&
		f.SrcWorkload == "" &&
		f.DstWorkload == "" &&
		len(f.Verdicts) == 0 &&
		f.DropReason == "" &&
		f.Protocol == "" &&
		f.Port == 0 &&
		f.L7Type == "" &&
		f.L7Query == "" &&
		!f.ExternalOnly &&
		f.Query == ""
}

func (f hubbleFlowFilter) matches(flow hubble.FlowRecord) bool {
	if f.Namespace != "" && flow.SrcNamespace != f.Namespace && flow.DstNamespace != f.Namespace {
		return false
	}
	if f.SrcWorkload != "" && !containsFold(flow.SrcWorkload, f.SrcWorkload) && !containsFold(flow.SrcPod, f.SrcWorkload) {
		return false
	}
	if f.DstWorkload != "" && !containsFold(flow.DstWorkload, f.DstWorkload) && !containsFold(flow.DstPod, f.DstWorkload) {
		return false
	}
	if len(f.Verdicts) > 0 {
		if _, ok := f.Verdicts[strings.ToUpper(flow.Verdict)]; !ok {
			return false
		}
	}
	if f.DropReason != "" && !containsFold(flow.DropReason, f.DropReason) {
		return false
	}
	if f.Protocol != "" && !strings.EqualFold(flow.Protocol, f.Protocol) {
		return false
	}
	if f.Port != 0 && flow.SrcPort != f.Port && flow.DstPort != f.Port {
		return false
	}
	if f.L7Type != "" && !strings.HasPrefix(strings.ToUpper(flow.L7), strings.ToUpper(f.L7Type)) {
		return false
	}
	if f.L7Query != "" && !containsFold(flow.L7, f.L7Query) {
		return false
	}
	if f.ExternalOnly && !flowTouchesExternal(flow) {
		return false
	}
	if f.Query != "" && !flowContainsQuery(flow, f.Query) {
		return false
	}
	return true
}

func flowTouchesExternal(f hubble.FlowRecord) bool {
	return strings.HasPrefix(f.SrcID, "ext:") ||
		strings.HasPrefix(f.DstID, "ext:") ||
		f.SrcNamespace == "" ||
		f.DstNamespace == ""
}

func flowContainsQuery(f hubble.FlowRecord, q string) bool {
	fields := []string{
		f.Verdict, f.TrafficDirection, f.ObservationPoint,
		f.SrcID, f.DstID, f.SrcNamespace, f.DstNamespace,
		f.SrcWorkload, f.DstWorkload, f.SrcPod, f.DstPod,
		f.SrcIP, f.DstIP, f.Protocol, f.L7, f.DropReason,
		strconv.FormatUint(uint64(f.SrcIdentity), 10),
		strconv.FormatUint(uint64(f.DstIdentity), 10),
		strconv.FormatUint(uint64(f.SrcPort), 10),
		strconv.FormatUint(uint64(f.DstPort), 10),
		strings.Join(f.TCPFlags, " "),
		strings.Join(f.SrcLabels, " "),
		strings.Join(f.DstLabels, " "),
	}
	for _, field := range fields {
		if containsFold(field, q) {
			return true
		}
	}
	return false
}

func containsFold(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

func parseCSVSet(raw string) map[string]struct{} {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	out := map[string]struct{}{}
	for _, part := range strings.Split(raw, ",") {
		part = strings.ToUpper(strings.TrimSpace(part))
		if part != "" {
			out[part] = struct{}{}
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func parseBoolQuery(raw string) bool {
	v, err := strconv.ParseBool(strings.TrimSpace(raw))
	return err == nil && v
}

const (
	defaultHubbleWSPushInterval = 2 * time.Second
	hubbleWSPongWait            = 60 * time.Second
	hubbleWSPingInterval        = 30 * time.Second
	hubbleWSWriteDeadline       = 10 * time.Second
)

func (s *Service) hubbleWSPushInterval() time.Duration {
	if s.HubbleSnapshotInterval <= 0 {
		return defaultHubbleWSPushInterval
	}
	return s.HubbleSnapshotInterval
}

// streamHubbleSnapshots pushes the latest snapshot returned by snap() every
// configured Hubble push interval. A ping/pong heartbeat detects dead clients.
func (s *Service) streamHubbleSnapshots(
	w http.ResponseWriter,
	r *http.Request,
	snap func() *hubble.Snapshot,
) {
	conn, err := hubbleUpgrader.Upgrade(w, r, nil)
	if err != nil {
		s.Logger.WithField("component", "hubble.ws").Error("upgrade: ", err)
		return
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(hubbleWSPongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(hubbleWSPongWait))
		return nil
	})

	// Drain incoming frames so pongs/close arrive promptly.
	go func() {
		for {
			if _, _, err := conn.NextReader(); err != nil {
				return
			}
		}
	}()

	push := time.NewTicker(s.hubbleWSPushInterval())
	defer push.Stop()
	ping := time.NewTicker(hubbleWSPingInterval)
	defer ping.Stop()

	writeSnapshot := func() error {
		cur := snap()
		if cur == nil {
			return nil
		}
		payload, err := json.Marshal(cur)
		if err != nil {
			return err
		}
		conn.SetWriteDeadline(time.Now().Add(hubbleWSWriteDeadline))
		return conn.WriteMessage(websocket.TextMessage, payload)
	}

	// Send one snapshot immediately so the client doesn't wait a full tick.
	if err := writeSnapshot(); err != nil {
		return
	}

	for {
		select {
		case <-r.Context().Done():
			return
		case <-push.C:
			if err := writeSnapshot(); err != nil {
				return
			}
		case <-ping.C:
			conn.SetWriteDeadline(time.Now().Add(hubbleWSWriteDeadline))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// streamHubbleEdgeFlows pushes the latest per-edge raw flow list returned by
// fetch() every configured Hubble push interval. Same lifecycle as streamHubbleSnapshots
// (ping/pong heartbeat, immediate-first-push); only the payload shape differs.
func (s *Service) streamHubbleEdgeFlows(
	w http.ResponseWriter,
	r *http.Request,
	fetch func() hubbleEdgeFlowsResponse,
) {
	conn, err := hubbleUpgrader.Upgrade(w, r, nil)
	if err != nil {
		s.Logger.WithField("component", "hubble.ws").Error("upgrade: ", err)
		return
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(hubbleWSPongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(hubbleWSPongWait))
		return nil
	})

	go func() {
		for {
			if _, _, err := conn.NextReader(); err != nil {
				return
			}
		}
	}()

	push := time.NewTicker(s.hubbleWSPushInterval())
	defer push.Stop()
	ping := time.NewTicker(hubbleWSPingInterval)
	defer ping.Stop()

	writePayload := func() error {
		payload, err := json.Marshal(fetch())
		if err != nil {
			return err
		}
		conn.SetWriteDeadline(time.Now().Add(hubbleWSWriteDeadline))
		return conn.WriteMessage(websocket.TextMessage, payload)
	}

	if err := writePayload(); err != nil {
		return
	}

	for {
		select {
		case <-r.Context().Done():
			return
		case <-push.C:
			if err := writePayload(); err != nil {
				return
			}
		case <-ping.C:
			conn.SetWriteDeadline(time.Now().Add(hubbleWSWriteDeadline))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
