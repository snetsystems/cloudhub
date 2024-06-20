package server

import (
	"context"
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

type deviceOrgError struct {
	Index        int    `json:"index"`
	OrgID        string `json:"organization_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
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

func newDeviceOrgResponse(ctx context.Context, s *Service, device *cloudhub.NetworkDeviceOrg) (*deviceOrgResponse, error) {

	resData := &deviceOrgResponse{
		ID:                  device.ID,
		LoadModule:          device.LoadModule,
		MLFunction:          device.MLFunction,
		DataDuration:        device.DataDuration,
		LearnCycle:          device.LearnCycle,
		LearnedDevicesIDs:   device.LearnedDevicesIDs,
		CollectorServer:     device.CollectorServer,
		PredictionMode:      device.PredictionMode,
		IsPredictionActive:  device.IsPredictionActive,
		CollectedDevicesIDs: device.CollectedDevicesIDs,
	}

	return resData, nil
}
