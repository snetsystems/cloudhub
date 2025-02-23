package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path"
	"reflect"
	"regexp"
	"strings"
	"sync"

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

const (
	// DefaultOrganizationID is the id of the default organization
	DefaultOrganizationID string = "default"
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
		return fmt.Errorf(err.Error())
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
		_, err = s.createDevice(ctx, req)
		if err != nil {
			failedDeviceList = append(failedDeviceList, createDeviceError{
				Index:        i,
				DeviceIP:     req.DeviceIP,
				ErrorMessage: err.Error(),
			})
		}
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

	for i, req := range reqs {
		currentReq := req
		if id, exists := existingIPs[currentReq.DeviceIP]; exists {
			_, err := s.UpdateDevice(ctx, &updateDeviceData{
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
			}
		} else {
			_, err = s.createDevice(ctx, currentReq)
			if err != nil {
				failedDeviceList = append(failedDeviceList, createDeviceError{
					Index:        i,
					DeviceIP:     currentReq.DeviceIP,
					ErrorMessage: err.Error(),
				})
			}
		}
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
	isSuperAdmin := hasSuperAdminContext(ctx)
	currentOrg, ok := hasOrganizationContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError, string(cloudhub.ErrOrganizationNotFound), s.Logger)
		return
	}
	if !(isSuperAdmin && currentOrg == DefaultOrganizationID) {
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

	activeCollectorKeys := &sync.Map{}

	for orgID, devices := range devicesGroupByOrg {
		org, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgID})
		if org != nil && len(org.CollectedDevicesIDs) > 0 {
			var activeCollectorsErr error
			_, activeCollectorKeys, activeCollectorsErr = s.getCollectorServers()
			if activeCollectorsErr != nil {
				for _, id := range devices {
					addFailedDevice(failedDevices, id, fmt.Errorf("Failed to access active collector-server"))
				}

				response := make(map[string]interface{})
				response["failed_devices"] = convertFailedDevicesToArray(failedDevices)
				encodeJSON(w, http.StatusMultiStatus, response, s.Logger)
				return
			}
		}
	}

	orgsToUpdate, err := removeDeviceIDsFromPreviousOrg(ctx, s, deviceOrgMap)

	for orgID, devicesIDs := range devicesGroupByOrg {
		org, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgID})
		if org != nil {
			_, exists := activeCollectorKeys.Load(org.CollectorServer)
			if !exists && len(org.CollectedDevicesIDs) > 0 {
				for _, id := range devicesIDs {
					addFailedDevice(failedDevices, id, fmt.Errorf("collector server not active"))
				}
				continue

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
				for _, devicesIDs := range devicesGroupByOrg {
					for _, id := range devicesIDs {
						addFailedDevice(failedDevices, id, err)
					}
				}
				continue
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				for _, devicesIDs := range devicesGroupByOrg {
					for _, id := range devicesIDs {
						addFailedDevice(failedDevices, id, fmt.Errorf(string(resp)))
					}
				}
				continue
			}
			if _, exists := restartCollectorServers[org.CollectorServer]; !exists {
				restartCollectorServers[org.CollectorServer] = org.CollectorServer
				_, _, err := s.restartDocker(org.CollectorServer)
				if err != nil {
					for _, devicesIDs := range devicesGroupByOrg {
						for _, id := range devicesIDs {
							addFailedDevice(failedDevices, id, err)
						}
					}
					continue
				}
			}
		}
		if currentOrg != nil {
			err = s.Store.NetworkDeviceOrg(ctx).Update(ctx, &org)
			msg := fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), org.ID)
			s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
			if err != nil {
				for _, devicesIDs := range devicesGroupByOrg {
					for _, id := range devicesIDs {
						addFailedDevice(failedDevices, id, err)
					}
				}
				continue
			}
		}
	}

	for _, id := range request.DevicesIDs {
		if _, exists := failedDevices[id]; exists {
			return
		}

		device, err := s.Store.NetworkDevice(ctx).Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
		if err != nil {
			addFailedDevice(failedDevices, id, err)
			return
		}
		if err := s.OrganizationExists(ctx, device.Organization); err != nil {
			addFailedDevice(failedDevices, id, err)
			return
		}
		serverCtx := serverContext(ctx)
		MLRst, _ := s.Store.MLNxRst(serverCtx).Get(serverCtx, cloudhub.MLNxRstQuery{ID: &device.DeviceIP})
		if MLRst != nil {
			err = s.Store.MLNxRst(serverCtx).Delete(serverCtx, MLRst)
			if err != nil {
				addFailedDevice(failedDevices, id, err)
				return
			}
		}
		DLRst, _ := s.Store.DLNxRst(serverCtx).Get(serverCtx, cloudhub.DLNxRstQuery{ID: &device.DeviceIP})
		if DLRst != nil {
			err = s.Store.DLNxRst(serverCtx).Delete(serverCtx, DLRst)
			if err != nil {
				addFailedDevice(failedDevices, id, err)
				return
			}
		}
		err = s.Store.DLNxRstStg(serverCtx).Delete(serverCtx, cloudhub.DLNxRstStgQuery{ID: &device.DeviceIP})
		if err != nil {
			addFailedDevice(failedDevices, id, err)
			return
		}
		err = s.Store.NetworkDevice(ctx).Delete(ctx, device)
		if err != nil {
			addFailedDevice(failedDevices, id, err)
			return
		}
		msg := fmt.Sprintf(MsgNetWorkDeviceDeleted.String(), id)
		s.logRegistration(ctx, "NetWorkDevice", msg)
	}

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
	updateData := updateDeviceData{
		id:                  id,
		updateDeviceRequest: req,
	}
	device, err := s.UpdateDevice(ctx, &updateData)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

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

		devOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &device.Organization})
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

	collectorKeys, activeCollectorKeys, err := s.getCollectorServers()
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	_, _, serverDeviceCount, orgToCollector := computeThreshold(existingDevicesOrg, devicesData.devicesGroupByOrg, CollectorSelectionRatio)

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
		if _, exists := activeCollectorKeys.Load(collectorServer); !exists {
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
			if device.IsCollecting {
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

		// Save unique collector servers to restartCollectorServers map
		if _, exists := restartCollectorServers[orgInfo.CollectorServer]; !exists {
			restartCollectorServers[orgInfo.CollectorServer] = orgInfo.CollectorServer
			_, _, err := s.restartDocker(orgInfo.CollectorServer)
			if err != nil {
				for _, device := range devicesData.devicesGroupByOrg[org] {
					if _, exists := failedDevices[device.ID]; !exists {
						failedDevices[device.ID] = err.Error()
					}
				}
				continue
			}
		}

		existOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org})
		if err != nil && existOrg == nil {
			s.Store.NetworkDeviceOrg(ctx).Add(ctx, &orgInfo)
		} else {
			s.Store.NetworkDeviceOrg(ctx).Update(ctx, &orgInfo)
		}
		for _, device := range devicesData.devicesGroupByOrg[org] {
			networkDevice := devicesData.networkDevicesMap[device.ID]
			if device.IsCollectingCfgWritten == false {
				networkDevice.IsCollectingCfgWritten = true
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

func (s *Service) getCollectorServers() ([]string, *sync.Map, error) {
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
	activeCollectorKeys := &sync.Map{}
	var wg sync.WaitGroup

	for _, minion := range response.Return[0].Data.Return.Minions {
		if strings.HasPrefix(minion, "ch-collector") {
			collectorKeys = append(collectorKeys, minion)
			wg.Add(1)
			go func(minion string) {
				defer wg.Done()
				if statusCode, resp, err := s.IsActiveMinionPingTest(minion); err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
					activeCollectorKeys.Store(minion, false)
				} else if resp != nil {
					r := &struct {
						Return []map[string]bool `json:"return"`
					}{}

					if err := json.Unmarshal(resp, r); err != nil || !r.Return[0][minion] {
						activeCollectorKeys.Store(minion, false)
						return
					}
					activeCollectorKeys.Store(minion, true)
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

	statusCode, resp, err = s.CreateFileWithLocalClient(filePath, []string{configString}, devOrg.CollectorServer)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, resp, err
	}
	// Log the successful creation of the config
	msg := fmt.Sprintf(MsgNetWorkDeviceConfCreated.String(), org.ID)
	s.logRegistration(ctx, "NetWorkDeviceConf", msg)
	return http.StatusOK, nil, err
}

func (s *Service) restartDocker(collectorServer string) (int, []byte, error) {
	aiConfig := s.InternalENV.AIConfig
	dockerPath := aiConfig.DockerPath
	dockerCmd := aiConfig.DockerCmd

	statusCode, resp, err := s.DockerRestart(dockerPath, collectorServer, dockerCmd)
	if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return statusCode, nil, err
	} else if resp != nil {
		r := &struct {
			Return []map[string]string `json:"return"`
		}{}
		if err := json.Unmarshal(resp, r); err != nil {
			return http.StatusInternalServerError, nil, err
		}
		// Check for the success message using regex
		re := regexp.MustCompile(`(?i)(Restarting.*Started|Stopping .* done|Starting .* done)`)
		for _, item := range r.Return {
			for _, value := range item {
				cleanedValue := strings.ReplaceAll(strings.ReplaceAll(value, "\n", ""), " ", "")
				if !re.MatchString(cleanedValue) {
					message := fmt.Errorf(value)
					return http.StatusInternalServerError, nil, message
				}
			}
		}
	} else {
		return http.StatusInternalServerError, nil, fmt.Errorf("Unknown error occurred at DirectoryExists() func")
	}
	return statusCode, resp, nil
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
