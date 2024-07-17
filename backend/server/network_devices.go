package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"reflect"
	"strings"
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
	Organization           *string              `json:"organization,omitempty"`
	DeviceIP               *string              `json:"device_ip,omitempty"`
	Hostname               *string              `json:"hostname,omitempty"`
	DeviceType             *string              `json:"device_type,omitempty"`
	DeviceCategory         *string              `json:"device_category,omitempty"`
	DeviceOS               *string              `json:"device_os,omitempty"`
	IsCollectingCfgWritten *bool                `json:"is_collecting_cfg_written,omitempty"`
	SSHConfig              *cloudhub.SSHConfig  `json:"ssh_config,omitempty"`
	SNMPConfig             *cloudhub.SNMPConfig `json:"snmp_config,omitempty"`
	Sensitivity            *float32             `json:"sensitivity,omitempty"`
	DeviceVendor           *string              `json:"device_vendor,omitempty"`
	IsLearning             *bool                `json:"is_learning,omitempty"`
}
type deleteDevicesRequest struct {
	DevicesIDs []string `json:"devices_ids"`
}

type devicesResponse struct {
	Devices       []*deviceResponse   `json:"devices"`
	FailedDevices []createDeviceError `json:"failed_devices"`
}
type deviceResponse struct {
	ID                     string              `json:"id"`
	Organization           string              `json:"organization"`
	DeviceIP               string              `json:"device_ip"`
	Hostname               string              `json:"hostname"`
	DeviceType             string              `json:"device_type"`
	DeviceCategory         string              `json:"device_category"`
	DeviceOS               string              `json:"device_os"`
	IsCollectingCfgWritten bool                `json:"is_collecting_cfg_written"`
	SSHConfig              cloudhub.SSHConfig  `json:"ssh_config"`
	SNMPConfig             cloudhub.SNMPConfig `json:"snmp_config"`
	Sensitivity            float32             `json:"sensitivity"`
	DeviceVendor           string              `json:"device_vendor"`
	LearningState          string              `json:"learning_state"`
	LearningBeginDatetime  string              `json:"learning_update_date"`
	LearningFinishDatetime string              `json:"learning_finish_datetime"`
	IsLearning             bool                `json:"is_learning"`
	MLFunction             string              `json:"ml_function"`
}
type createDeviceError struct {
	Index        int    `json:"index"`
	DeviceIP     string `json:"device_ip,omitempty"`
	DeviceID     string `json:"device_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}
type deviceError struct {
	DeviceID     string `json:"device_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}

type deviceMapByOrg struct {
	SavedCollectorDevices []string
	AllDevices            []string
}

// State type definition
type State string

// Define constants for the learn states
const (
	Ready        string = "Ready"
	MlInProgress string = "ML in Progress"
	DlInProgress string = "DL in Progress"
	MlComplete   string = "ML Complete"
	DlComplete   string = "DL Complete"
	MlFail       string = "ML Fail"
	DlFail       string = "DL Fail"
)

func newDeviceResponse(ctx context.Context, s *Service, device *cloudhub.NetworkDevice) (*deviceResponse, error) {
	deviceOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &device.Organization})
	MLFunction := MLFunctionMultiplied
	if deviceOrg != nil {
		MLFunction = deviceOrg.MLFunction
	}

	resData := &deviceResponse{
		ID:                     device.ID,
		Organization:           device.Organization,
		DeviceIP:               device.DeviceIP,
		Hostname:               device.Hostname,
		DeviceType:             device.DeviceType,
		DeviceCategory:         device.DeviceCategory,
		DeviceOS:               device.DeviceOS,
		IsCollectingCfgWritten: device.IsCollectingCfgWritten,
		SSHConfig: cloudhub.SSHConfig{
			UserID:     device.SSHConfig.UserID,
			Password:   device.SSHConfig.Password,
			EnPassword: device.SSHConfig.EnPassword,
			Port:       device.SSHConfig.Port,
		},
		SNMPConfig: cloudhub.SNMPConfig{
			Community: device.SNMPConfig.Community,
			Version:   device.SNMPConfig.Version,
			Port:      device.SNMPConfig.Port,
			Protocol:  device.SNMPConfig.Protocol,
		},
		Sensitivity:            device.Sensitivity,
		DeviceVendor:           device.DeviceVendor,
		LearningState:          device.LearningState,
		LearningBeginDatetime:  device.LearningBeginDatetime,
		LearningFinishDatetime: device.LearningFinishDatetime,
		IsLearning:             device.IsLearning,
		MLFunction:             MLFunction,
	}

	return resData, nil
}

func newDevicesResponse(ctx context.Context, s *Service, devices []cloudhub.NetworkDevice) *devicesResponse {
	devicesResp := []*deviceResponse{}
	failedDevices := []createDeviceError{}
	for i, device := range devices {
		data, err := newDeviceResponse(ctx, s, &device)
		if err != nil {
			failedDevices = append(failedDevices, createDeviceError{
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
		Organization:           r.Organization,
		DeviceIP:               r.DeviceIP,
		Hostname:               r.Hostname,
		DeviceType:             r.DeviceType,
		DeviceCategory:         cloudhub.DeviceCategoryMap["network"],
		DeviceOS:               r.DeviceOS,
		IsCollectingCfgWritten: false,
		SSHConfig:              r.SSHConfig,
		SNMPConfig:             r.SNMPConfig,
		Sensitivity:            1.0,
		DeviceVendor:           r.DeviceVendor,
		LearningState:          "",
		LearningBeginDatetime:  "",
		LearningFinishDatetime: "",
		IsLearning:             false,
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

// NewDevices creates and returns a new Device object (Version 2)
func (s *Service) NewDevices(w http.ResponseWriter, r *http.Request) {

	reqs, ctx, err := decodeRequest[[]deviceRequest](r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	ipCount := make(map[string]int)
	for _, req := range reqs {
		ipCount[req.DeviceIP]++
	}

	failedDevices := make(chan createDeviceError, len(ipCount))
	uniqueReqs := []deviceRequest{}

	for i, req := range reqs {
		if ipCount[req.DeviceIP] > 1 {
			failedDevices <- createDeviceError{
				Index:        i,
				DeviceIP:     req.DeviceIP,
				ErrorMessage: "duplicate IP in request",
			}
		} else {
			uniqueReqs = append(uniqueReqs, req)
		}
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, cloudhub.WorkerLimit)
	for i, req := range uniqueReqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, req deviceRequest) {
			defer wg.Done()
			defer func() { <-sem }()
			_, err := s.processDevice(ctx, req, allDevices)
			if err != nil {
				failedDevices <- createDeviceError{
					Index:        i,
					DeviceIP:     req.DeviceIP,
					ErrorMessage: err.Error(),
				}
			}
		}(ctx, i, req)
	}

	go func() {
		wg.Wait()
		close(failedDevices)
	}()

	var failedDeviceList []createDeviceError
	for err := range failedDevices {
		failedDeviceList = append(failedDeviceList, err)
	}

	response := map[string]interface{}{
		"failed_devices": failedDeviceList,
	}
	if len(failedDeviceList) > 0 {
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

	res, err := newDeviceResponse(ctx, s, device)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// RemoveDevices deletes specified Devices
func (s *Service) RemoveDevices(w http.ResponseWriter, r *http.Request) {
	request, ctx, err := decodeRequest[deleteDevicesRequest](r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	failedDevices := make(map[string]string)
	devicesGroupByOrg := make(map[string][]string)
	deviceOrgMap := make(map[string]string)
	for _, deviceID := range request.DevicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			failedDevices[deviceID] = err.Error()
		} else {
			if device.IsCollectingCfgWritten {
				devicesGroupByOrg[device.Organization] = append(devicesGroupByOrg[device.Organization], device.ID)
				deviceOrgMap[deviceID] = device.Organization
			}
		}
	}

	activeCollectorKeys := make(map[string]bool)
	if len(devicesGroupByOrg) > 0 {
		var activeCollectorsErr error
		_, activeCollectorKeys, activeCollectorsErr = s.getCollectorServers()
		if activeCollectorsErr != nil {
			for _, ids := range devicesGroupByOrg {
				for _, id := range ids {
					if _, exists := failedDevices[id]; !exists {
						failedDevices[id] = "Failed to access active collector-server"
					}
				}
			}

			response := make(map[string]interface{})
			response["failed_devices"] = failedDevices
			encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
			return
		}
	}

	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, deviceOrgMap)
	for orgID, devicesIDs := range devicesGroupByOrg {
		org, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgID})
		if err != nil {
			for _, id := range devicesIDs {
				if _, exists := failedDevices[id]; !exists {
					failedDevices[id] = err.Error()
				}
			}
			continue
		}

		isActive := activeCollectorKeys[org.CollectorServer]
		if !isActive {
			for _, id := range devicesIDs {
				if _, exists := failedDevices[id]; !exists {
					failedDevices[id] = "collector server not active"
				}
			}
			continue
		}

		previousLearnedDevicesIDs := org.LearnedDevicesIDs
		previousCollectedDevicesIDs := org.CollectedDevicesIDs
		org.LearnedDevicesIDs = RemoveElements(previousLearnedDevicesIDs, devicesIDs)
		org.CollectedDevicesIDs = RemoveElements(previousCollectedDevicesIDs, devicesIDs)
		orgsToUpdate[org.ID] = *org

	}
	for _, org := range orgsToUpdate {
		statusCode, resp, err := s.manageLogstashConfig(ctx, &org)
		if err != nil {
			for _, devicesIDs := range devicesGroupByOrg {
				for _, id := range devicesIDs {
					if _, exists := failedDevices[id]; !exists {
						failedDevices[id] = err.Error()
					}
				}
			}
			continue
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			for _, devicesIDs := range devicesGroupByOrg {
				for _, id := range devicesIDs {
					if _, exists := failedDevices[id]; !exists {
						failedDevices[id] = string(resp)
					}
				}
			}
			continue
		}
		err = s.Store.NetworkDeviceOrg(ctx).Update(ctx, &org)
		msg := fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), org.ID)
		s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
		if err != nil {
			for _, devicesIDs := range devicesGroupByOrg {
				for _, id := range devicesIDs {
					if _, exists := failedDevices[id]; !exists {
						failedDevices[id] = err.Error()
					}
				}
			}
			continue
		}
	}

	workerLimit := cloudhub.WorkerLimit
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	var mu sync.Mutex

	for i, id := range request.DevicesIDs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, id string) {
			defer wg.Done()
			defer func() {
				<-sem
			}()

			mu.Lock()
			if _, exists := failedDevices[id]; exists {
				mu.Unlock()
				return
			}
			mu.Unlock()

			device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
			if err := s.OrganizationExists(ctx, device.Organization); err != nil {
				mu.Lock()
				if _, exists := failedDevices[id]; !exists {
					failedDevices[id] = err.Error()
				}
				mu.Unlock()
				return
			}
			if err != nil {
				mu.Lock()
				if _, exists := failedDevices[id]; !exists {
					failedDevices[id] = err.Error()
				}
				mu.Unlock()
				return
			}

			err = s.Store.NetworkDevice(ctx).Delete(ctx, device)
			if err != nil {
				mu.Lock()
				if _, exists := failedDevices[id]; !exists {
					failedDevices[id] = err.Error()
				}
				mu.Unlock()
				return
			}

			msg := fmt.Sprintf(MsgNetWorkDeviceDeleted.String(), id)
			s.logRegistration(ctx, "NetWorkDevice", msg)
		}(ctx, i, id)
	}

	wg.Wait()

	response := make(map[string]interface{})
	if len(failedDevices) > 0 {
		response["failed_devices"] = convertFailedDevicesToArray(failedDevices)
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
	} else {
		encodeJSON(w, http.StatusNoContent, response, s.Logger)
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

	if device.DeviceIP != *req.DeviceIP {
		allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}
		for _, device := range allDevices {
			if device.DeviceIP == *req.DeviceIP {
				message := fmt.Sprintf("duplicate IP in existing devices: %s", *req.DeviceIP)
				Error(w, http.StatusUnprocessableEntity, message, s.Logger)
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

	if req.SSHConfig != nil {
		if req.SSHConfig.UserID != "" {
			device.SSHConfig.UserID = req.SSHConfig.UserID
		}
		if req.SSHConfig.Password != "" {
			device.SSHConfig.Password = req.SSHConfig.Password
		}
		if req.SSHConfig.EnPassword != "" {
			device.SSHConfig.EnPassword = req.SSHConfig.EnPassword
		}
		if req.SSHConfig.Port != 0 {
			device.SSHConfig.Port = req.SSHConfig.Port
		}
	}
	if req.SNMPConfig != nil {
		if req.SNMPConfig.Community != "" {
			device.SNMPConfig.Community = req.SNMPConfig.Community
		}
		if req.SNMPConfig.Version != "" {
			device.SNMPConfig.Version = req.SNMPConfig.Version
		}
		if req.SNMPConfig.Port != 0 {
			device.SNMPConfig.Port = req.SNMPConfig.Port
		}
		if req.SNMPConfig.Protocol != "" {
			device.SNMPConfig.Protocol = req.SNMPConfig.Protocol
		}
	}
	if req.Sensitivity != nil {
		device.Sensitivity = *req.Sensitivity
	}
	if req.DeviceVendor != nil {
		device.DeviceVendor = *req.DeviceVendor
	}
	if req.IsLearning != nil {
		device.IsLearning = *req.IsLearning
	}

	device.IsCollectingCfgWritten = false

	if err := s.OrganizationExists(ctx, device.Organization); err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	if err := s.Store.NetworkDevice(ctx).Update(ctx, device); err != nil {
		msg := fmt.Sprintf("Error updating Device ID %s: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceModified.String(), device.ID)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	res, err := newDeviceResponse(ctx, s, device)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

type manageDeviceOrg struct {
	ID                     string `json:"device_id"`
	IsCollecting           bool   `json:"is_collecting"`
	IsCollectingCfgWritten bool   `json:"is_collecting_cfg_written"`
}

type manageLearningDeviceOrg struct {
	ID         string `json:"device_id"`
	IsLearning bool   `json:"is_learning"`
}

type deviceGroupByOrg map[string][]manageDeviceOrg
type learningDeviceByOrg map[string][]manageLearningDeviceOrg

type collectingFilteredDevices struct {
	devicesGroupByOrg deviceGroupByOrg
	failedDevices     map[string]string
	networkDevicesMap map[string]*cloudhub.NetworkDevice
	deviceOrgMap      map[string]string
}
type learnFilteredDevices struct {
	learningDevicesGroupByOrg learningDeviceByOrg
	failedDevices             map[string]string
	networkDevicesMap         map[string]*cloudhub.NetworkDevice
	deviceOrgMap              map[string]string
}

// MonitoringConfigManagement is LogStash Config Management
func (s *Service) MonitoringConfigManagement(w http.ResponseWriter, r *http.Request) {
	type requestData struct {
		CollectingDevices []manageDeviceOrg `json:"collecting_devices"`
	}

	request, ctx, err := decodeRequest[requestData](r)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	devicesData := getDevicesGroupByOrg(ctx, s, request.CollectingDevices)
	failedDevices := devicesData.failedDevices

	if len(devicesData.devicesGroupByOrg) < 1 {
		for _, device := range request.CollectingDevices {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			if networkDevice == nil {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = fmt.Sprintf("Not found Device ID %s", device.ID)
				}
				continue
			}
		}
		response := map[string]interface{}{
			"failed_devices": convertFailedDevicesToArray(failedDevices),
		}
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
		return
	}

	existingDevicesOrg, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	collectorKeys, activeCollectorKeys, err := s.getCollectorServers()
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	ratio := 0.5
	_, _, serverDeviceCount, orgToCollector := computeThreshold(existingDevicesOrg, devicesData.devicesGroupByOrg, ratio)

	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, devicesData.deviceOrgMap)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	// Assign devices to collectors and update org information
	for org, devices := range devicesData.devicesGroupByOrg {
		selectedServer := findLeastLoadedCollectorServer(
			org,
			collectorKeys,
			serverDeviceCount,
			orgToCollector,
		)
		orgToCollector[org] = selectedServer
		serverDeviceCount[selectedServer] += len(devices)
	}

	for org, devices := range devicesData.devicesGroupByOrg {
		collectorServer := orgToCollector[org]

		// Skip this organization if its collector server is not active
		if isActive := activeCollectorKeys[collectorServer]; !isActive {
			for _, device := range devices {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = "Failed to access active collector-server"
				}
			}
			continue
		}
		orgInfo, exists := orgsToUpdate[org]
		if !exists {
			existingDeviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
			if err != nil || existingDeviceOrg == nil {
				orgInfo = cloudhub.NetworkDeviceOrg{
					ID:                  org,
					CollectedDevicesIDs: []string{},
					LearnedDevicesIDs:   []string{},
					CollectorServer:     collectorServer,
					LoadModule:          LoadModule,
					MLFunction:          MLFunction,
					DataDuration:        DataDuration,
				}
			} else {
				orgInfo = *existingDeviceOrg
			}
		}

		orgInfo.CollectorServer = collectorServer
		existingCollectingDeviceIDs := orgInfo.CollectedDevicesIDs
		for _, device := range devices {
			if device.IsCollecting || !device.IsCollectingCfgWritten {
				existingCollectingDeviceIDs = appendUnique(existingCollectingDeviceIDs, device.ID)
			} else {
				existingCollectingDeviceIDs = removeDeviceID(existingCollectingDeviceIDs, device.ID)
			}

		}
		orgInfo.CollectedDevicesIDs = existingCollectingDeviceIDs
		orgsToUpdate[org] = orgInfo

	}

	// Update the store only for successful orgInfos
	for org, orgInfo := range orgsToUpdate {

		statusCode, resp, err := s.manageLogstashConfig(ctx, &orgInfo)
		if err != nil {
			for _, device := range devicesData.devicesGroupByOrg[org] {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = err.Error()
				}
			}
			continue
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			for _, device := range devicesData.devicesGroupByOrg[org] {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = string(resp)
				}
			}
			continue
		}

		existOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
		if err != nil && existOrg == nil {
			s.Store.NetworkDeviceOrg(ctx).Add(ctx, &orgInfo)
		} else {
			s.Store.NetworkDeviceOrg(ctx).Update(ctx, &orgInfo)
		}
		for _, device := range devicesData.devicesGroupByOrg[org] {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			networkDevice.IsCollectingCfgWritten = true

			err := s.Store.NetworkDevice(ctx).Update(ctx, networkDevice)
			if err != nil {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = err.Error()
				}
			}
		}
	}

	response := map[string]interface{}{
		"failed_devices": convertFailedDevicesToArray(failedDevices),
	}
	encodeJSON(w, http.StatusCreated, response, s.Logger)
}

// LearningDeviceManagement is Learning Device. Indicates whether to create a learning model
func (s *Service) LearningDeviceManagement(w http.ResponseWriter, r *http.Request) {
	type requestData struct {
		IsLearningDevices []manageLearningDeviceOrg `json:"learning_devices"`
	}

	request, ctx, err := decodeRequest[requestData](r)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	devicesData := getLearnedDevicesGroupByOrg(ctx, s, request.IsLearningDevices)
	failedDevices := devicesData.failedDevices
	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, devicesData.deviceOrgMap)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	for org, devices := range devicesData.learningDevicesGroupByOrg {
		orgInfo, exists := orgsToUpdate[org]
		if !exists {
			existingDeviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
			if err != nil || existingDeviceOrg == nil {
				orgInfo = cloudhub.NetworkDeviceOrg{
					ID:                  org,
					CollectedDevicesIDs: []string{},
					LearnedDevicesIDs:   []string{},
					CollectorServer:     "",
					LoadModule:          LoadModule,
					MLFunction:          MLFunction,
					DataDuration:        DataDuration,
				}
			} else {
				orgInfo = *existingDeviceOrg
			}
		}

		existingLearningDeviceIDs := orgInfo.LearnedDevicesIDs
		for _, device := range devices {
			if device.IsLearning {
				existingLearningDeviceIDs = appendUnique(existingLearningDeviceIDs, device.ID)
			} else {
				existingLearningDeviceIDs = removeDeviceID(existingLearningDeviceIDs, device.ID)
			}
		}
		orgInfo.LearnedDevicesIDs = existingLearningDeviceIDs
		orgsToUpdate[org] = orgInfo
	}

	// Update the store only for successful orgInfos
	for org, orgInfo := range orgsToUpdate {
		existOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
		if err != nil && existOrg == nil {
			s.Store.NetworkDeviceOrg(ctx).Add(ctx, &orgInfo)
		} else {
			s.Store.NetworkDeviceOrg(ctx).Update(ctx, &orgInfo)
		}
		for _, device := range devicesData.learningDevicesGroupByOrg[org] {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			networkDevice.IsLearning = device.IsLearning
			if device.IsLearning && networkDevice.LearningState == "" {
				networkDevice.LearningState = Ready
			}
			err := s.Store.NetworkDevice(ctx).Update(ctx, networkDevice)
			if err != nil {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = err.Error()
				}
			}
		}
	}

	response := map[string]interface{}{
		"failed_devices": convertFailedDevicesToArray(failedDevices),
	}
	encodeJSON(w, http.StatusCreated, response, s.Logger)
}

func convertFailedDevicesToArray(failedDevices map[string]string) []deviceError {
	var result []deviceError
	for id, errMsg := range failedDevices {
		result = append(result, deviceError{DeviceID: id, ErrorMessage: errMsg})
	}
	return result
}

// removeDeviceIDsFromPreviousOrg removes device IDs from their previous organizations
func removeDeviceIDsFromPreviousOrg(ctx context.Context, s *Service, deviceOrgMap map[string]string) (map[string]cloudhub.NetworkDeviceOrg, error) {
	orgsToUpdate := make(map[string]cloudhub.NetworkDeviceOrg)
	allOrgs, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, orgInfo := range allOrgs {
		updated := false
		for _, deviceID := range orgInfo.LearnedDevicesIDs {
			if org, exists := deviceOrgMap[deviceID]; exists && org != orgInfo.ID {
				orgInfo.LearnedDevicesIDs = removeDeviceID(orgInfo.LearnedDevicesIDs, deviceID)
				updated = true
			}

		}
		for _, deviceID := range orgInfo.CollectedDevicesIDs {
			if org, exists := deviceOrgMap[deviceID]; exists && org != orgInfo.ID {
				orgInfo.CollectedDevicesIDs = removeDeviceID(orgInfo.CollectedDevicesIDs, deviceID)
				updated = true
			}
		}
		if updated {
			orgsToUpdate[orgInfo.ID] = orgInfo
		}

	}
	return orgsToUpdate, nil
}

func getDevicesGroupByOrg(ctx context.Context, s *Service, request []manageDeviceOrg) collectingFilteredDevices {
	failedDevices := make(map[string]string)
	devicesGroupByOrg := make(deviceGroupByOrg)
	networkDevicesMap := make(map[string]*cloudhub.NetworkDevice)
	deviceOrgMap := make(map[string]string)

	for _, reqDevice := range request {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &reqDevice.ID})
		if err != nil {
			failedDevices[reqDevice.ID] = err.Error()
		} else {
			networkDevicesMap[reqDevice.ID] = device
			deviceOrgMap[reqDevice.ID] = device.Organization
			devicesGroupByOrg[device.Organization] = append(devicesGroupByOrg[device.Organization], reqDevice)
		}
	}
	return collectingFilteredDevices{
		devicesGroupByOrg: devicesGroupByOrg,
		failedDevices:     failedDevices,
		networkDevicesMap: networkDevicesMap,
		deviceOrgMap:      deviceOrgMap,
	}
}

func getLearnedDevicesGroupByOrg(ctx context.Context, s *Service, request []manageLearningDeviceOrg) learnFilteredDevices {
	failedDevices := make(map[string]string)
	learningDevicesGroupByOrg := make(learningDeviceByOrg)
	networkDevicesMap := make(map[string]*cloudhub.NetworkDevice)
	deviceOrgMap := make(map[string]string)

	for _, reqDevice := range request {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &reqDevice.ID})
		if err != nil {
			failedDevices[reqDevice.ID] = err.Error()
		} else {
			learningDevicesGroupByOrg[device.Organization] = append(learningDevicesGroupByOrg[device.Organization], reqDevice)
			networkDevicesMap[reqDevice.ID] = device
			deviceOrgMap[reqDevice.ID] = device.Organization
		}
	}
	return learnFilteredDevices{
		learningDevicesGroupByOrg: learningDevicesGroupByOrg,
		failedDevices:             failedDevices,
		networkDevicesMap:         networkDevicesMap,
		deviceOrgMap:              deviceOrgMap,
	}
}

func contains(devices []string, deviceID string) bool {
	for _, d := range devices {
		if d == deviceID {
			return true
		}
	}
	return false
}
func removeDeviceID(devices []string, deviceID string) []string {
	for i, id := range devices {
		if id == deviceID {
			return append(devices[:i], devices[i+1:]...)
		}
	}
	return devices
}

func appendUnique(devices []string, newDevice string) []string {
	for _, device := range devices {
		if device == newDevice {
			return devices
		}
	}
	return append(devices, newDevice)
}

func findLeastLoadedCollectorServer(
	org string,
	collectorServerKeys []string,
	serverDeviceCount map[string]int,
	orgToCollector map[string]string,
) string {
	var selectedServer string
	minDevices := int(^uint(0) >> 1)

	for _, server := range collectorServerKeys {
		if _, exists := serverDeviceCount[server]; !exists {
			selectedServer = server
			break
		}
	}

	currentServer, exists := orgToCollector[org]
	if exists && selectedServer != currentServer {
		selectedServer = currentServer
	}

	if selectedServer == "" {
		for _, server := range collectorServerKeys {
			if serverDeviceCount[server] < minDevices {
				minDevices = serverDeviceCount[server]
				selectedServer = server
			}
		}
	}

	return selectedServer
}

func isZeroOfUnderlyingType(x interface{}) bool {
	return x == reflect.Zero(reflect.TypeOf(x)).Interface()
}

func updateSSHConfig(target, source *cloudhub.SSHConfig) {
	if source != nil {
		if !isZeroOfUnderlyingType(source.UserID) {
			target.UserID = source.UserID
		}
		if !isZeroOfUnderlyingType(source.Password) {
			target.Password = source.Password
		}
		if !isZeroOfUnderlyingType(source.EnPassword) {
			target.EnPassword = source.EnPassword
		}
		if !isZeroOfUnderlyingType(source.Port) {
			target.Port = source.Port
		}
	}
}

func updateSNMPConfig(target, source *cloudhub.SNMPConfig) {
	if source != nil {
		if !isZeroOfUnderlyingType(source.Community) {
			target.Community = source.Community
		}
		if !isZeroOfUnderlyingType(source.Version) {
			target.Version = source.Version
		}
		if !isZeroOfUnderlyingType(source.Port) {
			target.Port = source.Port
		}
		if !isZeroOfUnderlyingType(source.Protocol) {
			target.Protocol = source.Protocol
		}
	}
}

func (s *Service) getCollectorServers() ([]string, map[string]bool, error) {
	status, responseBody, err := s.GetWheelKeyAcceptedListAll()

	if err != nil {
		return nil, nil, err
	}

	if status != 200 {
		return nil, nil, fmt.Errorf("failed to retrieve keys, status code: %d", status)
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
		return nil, nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	var collectorKeys []string
	activeCollectorKeys := make(map[string]bool)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, minion := range response.Return[0].Data.Return.Minions {
		if strings.HasPrefix(minion, "ch-collector") {
			collectorKeys = append(collectorKeys, minion)
			wg.Add(1)
			go func(minion string) {

				defer wg.Done()
				if statusCode, resp, err := s.IsActiveMinionPingTest(minion); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
					mu.Lock()
					activeCollectorKeys[minion] = false
					mu.Unlock()
				} else if resp != nil {
					r := &struct {
						Return []map[string]bool `json:"return"`
					}{}

					if err := json.Unmarshal(resp, r); err != nil || !r.Return[0][minion] {
						mu.Lock()
						activeCollectorKeys[minion] = false
						mu.Unlock()
						return
					}
					mu.Lock()
					activeCollectorKeys[minion] = true
					mu.Unlock()

				}
			}(minion)
		}
	}

	wg.Wait()

	return collectorKeys, activeCollectorKeys, nil
}

func computeThreshold(existingDevicesOrg []cloudhub.NetworkDeviceOrg, groupedDevices deviceGroupByOrg, ratio float64) (int, map[string]int, map[string]int, map[string]string) {
	totalDevices := 0
	orgDeviceCount := make(map[string]int)
	serverDeviceCount := make(map[string]int)
	orgToCollector := make(map[string]string)
	existingDeviceIDs := make(map[string]string)

	for _, org := range existingDevicesOrg {
		count := len(org.CollectedDevicesIDs)
		totalDevices += count
		orgDeviceCount[org.ID] = count
		serverDeviceCount[org.CollectorServer] += count
		orgToCollector[org.ID] = org.CollectorServer
		for _, deviceID := range org.CollectedDevicesIDs {
			existingDeviceIDs[deviceID] = org.ID
		}
	}

	for org, devices := range groupedDevices {
		for _, device := range devices {
			if existingOrg, exists := existingDeviceIDs[device.ID]; exists {
				if existingOrg != org {
					orgDeviceCount[existingOrg]--
					orgDeviceCount[org]++
				}
			} else {
				totalDevices++
				orgDeviceCount[org]++
				existingDeviceIDs[device.ID] = org
			}
		}
	}

	threshold := int(float64(totalDevices) * ratio)
	return threshold, orgDeviceCount, serverDeviceCount, orgToCollector
}

func (s *Service) manageLogstashConfig(ctx context.Context, devOrg *cloudhub.NetworkDeviceOrg) (int, []byte, error) {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &devOrg.ID})
	devicesIDs := devOrg.CollectedDevicesIDs
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	aiConfig := s.InternalENV.AIConfig
	dockerPath := aiConfig.DockerPath
	dockerCmd := aiConfig.DockerCmd
	dirPath := aiConfig.LogstashPath
	fileName := fmt.Sprintf("%s_snmp_nx.rb", org.Name)
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
		return http.StatusInternalServerError, nil, fmt.Errorf("Unknown error occurred at DirectoryExists() func")
	}

	// If there are no devices to collect data from, remove the configuration file
	if len(devicesIDs) < 1 {
		statusCode, resp, err = s.RemoveFileWithLocalClient(filePath, devOrg.CollectorServer)
		if err != nil {
			return http.StatusInternalServerError, nil, err
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			return statusCode, resp, err
		}
		return statusCode, resp, nil
	}

	var hostEntries []string
	var deviceFilters []string
	for _, deviceID := range devicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			continue
		}
		host := fmt.Sprintf("%s:%s/%d", strings.ToLower(device.SNMPConfig.Protocol), device.DeviceIP, device.SNMPConfig.Port)
		hostEntry := fmt.Sprintf("{host => \"%s\" community => \"%s\" version => \"%s\" timeout => %d}",
			host, device.SNMPConfig.Community, device.SNMPConfig.Version, 50000)
		hostEntries = append(hostEntries, hostEntry)

		filter := fmt.Sprintf(`
		if [host] == "%s" {
			mutate {
				add_field => {
					"dev_id" => %s
				}
			}
		}`, device.DeviceIP, device.ID)
		deviceFilters = append(deviceFilters, filter)
	}

	hosts := strings.Join(hostEntries, ",\n")
	filters := strings.Join(deviceFilters, "\n")

	influxDBs, err := GetServerInfluxDBs(ctx, s)
	if err != nil || len(influxDBs) < 1 {
		return http.StatusInternalServerError, nil, err
	}

	tmplParams := cloudhub.TemplateParams{
		"OrgName":        org.Name,
		"DeviceHosts":    hosts,
		"DeviceFilter":   filters,
		"InfluxOrigin":   influxDBs[0].Origin,
		"InfluxPort":     influxDBs[0].Port,
		"InfluxUsername": influxDBs[0].Username,
		"InfluxPassword": influxDBs[0].Password,
	}

	tm := s.InternalENV.TemplatesManager
	t, err := tm.Get(ctx, string(LogstashTemplateField))
	templateService := &TemplateService{}
	configString, err := templateService.LoadTemplate(cloudhub.LoadTemplateConfig{
		Field:          LogstashTemplateField,
		TemplateString: t.Template,
	}, tmplParams)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}

	statusCode, resp, err = s.CreateFileWithLocalClient(filePath, []string{configString}, devOrg.CollectorServer)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}

	if statusCode, resp, err := s.DockerRestart(dockerPath, devOrg.CollectorServer, dockerCmd); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, nil, err
	} else if resp != nil {
		r := &struct {
			Return []map[string]string `json:"return"`
		}{}
		if err := json.Unmarshal(resp, r); err != nil {
			return http.StatusInternalServerError, nil, err
		}
	} else {
		return http.StatusInternalServerError, nil, fmt.Errorf("Unknown error occurred at DirectoryExists() func")
	}

	// Log the successful creation of the config
	msg := fmt.Sprintf(MsgNetWorkDeviceConfCreated.String(), org.ID)
	s.logRegistration(ctx, "NetWorkDeviceConf", msg)
	return http.StatusOK, nil, err
}

// RemoveElements removes elements from the origin slice that are present in the delete slice.
func RemoveElements[T comparable](origin []T, delete []T) []T {
	deleteMap := make(map[T]bool)
	for _, item := range delete {
		deleteMap[item] = true
	}

	var result []T
	for _, item := range origin {
		if !deleteMap[item] {
			result = append(result, item)
		}
	}

	return result
}
