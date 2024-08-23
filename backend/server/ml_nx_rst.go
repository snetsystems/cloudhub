package server

import (
	"fmt"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// GetMLNxRst handles the request to get a single MLNxRst by IP.
func (s *Service) GetMLNxRst(w http.ResponseWriter, r *http.Request) {
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
	mlNxRst, err := s.Store.MLNxRst(ctx).Get(ctx, cloudhub.MLNxRstQuery{ID: &ip})
	if err != nil {
		notFound(w, ip, s.Logger)
		return
	}

	res, err := newMLNxRstResponse(mlNxRst)
	if err != nil {
		notFound(w, ip, s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// newMLNxRstResponse creates a response object from the MLNxRst.
func newMLNxRstResponse(mlNxRst *cloudhub.MLNxRst) (*mlNxRstResponse, error) {
	resData := &mlNxRstResponse{
		Device:                 mlNxRst.Device,
		LearningFinishDatetime: mlNxRst.LearningFinishDatetime,
		Epsilon:                mlNxRst.Epsilon,
		MeanMatrix:             mlNxRst.MeanMatrix,
		CovarianceMatrix:       mlNxRst.CovarianceMatrix,
		K:                      mlNxRst.K,
		Mean:                   mlNxRst.Mean,
		MDThreshold:            mlNxRst.MDThreshold,
		MDArray:                mlNxRst.MDArray,
		CPUArray:               mlNxRst.CPUArray,
		TrafficArray:           mlNxRst.TrafficArray,
		GaussianArray:          mlNxRst.GaussianArray,
	}

	return resData, nil
}

// mlNxRstResponse is the response format for MLNxRst.
type mlNxRstResponse struct {
	Device                 string    `json:"device_ip"`
	LearningFinishDatetime string    `json:"learning_finish_datetime"`
	Epsilon                float64   `json:"epsilon"`
	MeanMatrix             string    `json:"mean_matrix"`
	CovarianceMatrix       string    `json:"covariance_matrix"`
	K                      float32   `json:"k"`
	Mean                   float32   `json:"mean"`
	MDThreshold            float32   `json:"md_threshold"`
	MDArray                []float32 `json:"md_array"`
	CPUArray               []float32 `json:"cpu_array"`
	TrafficArray           []float32 `json:"traffic_array"`
	GaussianArray          []float32 `json:"gaussian_array"`
}

// getQueryParams extracts the specified query parameters from the URL query.
func getQueryParams(r *http.Request, keys ...string) (map[string]string, error) {
	params := make(map[string]string)
	for _, key := range keys {
		vals := r.URL.Query()[key]
		if len(vals) == 0 {
			return nil, fmt.Errorf("missing parameter %s", key)
		}
		params[key] = vals[0]
	}
	return params, nil
}
