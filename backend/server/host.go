package server

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type hostRequest struct {
	MinionID         string                 `json:"minionId"`
	Hostname         string                 `json:"hostname"`
	OriginalHostname string                 `json:"originalHostname"`
	IPInterfaces     []cloudhub.IPInterface `json:"ipInterfaces"`
	OS           string                 `json:"os"`
	OSFamily     string                 `json:"osFamily"`
	OSVersion    string                 `json:"osVersion"`
	Kernel       string                 `json:"kernel"`
	Arch         string                 `json:"arch"`
	MemTotalKB   int64                  `json:"memTotalKb"`
	SwapTotalKB  int64                  `json:"swapTotalKb"`
	CPUCores     int                    `json:"cpuCores"`
	CPUModel     string                 `json:"cpuModel"`
	BIOSVersion  string                 `json:"biosVersion"`
	Timezone     string                 `json:"timezone"`
	SelinuxState string                 `json:"selinuxState"`
	IsCollector  bool                   `json:"isCollector"`
	GPUs         []cloudhub.GPU         `json:"gpus"`
	SourceType   string                 `json:"sourceType"`
	Status       string                 `json:"status"`
}

type gpuResponse struct {
	Vendor string `json:"vendor"`
	Model  string `json:"model"`
}

type ifaceResponse struct {
	InterfaceName string `json:"interfaceName"`
	IPAddress     string `json:"ipAddress"`
}

type hostResponse struct {
	ID               string          `json:"id"`
	MinionID         string          `json:"minionId"`
	Hostname         string          `json:"hostname"`
	OriginalHostname string          `json:"originalHostname"`
	IP               string          `json:"ip"`
	PrivateIPs   []string        `json:"privateIps"`
	IPInterfaces []ifaceResponse `json:"ipInterfaces"`
	OS           string          `json:"os"`
	OSFamily     string          `json:"osFamily"`
	OSVersion    string          `json:"osVersion"`
	Kernel       string          `json:"kernel"`
	Arch         string          `json:"arch"`
	MemTotalKB   int64           `json:"memTotalKb"`
	SwapTotalKB  int64           `json:"swapTotalKb"`
	CPUCores     int             `json:"cpuCores"`
	CPUModel     string          `json:"cpuModel"`
	BIOSVersion  string          `json:"biosVersion"`
	Timezone     string          `json:"timezone"`
	SelinuxState string          `json:"selinuxState"`
	IsCollector  bool            `json:"isCollector"`
	GPUs         []gpuResponse   `json:"gpus"`
	SourceType   string          `json:"sourceType"`
	OrgID        string          `json:"orgId"`
	Status       string          `json:"status"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
	Links        selfLinks       `json:"links"`
}

var privateRanges = func() []*net.IPNet {
	cidrs := []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}
	nets := make([]*net.IPNet, len(cidrs))
	for i, c := range cidrs {
		_, nets[i], _ = net.ParseCIDR(c)
	}
	return nets
}()

func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	for _, r := range privateRanges {
		if r.Contains(ip) {
			return true
		}
	}
	return false
}

func toHostResponse(h cloudhub.Host) hostResponse {
	privateIPs := make([]string, 0, len(h.IPInterfaces))
	ifaces := make([]ifaceResponse, 0, len(h.IPInterfaces))
	for _, iface := range h.IPInterfaces {
		ifaces = append(ifaces, ifaceResponse{InterfaceName: iface.InterfaceName, IPAddress: iface.IPAddress})
		if isPrivateIP(iface.IPAddress) {
			privateIPs = append(privateIPs, iface.IPAddress)
		}
	}

	gpus := make([]gpuResponse, 0, len(h.GPUs))
	for _, g := range h.GPUs {
		gpus = append(gpus, gpuResponse{Vendor: g.Vendor, Model: g.Model})
	}

	return hostResponse{
		ID:               h.ID,
		MinionID:         h.MinionID,
		Hostname:         h.Hostname,
		OriginalHostname: h.OriginalHostname,
		IP:               h.IP,
		PrivateIPs:   privateIPs,
		IPInterfaces: ifaces,
		OS:           h.OS,
		OSFamily:     h.OSFamily,
		OSVersion:    h.OSVersion,
		Kernel:       h.Kernel,
		Arch:         h.Arch,
		MemTotalKB:   h.MemTotalKB,
		SwapTotalKB:  h.SwapTotalKB,
		CPUCores:     h.CPUCores,
		CPUModel:     h.CPUModel,
		BIOSVersion:  h.BIOSVersion,
		Timezone:     h.Timezone,
		SelinuxState: h.SelinuxState,
		IsCollector:  h.IsCollector,
		GPUs:         gpus,
		SourceType:   h.SourceType,
		OrgID:        h.OrgID,
		Status:       h.Status,
		CreatedAt:   h.CreatedAt,
		UpdatedAt:    h.UpdatedAt,
		Links:        selfLinks{Self: fmt.Sprintf("/cloudhub/v2/hosts/%s", h.Hostname)},
	}
}

// GetHosts returns all registered hosts.
func (s *Service) GetHosts(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())

	all, err := s.Store.Hosts(ctx).All(ctx)
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}

	resp := make([]hostResponse, 0, len(all))
	for _, h := range all {
		resp = append(resp, toHostResponse(h))
	}
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

// GetHost returns a single registered host by hostname.
func (s *Service) GetHost(w http.ResponseWriter, r *http.Request) {
	hostname := httprouter.GetParamFromContext(r.Context(), "hostname")
	ctx := serverContext(r.Context())
	if hostname == "" {
		invalidData(w, fmt.Errorf("hostname is required"), s.Logger)
		return
	}

	host, err := s.Store.Hosts(ctx).Get(ctx, cloudhub.HostQuery{Hostname: &hostname})
	if err != nil {
		if err == cloudhub.ErrHostNotFound {
			notFound(w, hostname, s.Logger)
			return
		}
		internalServerError(w, err, s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, toHostResponse(*host), s.Logger)
}

func normalizedHostFromRequest(req hostRequest, forCreate bool, existing *cloudhub.Host) *cloudhub.Host {
	sourceType := req.SourceType
	if sourceType == "" {
		sourceType = "salt"
	}
	status := req.Status
	if status != "accepted" && status != "rejected" {
		status = "accepted"
	}
	h := &cloudhub.Host{
		MinionID:         req.MinionID,
		Hostname:         req.Hostname,
		OriginalHostname: req.OriginalHostname,
		IPInterfaces:     req.IPInterfaces,
		OS:               req.OS,
		OSFamily:         req.OSFamily,
		OSVersion:        req.OSVersion,
		Kernel:           req.Kernel,
		Arch:             req.Arch,
		MemTotalKB:       req.MemTotalKB,
		SwapTotalKB:      req.SwapTotalKB,
		CPUCores:         req.CPUCores,
		CPUModel:         req.CPUModel,
		BIOSVersion:      req.BIOSVersion,
		Timezone:         req.Timezone,
		SelinuxState:     req.SelinuxState,
		GPUs:             req.GPUs,
		SourceType:       sourceType,
		Status:           status,
	}
	if forCreate {
		h.IsCollector = req.IsCollector
		h.OrgID = ""
		h.CreatedAt = time.Now()
	} else {
		h.IsCollector = existing.IsCollector
		h.OrgID = existing.OrgID
	}
	return h
}

// RegisterHost creates a new host record from a minion accept event.
func (s *Service) RegisterHost(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())

	var req hostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	if req.Hostname == "" {
		invalidData(w, fmt.Errorf("hostname is required"), s.Logger)
		return
	}

	host := normalizedHostFromRequest(req, true, nil)

	created, err := s.Store.Hosts(ctx).Add(ctx, host)
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}

	encodeJSON(w, http.StatusCreated, toHostResponse(*created), s.Logger)
}

// UpdateHost updates mutable fields of an existing host by hostname.
func (s *Service) UpdateHost(w http.ResponseWriter, r *http.Request) {
	hostname := httprouter.GetParamFromContext(r.Context(), "hostname")
	ctx := serverContext(r.Context())
	if hostname == "" {
		invalidData(w, fmt.Errorf("hostname is required"), s.Logger)
		return
	}

	var req hostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	existing, gerr := s.Store.Hosts(ctx).Get(ctx, cloudhub.HostQuery{Hostname: &hostname})
	if gerr != nil {
		if gerr == cloudhub.ErrHostNotFound {
			notFound(w, hostname, s.Logger)
			return
		}
		internalServerError(w, gerr, s.Logger)
		return
	}

	host := normalizedHostFromRequest(req, false, existing)
	host.Hostname = hostname

	updated, err := s.Store.Hosts(ctx).Update(ctx, host)
	if err != nil {
		if err == cloudhub.ErrHostNotFound {
			notFound(w, hostname, s.Logger)
			return
		}
		internalServerError(w, err, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, toHostResponse(*updated), s.Logger)
}

// PatchHost applies a partial update to an existing host by hostname.
func (s *Service) PatchHost(w http.ResponseWriter, r *http.Request) {
	hostname := httprouter.GetParamFromContext(r.Context(), "hostname")
	ctx := serverContext(r.Context())
	if hostname == "" {
		invalidData(w, fmt.Errorf("hostname is required"), s.Logger)
		return
	}

	var patch cloudhub.HostPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	if patch.Status != nil && *patch.Status != "accepted" && *patch.Status != "rejected" {
		invalidData(w, fmt.Errorf("status must be accepted or rejected"), s.Logger)
		return
	}

	updated, err := s.Store.Hosts(ctx).Patch(ctx, hostname, patch)
	if err != nil {
		if err == cloudhub.ErrHostNotFound {
			notFound(w, hostname, s.Logger)
			return
		}
		internalServerError(w, err, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, toHostResponse(*updated), s.Logger)
}

// DeleteHost removes a host by hostname.
func (s *Service) DeleteHost(w http.ResponseWriter, r *http.Request) {
	hostname := httprouter.GetParamFromContext(r.Context(), "hostname")
	ctx := serverContext(r.Context())
	if hostname == "" {
		invalidData(w, fmt.Errorf("hostname is required"), s.Logger)
		return
	}

	if err := s.Store.Hosts(ctx).Delete(ctx, hostname); err != nil {
		if err == cloudhub.ErrHostNotFound {
			notFound(w, hostname, s.Logger)
			return
		}
		internalServerError(w, err, s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type bulkUpsertHostsRequest struct {
	Hosts []hostRequest `json:"hosts"`
}

type bulkUpsertHostsFailedItem struct {
	Hostname string `json:"hostname"`
	Error    string `json:"error"`
}

type bulkUpsertHostsResponse struct {
	Created []string                  `json:"created"`
	Updated []string                  `json:"updated"`
	Failed  []bulkUpsertHostsFailedItem `json:"failed"`
}

// BulkUpsertHosts creates or updates multiple hosts in one request (e.g. Salt-driven inventory refresh).
// On update, IsCollector and OrgID are taken from the existing row so clients can omit them.
func (s *Service) BulkUpsertHosts(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())

	var body bulkUpsertHostsRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if len(body.Hosts) == 0 {
		Error(w, http.StatusBadRequest, "hosts is required", s.Logger)
		return
	}

	var created, updated []string
	var failed []bulkUpsertHostsFailedItem

	for _, req := range body.Hosts {
		if req.Hostname == "" {
			failed = append(failed, bulkUpsertHostsFailedItem{Hostname: "", Error: "hostname is required"})
			continue
		}
		hn := req.Hostname
		existing, gerr := s.Store.Hosts(ctx).Get(ctx, cloudhub.HostQuery{Hostname: &hn})
		if gerr == cloudhub.ErrHostNotFound {
			host := normalizedHostFromRequest(req, true, nil)
			_, aerr := s.Store.Hosts(ctx).Add(ctx, host)
			if aerr != nil {
				failed = append(failed, bulkUpsertHostsFailedItem{Hostname: hn, Error: aerr.Error()})
				continue
			}
			created = append(created, hn)
			continue
		}
		if gerr != nil {
			failed = append(failed, bulkUpsertHostsFailedItem{Hostname: hn, Error: gerr.Error()})
			continue
		}
		host := normalizedHostFromRequest(req, false, existing)
		host.Hostname = hn
		_, uerr := s.Store.Hosts(ctx).Update(ctx, host)
		if uerr != nil {
			failed = append(failed, bulkUpsertHostsFailedItem{Hostname: hn, Error: uerr.Error()})
			continue
		}
		updated = append(updated, hn)
	}

	resp := bulkUpsertHostsResponse{
		Created: created,
		Updated: updated,
		Failed:  failed,
	}
	if resp.Created == nil {
		resp.Created = []string{}
	}
	if resp.Updated == nil {
		resp.Updated = []string{}
	}
	if resp.Failed == nil {
		resp.Failed = []bulkUpsertHostsFailedItem{}
	}

	status := http.StatusOK
	if len(failed) > 0 {
		if len(created)+len(updated) == 0 {
			status = http.StatusBadRequest
		} else {
			status = http.StatusMultiStatus
		}
	}

	encodeJSON(w, status, resp, s.Logger)
}
