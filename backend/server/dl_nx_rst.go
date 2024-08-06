package server

import (
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// GetDLNxRst handles the request to get a single DLNxRst by IP.
func (s *Service) GetDLNxRst(w http.ResponseWriter, r *http.Request) {
	params, err := getQueryParams(r, "ip")
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ip := params["ip"]
	if ip == "" {
		Error(w, http.StatusUnprocessableEntity, "missing parameter ip", s.Logger)
		return
	}

	ctx := serverContext(r.Context())
	dlNxRst, err := s.Store.DLNxRst(ctx).Get(ctx, cloudhub.DLNxRstQuery{ID: &ip})
	if err != nil {
		notFound(w, ip, s.Logger)
		return
	}

	res, err := newDLNxRstResponse(dlNxRst)
	if err != nil {
		notFound(w, ip, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// newDLNxRstResponse creates a response object from the DLNxRst.
func newDLNxRstResponse(dlNxRst *cloudhub.DLNxRst) (*dlNxRstResponse, error) {
	resData := &dlNxRstResponse{
		Device:                 dlNxRst.Device,
		LearningFinishDatetime: dlNxRst.LearningFinishDatetime,
		DLThreshold:            dlNxRst.DLThreshold,
		TrainLoss:              dlNxRst.TrainLoss,
		ValidLoss:              dlNxRst.ValidLoss,
		MSE:                    dlNxRst.MSE,
	}

	return resData, nil
}

// dlNxRstResponse is the response format for DLNxRst.
type dlNxRstResponse struct {
	Device                 string    `json:"device_ip"`
	LearningFinishDatetime string    `json:"learning_finish_datetime"`
	DLThreshold            float32   `json:"dl_threshold"`
	TrainLoss              []float32 `json:"train_loss"`
	ValidLoss              []float32 `json:"valid_loss"`
	MSE                    []float32 `json:"mse"`
}
