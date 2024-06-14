package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/pelletier/go-toml/v2"
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
	DeviceIP           *string              `json:"device_ip,omitempty"`
	Organization       *string              `json:"organization,omitempty"`
	Hostname           *string              `json:"hostname,omitempty"`
	DeviceCategory     *string              `json:"device_category"`
	DeviceOS           *string              `json:"device_os,omitempty"`
	IsConfigWritten    *bool                `json:"is_monitoring_enabled,omitempty"`
	SSHConfig          *cloudhub.SSHConfig  `json:"ssh_config"`
	SNMPConfig         *cloudhub.SNMPConfig `json:"snmp_config"`
	Sensitivity        *float32             `json:"sensitivity,omitempty"`
	DeviceVendor       *string              `json:"device_vendor,omitempty"`
	LearningState      *string              `json:"learning_state"`
	LearningUpdateDate *string              `json:"learning_update_date,omitempty"`
}

type deviceResponse struct {
	ID                 uint64              `json:"id"`
	Organization       string              `json:"organization"`
	OrganizationName   string              `json:"organization_name"`
	DeviceIP           string              `json:"device_ip"`
	Hostname           string              `json:"hostname"`
	DeviceType         string              `json:"device_type"`
	DeviceCategory     string              `json:"device_category"`
	DeviceOS           string              `json:"device_os"`
	IsConfigWritten    bool                `json:"is_config_written"`
	SSHConfig          cloudhub.SSHConfig  `json:"ssh_config"`
	SNMPConfig         cloudhub.SNMPConfig `json:"snmp_config"`
	Sensitivity        float32             `json:"sensitivity,omitempty"`
	DeviceVendor       string              `json:"device_vendor"`
	LearningState      string              `json:"learning_state"`
	LearningUpdateDate string              `json:"learning_update_date,omitempty"`
}
type deviceError struct {
	Index        int    `json:"index"`
	DeviceIP     string `json:"device_ip,omitempty"`
	DeviceID     uint64 `json:"device_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}

type deviceMapByOrg struct {
	SavedCollectorDevices []uint64
	AllDevices            []uint64
}

func newDeviceResponse(ctx context.Context, s *Service, device *cloudhub.NetworkDevice) (*deviceResponse, error) {

	orgName, err := s.OrganizationNameByID(ctx, device.Organization)

	if err != nil {
		return nil, err
	}

	resData := &deviceResponse{
		ID:               device.ID,
		Organization:     device.Organization,
		OrganizationName: orgName,
		DeviceIP:         device.DeviceIP,
		Hostname:         device.Hostname,
		DeviceType:       device.DeviceType,
		DeviceCategory:   device.DeviceCategory,
		DeviceOS:         device.DeviceOS,
		IsConfigWritten:  device.IsConfigWritten,
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
		Sensitivity:   device.Sensitivity,
		DeviceVendor:  device.DeviceVendor,
		LearningState: device.LearningState,
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
		Organization:    r.Organization,
		DeviceIP:        r.DeviceIP,
		Hostname:        r.Hostname,
		DeviceType:      r.DeviceType,
		DeviceCategory:  cloudhub.DeviceCategoryMap["network"],
		DeviceOS:        r.DeviceOS,
		IsConfigWritten: false,
		LearningState:   "ready",
		SSHConfig:       r.SSHConfig,
		SNMPConfig:      r.SNMPConfig,
		Sensitivity:     1.0,
		DeviceVendor:    r.DeviceVendor,
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

	if err != nil {
		http.Error(w, "Failed to get existing devices", http.StatusInternalServerError)
		return
	}

	device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if device.DeviceIP != *req.DeviceIP {
		allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)
		if err != nil {
			http.Error(w, "Failed to get existing devices", http.StatusInternalServerError)
			return
		}
		for _, device := range allDevices {
			if device.DeviceIP == *req.DeviceIP {
				message := fmt.Sprintf("duplicate IP in existing devices: %s", *req.DeviceIP)
				http.Error(w, message, http.StatusBadRequest)
				return
			}
		}
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
	if req.LearningState != nil {
		device.LearningState = *req.LearningState
	}
	if req.LearningUpdateDate != nil {
		device.LearningUpdateDate = *req.LearningUpdateDate
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

//MonitoringConfigManagement is LogStash Config Management
func (s *Service) MonitoringConfigManagement(w http.ResponseWriter, r *http.Request) {
	var request struct {
		DeviceIDs []uint64 `json:"devices_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	failedDevices := []deviceError{}

	deviceListGroupByOrg := make(map[string][]uint64)

	for i, id := range request.DeviceIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
		if err != nil {
			failedDevices = append(failedDevices, deviceError{Index: i, DeviceID: id, ErrorMessage: err.Error()})
		} else {
			deviceListGroupByOrg[device.Organization] = append(deviceListGroupByOrg[device.Organization], device.ID)
		}

	}
	if len(deviceListGroupByOrg) < 1 {
		response := map[string]interface{}{
			"failed_devices": failedDevices,
		}
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
		return

	}
	fmt.Println(deviceListGroupByOrg)
	collectorKeys, err := s.getCollectorServers()

	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)

	selectedNetDeviceOrgStore := addOrUpdateDevicesInStore(deviceOrg, deviceListGroupByOrg, collectorKeys)
	for _, v := range selectedNetDeviceOrgStore {
		statusCode, resp, err := s.generateLogstashConfigGroupByOrg(ctx, &v)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}

		org, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &v.ID})

		if org != nil {
			s.Store.NetworkDeviceOrg(ctx).Update(ctx, &v)
			msg := fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), v.ID)
			s.logRegistration(ctx, "NetWorkDeviceOrg conf", msg)

		} else {
			s.Store.NetworkDeviceOrg(ctx).Add(ctx, &v)
			msg := fmt.Sprintf(MsgNetWorkDeviceOrgCreated.String(), v.ID)
			s.logRegistration(ctx, "NetWorkDeviceOrg conf", msg)
		}

	}
	response := map[string]interface{}{
		"failed_devices": failedDevices,
	}
	encodeJSON(w, http.StatusCreated, response, s.Logger)

}

func removeDevices(devices, devicesToRemove []uint64) []uint64 {
	deviceMap := make(map[uint64]bool)
	for _, device := range devicesToRemove {
		deviceMap[device] = true
	}

	var updatedDevices []uint64
	for _, device := range devices {
		if !deviceMap[device] {
			updatedDevices = append(updatedDevices, device)
		}
	}
	return updatedDevices
}

func addOrUpdateDevicesInStore(stores []cloudhub.NetworkDeviceOrg, orgDevices map[string][]uint64, collectors []string) []cloudhub.NetworkDeviceOrg {
	for _, deviceIDs := range orgDevices {
		for _, deviceID := range deviceIDs {
			for i, store := range stores {
				if contains(store.DevicesIDs, deviceID) {
					stores[i].DevicesIDs = removeDevices(stores[i].DevicesIDs, []uint64{deviceID})
					break
				}
			}
		}
	}

	for org, deviceIDs := range orgDevices {
		storeFound := false
		for i, store := range stores {
			if store.ID == org {
				leastLoadedServer := findLeastLoadedCollectorServer(stores, collectors)
				stores[i].DevicesIDs = appendUnique(stores[i].DevicesIDs, deviceIDs...)
				stores[i].CollectorServer = leastLoadedServer
				storeFound = true
				break
			}
		}
		if !storeFound {
			leastLoadedServer := findLeastLoadedCollectorServer(stores, collectors)
			newStore := cloudhub.NetworkDeviceOrg{
				ID:              org,
				DevicesIDs:      deviceIDs,
				LoadModule:      "learn.ch_nx_load",
				MLFunction:      "ml_multiplied",
				DataDuration:    15,
				LearnCycle:      15,
				CollectorServer: leastLoadedServer,
			}
			stores = append(stores, newStore)
		}
	}

	return stores
}

func contains(devices []uint64, deviceID uint64) bool {
	for _, d := range devices {
		if d == deviceID {
			return true
		}
	}
	return false
}

func appendUnique(devices []uint64, newDevices ...uint64) []uint64 {
	deviceSet := make(map[uint64]bool)
	for _, device := range devices {
		deviceSet[device] = true
	}

	for _, device := range newDevices {
		if !deviceSet[device] {
			devices = append(devices, device)
			deviceSet[device] = true
		}
	}

	return devices
}
func findLeastLoadedCollectorServer(stores []cloudhub.NetworkDeviceOrg, collectors []string) string {
	usedServers := make(map[string]bool)
	for _, store := range stores {
		usedServers[store.CollectorServer] = true
	}
	for _, server := range collectors {
		if !usedServers[server] {
			return server
		}
	}
	serverLoad := make(map[string]int)
	for _, store := range stores {
		serverLoad[store.CollectorServer] += len(store.DevicesIDs)
	}

	leastLoadedServer := collectors[0]
	for _, server := range collectors {
		if serverLoad[server] < serverLoad[leastLoadedServer] {
			leastLoadedServer = server
		}
	}
	return leastLoadedServer
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

func (s *Service) getCollectorServers() ([]string, error) {
	status, responseBody, err := s.GetWheelKeyAcceptedListAll()
	if err != nil {
		return nil, err
	}

	if status != 200 {
		return nil, fmt.Errorf("failed to retrieve keys, status code: %d", status)
	}

	var response struct {
		Return []struct {
			Data struct {
				Return struct {
					Minions []string `json:"minions"`
				} `json:"return"`
			} `json:"data"`
		} `json:"return"`
	}

	err = json.Unmarshal(responseBody, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	var collectorKeys []string
	for _, minion := range response.Return[0].Data.Return.Minions {
		if strings.HasPrefix(minion, "ch-collector") {
			collectorKeys = append(collectorKeys, minion)
		}
	}

	return collectorKeys, nil
}

func (s *Service) generateLogstashConfigGroupByOrg(ctx context.Context, devOrg *cloudhub.NetworkDeviceOrg) (int, []byte, error) {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &devOrg.ID})
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	fileName := fmt.Sprintf("%s.conf", org.Name)
	dirPath := "/etc/logstash/pipeline"
	filePath := path.Join(dirPath, fileName)
	var statusCode int
	var resp []byte

	if statusCode, resp, err := s.DirectoryExistsWithLocalClient(dirPath, devOrg.CollectorServer); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, nil, err
	} else if resp != nil {
		r := &struct {
			Return []map[string]bool `json:"return"`
		}{}

		if err := json.Unmarshal(resp, r); err != nil {
			return http.StatusInternalServerError, nil, err
		}

		if !r.Return[0][devOrg.CollectorServer] {
			if statusCode, _, err := s.MkdirWithLocalClient(dirPath, devOrg.CollectorServer); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				return statusCode, nil, err
			}
		}
	} else {
		return http.StatusInternalServerError, nil, fmt.Errorf("Unknown error ocuured at DirectoryExists() func")
	}

	telegrafConfig := "test Message"
	b, _ := toml.Marshal(telegrafConfig)

	statusCode, resp, err = s.CreateFileWithLocalClient(filePath, []string{string(b)}, devOrg.CollectorServer)

	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}
	return http.StatusOK, nil, nil
}

func (s *Service) removeLogstashConfigGroupByOrg(ctx context.Context, devOrg *cloudhub.NetworkDeviceOrg) (int, []byte, error) {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &devOrg.ID})
	fileName := fmt.Sprintf("%s.conf", org.Name)
	dirPath := "/etc/logstash/pipeline"
	filePath := path.Join(dirPath, fileName)

	var statusCode int
	var resp []byte

	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	statusCode, resp, err = s.RemoveFileWithLocalClient(filePath, devOrg.CollectorServer)

	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}

	return http.StatusOK, nil, nil
}
