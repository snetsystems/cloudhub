package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// createDeviceMappingRequest represents a request to create a new device mapping
type createDeviceMappingRequest struct {
	IP         string `json:"ip"`
	Hostname   string `json:"hostname"`
	AliasName  string `json:"aliasName,omitempty"`
	DeviceType string `json:"deviceType"`
	OrgID      string `json:"orgId,omitempty"`
	Vendor     string `json:"vendor,omitempty"`
}

// updateDeviceMappingRequest represents a request to update device mapping
type updateDeviceMappingRequest struct {
	IP         *string `json:"ip,omitempty"`
	AliasName  *string `json:"aliasName,omitempty"`
	DeviceType *string `json:"deviceType,omitempty"`
	OrgID      *string `json:"orgId,omitempty"`
	Vendor     *string `json:"vendor,omitempty"`
}

// moveDeviceOrgRequest represents a request to move device to different organization
type moveDeviceOrgRequest struct {
	NewOrgID string `json:"newOrgId"`
}

// deviceMappingResponse represents device mapping API response
type deviceMappingResponse struct {
	IP          string    `json:"ip"`
	Hostname    string    `json:"hostname"`
	AliasName   string    `json:"aliasName"`
	DeviceType  string    `json:"deviceType"`
	OrgID       string    `json:"orgId"`
	Links       selfLinks `json:"links,omitempty"`
	IsDeletable bool      `json:"isDeletable"`
	Vendor      string    `json:"vendor"`
}

// deviceMappingsResponse represents multiple device mappings response
type deviceMappingsResponse struct {
	Devices []deviceMappingResponse `json:"devices"`
}

// orgDevicesResponse represents organization devices response
type orgDevicesResponse struct {
	OrganizationID string   `json:"organizationId"`
	Hostnames      []string `json:"hostnames"`
}

// aliasLookupResponse represents alias lookup response
type aliasLookupResponse struct {
	AliasName string `json:"aliasName"`
	OrgID     string `json:"orgId"`
	Hostname  string `json:"hostname"`
}

// deviceMetaDetailResponse represents device detail for LogTable Detail click
type ensureDeviceRequest struct {
	Hostname   string `json:"hostname"`
	EsSourceID string `json:"esSource,omitempty"`
}
type ensureDeviceResponse struct {
	Meta   *deviceMappingResponse `json:"meta,omitempty"`
	Status string                 `json:"status"` // found | auto_registered | not_found
}

var (
	defaultDays   = 7
	defaultIndex  = "syslog-*"
	defaultOrgID  = "default"
	defaultDevice = "baremetal"
)

func (r *createDeviceMappingRequest) ValidCreate() error {
	if r.Hostname == "" {
		return fmt.Errorf("hostname is required")
	}
	if r.IP == "" {
		return fmt.Errorf("ip is required")
	}
	if r.DeviceType == "" {
		r.DeviceType = defaultDevice // default device type
	}
	if r.OrgID == "" {
		r.OrgID = "default" // default to default organization
	}
	if r.AliasName == "" {
		r.AliasName = "" // default alias is empty
	}
	return nil
}

// TODO: Add validation for alias name
func (r *updateDeviceMappingRequest) ValidUpdate() error {
	if r.IP == nil && r.AliasName == nil && r.DeviceType == nil && r.OrgID == nil && r.Vendor == nil {
		return fmt.Errorf("no fields to update")
	}
	return nil
}

func (r *moveDeviceOrgRequest) ValidMove() error {
	if r.NewOrgID == "" {
		return fmt.Errorf("newOrgId is required")
	}
	return nil
}

func newDeviceMappingResponse(meta *cloudhub.DeviceMeta) *deviceMappingResponse {
	return &deviceMappingResponse{
		IP:         meta.IP,
		Hostname:   meta.Hostname,
		AliasName:  meta.AliasName,
		DeviceType: meta.DeviceType,
		OrgID:      meta.OrgID,
		Links: selfLinks{
			Self: fmt.Sprintf("/cloudhub/v1/device-mappings/%s/devices/%s", meta.OrgID, meta.Hostname),
		},
		IsDeletable: meta.IsDeletable,
		Vendor:      meta.Vendor,
	}
}

func newDeviceMappingsByOrgResponse(devices []*cloudhub.DeviceMeta) map[string][]*deviceMappingResponse {
	resp := make(map[string][]*deviceMappingResponse)
	for _, device := range devices {
		org := device.OrgID
		resp[org] = append(resp[org], newDeviceMappingResponse(device))
	}
	return resp
}

// AllDeviceMappings returns all device mappings for an organization
func (s *Service) AllDeviceMappings(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())

	isSuperAdmin := hasSuperAdminContext(ctx)
	currOrg, orgOK := hasOrganizationContext(ctx)
	if !orgOK {
		Error(w, http.StatusInternalServerError, string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}
	esID, err := queryInt("es-source", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	if esID == -1 {
		devices, err := s.Store.DeviceMappings(ctx).AllDevices(ctx, cloudhub.AccessContext{
			IsSuperAdmin: isSuperAdmin,
			OrgID:        currOrg,
		})
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}

		encodeJSON(w, http.StatusOK, newDeviceMappingsByOrgResponse(devices), s.Logger)
		return
	}

	hosts, err := s.DistinctHostsBefore(ctx, esID, "syslog-*", 7)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	devices, err := s.mergeAndUpsertDevices(ctx, hosts)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, newDeviceMappingsByOrgResponse(devices), s.Logger)
}

// GetDeviceMapping returns a specific device mapping by hostname
func (s *Service) GetDeviceMapping(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())
	hostname := httprouter.GetParamFromContext(ctx, "hostname")

	if hostname == "" {
		Error(w, http.StatusBadRequest, "hostname parameter is required", s.Logger)
		return
	}

	isSuperAdmin := hasSuperAdminContext(ctx)
	currentOrg, ok := hasOrganizationContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError, string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}

	device, err := s.Store.DeviceMappings(ctx).GetDevice(ctx, hostname)
	if err != nil {
		if err.Error() == fmt.Sprintf("hostname %s not found", hostname) {
			Error(w, http.StatusNotFound, "device not found", s.Logger)
		} else {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		}
		return
	}

	if !isSuperAdmin && device.OrgID != currentOrg {
		Error(w, http.StatusForbidden, "access to device denied", s.Logger)
		return
	}

	resp := newDeviceMappingResponse(device)
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

// RegisterDevice handles POST /device-mappings
func (s *Service) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	var req createDeviceMappingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	if err := s.OrganizationExists(ctx, req.OrgID); err != nil {
		Error(w, http.StatusBadRequest,
			fmt.Sprintf("organization %s does not exist", req.OrgID), s.Logger)
		return
	}

	meta := &cloudhub.DeviceMeta{
		IP:         req.IP,
		Hostname:   req.Hostname,
		AliasName:  req.AliasName,
		DeviceType: req.DeviceType,
		OrgID:      req.OrgID,
		Vendor:     req.Vendor,
	}

	if err := s.Store.DeviceMappings(ctx).AddDevice(ctx, meta); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	s.logRegistration(ctx, "DeviceMappings", fmt.Sprintf(MsgDeviceMappingCreated.String(), meta.Hostname))

	encodeJSON(w, http.StatusCreated, newDeviceMappingResponse(meta), s.Logger)
}

// UpdateDeviceMapping updates an existing device mapping
func (s *Service) UpdateDeviceMapping(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	hostname := httprouter.GetParamFromContext(ctx, "hostname")
	if hostname == "" {
		Error(w, http.StatusBadRequest, "hostname parameter is required", s.Logger)
		return
	}

	var req updateDeviceMappingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	if err := req.ValidUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	isSuperAdmin := hasSuperAdminContext(ctx)
	currentOrg, ok := hasOrganizationContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError,
			string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}

	device, err := s.Store.DeviceMappings(ctx).GetDevice(ctx, hostname)
	if err != nil {
		if err.Error() == fmt.Sprintf("hostname %s not found", hostname) {
			Error(w, http.StatusNotFound, "device not found", s.Logger)
		} else {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		}
		return
	}

	if !isSuperAdmin && device.OrgID != currentOrg {
		Error(w, http.StatusForbidden, "access to device denied", s.Logger)
		return
	}

	if req.OrgID != nil && !isSuperAdmin {
		Error(w, http.StatusForbidden, "only superAdmin can change orgId", s.Logger)
		return
	}

	if req.OrgID != nil {
		if err := s.OrganizationExists(ctx, *req.OrgID); err != nil {
			Error(w, http.StatusBadRequest,
				fmt.Sprintf("organization %s does not exist", *req.OrgID), s.Logger)
			return
		}
	}

	final := &cloudhub.DeviceMeta{
		IP:         device.IP,
		Hostname:   device.Hostname,
		AliasName:  device.AliasName,
		DeviceType: device.DeviceType,
		OrgID:      device.OrgID,
	}
	if req.IP != nil {
		final.IP = *req.IP
	}
	if req.AliasName != nil {
		final.AliasName = *req.AliasName
	}
	if req.DeviceType != nil {
		final.DeviceType = *req.DeviceType
	}
	if req.OrgID != nil {
		final.OrgID = *req.OrgID
	}
	if req.Vendor != nil {
		final.Vendor = *req.Vendor
	}
	if err := s.Store.DeviceMappings(ctx).UpdateDevice(ctx, hostname, final); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	s.logRegistration(ctx, "DeviceMappings", fmt.Sprintf(MsgDeviceMappingModified.String(), hostname))

	updated, err := s.Store.DeviceMappings(ctx).GetDevice(ctx, hostname)
	if err != nil {
		// shouldn't normally happen; but fall back to final patch
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		encodeJSON(w, http.StatusOK, newDeviceMappingResponse(final), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, newDeviceMappingResponse(updated), s.Logger)
}

// DeleteDeviceMapping deletes a device mapping
func (s *Service) DeleteDeviceMapping(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	hostname := httprouter.GetParamFromContext(ctx, "hostname")
	if hostname == "" {
		Error(w, http.StatusBadRequest, "hostname parameter is required", s.Logger)
		return
	}

	isSuperAdmin := hasSuperAdminContext(ctx)
	currentOrg, ok := hasOrganizationContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError,
			string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}

	device, err := s.Store.DeviceMappings(ctx).GetDevice(ctx, hostname)
	if err != nil {
		if err.Error() == fmt.Sprintf("hostname %s not found", hostname) {
			Error(w, http.StatusNotFound, "device not found", s.Logger)
		} else {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		}
		return
	}

	if !isSuperAdmin && device.OrgID != currentOrg {
		Error(w, http.StatusForbidden, "access to device denied", s.Logger)
		return
	}

	if err := s.Store.DeviceMappings(ctx).DeleteDevice(ctx, hostname); err != nil {
		if err.Error() == fmt.Sprintf("hostname %s not found", hostname) {
			Error(w, http.StatusNotFound, "device not found", s.Logger)
		} else {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		}
		return
	}

	s.logRegistration(ctx, "DeviceMappings", fmt.Sprintf(MsgDeviceMappingDeleted.String(), hostname))

	w.WriteHeader(http.StatusNoContent)
}

// GetOrgDevices returns all devices belonging to an organization (for LogAnalysis filtering)
func (s *Service) GetOrgDevices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orgID := httprouter.GetParamFromContext(ctx, "orgId")

	if orgID == "" {
		Error(w, http.StatusBadRequest, "orgId parameter is required", s.Logger)
		return
	}

	if err := s.OrganizationExists(ctx, orgID); err != nil {
		Error(w, http.StatusBadRequest, fmt.Sprintf("organization %s does not exist", orgID), s.Logger)
		return
	}

	devices, err := s.Store.DeviceMappings(ctx).AllDevices(ctx, cloudhub.AccessContext{
		IsSuperAdmin: hasSuperAdminContext(ctx),
		OrgID:        orgID,
	})
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var hostnames []string
	for _, device := range devices {
		if device.OrgID == orgID {
			hostnames = append(hostnames, device.Hostname)
		}
	}

	resp := orgDevicesResponse{
		OrganizationID: orgID,
		Hostnames:      hostnames,
	}
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

// GetDeviceByAlias returns device information by alias name
func (s *Service) GetDeviceByAlias(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	aliasName := httprouter.GetParamFromContext(ctx, "aliasName")
	if aliasName == "" {
		Error(w, http.StatusBadRequest, "aliasName parameter is required", s.Logger)
		return
	}

	aliasToDevice, err := s.Store.DeviceMappings(ctx).GetByAlias(ctx, aliasName)
	if err != nil {
		if err.Error() == fmt.Sprintf("alias %s not found", aliasName) {
			Error(w, http.StatusNotFound, "alias not found", s.Logger)
		} else {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		}
		return
	}

	isSuperAdmin := hasSuperAdminContext(ctx)
	currentOrg, ok := hasOrganizationContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError,
			string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}

	if !isSuperAdmin && aliasToDevice.OrgID != currentOrg {
		Error(w, http.StatusForbidden, "access to alias denied", s.Logger)
		return
	}

	resp := aliasLookupResponse{
		AliasName: aliasName,
		OrgID:     aliasToDevice.OrgID,
		Hostname:  aliasToDevice.Hostname,
	}
	encodeJSON(w, http.StatusOK, resp, s.Logger)
}

func defaultDeviceType(es cloudhub.ESInfo) string {
	if es.DeviceType == "" {
		return defaultDevice
	}
	return es.DeviceType
}
func (s *Service) mergeAndUpsertDevices(
	ctx context.Context,
	hosts map[string]cloudhub.ESInfo,
) ([]*cloudhub.DeviceMeta, error) {

	existing, err := s.Store.DeviceMappings(ctx).AllDevices(ctx, cloudhub.AccessContext{
		IsSuperAdmin: hasSuperAdminContext(ctx),
		OrgID:        DefaultOrganizationID,
	})
	if err != nil {
		return nil, err
	}

	cache := make(map[string]*cloudhub.DeviceMeta, len(existing))
	for _, d := range existing {
		cache[d.Hostname] = d
	}

	var toCreate []*cloudhub.DeviceMeta
	for h, info := range hosts {
		if existingMeta, ok := cache[h]; ok {
			if existingMeta.IP != info.IP {
				existingMeta.IP = info.IP
				if err := s.Store.DeviceMappings(ctx).UpdateDevice(ctx, h, existingMeta); err != nil {
					return nil, err
				}
			}
			continue
		}
		meta := &cloudhub.DeviceMeta{
			IP:          info.IP,
			Hostname:    h,
			AliasName:   "", // unknown
			DeviceType:  defaultDeviceType(info),
			OrgID:       DefaultOrganizationID,
			IsDeletable: false,
			Vendor:      "",
		}
		toCreate = append(toCreate, meta)
		cache[h] = meta
	}
	if len(toCreate) != 0 {
		if err := s.Store.DeviceMappings(ctx).BatchAddDevices(ctx, toCreate); err != nil {
			return nil, err
		}

		// Log batch device creation
		for _, device := range toCreate {
			s.logRegistration(ctx, "DeviceMappings", fmt.Sprintf(MsgDeviceMappingAutoRegistered.String(), device.Hostname))
		}
	}

	for host, dev := range cache {
		_, found := hosts[host]
		dev.IsDeletable = !found
	}

	out := make([]*cloudhub.DeviceMeta, 0, len(cache))
	for _, v := range cache {
		out = append(out, v)
	}

	return out, nil
}

// EnsureDevice guarantees that a hostname exists in the device‑mapping store.
func (s *Service) EnsureDevice(w http.ResponseWriter, r *http.Request) {

	var req ensureDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Hostname == "" {
		invalidJSON(w, s.Logger)
		return
	}
	hostname := req.Hostname

	esSourceID, esErr := bodyInt(req.EsSourceID, "esSource")

	ctx := serverContext(r.Context())

	meta, err := s.Store.DeviceMappings(ctx).GetDevice(ctx, hostname)
	if err == nil {
		resp := ensureDeviceResponse{
			Meta:   newDeviceMappingResponse(meta),
			Status: "found",
		}
		encodeJSON(w, http.StatusOK, resp, s.Logger)
		return
	}

	if !hasSuperAdminContext(ctx) {
		resp := ensureDeviceResponse{Status: "not_found"}
		encodeJSON(w, http.StatusNotFound, resp, s.Logger)
		return
	}

	if esSourceID == -1 {
		Error(w, http.StatusUnprocessableEntity, esErr.Error(), s.Logger)
		return
	}
	var esInfo cloudhub.ESInfo
	if esErr != nil {
		Error(w, http.StatusUnprocessableEntity, esErr.Error(), s.Logger)
		return
	}

	info, ok, err := s.GetLatestHostInfo(
		ctx, esSourceID, defaultIndex, hostname, defaultDays,
	)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	if !ok {
		resp := ensureDeviceResponse{Status: "not_found"}
		encodeJSON(w, http.StatusNotFound, resp, s.Logger)
		return
	}
	esInfo = info

	meta = &cloudhub.DeviceMeta{
		IP:          esInfo.IP,
		Hostname:    hostname,
		AliasName:   "",
		DeviceType:  defaultDeviceType(esInfo),
		OrgID:       defaultOrgID,
		IsDeletable: false,
		Vendor:      "",
	}
	if err := s.Store.DeviceMappings(ctx).AddDevice(ctx, meta); err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	s.logRegistration(ctx, "DeviceMappings", fmt.Sprintf(MsgDeviceMappingAutoRegistered.String(), hostname))

	resp := ensureDeviceResponse{
		Meta:   newDeviceMappingResponse(meta),
		Status: "auto_registered",
	}
	encodeJSON(w, http.StatusCreated, resp, s.Logger)

}
