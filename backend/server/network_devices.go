package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"sync"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type deviceRequest struct {
	DeviceIP     string              `json:"device_ip"`
	Organization string              `json:"organization"`
	Hostname     string              `json:"hostname"`
	DeviceType   string              `json:"device_type"`
	DeviceOS     string              `json:"device_os"`
	SSHConfig    cloudhub.SSHConfig  `json:"ssh_config,omitempty"`
	SNMPConfig   cloudhub.SNMPConfig `json:"snmp_config"`
	DeviceVendor string              `json:"device_vendor,omitempty"`
}

type updateDeviceRequest struct {
	DeviceIP            *string              `json:"device_ip,omitempty"`
	Organization        *string              `json:"organization,omitempty"`
	Hostname            *string              `json:"hostname,omitempty"`
	DeviceCategory      *string              `json:"device_category"`
	DeviceOS            *string              `json:"device_os,omitempty"`
	IsConfigWritten     *bool                `json:"is_monitoring_enabled,omitempty"`
	IsModelingGenerated *bool                `json:"is_modeling_generated,omitempty"`
	SSHConfig           *cloudhub.SSHConfig  `json:"ssh_config"`
	SNMPConfig          *cloudhub.SNMPConfig `json:"snmp_config"`
	Sensitivity         *float32             `json:"sensitivity,omitempty"`
	DeviceVendor        *string              `json:"device_vendor,omitempty"`
}

type deviceResponse struct {
	ID                  uint64              `json:"id"`
	Organization        string              `json:"organization"`
	OrganizationName    string              `json:"organization_name"`
	DeviceIP            string              `json:"device_ip"`
	Hostname            string              `json:"hostname"`
	DeviceType          string              `json:"device_type"`
	DeviceCategory      string              `json:"device_category"`
	DeviceOS            string              `json:"device_os"`
	IsConfigWritten     bool                `json:"is_config_written"`
	IsModelingGenerated bool                `json:"is_modeling_generated"`
	SSHConfig           cloudhub.SSHConfig  `json:"ssh_config"`
	SNMPConfig          cloudhub.SNMPConfig `json:"snmp_config"`
	Sensitivity         float32             `json:"sensitivity,omitempty"`
	DeviceVendor        string              `json:"device_vendor"`
}
type deviceError struct {
	Index        int    `json:"index"`
	DeviceIP     string `json:"device_ip, omitempty"`
	DeviceID     uint64 `json:"device_id, omitempty"`
	ErrorMessage string `json:"errorMessage"`
}

func newDeviceResponse(ctx context.Context, s *Service, device *cloudhub.NetworkDevice) (*deviceResponse, error) {

	orgName, err := s.OrganizationNameByID(ctx, device.Organization)

	if err != nil {
		return nil, err
	}

	resData := &deviceResponse{
		ID:                  device.ID,
		Organization:        device.Organization,
		OrganizationName:    orgName,
		DeviceIP:            device.DeviceIP,
		Hostname:            device.Hostname,
		DeviceType:          device.DeviceType,
		DeviceCategory:      device.DeviceCategory,
		DeviceOS:            device.DeviceOS,
		IsConfigWritten:     device.IsConfigWritten,
		IsModelingGenerated: device.IsModelingGenerated,
		SSHConfig: cloudhub.SSHConfig{
			SSHUserID:     device.SSHConfig.SSHUserID,
			SSHPassword:   device.SSHConfig.SSHPassword,
			SSHEnPassword: device.SSHConfig.SSHEnPassword,
			SSHPort:       device.SSHConfig.SSHPort,
		},
		SNMPConfig: cloudhub.SNMPConfig{
			SNMPCommunity: device.SNMPConfig.SNMPCommunity,
			SNMPVersion:   device.SNMPConfig.SNMPVersion,
			SNMPPort:      device.SNMPConfig.SNMPPort,
			SNMPProtocol:  device.SNMPConfig.SNMPProtocol,
		},
		Sensitivity:  device.Sensitivity,
		DeviceVendor: device.DeviceVendor,
	}

	return resData, nil
}

type devicesResponse struct {
	Devices       []*deviceResponse `json:"Devices"`
	FailedDevices []deviceError     `json:"failed_devices"`
}

func newDevicesResponse(ctx context.Context, s *Service, devices []cloudhub.NetworkDevice) *devicesResponse {
	devicesResp := []*deviceResponse{}
	failedDevices := []deviceError{}
	for i, device := range devices {
		data, err := newDeviceResponse(ctx, s, &device)
		if err != nil {
			failedDevices = append(failedDevices, deviceError{
				Index:        i,
				DeviceIP:     device.DeviceIP,
				ErrorMessage: err.Error(),
			})
		} else {
			devicesResp = append(devicesResp, data)
		}
	}

	return &devicesResponse{
		Devices:       devicesResp,
		FailedDevices: failedDevices,
	}
}

func (r *deviceRequest) validCreate() error {
	switch {
	case r.DeviceIP == "":
		return fmt.Errorf("device_ip required in device request body")

	case r.Organization == "":
		return fmt.Errorf("organization required in device request body")
	}

	return nil
}

func (r *updateDeviceRequest) validUpdate() error {
	return nil
}

func (r *deviceRequest) CreateDeviceFromRequest() (*cloudhub.NetworkDevice, error) {
	if r == nil {
		return nil, errors.New("deviceRequest is nil")
	}

	return &cloudhub.NetworkDevice{
		Organization:        r.Organization,
		DeviceIP:            r.DeviceIP,
		Hostname:            r.Hostname,
		DeviceType:          r.DeviceType,
		DeviceCategory:      cloudhub.DeviceCategoryMap["network"],
		DeviceOS:            r.DeviceOS,
		IsConfigWritten:     false,
		IsModelingGenerated: false,
		SSHConfig:           r.SSHConfig,
		SNMPConfig:          r.SNMPConfig,
		Sensitivity:         1.0,
		DeviceVendor:        r.DeviceVendor,
	}, nil
}

func (s *Service) processDevice(ctx context.Context, req deviceRequest, allDevices []cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
	if s == nil || s.Store == nil {
		return nil, errors.New("Service or Store is nil")
	}

	for _, device := range allDevices {
		if device.DeviceIP == req.DeviceIP {
			return nil, fmt.Errorf("duplicate IP in existing devices: %s", req.DeviceIP)
		}
	}

	if err := req.validCreate(); err != nil {
		return nil, err
	}
	device, err := req.CreateDeviceFromRequest()
	if err != nil {
		return nil, err
	}

	if err := s.OrganizationExists(ctx, req.Organization); err != nil {
		return nil, err
	}

	res, err := s.Store.NetworkDevice(ctx).Add(ctx, device)
	if err != nil {
		return nil, err
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceCreated.String(), res.ID)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	return res, nil
}

// NewDevices creates and returns a new Device object
func (s *Service) NewDevices(w http.ResponseWriter, r *http.Request) {
	var reqs []deviceRequest
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}
	ctx := r.Context()

	allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)

	if err != nil {
		http.Error(w, "Failed to get existing devices", http.StatusInternalServerError)
		return
	}

	ipCount := make(map[string]int)
	for _, req := range reqs {
		ipCount[req.DeviceIP]++
	}

	var failedDevices []deviceError
	var uniqueReqs []deviceRequest

	for i, req := range reqs {
		if ipCount[req.DeviceIP] > 1 {
			failedDevices = append(failedDevices, deviceError{
				Index:        i,
				DeviceIP:     req.DeviceIP,
				ErrorMessage: "duplicate IP in request",
			})
		} else {
			uniqueReqs = append(uniqueReqs, req)
		}
	}

	workerLimit := 10
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	var mu sync.Mutex

	for i, req := range uniqueReqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, req deviceRequest) {
			defer wg.Done()
			defer func() {
				if rec := recover(); rec != nil {
					s.Logger.Error("Recovered from panic: %v", rec)
					mu.Lock()
					failedDevices = append(failedDevices, deviceError{
						Index:        i,
						DeviceIP:     req.DeviceIP,
						ErrorMessage: "internal server error",
					})
					mu.Unlock()
				}
				<-sem
			}()
			_, err := s.processDevice(ctx, req, allDevices)
			if err != nil {
				mu.Lock()
				failedDevices = append(failedDevices, deviceError{
					Index:        i,
					DeviceIP:     req.DeviceIP,
					ErrorMessage: err.Error(),
				})
				mu.Unlock()
			}
		}(ctx, i, req)
	}

	wg.Wait()

	response := map[string]interface{}{
		"failed_devices": failedDevices,
	}
	if len(failedDevices) > 0 {
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
	} else {
		encodeJSON(w, http.StatusCreated, response, s.Logger)
	}
}

// AllDevices returns all devices within the store.
func (s *Service) AllDevices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	devices, err := s.Store.NetworkDevice(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newDevicesResponse(ctx, s, devices)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// DeviceID returns a single specified Device
func (s *Service) DeviceID(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			s.Logger.Error("Recovered from panic: %v", rec)
			Error(w, http.StatusInternalServerError, fmt.Sprintf("recovered from panic: %v", rec), s.Logger)
		}
	}()

	id, err := parseID(r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res, err := newDeviceResponse(ctx, s, device)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// RemoveDevices deletes specified Devices
func (s *Service) RemoveDevices(w http.ResponseWriter, r *http.Request) {
	var request struct {
		DeviceIDs []uint64 `json:"devices_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	workerLimit := 10
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	failedDevices := []deviceError{}
	var mu sync.Mutex

	for i, id := range request.DeviceIDs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, id uint64) {
			defer wg.Done()
			defer func() {
				if rec := recover(); rec != nil {
					s.Logger.Error("Recovered from panic: %v", rec)
					mu.Lock()
					failedDevices = append(failedDevices, deviceError{
						Index:        i,
						DeviceID:     id,
						ErrorMessage: "internal server error",
					})
					mu.Unlock()
				}
				<-sem
			}()

			device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
			if err := s.OrganizationExists(ctx, device.Organization); err != nil {
				Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
				return
			}
			if err != nil {
				mu.Lock()
				failedDevices = append(failedDevices, deviceError{
					Index:        i,
					DeviceID:     id,
					ErrorMessage: "device not found",
				})
				mu.Unlock()
				return
			}

			err = s.Store.NetworkDevice(ctx).Delete(ctx, device)
			if err != nil {
				mu.Lock()
				failedDevices = append(failedDevices, deviceError{
					Index:        i,
					DeviceID:     id,
					ErrorMessage: err.Error(),
				})
				mu.Unlock()
				return
			}

			msg := fmt.Sprintf(MsgNetWorkDeviceDeleted.String(), id)
			s.logRegistration(ctx, "NetWorkDevice", msg)
		}(ctx, i, id)
	}

	wg.Wait()

	response := map[string]interface{}{
		"failed_devices": failedDevices,
	}
	if len(failedDevices) > 0 {
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
	} else {
		encodeJSON(w, http.StatusNoContent, response, s.Logger)

	}
}

// UpdateNetworkDevice completely updates either the Device
func (s *Service) UpdateNetworkDevice(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req updateDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)
	for _, device := range allDevices {
		if device.DeviceIP == *req.DeviceIP {
			message := fmt.Errorf("duplicate IP in existing devices: %s", req.DeviceIP)
			http.Error(w, message.Error(), http.StatusInternalServerError)
		}
	}

	if err != nil {
		http.Error(w, "Failed to get existing devices", http.StatusInternalServerError)
		return
	}

	device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if req.DeviceIP != nil {
		device.DeviceIP = *req.DeviceIP
	}
	if req.Organization != nil {
		device.Organization = *req.Organization
	}
	if req.Hostname != nil {
		device.Hostname = *req.Hostname
	}
	if req.DeviceCategory != nil {
		device.DeviceCategory = *req.DeviceCategory
	}
	if req.DeviceOS != nil {
		device.DeviceOS = *req.DeviceOS
	}
	if req.IsConfigWritten != nil {
		device.IsConfigWritten = *req.IsConfigWritten
	}
	if req.IsModelingGenerated != nil {
		device.IsModelingGenerated = *req.IsModelingGenerated
	}

	if req.SSHConfig != nil {
		if req.SSHConfig.SSHUserID != "" {
			device.SSHConfig.SSHUserID = req.SSHConfig.SSHUserID
		}
		if req.SSHConfig.SSHPassword != "" {
			device.SSHConfig.SSHPassword = req.SSHConfig.SSHPassword
		}
		if req.SSHConfig.SSHEnPassword != "" {
			device.SSHConfig.SSHEnPassword = req.SSHConfig.SSHEnPassword
		}
		if req.SSHConfig.SSHPort != 0 {
			device.SSHConfig.SSHPort = req.SSHConfig.SSHPort
		}
	}

	if req.SNMPConfig != nil {
		if req.SNMPConfig.SNMPCommunity != "" {
			device.SNMPConfig.SNMPCommunity = req.SNMPConfig.SNMPCommunity
		}
		if req.SNMPConfig.SNMPVersion != "" {
			device.SNMPConfig.SNMPVersion = req.SNMPConfig.SNMPVersion
		}
		if req.SNMPConfig.SNMPPort != 0 {
			device.SNMPConfig.SNMPPort = req.SNMPConfig.SNMPPort
		}
		if req.SNMPConfig.SNMPProtocol != "" {
			device.SNMPConfig.SNMPProtocol = req.SNMPConfig.SNMPProtocol
		}
	}

	if req.Sensitivity != nil {
		device.Sensitivity = *req.Sensitivity
	}

	if req.DeviceVendor != nil {
		device.DeviceVendor = *req.DeviceVendor
	}

	if err := s.OrganizationExists(ctx, device.Organization); err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	if err := s.Store.NetworkDevice(ctx).Update(ctx, device); err != nil {
		msg := fmt.Sprintf("Error updating Device ID %s: %v", strconv.FormatUint(id, 10), err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceModified.String(), strconv.FormatUint(device.ID, 10))
	s.logRegistration(ctx, "NetWorkDevice", msg)

	res, err := newDeviceResponse(ctx, s, device)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

func isZeroOfUnderlyingType(x interface{}) bool {
	return x == reflect.Zero(reflect.TypeOf(x)).Interface()
}

func updateSSHConfig(target, source *cloudhub.SSHConfig) {
	if source != nil {
		if !isZeroOfUnderlyingType(source.SSHUserID) {
			target.SSHUserID = source.SSHUserID
		}
		if !isZeroOfUnderlyingType(source.SSHPassword) {
			target.SSHPassword = source.SSHPassword
		}
		if !isZeroOfUnderlyingType(source.SSHEnPassword) {
			target.SSHEnPassword = source.SSHEnPassword
		}
		if !isZeroOfUnderlyingType(source.SSHPort) {
			target.SSHPort = source.SSHPort
		}
	}
}

func updateSNMPConfig(target, source *cloudhub.SNMPConfig) {
	if source != nil {
		if !isZeroOfUnderlyingType(source.SNMPCommunity) {
			target.SNMPCommunity = source.SNMPCommunity
		}
		if !isZeroOfUnderlyingType(source.SNMPVersion) {
			target.SNMPVersion = source.SNMPVersion
		}
		if !isZeroOfUnderlyingType(source.SNMPPort) {
			target.SNMPPort = source.SNMPPort
		}
		if !isZeroOfUnderlyingType(source.SNMPProtocol) {
			target.SNMPProtocol = source.SNMPProtocol
		}
	}
}

func parseID(r *http.Request) (uint64, error) {
	idStr, err := paramStr("id", r)
	if err != nil {
		return 0, err
	}

	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return 0, err
	}

	return id, nil
}
