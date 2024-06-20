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
	FailedOrgs    []*deviceOrgError    `json:"failed_orgs"`
}
type deviceOrgResponse struct {
	ID                  string   `json:"organization"`
	LoadModule          string   `json:"load_module"`
	MLFunction          string   `json:"ml_function"`
	DataDuration        int      `json:"data_duration"`
	LearnCycle          int      `json:"learn_cycle"`
	LearnedDevicesIDs   []uint64 `json:"learned_devices_ids"`
	CollectorServer     string   `json:"collector_server"`
	PredictionMode      string   `json:"prediction_mode"`
	IsPredictionActive  bool     `json:"is_prediction_active"`
	CollectedDevicesIDs []uint64 `json:"collected_devices_ids"`
}
type updateDeviceOrgRequest struct {
	LoadModule         *string `json:"load_module,omitempty"`
	MLFunction         *string `json:"ml_function,omitempty"`
	DataDuration       *int    `json:"data_duration,omitempty"`
	LearnCycle         *int    `json:"learn_cycle,omitempty"`
	PredictionMode     *string `json:"prediction_mode,omitempty"`
	IsPredictionActive *bool   `json:"is_prediction_active,omitempty"`
}

type deviceOrgRequest struct {
	ID                 string  `json:"organization"`
	MLFunction         *string `json:"ml_function"`
	DataDuration       *int    `json:"data_duration"`
	LearnCycle         *int    `json:"learn_cycle"`
	PredictionMode     *string `json:"prediction_mode"`
	IsPredictionActive *bool   `json:"is_prediction_active"`
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
	LoadModule         = "learn.ch_nx_load"
	MLFunction         = MLFunctionMultiplied
	PredictionMode     = "ML"
	DataDuration       = 15
	LearnCycle         = 15
	IsPredictionActive = false
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
	if r.LearnCycle == nil {
		return fmt.Errorf("learn_cycle required in device org request body")
	}
	if r.PredictionMode == nil || *r.PredictionMode == "" {
		return fmt.Errorf("prediction_mode required in device org request body")
	}
	if r.IsPredictionActive == nil {
		return fmt.Errorf("is_prediction_active required in device org request body")
	}
	return nil
}

func (r *updateDeviceOrgRequest) validUpdate() error {
	return nil
}

func newDevicesOrgResponse(ctx context.Context, s *Service, devicesOrg []cloudhub.NetworkDeviceOrg) *devicesOrgResponse {
	Organizations := []*deviceOrgResponse{}
	failedOrgs := []*deviceOrgError{}
	for i, org := range devicesOrg {
		data, err := newDeviceOrgResponse(ctx, s, &org)
		if err != nil {
			failedOrgs = append(failedOrgs, &deviceOrgError{
				Index:        i,
				OrgID:        org.ID,
				ErrorMessage: err.Error(),
			})
		} else {
			Organizations = append(Organizations, data)
		}
	}

	return &devicesOrgResponse{
		Organizations: Organizations,
		FailedOrgs:    failedOrgs,
	}
}

func newDeviceOrgResponse(ctx context.Context, s *Service, deviceOrg *cloudhub.NetworkDeviceOrg) (*deviceOrgResponse, error) {

	resData := &deviceOrgResponse{
		ID:                  deviceOrg.ID,
		LoadModule:          deviceOrg.LoadModule,
		MLFunction:          deviceOrg.MLFunction,
		DataDuration:        deviceOrg.DataDuration,
		LearnCycle:          deviceOrg.LearnCycle,
		LearnedDevicesIDs:   deviceOrg.LearnedDevicesIDs,
		CollectorServer:     deviceOrg.CollectorServer,
		PredictionMode:      deviceOrg.PredictionMode,
		IsPredictionActive:  deviceOrg.IsPredictionActive,
		CollectedDevicesIDs: deviceOrg.CollectedDevicesIDs,
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
	if req.LearnCycle != nil {
		deviceOrg.LearnCycle = *req.LearnCycle
	}
	if req.PredictionMode != nil {
		deviceOrg.PredictionMode = *req.PredictionMode
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

	existingDeviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &req.ID})
	if err == nil && existingDeviceOrg != nil {
		Error(w, http.StatusConflict, fmt.Sprintf("Device Org with ID %s already exists", req.ID), s.Logger)
		return
	} else if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error checking for existing Device Org: %v", err), s.Logger)
		return
	}

	// Create a new NetworkDeviceOrg from the request data
	newDeviceOrg := cloudhub.NetworkDeviceOrg{
		ID:                  req.ID,
		LoadModule:          LoadModule,
		MLFunction:          *req.MLFunction,
		DataDuration:        *req.DataDuration,
		LearnCycle:          *req.LearnCycle,
		PredictionMode:      *req.PredictionMode,
		IsPredictionActive:  *req.IsPredictionActive,
		LearnedDevicesIDs:   []uint64{},
		CollectedDevicesIDs: []uint64{},
		CollectorServer:     "",
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
