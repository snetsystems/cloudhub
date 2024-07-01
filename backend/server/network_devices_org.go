package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// AllDevicesOrg returns all devices within the store.
func (s *Service) AllDevicesOrg(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	devices, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newDevicesOrgResponse(ctx, s, devices)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

type devicesOrgResponse struct {
	Organizations []*deviceOrgResponse `json:"organizations"`
}
type deviceOrgResponse struct {
	ID                  string               `json:"organization"`
	LoadModule          string               `json:"load_module"`
	MLFunction          string               `json:"ml_function"`
	DataDuration        int                  `json:"data_duration"`
	LearnedDevicesIDs   []uint64             `json:"learned_devices_ids"`
	CollectorServer     string               `json:"collector_server"`
	CollectedDevicesIDs []uint64             `json:"collected_devices_ids"`
	AIKapacitor         cloudhub.AIKapacitor `json:"ai_kapacitor"`
}
type updateDeviceOrgRequest struct {
	LoadModule          *string               `json:"load_module,omitempty"`
	MLFunction          *string               `json:"ml_function,omitempty"`
	DataDuration        *int                  `json:"data_duration,omitempty"`
	CollectedDevicesIDs *[]uint64             `json:"collected_devices_ids"`
	LearnedDevicesIDs   *[]uint64             `json:"learned_devices_ids"`
	AIKapacitor         *cloudhub.AIKapacitor `json:"ai_kapacitor"`
}

type deviceOrgRequest struct {
	ID           string                `json:"organization"`
	MLFunction   *string               `json:"ml_function"`
	DataDuration *int                  `json:"data_duration"`
	RelearnCycle *string               `json:"relearn_cycle"`
	AIKapacitor  *cloudhub.AIKapacitor `json:"ai_kapacitor"`
}

type deviceOrgError struct {
	Index        int    `json:"index"`
	OrgID        string `json:"organization_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}

// MLFunctionMultiplied represents an ML algorithm for multiplication-based operations.
const MLFunctionMultiplied = "ml_multiplied"

// MLFunctionScalingNormalized represents an ML algorithm for scaling and normalization.
const MLFunctionScalingNormalized = "ml_scaling_normalized"

// MLFunctionGaussianStd represents an ML algorithm for Gaussian standard deviation calculations.
const MLFunctionGaussianStd = "ml_gaussian_std"

// ML/DL Setting
const (
	LoadModule   = "learn.ch_nx_load"
	MLFunction   = MLFunctionMultiplied
	DataDuration = 15
)

func isAllowedMLFunction(function string) bool {
	switch function {
	case MLFunctionMultiplied, MLFunctionScalingNormalized, MLFunctionGaussianStd:
		return true
	default:
		return false
	}
}

func (r *deviceOrgRequest) validCreate() error {
	if r.ID == "" {
		return fmt.Errorf("organization required in device org request body")
	}
	if !isAllowedMLFunction(*r.MLFunction) {
		return fmt.Errorf("invalid ml_function in device request body")
	}
	if r.DataDuration == nil {
		return fmt.Errorf("data_duration required in device org request body")
	}
	if r.AIKapacitor == nil {
		return fmt.Errorf("AI Kapacitor required in device org request body")
	}

	return nil
}

func (r *updateDeviceOrgRequest) validUpdate() error {
	return nil
}

func newDevicesOrgResponse(ctx context.Context, s *Service, devicesOrg []cloudhub.NetworkDeviceOrg) *devicesOrgResponse {
	Organizations := []*deviceOrgResponse{}
	for _, org := range devicesOrg {
		data, err := newDeviceOrgResponse(ctx, s, &org)
		if err == nil {

			Organizations = append(Organizations, data)
		}
	}

	return &devicesOrgResponse{
		Organizations: Organizations,
	}
}

func newDeviceOrgResponse(ctx context.Context, s *Service, deviceOrg *cloudhub.NetworkDeviceOrg) (*deviceOrgResponse, error) {

	resData := &deviceOrgResponse{
		ID:                  deviceOrg.ID,
		LoadModule:          deviceOrg.LoadModule,
		MLFunction:          deviceOrg.MLFunction,
		DataDuration:        deviceOrg.DataDuration,
		LearnedDevicesIDs:   deviceOrg.LearnedDevicesIDs,
		CollectorServer:     deviceOrg.CollectorServer,
		CollectedDevicesIDs: deviceOrg.CollectedDevicesIDs,
		AIKapacitor:         deviceOrg.AIKapacitor,
	}

	return resData, nil
}

// NetworkDeviceOrgID returns a device org by ID.
func (s *Service) NetworkDeviceOrgID(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res, err := newDeviceOrgResponse(ctx, s, deviceOrg)
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error creating response for Device Org ID %s: %v", id, err), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateNetworkDeviceOrg completely updates either the Device Org
func (s *Service) UpdateNetworkDeviceOrg(w http.ResponseWriter, r *http.Request) {
	idStr, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	var req updateDeviceOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &idStr})
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}

	if req.LoadModule != nil {
		deviceOrg.LoadModule = *req.LoadModule
	}
	if req.MLFunction != nil {
		deviceOrg.MLFunction = *req.MLFunction
	}
	if req.DataDuration != nil {
		deviceOrg.DataDuration = *req.DataDuration
	}
	if req.CollectedDevicesIDs != nil {
		deviceOrg.CollectedDevicesIDs = *req.CollectedDevicesIDs
	}
	if req.LearnedDevicesIDs != nil {
		deviceOrg.LearnedDevicesIDs = *req.LearnedDevicesIDs
	}
	if req.AIKapacitor != nil {
		if req.AIKapacitor.KapaURL != "" {
			deviceOrg.AIKapacitor.KapaURL = req.AIKapacitor.KapaURL
		}
		if req.AIKapacitor.Username != "" {
			deviceOrg.AIKapacitor.Username = req.AIKapacitor.Username
		}
		if req.AIKapacitor.Password != "" {
			deviceOrg.AIKapacitor.Password = req.AIKapacitor.Password
		}
		deviceOrg.AIKapacitor.InsecureSkipVerify = req.AIKapacitor.InsecureSkipVerify
	}

	if err := s.Store.NetworkDeviceOrg(ctx).Update(ctx, deviceOrg); err != nil {
		msg := fmt.Sprintf("Error updating Device Org ID %s: %v", idStr, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	msg := fmt.Sprintf(MsgNetWorkDeviceModified.String(), idStr)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	res, err := newDeviceOrgResponse(ctx, s, deviceOrg)
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}

	msg = fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), idStr)
	s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// AddNetworkDeviceOrg adds a new Device Org to the store.
func (s *Service) AddNetworkDeviceOrg(w http.ResponseWriter, r *http.Request) {
	var req deviceOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	_, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &req.ID})
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error checking for existing Org: %v", err), s.Logger)
		return
	}

	existingDeviceOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &req.ID})
	if existingDeviceOrg != nil {
		Error(w, http.StatusConflict, fmt.Sprintf("Device Org with ID %s already exists", req.ID), s.Logger)
		return
	}

	// Create a new NetworkDeviceOrg from the request data
	newDeviceOrg := cloudhub.NetworkDeviceOrg{
		ID:                  req.ID,
		LoadModule:          LoadModule,
		MLFunction:          *req.MLFunction,
		DataDuration:        *req.DataDuration,
		LearnedDevicesIDs:   []uint64{},
		CollectedDevicesIDs: []uint64{},
		CollectorServer:     "",
		AIKapacitor: cloudhub.AIKapacitor{
			KapaURL:            *&req.AIKapacitor.KapaURL,
			Username:           *&req.AIKapacitor.Username,
			Password:           *&req.AIKapacitor.Password,
			InsecureSkipVerify: *&req.AIKapacitor.InsecureSkipVerify,
		},
	}

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Add(ctx, &newDeviceOrg)
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error creating new Device Org: %v", err), s.Logger)
		return
	}

	res, err := newDeviceOrgResponse(ctx, s, deviceOrg)
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error creating response for new Device Org: %v", err), s.Logger)
		return
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceOrgCreated.String(), deviceOrg.ID)
	s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
	encodeJSON(w, http.StatusCreated, res, s.Logger)
}

// RemoveNetworkDeviceOrg removes a Device Org from the store by ID.
func (s *Service) RemoveNetworkDeviceOrg(w http.ResponseWriter, r *http.Request) {
	idStr, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &idStr})
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}

	if err := s.Store.NetworkDeviceOrg(ctx).Delete(ctx, &cloudhub.NetworkDeviceOrg{ID: deviceOrg.ID}); err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error removing Device Org ID %s: %v", idStr, err), s.Logger)
		return
	}

	msg := fmt.Sprintf("Network Device Org with ID %s removed successfully", idStr)
	s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
	encodeJSON(w, http.StatusOK, map[string]string{"message": msg}, s.Logger)
}
