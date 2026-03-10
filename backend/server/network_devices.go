package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"crypto/sha256"
	"encoding/hex"
	"sort"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type createDeviceRequest struct {
	Organization string              `json:"organization"`
	DeviceIP     string              `json:"device_ip"`
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
	DeviceVendor           *string              `json:"device_vendor,omitempty"`
	IsLearning             *bool                `json:"is_learning,omitempty"`
	Sensitivity            *float32             `json:"sensitivity,omitempty"`
}

type updateDeviceData struct {
	id string
	updateDeviceRequest
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
	LearningBeginDatetime  string              `json:"learning_update_datetime"`
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

// FailedDevice represents a structure for a failed device
type FailedDevice struct {
	ID  string
	Err error
}

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

// CollectorSelectionRatio determines the ratio criteria for selecting collectors and is intended for future use.
const (
	CollectorSelectionRatio float64 = 0.5
)

func newDeviceResponse(ctx context.Context, s *Service, device *cloudhub.NetworkDevice) (*deviceResponse, error) {
	deviceOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &device.Organization})
	MLFunction := MLFunctionLinearDescent
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
			Community:     device.SNMPConfig.Community,
			Version:       device.SNMPConfig.Version,
			Port:          device.SNMPConfig.Port,
			Protocol:      device.SNMPConfig.Protocol,
			SecurityName:  device.SNMPConfig.SecurityName,
			AuthProtocol:  device.SNMPConfig.AuthProtocol,
			AuthPass:      device.SNMPConfig.AuthPass,
			PrivProtocol:  device.SNMPConfig.PrivProtocol,
			PrivPass:      device.SNMPConfig.PrivPass,
			SecurityLevel: device.SNMPConfig.SecurityLevel,
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

func (r *createDeviceRequest) validCreate() error {
	switch {
	case r.Organization == "":
		return fmt.Errorf("organization required in device request body")
	}

	err := ValidateDeviceIP(r.DeviceIP)
	if err != nil {
		return fmt.Errorf("failed to validate device IP: %w", err)
	}
	return nil
}

func (r *updateDeviceRequest) validUpdate() error {
	return nil
}

func (r *createDeviceRequest) CreateDeviceFromRequest() (*cloudhub.NetworkDevice, error) {
	if r == nil {
		return nil, errors.New("createDeviceRequest is nil")
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

func (s *Service) createDevice(ctx context.Context, req createDeviceRequest) (*cloudhub.NetworkDevice, error) {
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

	if err := s.OrganizationExists(ctx, req.Organization); err != nil {
		return nil, err
	}

	device.ShardID = -1

	res, err := s.Store.NetworkDevice(ctx).Add(ctx, device)
	if err != nil {
		return nil, err
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceCreated.String(), res.ID)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	return res, nil
}

// NewDevice creates and returns a new Device object
func (s *Service) NewDevice(w http.ResponseWriter, r *http.Request) {

	reqs, ctx, err := decodeRequest[[]createDeviceRequest](r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	existingIPs := make(map[string]bool)
	for _, device := range allDevices {
		existingIPs[device.DeviceIP] = true
	}

	var succeededShards []int
	var failedDeviceList []createDeviceError
	for i, req := range reqs {
		if _, exists := existingIPs[req.DeviceIP]; exists {
			failedDeviceList = append(failedDeviceList, createDeviceError{
				Index:        i,
				DeviceIP:     req.DeviceIP,
				ErrorMessage: fmt.Sprintf("duplicate IP in existing devices: %s", req.DeviceIP),
			})
			continue
		}
		device, err := s.createDevice(ctx, req)
		if err != nil {
			failedDeviceList = append(failedDeviceList, createDeviceError{
				Index:        i,
				DeviceIP:     req.DeviceIP,
				ErrorMessage: err.Error(),
			})
		} else {
			succeededShards = append(succeededShards, device.ShardID)
		}
	}

	s.pushUniqueShards(ctx, succeededShards)

	response := map[string]interface{}{
		"failed_devices": failedDeviceList,
	}
	if len(failedDeviceList) > 0 {
		encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
	} else {
		encodeJSON(w, http.StatusCreated, response, s.Logger)
	}
}

// NewDevices creates and returns a new Device object (Version 2)
func (s *Service) NewDevices(w http.ResponseWriter, r *http.Request) {

	reqs, ctx, err := decodeRequest[[]createDeviceRequest](r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	allDevices, err := s.Store.NetworkDevice(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	var failedDeviceList []createDeviceError
	existingIPs := make(map[string]string)

	for _, device := range allDevices {
		existingIPs[device.DeviceIP] = device.ID
	}

	var succeededShards []int
	for i, req := range reqs {
		currentReq := req
		if id, exists := existingIPs[currentReq.DeviceIP]; exists {
			dev, err := s.UpdateDevice(ctx, &updateDeviceData{
				id: id,
				updateDeviceRequest: updateDeviceRequest{
					Organization: &currentReq.Organization,
					DeviceIP:     &currentReq.DeviceIP,
					Hostname:     &currentReq.Hostname,
					DeviceType:   &currentReq.DeviceType,
					DeviceOS:     &currentReq.DeviceOS,
					SSHConfig:    &currentReq.SSHConfig,
					SNMPConfig:   &currentReq.SNMPConfig,
				},
			})
			if err != nil {
				failedDeviceList = append(failedDeviceList, createDeviceError{
					Index:        i,
					DeviceIP:     currentReq.DeviceIP,
					ErrorMessage: err.Error(),
				})
			} else {
				succeededShards = append(succeededShards, dev.ShardID)
			}
		} else {
			dev, err := s.createDevice(ctx, currentReq)
			if err != nil {
				failedDeviceList = append(failedDeviceList, createDeviceError{
					Index:        i,
					DeviceIP:     currentReq.DeviceIP,
					ErrorMessage: err.Error(),
				})
			} else {
				succeededShards = append(succeededShards, dev.ShardID)
			}
		}
	}

	s.pushUniqueShards(ctx, succeededShards)

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
	isSuperAdmin := hasSuperAdminContext(ctx)
	currentOrg, ok := hasOrganizationContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError, string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}
	if !(isSuperAdmin && currentOrg == cloudhub.DefaultOrgID) {
		devicesByOrg := devices[:0]
		for _, d := range devices {
			if d.Organization == currentOrg {
				devicesByOrg = append(devicesByOrg, d)
			}
		}
		res := newDevicesResponse(ctx, s, devicesByOrg)
		encodeJSON(w, http.StatusOK, res, s.Logger)
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
	restartCollectorServers := map[string]string{}

	for _, deviceID := range request.DevicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			addFailedDevice(failedDevices, deviceID, err)
		}
		devicesGroupByOrg[device.Organization] = append(devicesGroupByOrg[device.Organization], device.ID)
		deviceOrgMap[deviceID] = device.Organization
	}

	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, deviceOrgMap)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	for orgID, devicesIDs := range devicesGroupByOrg {
		org, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgID})
		if org != nil {
			// Verify if the collector server is available.
			// This is a no-op on K8s but performs a Salt-ping check on Baremetal.
			if err := s.InternalENV.Platform.VerifyCollectorReady(ctx, org.CollectorServer); err != nil {
				for _, id := range devicesIDs {
					addFailedDevice(failedDevices, id, err)
				}
				response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			}

			previousLearnedDevicesIDs := org.LearnedDevicesIDs
			previousCollectedDevicesIDs := org.CollectedDevicesIDs
			org.LearnedDevicesIDs = RemoveElements(previousLearnedDevicesIDs, devicesIDs)
			org.CollectedDevicesIDs = RemoveElements(previousCollectedDevicesIDs, devicesIDs)
			orgsToUpdate[org.ID] = *org
		}

	}

	for _, org := range orgsToUpdate {
		currentOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org.ID})
		if currentOrg != nil && !reflect.DeepEqual(org.CollectedDevicesIDs, currentOrg.CollectedDevicesIDs) {
			statusCode, resp, err := s.manageLogstashConfig(ctx, &org)
			if err != nil {
				for _, id := range devicesGroupByOrg[org.ID] {
					addFailedDevice(failedDevices, id, err)
				}
				response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				for _, id := range devicesGroupByOrg[org.ID] {
					addFailedDevice(failedDevices, id, fmt.Errorf(string(resp)))
				}
				response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			}
			if _, exists := restartCollectorServers[org.CollectorServer]; !exists {
				restartCollectorServers[org.CollectorServer] = org.CollectorServer
				if err := s.InternalENV.Platform.RestartCollector(ctx, org.CollectorServer); err != nil {
					for _, id := range devicesGroupByOrg[org.ID] {
						addFailedDevice(failedDevices, id, err)
					}
					response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
					encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
					return
				}
			}
		}
		if currentOrg != nil {
			err = s.Store.NetworkDeviceOrg(ctx).Update(ctx, &org)
			if err != nil {
				for _, id := range devicesGroupByOrg[org.ID] {
					addFailedDevice(failedDevices, id, err)
				}
				response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			}
			msg := fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), org.ID)
			s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
		}
	}

	var succeededShards []int
	for _, id := range request.DevicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
		if err != nil {
			addFailedDevice(failedDevices, id, err)
			response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
			encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
			return
		}
		if err := s.OrganizationExists(ctx, device.Organization); err != nil {
			addFailedDevice(failedDevices, id, err)
			response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
			encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
			return
		}
		serverCtx := serverContext(ctx)
		MLRst, _ := s.Store.MLNxRst(serverCtx).Get(serverCtx, cloudhub.MLNxRstQuery{ID: &device.DeviceIP})
		if MLRst != nil {
			err = s.Store.MLNxRst(serverCtx).Delete(serverCtx, MLRst)
			if err != nil {
				addFailedDevice(failedDevices, id, err)
				response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			}
		}
		DLRst, _ := s.Store.DLNxRst(serverCtx).Get(serverCtx, cloudhub.DLNxRstQuery{ID: &device.DeviceIP})
		if DLRst != nil {
			err = s.Store.DLNxRst(serverCtx).Delete(serverCtx, DLRst)
			if err != nil {
				addFailedDevice(failedDevices, id, err)
				response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			}
		}
		err = s.Store.DLNxRstStg(serverCtx).Delete(serverCtx, cloudhub.DLNxRstStgQuery{ID: &device.DeviceIP})
		if err != nil {
			addFailedDevice(failedDevices, id, err)
			response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
			encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
			return
		}
		err = s.Store.NetworkDevice(ctx).Delete(ctx, device)
		if err != nil {
			addFailedDevice(failedDevices, id, fmt.Errorf("failed to delete device from store: %w", err))
			response := map[string]interface{}{"failed_devices": convertFailedDevicesToArray(failedDevices)}
			encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
			return
		}
		msg := fmt.Sprintf(MsgNetWorkDeviceDeleted.String(), id)
		s.logRegistration(ctx, "NetWorkDevice", msg)
		succeededShards = append(succeededShards, device.ShardID)
	}

	s.pushUniqueShards(ctx, succeededShards)

	w.WriteHeader(http.StatusNoContent)
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
	updateData := updateDeviceData{
		id:                  id,
		updateDeviceRequest: req,
	}
	device, err := s.UpdateDevice(ctx, &updateData)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	s.pushUniqueShards(ctx, []int{device.ShardID})

	res, err := newDeviceResponse(ctx, s, device)
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateDevice updates the specified NetworkDevice with the given request data.
func (s *Service) UpdateDevice(ctx context.Context, req *updateDeviceData) (*cloudhub.NetworkDevice, error) {
	device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &req.id})
	if err != nil {
		return nil, fmt.Errorf("device not found: %v", err)
	}

	originalOrgID := device.Organization
	isModified := false
	if req.DeviceIP != nil && device.DeviceIP != *req.DeviceIP {
		device.DeviceIP = *req.DeviceIP
		isModified = true
	}
	if req.Organization != nil && device.Organization != *req.Organization {
		device.Organization = *req.Organization
		isModified = true
	}
	if req.Hostname != nil && device.Hostname != *req.Hostname {
		device.Hostname = *req.Hostname
		isModified = true
	}
	if req.DeviceType != nil && device.DeviceType != *req.DeviceType {
		device.DeviceType = *req.DeviceType
		isModified = true
	}
	if req.DeviceCategory != nil && device.DeviceCategory != *req.DeviceCategory {
		device.DeviceCategory = *req.DeviceCategory
		isModified = true
	}
	if req.DeviceOS != nil && device.DeviceOS != *req.DeviceOS {
		device.DeviceOS = *req.DeviceOS
		isModified = true
	}
	if req.SSHConfig != nil {
		if req.SSHConfig.UserID != "" && device.SSHConfig.UserID != req.SSHConfig.UserID {
			device.SSHConfig.UserID = req.SSHConfig.UserID
		}
		if req.SSHConfig.Password != "" && device.SSHConfig.Password != req.SSHConfig.Password {
			device.SSHConfig.Password = req.SSHConfig.Password
		}
		if req.SSHConfig.EnPassword != "" && device.SSHConfig.EnPassword != req.SSHConfig.EnPassword {
			device.SSHConfig.EnPassword = req.SSHConfig.EnPassword
		}
		if req.SSHConfig.Port != 0 && device.SSHConfig.Port != req.SSHConfig.Port {
			device.SSHConfig.Port = req.SSHConfig.Port
		}
	}
	if req.SNMPConfig != nil {
		if device.SNMPConfig.Community != req.SNMPConfig.Community {
			device.SNMPConfig.Community = req.SNMPConfig.Community
			isModified = true
		}
		if req.SNMPConfig.Version != "" && device.SNMPConfig.Version != req.SNMPConfig.Version {
			device.SNMPConfig.Version = req.SNMPConfig.Version
			isModified = true
		}
		if req.SNMPConfig.Port != 0 && device.SNMPConfig.Port != req.SNMPConfig.Port {
			device.SNMPConfig.Port = req.SNMPConfig.Port
			isModified = true
		}
		if req.SNMPConfig.Protocol != "" && device.SNMPConfig.Protocol != req.SNMPConfig.Protocol {
			device.SNMPConfig.Protocol = req.SNMPConfig.Protocol
			isModified = true
		}
		if device.SNMPConfig.SecurityName != req.SNMPConfig.SecurityName {
			device.SNMPConfig.SecurityName = req.SNMPConfig.SecurityName
			isModified = true
		}
		if device.SNMPConfig.AuthProtocol != req.SNMPConfig.AuthProtocol {
			device.SNMPConfig.AuthProtocol = req.SNMPConfig.AuthProtocol
			isModified = true
		}
		if device.SNMPConfig.AuthPass != req.SNMPConfig.AuthPass {
			device.SNMPConfig.AuthPass = req.SNMPConfig.AuthPass
			isModified = true
		}
		if device.SNMPConfig.PrivProtocol != req.SNMPConfig.PrivProtocol {
			device.SNMPConfig.PrivProtocol = req.SNMPConfig.PrivProtocol
			isModified = true
		}
		if device.SNMPConfig.PrivPass != req.SNMPConfig.PrivPass {
			device.SNMPConfig.PrivPass = req.SNMPConfig.PrivPass
			isModified = true
		}
		if device.SNMPConfig.SecurityLevel != req.SNMPConfig.SecurityLevel {
			device.SNMPConfig.SecurityLevel = req.SNMPConfig.SecurityLevel
			isModified = true
		}
	}
	if req.Sensitivity != nil && device.Sensitivity != *req.Sensitivity {
		device.Sensitivity = *req.Sensitivity
	}
	if req.DeviceVendor != nil && device.DeviceVendor != *req.DeviceVendor {
		device.DeviceVendor = *req.DeviceVendor
		isModified = true
	}
	if req.IsLearning != nil && device.IsLearning != *req.IsLearning {
		device.IsLearning = *req.IsLearning
	}
	if req.IsCollectingCfgWritten != nil && device.IsCollectingCfgWritten != *req.IsCollectingCfgWritten {
		device.IsCollectingCfgWritten = *req.IsCollectingCfgWritten
	}
	if isModified {
		device.IsCollectingCfgWritten = false

		devOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &originalOrgID})
		if devOrg != nil {
			for _, id := range devOrg.CollectedDevicesIDs {
				if id == device.ID {
					return nil, fmt.Errorf("device is already being collected. Stop collecting before updating")
				}
			}
			for _, id := range devOrg.LearnedDevicesIDs {
				if id == device.ID {
					return nil, fmt.Errorf("device is already being learned. Stop learning before updating")
				}
			}
		}
	}
	if err := s.OrganizationExists(ctx, device.Organization); err != nil {
		return nil, fmt.Errorf("organization does not exist: %v", err)
	}
	if err := s.Store.NetworkDevice(ctx).Update(ctx, device); err != nil {
		return nil, fmt.Errorf("failed to update device: %v", err)
	}

	return device, nil
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
	restartCollectorServers := map[string]string{}

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

	collectorKeys, _, err := s.InternalENV.Platform.GetActiveCollectors(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}
	totalShards := s.InternalENV.Platform.GetTotalShards(ctx)

	_, _, serverDeviceCount, orgToCollector := computeThreshold(existingDevicesOrg, devicesData.devicesGroupByOrg, CollectorSelectionRatio)

	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, devicesData.deviceOrgMap)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

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

		// Verify if the collector server is available.
		if err := s.InternalENV.Platform.VerifyCollectorReady(ctx, collectorServer); err != nil {
			for _, device := range devices {
				if _, exists := failedDevices[device.ID]; !exists {
					failedDevices[device.ID] = err.Error()
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
			if device.IsCollecting {
				existingCollectingDeviceIDs = appendUnique(existingCollectingDeviceIDs, device.ID)
				// Update ShardID when monitoring starts
				if nd, ok := devicesData.networkDevicesMap[device.ID]; ok {
					nd.ShardID = s.InternalENV.Platform.GetShardID(nd.ID, totalShards)
				}
			} else {
				existingCollectingDeviceIDs = removeDeviceID(existingCollectingDeviceIDs, device.ID)
			}
		}
		orgInfo.CollectedDevicesIDs = existingCollectingDeviceIDs
		orgsToUpdate[org] = orgInfo

	}

	succeededShardsMap := make(map[int]bool)
	// Update the store and handle config/restarts for each org
	for org, orgInfo := range orgsToUpdate {
		statusCode, resp, err := s.manageLogstashConfig(ctx, &orgInfo)
		if err != nil {
			for _, device := range devicesData.devicesGroupByOrg[org] {
				addFailedDevice(failedDevices, device.ID, err)
			}
			continue
		} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
			for _, device := range devicesData.devicesGroupByOrg[org] {
				addFailedDevice(failedDevices, device.ID, fmt.Errorf("%s", string(resp)))
			}
			continue
		}

		// Save unique collector servers to restartCollectorServers map (Handled by Platform interface internally)
		if orgInfo.CollectorServer != "" {
			if _, exists := restartCollectorServers[orgInfo.CollectorServer]; !exists {
				restartCollectorServers[orgInfo.CollectorServer] = orgInfo.CollectorServer
				if err := s.InternalENV.Platform.RestartCollector(ctx, orgInfo.CollectorServer); err != nil {
					for _, device := range devicesData.devicesGroupByOrg[org] {
						addFailedDevice(failedDevices, device.ID, err)
					}
					continue
				}
			}
		}

		// Update Org in store
		existOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
		if err != nil && existOrg == nil {
			s.Store.NetworkDeviceOrg(ctx).Add(ctx, &orgInfo)
		} else {
			s.Store.NetworkDeviceOrg(ctx).Update(ctx, &orgInfo)
		}

		// Update Devices and record succeeded shards
		for _, device := range devicesData.devicesGroupByOrg[org] {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			networkDevice.IsCollectingCfgWritten = true

			if err := s.Store.NetworkDevice(ctx).Update(ctx, networkDevice); err != nil {
				addFailedDevice(failedDevices, device.ID, err)
			} else {
				succeededShardsMap[networkDevice.ShardID] = true
			}
		}
	}

	// Notify Kafka for all succeeded shards
	s.pushUniqueShardsMap(ctx, succeededShardsMap)

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

	totalShards := s.InternalENV.Platform.GetTotalShards(ctx)
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
				// Update ShardID when learning starts
				if nd, ok := devicesData.networkDevicesMap[device.ID]; ok {
					nd.ShardID = s.InternalENV.Platform.GetShardID(nd.ID, totalShards)
				}
			} else {
				existingLearningDeviceIDs = removeDeviceID(existingLearningDeviceIDs, device.ID)
			}
		}
		orgInfo.LearnedDevicesIDs = existingLearningDeviceIDs
		orgsToUpdate[org] = orgInfo
	}

	succeededShardsMap := make(map[int]bool)
	for org, orgInfo := range orgsToUpdate {
		if err := s.Store.NetworkDeviceOrg(ctx).Update(ctx, &orgInfo); err != nil {
			s.Logger.WithField("org", org).Error("Failed to update org info")
			continue
		}

		// Save updated devices: apply request is_learning and ShardID, then persist
		for _, device := range devicesData.learningDevicesGroupByOrg[org] {
			if networkDevice, ok := devicesData.networkDevicesMap[device.ID]; ok {
				networkDevice.IsLearning = device.IsLearning
				if err := s.Store.NetworkDevice(ctx).Update(ctx, networkDevice); err != nil {
					addFailedDevice(failedDevices, device.ID, err)
					continue
				}

				if _, exists := failedDevices[device.ID]; !exists {
					succeededShardsMap[networkDevice.ShardID] = true
				}
			}
		}
	}
	s.pushUniqueShardsMap(ctx, succeededShardsMap)

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

func addFailedDevice(failedDevices map[string]string, id string, err error) {
	if _, exists := failedDevices[id]; !exists {
		failedDevices[id] = err.Error()
	}
}

// removeDeviceIDsFromPreviousOrg removes device IDs from their previous organizations
func removeDeviceIDsFromPreviousOrg(ctx context.Context, s *Service, deviceOrgMap map[string]string) (map[string]cloudhub.NetworkDeviceOrg, error) {
	orgsToUpdate := make(map[string]cloudhub.NetworkDeviceOrg)
	allOrgs, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)
	if err == nil {
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

	fileName := fmt.Sprintf("%s_snmp_nx.rb", org.Name)

	// If there are no devices to collect data from, remove the configuration file
	if len(devicesIDs) < 1 {
		if err = s.InternalENV.Platform.RemoveLogstashConfig(ctx, devOrg.CollectorServer, fileName); err != nil {
			return http.StatusInternalServerError, nil, err
		}
		return http.StatusOK, nil, nil
	}

	var hostEntriesV1AndV2 []string
	var deviceFilters []string
	filteredDevices := make(map[cloudhub.SNMPConfig]FilteredDeviceV3)
	for _, deviceID := range devicesIDs {
		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			continue
		}

		if device.SNMPConfig.Version == "v3" || device.SNMPConfig.Version == "3" {
			s.filterDeviceBySNMPConfigV3(*device, org.Name, &filteredDevices)
		} else {
			host := fmt.Sprintf("%s:%s/%d", strings.ToLower(device.SNMPConfig.Protocol), device.DeviceIP, device.SNMPConfig.Port)
			hostEntry := fmt.Sprintf("{host => \"%s\" community => \"%s\" version => \"%s\" timeout => %d}",
				host, device.SNMPConfig.Community, device.SNMPConfig.Version, 50000)
			hostEntriesV1AndV2 = append(hostEntriesV1AndV2, hostEntry)
		}

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

	snmpV1AndV2Hosts := strings.Join(hostEntriesV1AndV2, ",\n")
	filters := strings.Join(deviceFilters, "\n")
	influxDBs, err := GetServerInfluxDBs(ctx, s)
	if err != nil || len(influxDBs) < 1 {
		return http.StatusInternalServerError, nil, err
	}

	filteredDevicesArray := make([]FilteredDeviceV3, 0, len(filteredDevices))
	for _, fd := range filteredDevices {
		fd.HostEntries = strings.TrimSuffix(fd.HostEntries, "\n")
		filteredDevicesArray = append(filteredDevicesArray, fd)
	}
	tmplParams := []cloudhub.TemplateBlock{
		{Name: "comment", Params: cloudhub.TemplateParamsMap{}},
		{
			Name: "input",
			Params: cloudhub.TemplateParamsMap{
				"DeviceHostsV1AndV2": snmpV1AndV2Hosts,
				"OrgName":            org.Name,
			},
		},
		{
			Name: "snmp_v3_input",
			Params: cloudhub.TemplateParamsMap{
				"RefeatV3": filteredDevicesArray,
			},
		},
		{
			Name: "filter_ouput",
			Params: cloudhub.TemplateParamsMap{
				"OrgName":        org.Name,
				"DeviceFilter":   filters,
				"InfluxOrigin":   influxDBs[0].Origin,
				"InfluxPort":     influxDBs[0].Port,
				"InfluxUsername": influxDBs[0].Username,
				"InfluxPassword": influxDBs[0].Password,
			},
		},
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

	if err := s.InternalENV.Platform.DeployLogstashConfig(ctx, devOrg.CollectorServer, fileName, configString); err != nil {
		return http.StatusMultiStatus, []byte(err.Error()), err
	}

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

// FilteredDeviceV3 is SNMP V3 device Info
type FilteredDeviceV3 struct {
	HostEntries   string
	SecurityName  string
	AuthProtocol  string
	AuthPass      string
	PrivProtocol  string
	PrivPass      string
	SecurityLevel string
	OrgName       string
}

func (s *Service) filterDeviceBySNMPConfigV3(device cloudhub.NetworkDevice, orgName string, filteredDevices *map[cloudhub.SNMPConfig]FilteredDeviceV3) {
	reqConfig := device.SNMPConfig
	host := fmt.Sprintf("%s:%s/%d", strings.ToLower(reqConfig.Protocol), device.DeviceIP, reqConfig.Port)
	hostEntry := fmt.Sprintf("{host => \"%s\" version => \"%s\" timeout => %d}\n",
		host, "3", 50000)

	for config := range *filteredDevices {
		if reflect.DeepEqual(config, reqConfig) {
			fd := (*filteredDevices)[config]
			fd.HostEntries += hostEntry
			fd.SecurityName = reqConfig.SecurityName
			fd.AuthProtocol = strings.ToLower(reqConfig.AuthProtocol)
			fd.AuthPass = reqConfig.AuthPass
			fd.PrivProtocol = strings.ToLower(reqConfig.PrivProtocol)
			fd.PrivPass = reqConfig.PrivPass
			fd.SecurityLevel = reqConfig.SecurityLevel
			fd.OrgName = orgName
			(*filteredDevices)[config] = fd
			return
		}
	}
	(*filteredDevices)[device.SNMPConfig] = FilteredDeviceV3{
		HostEntries:   hostEntry,
		SecurityName:  reqConfig.SecurityName,
		AuthProtocol:  strings.ToLower(reqConfig.AuthProtocol),
		AuthPass:      reqConfig.AuthPass,
		PrivProtocol:  strings.ToLower(reqConfig.PrivProtocol),
		PrivPass:      reqConfig.PrivPass,
		SecurityLevel: reqConfig.SecurityLevel,
		OrgName:       orgName,
	}
}

// GetCollectorConfig handles the sidecar polling request for Logstash configuration.
func (s *Service) GetCollectorConfig(w http.ResponseWriter, r *http.Request) {
	shardIDStr, err := paramStr("shardID", r)
	if err != nil {
		Error(w, http.StatusBadRequest, cloudhub.ErrInvalidShardID.Error(), s.Logger)
		return
	}

	parts := strings.Split(shardIDStr, "-")
	ordinalStr := parts[len(parts)-1]
	shardIndex, err := strconv.Atoi(ordinalStr)
	if err != nil {
		Error(w, http.StatusBadRequest, cloudhub.ErrInvalidShardID.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	finalConfig, err := s.InternalENV.Platform.GenerateShardConfig(ctx, shardIndex)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	hash := sha256.Sum256([]byte(finalConfig))
	etag := hex.EncodeToString(hash[:])

	w.Header().Set("ETag", etag)

	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(finalConfig))
}

// SyncCollectorShards handles a bulk synchronization request for multiple Kafka partitions.
func (s *Service) SyncCollectorShards(w http.ResponseWriter, r *http.Request) {
	type requestData struct {
		Partitions []string `json:"partitions"`
	}

	request, ctx, err := decodeRequest[requestData](r)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	var partitionIndices []int
	for _, pID := range request.Partitions {
		// Support both "partition-0" and "0" formats
		parts := strings.Split(pID, "-")
		ordinalStr := parts[len(parts)-1]
		idx, err := strconv.Atoi(ordinalStr)
		if err != nil {
			Error(w, http.StatusBadRequest, fmt.Sprintf("Invalid partition ID format: %s", pID), s.Logger)
			return
		}
		partitionIndices = append(partitionIndices, idx)
	}

	if len(partitionIndices) == 0 {
		Error(w, http.StatusBadRequest, "No partitions specified", s.Logger)
		return
	}

	// Trigger Kafka push for these partitions (Mapping 1:1 to ShardIDs)
	s.InternalENV.Platform.PushConfigUpdates(ctx, partitionIndices)

	// Fetch all devices to identify which ones belong to these partitions
	allDevices, err := s.GetAllNetworkDevices(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, "Failed to retrieve devices", s.Logger)
		return
	}

	var affectedDeviceIDs []string
	partitionMap := make(map[int]bool)
	for _, idx := range partitionIndices {
		partitionMap[idx] = true
	}

	for _, dev := range allDevices {
		if partitionMap[dev.ShardID] {
			affectedDeviceIDs = append(affectedDeviceIDs, dev.ID)
		}
	}

	response := map[string]interface{}{
		"devices": affectedDeviceIDs,
		"message": "Partition sync initiated via Kafka",
	}
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

// GetAllNetworkDeviceOrgs fetches all organization configurations from the store.
func (s *Service) GetAllNetworkDeviceOrgs(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
	serverCtx := serverContext(ctx)
	allOrgs, err := s.Store.NetworkDeviceOrg(serverCtx).All(serverCtx)
	if err != nil {
		if strings.Contains(err.Error(), "no Network Device found") {
			return []cloudhub.NetworkDeviceOrg{}, nil
		}
		return nil, fmt.Errorf("failed to fetch accounts: %w", err)
	}
	return allOrgs, nil
}

// GetAllNetworkDevices fetches all network devices from the store.
func (s *Service) GetAllNetworkDevices(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
	serverCtx := serverContext(ctx)
	allDevices, err := s.Store.NetworkDevice(serverCtx).All(serverCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch devices: %w", err)
	}
	return allDevices, nil
}

// GenerateOrgConfig generates the Logstash configuration for a specific organization's devices.
func (s *Service) GenerateOrgConfig(ctx context.Context, orgInfo *cloudhub.NetworkDeviceOrg) (string, error) {
	serverCtx := serverContext(ctx)
	org, err := s.Store.Organizations(serverCtx).Get(serverCtx, cloudhub.OrganizationQuery{ID: &orgInfo.ID})
	if err != nil {
		return "", fmt.Errorf("failed to get org %s: %w", orgInfo.ID, err)
	}

	var hostEntriesV1AndV2 []string
	var deviceFilters []string
	filteredDevices := make(map[cloudhub.SNMPConfig]FilteredDeviceV3)

	for _, deviceID := range orgInfo.CollectedDevicesIDs {
		device, err := s.Store.NetworkDevice(serverCtx).Get(serverCtx, cloudhub.NetworkDeviceQuery{ID: &deviceID})
		if err != nil {
			continue
		}

		if device.SNMPConfig.Version == "v3" || device.SNMPConfig.Version == "3" {
			s.filterDeviceBySNMPConfigV3(*device, org.Name, &filteredDevices)
		} else {
			host := fmt.Sprintf("%s:%s/%d", strings.ToLower(device.SNMPConfig.Protocol), device.DeviceIP, device.SNMPConfig.Port)
			hostEntry := fmt.Sprintf("{host => \"%s\" community => \"%s\" version => \"%s\" timeout => %d}",
				host, device.SNMPConfig.Community, device.SNMPConfig.Version, 50000)
			hostEntriesV1AndV2 = append(hostEntriesV1AndV2, hostEntry)
		}

		filter := fmt.Sprintf(`
        if [host] == "%s" {
            mutate {
                add_field => {
                    "dev_id" => "%s"
                    "org_id" => "%s"
                }
            }
        }`, device.DeviceIP, device.ID, org.ID)
		deviceFilters = append(deviceFilters, filter)
	}

	if len(hostEntriesV1AndV2) == 0 && len(filteredDevices) == 0 {
		return "", nil
	}

	snmpV1AndV2Hosts := strings.Join(hostEntriesV1AndV2, ",\n")
	filters := strings.Join(deviceFilters, "\n")
	influxDBs, _ := GetServerInfluxDBs(serverCtx, s)

	influxOrigin, influxPort, influxUser, influxPass := "", "", "", ""
	if len(influxDBs) > 0 {
		influxOrigin = influxDBs[0].Origin
		influxPort = influxDBs[0].Port
		influxUser = influxDBs[0].Username
		influxPass = influxDBs[0].Password
	}

	filteredDevicesArray := make([]FilteredDeviceV3, 0, len(filteredDevices))
	for _, fd := range filteredDevices {
		fd.HostEntries = strings.TrimSuffix(fd.HostEntries, "\n")
		filteredDevicesArray = append(filteredDevicesArray, fd)
	}

	sort.Slice(filteredDevicesArray, func(i, j int) bool {
		return filteredDevicesArray[i].SecurityName < filteredDevicesArray[j].SecurityName
	})

	tmplParams := []cloudhub.TemplateBlock{
		{Name: "comment", Params: cloudhub.TemplateParamsMap{}},
		{
			Name: "input",
			Params: cloudhub.TemplateParamsMap{
				"DeviceHostsV1AndV2": snmpV1AndV2Hosts,
				"OrgName":            org.Name,
			},
		},
		{
			Name: "snmp_v3_input",
			Params: cloudhub.TemplateParamsMap{
				"RefeatV3": filteredDevicesArray,
			},
		},
		{
			Name: "filter_ouput",
			Params: cloudhub.TemplateParamsMap{
				"OrgName":        org.Name,
				"DeviceFilter":   filters,
				"InfluxOrigin":   influxOrigin,
				"InfluxPort":     influxPort,
				"InfluxUsername": influxUser,
				"InfluxPassword": influxPass,
			},
		},
	}

	tm := s.InternalENV.TemplatesManager
	t, err := tm.Get(ctx, string(LogstashTemplateField))
	if err != nil {
		return "", fmt.Errorf("failed to get logstash template: %w", err)
	}
	templateService := &TemplateService{}
	configPart, err := templateService.LoadTemplate(cloudhub.LoadTemplateConfig{
		Field:          LogstashTemplateField,
		TemplateString: t.Template,
	}, tmplParams)

	if err != nil {
		return "", fmt.Errorf("failed to load template: %w", err)
	}

	return fmt.Sprintf("\n# Configuration for Org: %s\n%s", org.Name, configPart), nil
}

func (s *Service) pushUniqueShards(ctx context.Context, shards []int) {
	if len(shards) == 0 {
		return
	}
	shardsMap := make(map[int]bool)
	for _, sid := range shards {
		shardsMap[sid] = true
	}
	s.pushUniqueShardsMap(ctx, shardsMap)
}

func (s *Service) pushUniqueShardsMap(ctx context.Context, shardsMap map[int]bool) {
	if len(shardsMap) == 0 {
		return
	}
	var validShards []int
	for sid := range shardsMap {
		if sid >= 0 {
			validShards = append(validShards, sid)
		}
	}
	if len(validShards) > 0 {
		s.InternalENV.Platform.PushConfigUpdates(ctx, validShards)
	}
}
