package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"strconv"
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
	DevicesIDs []uint64 `json:"devices_ids"`
}

type deviceResponse struct {
	ID                     uint64              `json:"id"`
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
	DeviceID     uint64 `json:"device_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}
type deviceError struct {
	DeviceID     uint64 `json:"device_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}

type deviceMapByOrg struct {
	SavedCollectorDevices []uint64
	AllDevices            []uint64
}

// State type definition
type State string

// Define constants for the learn states
const (
	Ready        string = "ready"
	MlInProgress string = "ML in Progress"
	DlInProgress string = "DL in Progress"
	MlComplete   string = "ML Complete"
	DlComplete   string = "DL Complete"
	MlFail       string = "ML Fail"
	DlFail       string = "DL Fail"
)

func newDeviceResponse(ctx context.Context, s *Service, device *cloudhub.NetworkDevice) (*deviceResponse, error) {
	deviceOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &device.Organization})
	MLFunction := ""
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

type devicesResponse struct {
	Devices       []*deviceResponse   `json:"devices"`
	FailedDevices []createDeviceError `json:"failed_devices"`
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

// NewDevices creates and returns a new Device object
func (s *Service) NewDevices(w http.ResponseWriter, r *http.Request) {

	reqs, ctx, err := decodeRequest[[]deviceRequest](r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)

	if err != nil {
		http.Error(w, "Failed to get existing devices", http.StatusInternalServerError)
		return
	}

	ipCount := make(map[string]int)
	for _, req := range reqs {
		ipCount[req.DeviceIP]++
	}

	failedDevices := []createDeviceError{}
	uniqueReqs := []deviceRequest{}

	for i, req := range reqs {
		if ipCount[req.DeviceIP] > 1 {
			failedDevices = append(failedDevices, createDeviceError{
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
					failedDevices = append(failedDevices, createDeviceError{
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
				failedDevices = append(failedDevices, createDeviceError{
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

	request, ctx, err := decodeRequest[deleteDevicesRequest](r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	failedDevices := []deviceError{}
	devicesGroupByOrg := make(map[string][]uint64)

	for _, deviceID := range request.DevicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			failedDevices = append(failedDevices, deviceError{DeviceID: deviceID, ErrorMessage: err.Error()})
		} else {
			if device.IsCollectingCfgWritten {
				devicesGroupByOrg[device.Organization] = append(devicesGroupByOrg[device.Organization], device.ID)
			}
		}
	}
	activeCollectorKeys := make(map[string]bool)
	if len(devicesGroupByOrg) > 1 {
		var activeCollectorsErr error
		_, activeCollectorKeys, activeCollectorsErr = s.getCollectorServers()
		if activeCollectorsErr != nil {
			http.Error(w, "Failed to access active collector-server", http.StatusInternalServerError)
			return
		}
	}

	previousLearnedDevicesIDs := []uint64{}
	previousCollectedDevicesIDs := []uint64{}
	for orgID, devicesIDs := range devicesGroupByOrg {

		org, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgID})
		if err != nil {
			http.Error(w, "Failed to get existing devices", http.StatusInternalServerError)
			return
		}

		isActive := activeCollectorKeys[org.CollectorServer]
		if !isActive {
			for _, v := range devicesIDs {
				failedDevices = append(failedDevices, deviceError{DeviceID: v, ErrorMessage: "collector server not active"})
			}
			continue
		}

		previousLearnedDevicesIDs = org.LearnedDevicesIDs
		previousCollectedDevicesIDs = org.CollectedDevicesIDs

		org.LearnedDevicesIDs = RemoveElements(previousLearnedDevicesIDs, devicesIDs)
		org.CollectedDevicesIDs = RemoveElements(previousCollectedDevicesIDs, devicesIDs)

		statusCode, resp, err := s.manageLogstashConfig(ctx, org, &failedDevices)

		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			return
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			return
		}

		err = s.Store.NetworkDeviceOrg(ctx).Update(ctx, org)
		msg := fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), org.ID)
		s.logRegistration(ctx, "NetWorkDeviceOrg", msg)

		if err != nil {
			for _, v := range devicesIDs {
				failedDevices = append(failedDevices, deviceError{DeviceID: v, ErrorMessage: "Error updating NetworkDeviceOrg:"})
			}
			Error(w, statusCode, string("Error updating NetworkDeviceOrg:"), s.Logger)
			return
		}

	}

	workerLimit := 10
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup

	var mu sync.Mutex

	for i, id := range request.DevicesIDs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, i int, id uint64) {
			defer wg.Done()
			defer func() {
				if rec := recover(); rec != nil {
					s.Logger.Error("Recovered from panic: %v", rec)
					mu.Lock()
					failedDevices = append(failedDevices, deviceError{
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
	if req.IsCollectingCfgWritten != nil {
		device.IsCollectingCfgWritten = *req.IsCollectingCfgWritten
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

type manageDeviceOrg struct {
	ID                     uint64 `json:"device_id"`
	IsLearning             bool   `json:"is_learning"`
	IsCollectingCfgWritten bool   `json:"is_collecting_cfg_written"`
}

type deviceGroupByOrg map[string][]manageDeviceOrg

type filteredDevices struct {
	devicesGroupByOrg         deviceGroupByOrg
	learningDevicesGroupByOrg deviceGroupByOrg
	failedDevices             []deviceError
	previousOrgMap            map[uint64]string
	networkDevicesMap         map[uint64]*cloudhub.NetworkDevice
}

//MonitoringConfigManagement is LogStash Config Management
func (s *Service) MonitoringConfigManagement(w http.ResponseWriter, r *http.Request) {
	type requestData struct {
		CollectingDevices []manageDeviceOrg `json:"collecting_devices"`
	}

	request, ctx, err := decodeRequest[requestData](r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	devicesData := getDevicesGroupByOrg(ctx, s, request.CollectingDevices)
	failedDevices := devicesData.failedDevices
	if len(devicesData.devicesGroupByOrg) < 1 {
		for _, device := range request.CollectingDevices {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			networkDevice.IsLearning = device.IsLearning
			err := s.Store.NetworkDevice(ctx).Update(ctx, networkDevice)
			if err != nil {
				failedDevices = append(failedDevices, deviceError{DeviceID: device.ID, ErrorMessage: err.Error()})
			}
		}
		response := map[string]interface{}{
			"failed_devices": failedDevices,
		}
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
		return
	}

	existingDevicesOrg, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	collectorKeys, activeCollectorKeys, err := s.getCollectorServers()
	if err != nil {
		http.Error(w, "Failed to access active collector-server", http.StatusInternalServerError)
		return
	}

	ratio := 0.5
	threshold, orgDeviceCount, serverDeviceCount, orgToCollector, deviceOrgMap := computeThreshold(existingDevicesOrg, devicesData.devicesGroupByOrg, ratio)

	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, request.CollectingDevices, devicesData.previousOrgMap, deviceOrgMap)
	if err != nil {
		fmt.Println("Error removing device IDs from previous org:", err)
		return
	}

	// Assign devices to collectors and update org information
	for org, devices := range devicesData.devicesGroupByOrg {
		selectedServer := findLeastLoadedCollectorServer(
			org,
			orgDeviceCount,
			collectorKeys,
			threshold,
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
			continue
		}

		orgInfo, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
		if err != nil || orgInfo == nil {
			orgInfo = &cloudhub.NetworkDeviceOrg{
				ID:                  org,
				CollectedDevicesIDs: []uint64{},
				LearnedDevicesIDs:   []uint64{},
				CollectorServer:     collectorServer,
				LoadModule:          LoadModule,
				MLFunction:          MLFunction,
				PredictionMode:      PredictionMode,
				IsPredictionActive:  IsPredictionActive,
				DataDuration:        DataDuration,
				LearnCycle:          LearnCycle,
			}
		} else {
			orgInfo.CollectorServer = collectorServer
		}

		existingDeviceIDs := orgInfo.CollectedDevicesIDs
		for _, device := range devices {
			existingDeviceIDs = appendUnique(existingDeviceIDs, device.ID)
		}
		orgInfo.CollectedDevicesIDs = existingDeviceIDs

		existingLearningDeviceIDs := orgInfo.LearnedDevicesIDs
		for _, device := range devicesData.learningDevicesGroupByOrg[org] {
			existingLearningDeviceIDs = appendUnique(existingLearningDeviceIDs, device.ID)
		}
		orgInfo.LearnedDevicesIDs = existingLearningDeviceIDs

		orgsToUpdate[org] = orgInfo

		statusCode, resp, err := s.manageLogstashConfig(ctx, orgInfo, &failedDevices)
		if err != nil {
			unknownErrorWithMessage(w, err, s.Logger)
			delete(orgsToUpdate, org)
			continue
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			Error(w, statusCode, string(resp), s.Logger)
			delete(orgsToUpdate, org)
			continue
		}
	}

	// Update the store only for successful orgInfos
	for org, orgInfo := range orgsToUpdate {
		s.Store.NetworkDeviceOrg(ctx).Update(ctx, orgInfo)
		for _, device := range devicesData.devicesGroupByOrg[org] {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			networkDevice.IsCollectingCfgWritten = true
			networkDevice.IsLearning = device.IsLearning
			err := s.Store.NetworkDevice(ctx).Update(ctx, networkDevice)
			if err != nil {
				failedDevices = append(failedDevices, deviceError{DeviceID: device.ID, ErrorMessage: err.Error()})
			}
		}

	}

	response := map[string]interface{}{
		"failed_devices": failedDevices,
	}
	encodeJSON(w, http.StatusCreated, response, s.Logger)
}

// removeDeviceIDsFromPreviousOrg removes device IDs from their previous organizations
func removeDeviceIDsFromPreviousOrg(ctx context.Context, s *Service, request []manageDeviceOrg, previousOrgMap, deviceOrgMap map[uint64]string) (map[string]*cloudhub.NetworkDeviceOrg, error) {
	orgsToUpdate := make(map[string]*cloudhub.NetworkDeviceOrg)

	for _, reqDevice := range request {
		previousOrg := previousOrgMap[reqDevice.ID]
		if previousOrg != "" && previousOrg != deviceOrgMap[reqDevice.ID] {
			orgInfo, exists := orgsToUpdate[previousOrg]
			if !exists {
				var err error
				orgInfo, err = s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &previousOrg})
				if err == nil && orgInfo != nil {
					orgsToUpdate[previousOrg] = orgInfo
				} else if err != nil {
					return nil, err
				}
			}
			if orgInfo != nil {
				orgInfo.CollectedDevicesIDs = removeDeviceID(orgInfo.CollectedDevicesIDs, reqDevice.ID)
				if reqDevice.IsLearning {
					orgInfo.LearnedDevicesIDs = removeDeviceID(orgInfo.LearnedDevicesIDs, reqDevice.ID)
				}
			}
		}
	}

	return orgsToUpdate, nil
}

func getDevicesGroupByOrg(ctx context.Context, s *Service, request []manageDeviceOrg) filteredDevices {
	failedDevices := []deviceError{}
	devicesGroupByOrg := make(deviceGroupByOrg)
	learningDevicesGroupByOrg := make(deviceGroupByOrg)
	previousOrgMap := make(map[uint64]string)
	networkDevicesMap := make(map[uint64]*cloudhub.NetworkDevice)

	for _, reqDevice := range request {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &reqDevice.ID})
		if err != nil {
			failedDevices = append(failedDevices, deviceError{DeviceID: reqDevice.ID, ErrorMessage: err.Error()})
		} else {
			if !reqDevice.IsCollectingCfgWritten {
				devicesGroupByOrg[device.Organization] = append(devicesGroupByOrg[device.Organization], reqDevice)
			}
			if reqDevice.IsLearning {
				learningDevicesGroupByOrg[device.Organization] = append(learningDevicesGroupByOrg[device.Organization], reqDevice)
			}
			previousOrgMap[reqDevice.ID] = device.Organization
			networkDevicesMap[reqDevice.ID] = device
		}
	}

	return filteredDevices{
		devicesGroupByOrg:         devicesGroupByOrg,
		learningDevicesGroupByOrg: learningDevicesGroupByOrg,
		failedDevices:             failedDevices,
		previousOrgMap:            previousOrgMap,
		networkDevicesMap:         networkDevicesMap,
	}
}

func contains(devices []uint64, deviceID uint64) bool {
	for _, d := range devices {
		if d == deviceID {
			return true
		}
	}
	return false
}
func removeDeviceID(devices []uint64, deviceID uint64) []uint64 {
	for i, id := range devices {
		if id == deviceID {
			return append(devices[:i], devices[i+1:]...)
		}
	}
	return devices
}

func appendUnique(devices []uint64, newDevice uint64) []uint64 {
	for _, device := range devices {
		if device == newDevice {
			return devices
		}
	}
	return append(devices, newDevice)
}

func findLeastLoadedCollectorServer(
	org string,
	orgDeviceCount map[string]int,
	collectorServerKeys []string,
	threshold int,
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

	if selectedServer == "" {
		for _, server := range collectorServerKeys {
			if serverDeviceCount[server] < minDevices {
				minDevices = serverDeviceCount[server]
				selectedServer = server
			}
		}
	}

	currentServer, exists := orgToCollector[org]
	if exists && selectedServer != currentServer {
		selectedServer = currentServer
		if orgDeviceCount[org] > threshold {
			//Todo improve distribution collector-server
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

func computeThreshold(existingDevicesOrg []cloudhub.NetworkDeviceOrg, groupedDevices deviceGroupByOrg, ratio float64) (int, map[string]int, map[string]int, map[string]string, map[uint64]string) {
	totalDevices := 0
	orgDeviceCount := make(map[string]int)
	serverDeviceCount := make(map[string]int)
	orgToCollector := make(map[string]string)
	existingDeviceIDs := make(map[uint64]string)
	deviceOrgMap := make(map[uint64]string)

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
			deviceOrgMap[device.ID] = org
		}
	}

	threshold := int(float64(totalDevices) * ratio)
	return threshold, orgDeviceCount, serverDeviceCount, orgToCollector, deviceOrgMap
}

func (s *Service) manageLogstashConfig(ctx context.Context, devOrg *cloudhub.NetworkDeviceOrg, failedDevices *[]deviceError) (int, []byte, error) {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &devOrg.ID})
	devicesIDs := devOrg.CollectedDevicesIDs
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
	// If there are no devices to collect data from, remove the configuration file
	if len(devicesIDs) < 1 {
		statusCode, resp, err = s.RemoveFileWithLocalClient(filePath, devOrg.CollectorServer)
		if err != nil {
			return http.StatusInternalServerError, nil, err
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			return statusCode, resp, err
		}
	}

	cannedFilePath := filepath.Join("../../", "canned", "template_logstash_gen.conf")
	content, err := os.ReadFile(cannedFilePath)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}
	configString := string(content)

	var hostEntries []string
	for _, deviceID := range devicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			continue
		}
		host := fmt.Sprintf("%s:%s/%d", device.SNMPConfig.Protocol, device.DeviceIP, device.SNMPConfig.Port)
		hostEntry := fmt.Sprintf("{host => \"%s\" community => \"%s\" version => \"%s\" retries => %d timeout => %d}",
			host, device.SNMPConfig.Community, device.SNMPConfig.Version, 1, 30000)
		hostEntries = append(hostEntries, hostEntry)
	}

	hosts := fmt.Sprintf("[%s]", strings.Join(hostEntries, ",\n"))
	orgName := org.Name

	replacer := strings.NewReplacer(
		"${org}", orgName,
		"${hosts}", hosts,
	)

	configString = replacer.Replace(configString)

	statusCode, resp, err = s.CreateFileWithLocalClient(filePath, []string{configString}, devOrg.CollectorServer)

	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}

	//Todo: Log...
	msg := fmt.Sprintf(MsgNetWorkDeviceConfCreated.String(), org.ID)
	s.logRegistration(ctx, "NetWorkDeviceConf", msg)
	return http.StatusOK, nil, err
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
