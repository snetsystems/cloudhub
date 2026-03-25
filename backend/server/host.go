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
	Disks        []cloudhub.Disk        `json:"disks"`
	GPUs         []cloudhub.GPU         `json:"gpus"`
	SourceType   string                 `json:"sourceType"`
	Status       string                 `json:"status"`
}

type diskResponse struct {
	Device     string `json:"device"`
	MountPoint string `json:"mountPoint"`
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
	Disks        []diskResponse  `json:"disks"`
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

	disks := make([]diskResponse, 0, len(h.Disks))
	for _, d := range h.Disks {
		disks = append(disks, diskResponse{Device: d.Device, MountPoint: d.MountPoint})
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
		Disks:        disks,
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

	sourceType := req.SourceType
	if sourceType == "" {
		sourceType = "salt"
	}

	status := req.Status
	if status != "accepted" && status != "rejected" {
		status = "accepted"
	}

	host := &cloudhub.Host{
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
		Disks:            req.Disks,
		GPUs:             req.GPUs,
		SourceType:       sourceType,
		OrgID:            "",
		Status:           status,
		CreatedAt:        time.Now(),
	}

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

	status := req.Status
	if status != "accepted" && status != "rejected" {
		status = "accepted"
	}

	host := &cloudhub.Host{
		MinionID:         req.MinionID,
		Hostname:         hostname,
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
		Disks:            req.Disks,
		GPUs:             req.GPUs,
		SourceType:       req.SourceType,
		Status:           status,
	}

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
