package server

import (
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type envResponse struct {
	Links                  selfLinks `json:"links"`
	TelegrafSystemInterval string    `json:"telegrafSystemInterval"`
	CustomAutoRefresh      string    `json:"customAutoRefresh,omitempty"`
}

func newEnvResponse(env cloudhub.Environment) *envResponse {
	return &envResponse{
		Links: selfLinks{
			Self: "/cloudhub/v1/env",
		},
		TelegrafSystemInterval: env.TelegrafSystemInterval.String(),
		CustomAutoRefresh:      env.CustomAutoRefresh,
	}
}

// Environment retrieves the global application configuration
func (s *Service) Environment(w http.ResponseWriter, r *http.Request) {
	res := newEnvResponse(s.Env)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}
