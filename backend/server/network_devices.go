package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"sync"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type deviceRequest struct {
	Organization   string              `json:"organization"`
	DeviceIP       string              `json:"device_ip"`
	Hostname       string              `json:"hostname"`
	DeviceType     string              `json:"device_type"`
	DeviceCategory string              `json:"device_category"`
	DeviceOS       string              `json:"device_os"`
	SSHConfig      cloudhub.SSHConfig  `json:"ssh_config,omitempty"`
	SNMPConfig     cloudhub.SNMPConfig `json:"snmp_config"`
	DeviceVendor   string              `json:"device_vendor"`
}

type updateDeviceRequest struct {
	DeviceIP            *string              `json:"device_ip,omitempty"`
	Organization        *string              `json:"organization,omitempty"`
	Hostname            *string              `json:"hostname,omitempty"`
	DeviceCategory      *string              `json:"device_category"`
	DeviceOS            *string              `json:"device_os,omitempty"`
	IsMonitoringEnabled *bool                `json:"is_monitoring_enabled,omitempty"`
	IsModelingGenerated *bool                `json:"is_modeling_generated,omitempty"`
	SSHConfig           *cloudhub.SSHConfig  `json:"ssh_conn"`
	SNMPConfig          *cloudhub.SNMPConfig `json:"snmp_config"`
	LearnSettingGroupID *int                 `json:"learn_setting_group_id,omitempty"`
	LearnRatio          *float64             `json:"learn_ratio,omitempty"`
	DeviceVendor        *string              `json:"device_vendor,omitempty"`
}

type deviceResponse struct {
	ID                  string              `json:"id"`
	Organization        string              `json:"organization"`
	DeviceIP            string              `json:"device_ip"`
	Hostname            string              `json:"hostname"`
	DeviceType          string              `json:"device_type"`
	DeviceCategory      string              `json:"device_category"`
	DeviceOS            string              `json:"device_os"`
	IsMonitoringEnabled bool                `json:"is_monitoring_enabled"`
	IsModelingGenerated bool                `json:"is_modeling_generated"`
	SSHConfig           cloudhub.SSHConfig  `json:"ssh_conn"`
	SNMPConfig          cloudhub.SNMPConfig `json:"snmp_config"`
	LearnSettingGroupID int                 `json:"learn_setting_group_id"`
	LearnRatio          float64             `json:"learn_ratio"`
	DeviceVendor        string              `json:"device_vendor"`
	Links               selfLinks           `json:"links"`
}

func newDeviceResponse(device *cloudhub.NetworkDevice) *deviceResponse {
	selfLink := fmt.Sprintf("/cloudhub/v1/device/%s", device.ID)

	resData := &deviceResponse{
		ID:                  device.ID,
		Organization:        device.Organization,
		DeviceIP:            device.DeviceIP,
		Hostname:            device.Hostname,
		DeviceType:          device.DeviceType,
		DeviceCategory:      device.DeviceCategory,
		DeviceOS:            device.DeviceOS,
		IsMonitoringEnabled: device.IsMonitoringEnabled,
		IsModelingGenerated: device.IsModelingGenerated,
		SSHConfig: cloudhub.SSHConfig{
			SSHUserName:   device.SSHConfig.SSHUserName,
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
		LearnSettingGroupID: device.LearnSettingGroupID,
		LearnRatio:          device.LearnRatio,
		DeviceVendor:        device.DeviceVendor,
		Links:               selfLinks{Self: selfLink},
	}

	return resData
}

type devicesResponse struct {
	Links   selfLinks         `json:"links"`
	Devices []*deviceResponse `json:"Devices"`
}

func newDevicesResponse(devices []cloudhub.NetworkDevice) *devicesResponse {
	devicesResp := make([]*deviceResponse, len(devices))
	for i, device := range devices {
		devicesResp[i] = newDeviceResponse(&device)
	}

	return &devicesResponse{
		Devices: devicesResp,
	}
}

func (r *deviceRequest) validCreate() error {
	switch {
	case r.DeviceIP == "":
		return fmt.Errorf("device_ip required in device request body")
	case r.DeviceCategory == "":
		return fmt.Errorf("device_type required in device request body")
	case r.Organization == "":
		return fmt.Errorf("organization required in device request body")
	}

	if _, ok := cloudhub.DeviceCategoryMap[r.DeviceCategory]; !ok {
		return fmt.Errorf("invalid device_type: %s", r.DeviceCategory)
	}

	return nil
}

func (r *updateDeviceRequest) validUpdate() error {
	switch {
	case r.DeviceIP == nil:
		return fmt.Errorf("device_ip required in device request body")
	case r.DeviceCategory != nil:
		if _, ok := cloudhub.DeviceCategoryMap[*r.DeviceCategory]; !ok {
			return fmt.Errorf("invalid device_category: %s", *r.DeviceCategory)
		}
	case r.Organization == nil:
		return fmt.Errorf("organization required in device request body")
	}

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
		DeviceCategory:      r.DeviceCategory,
		DeviceOS:            r.DeviceOS,
		IsMonitoringEnabled: false,
		IsModelingGenerated: false,
		SSHConfig:           r.SSHConfig,
		SNMPConfig:          r.SNMPConfig,
		LearnSettingGroupID: 1,
		LearnRatio:          0.0,
		DeviceVendor:        r.DeviceVendor,
	}, nil
}

func (s *Service) processDevice(ctx context.Context, req deviceRequest) (*cloudhub.NetworkDevice, error) {
	if s == nil || s.Store == nil {
		return nil, errors.New("Service or Store is nil")
	}

	if err := req.validCreate(); err != nil {
		return nil, err
	}

	device, err := req.CreateDeviceFromRequest()
	if err != nil {
		return nil, err
	}

	res, err := s.Store.NetworkDevice(ctx).Add(ctx, device)
	msg := fmt.Sprintf(MsgNetWorkDeviceCreated.String(), res.ID)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	if err != nil {
		return nil, err
	}
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

	workerLimit := 10
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	failedDevices := []map[string]interface{}{}
	var mu sync.Mutex

	for i, req := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, req deviceRequest) {
			defer wg.Done()
			defer func() {
				if rec := recover(); rec != nil {
					s.Logger.Error("Recovered from panic: %v", rec)
					mu.Lock()
					failedDevices = append(failedDevices, map[string]interface{}{
						"index":        i,
						"device_ip":    req.DeviceIP,
						"errorMessage": "internal server error",
					})
					mu.Unlock()
				}
				<-sem
			}()
			_, err := s.processDevice(ctx, req)
			if err != nil {
				mu.Lock()
				failedDevices = append(failedDevices, map[string]interface{}{
					"index":        i,
					"device_ip":    req.DeviceIP,
					"errorMessage": err.Error(),
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

	res := newDevicesResponse(devices)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// DeviceID returns a single specified Device
func (s *Service) DeviceID(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
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

	res := newDeviceResponse(device)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// RemoveDevices deletes specified Devices
func (s *Service) RemoveDevices(w http.ResponseWriter, r *http.Request) {
	var request struct {
		DeviceIDs []string `json:"devices_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	workerLimit := 10
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	failedDevices := []map[string]interface{}{}
	var mu sync.Mutex

	for i, id := range request.DeviceIDs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, id string) {
			defer wg.Done()
			defer func() {
				if rec := recover(); rec != nil {
					s.Logger.Error("Recovered from panic: %v", rec)
					mu.Lock()
					failedDevices = append(failedDevices, map[string]interface{}{
						"index":        i,
						"device_id":    id,
						"errorMessage": "internal server error",
					})
					mu.Unlock()
				}
				<-sem
			}()

			device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
			if err != nil {
				mu.Lock()
				failedDevices = append(failedDevices, map[string]interface{}{
					"index":        i,
					"device_id":    id,
					"errorMessage": "device not found",
				})
				mu.Unlock()
				return
			}

			err = s.Store.NetworkDevice(ctx).Delete(ctx, device)
			if err != nil {
				mu.Lock()
				failedDevices = append(failedDevices, map[string]interface{}{
					"index":        i,
					"device_id":    id,
					"errorMessage": err.Error(),
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
		w.WriteHeader(http.StatusNoContent)
	}
}

// UpdateNetworkDevice completely updates either the Device
func (s *Service) UpdateNetworkDevice(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
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
	if req.IsMonitoringEnabled != nil {
		device.IsMonitoringEnabled = *req.IsMonitoringEnabled
	}
	if req.IsModelingGenerated != nil {
		device.IsModelingGenerated = *req.IsModelingGenerated
	}

	if req.SSHConfig != nil {
		if req.SSHConfig.SSHUserName != "" {
			device.SSHConfig.SSHUserName = req.SSHConfig.SSHUserName
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

	if req.LearnSettingGroupID != nil {
		device.LearnSettingGroupID = *req.LearnSettingGroupID
	}

	if req.LearnRatio != nil {
		device.LearnRatio = *req.LearnRatio
	}

	if req.DeviceVendor != nil {
		device.DeviceVendor = *req.DeviceVendor
	}

	if err := s.Store.NetworkDevice(ctx).Update(ctx, device); err != nil {
		msg := fmt.Sprintf("Error updating Device ID %s: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceModified.String(), device.ID)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	res := newDeviceResponse(device)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

func isZeroOfUnderlyingType(x interface{}) bool {
	return x == reflect.Zero(reflect.TypeOf(x)).Interface()
}

func updateSSHConfig(target, source *cloudhub.SSHConfig) {
	if source != nil {
		if !isZeroOfUnderlyingType(source.SSHUserName) {
			target.SSHUserName = source.SSHUserName
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
