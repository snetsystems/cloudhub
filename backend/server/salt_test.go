package server

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/snetsystems/cloudhub/backend/log"
)

func TestService_SaltHTTPPost(t *testing.T) {
	type body struct {
		Token    string `json:"token"`
		Eauth    string `json:"eauth"`
		Client   string `json:"client"`
		Fun      string `json:"fun"`
		Func     string `json:"func"`
		Provider string `json:"provider"`
		Kwarg    struct {
			Project string `json:"project"`
		} `json:"kwarg"`
	}

	tests := []struct {
		name    string
		s       *Service
		body    body
		wantErr bool
	}{
		{
			name: "Get Compute Limits For OSP",
			s: &Service{
				AddonURLs: map[string]string{
					"salt": saltTestURL,
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				Logger: log.New(log.DebugLevel),
			},
			body: body{
				Eauth:    "pam",
				Client:   "runner",
				Fun:      "cloud.action",
				Func:     "get_compute_limits",
				Provider: "pj-demo",
				Kwarg: struct {
					Project string `json:"project"`
				}{
					Project: "pj-demo",
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.body.Token = tt.s.AddonTokens["salt"]
			payload, _ := json.Marshal(tt.body)
			statusCode, resp, err := tt.s.SaltHTTPPost(payload)
			if err != nil {
				t.Errorf("Service.SaltHTTPPost() error = %v\n", err)
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				t.Errorf("Service.SaltHTTPPost() statusCode = %v\n", statusCode)
			}
			tt.s.Logger.
				WithField("1-statusCode", statusCode).
				WithField("2-resp", resp).
				Debug("Responsed Data")
		})
	}
}

func TestService_DaemonReload(t *testing.T) {
	type args struct {
		name string
	}
	tests := []struct {
		name string
		s    *Service
		args args
	}{
		{
			name: "Daemon Reload",
			s: &Service{
				AddonURLs: map[string]string{
					"salt": saltTestURL,
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				Logger: log.New(log.DebugLevel),
			},
			args: args{
				name: "telegraf.service",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusCode, resp, err := tt.s.DaemonReload(tt.args.name)
			if err != nil {
				t.Errorf("Service.DaemonReload() error = %v\n", err)
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				t.Errorf("Service.DaemonReload() statusCode = %v\n", statusCode)
			}
			tt.s.Logger.
				WithField("1-statusCode", statusCode).
				WithField("2-resp", resp).
				Debug("Responsed Data")
		})
	}
}
