package server

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http/httptest"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func TestConfig(t *testing.T) {
	type fields struct {
		ConfigStore cloudhub.ConfigStore
	}
	type wants struct {
		statusCode  int
		contentType string
		body        string
	}

	tests := []struct {
		name   string
		fields fields
		wants  wants
	}{
		{
			name: "Get global application configuration",
			fields: fields{
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
			},
			wants: wants{
				statusCode:  200,
				contentType: "application/json",
				body:        `{"links":{"self":"/cloudhub/v1/config","auth":"/cloudhub/v1/config/auth"},"auth":{"superAdminNewUsers":false}}`,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					ConfigStore: tt.fields.ConfigStore,
				},
				Logger: log.New(log.DebugLevel),
			}

			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "http://any.url", nil)

			s.Config(w, r)

			resp := w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wants.statusCode {
				t.Errorf("%q. Config() = %v, want %v", tt.name, resp.StatusCode, tt.wants.statusCode)
			}
			if tt.wants.contentType != "" && content != tt.wants.contentType {
				t.Errorf("%q. Config() = %v, want %v", tt.name, content, tt.wants.contentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wants.body); tt.wants.body != "" && !eq {
				t.Errorf("%q. Config() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wants.body)
			}
		})
	}
}

func TestAuthConfig(t *testing.T) {
	type fields struct {
		ConfigStore cloudhub.ConfigStore
	}
	type wants struct {
		statusCode  int
		contentType string
		body        string
	}

	tests := []struct {
		name   string
		fields fields
		wants  wants
	}{
		{
			name: "Get auth configuration",
			fields: fields{
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
			},
			wants: wants{
				statusCode:  200,
				contentType: "application/json",
				body:        `{"superAdminNewUsers": false, "links": {"self": "/cloudhub/v1/config/auth"}}`,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					ConfigStore: tt.fields.ConfigStore,
				},
				Logger: log.New(log.DebugLevel),
			}

			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "http://any.url", nil)

			s.AuthConfig(w, r)

			resp := w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wants.statusCode {
				t.Errorf("%q. Config() = %v, want %v", tt.name, resp.StatusCode, tt.wants.statusCode)
			}
			if tt.wants.contentType != "" && content != tt.wants.contentType {
				t.Errorf("%q. Config() = %v, want %v", tt.name, content, tt.wants.contentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wants.body); tt.wants.body != "" && !eq {
				t.Errorf("%q. Config() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wants.body)
			}
		})
	}
}

func TestReplaceAuthConfig(t *testing.T) {
	type fields struct {
		ConfigStore cloudhub.ConfigStore
	}
	type args struct {
		payload interface{} // expects JSON serializable struct
	}
	type wants struct {
		statusCode  int
		contentType string
		body        string
	}

	tests := []struct {
		name   string
		fields fields
		args   args
		wants  wants
	}{
		{
			name: "Set auth configuration",
			fields: fields{
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
			},
			args: args{
				payload: cloudhub.AuthConfig{
					SuperAdminNewUsers: true,
				},
			},
			wants: wants{
				statusCode:  200,
				contentType: "application/json",
				body:        `{"superAdminNewUsers": true, "links": {"self": "/cloudhub/v1/config/auth"}}`,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					ConfigStore: tt.fields.ConfigStore,
				},
				Logger: log.New(log.DebugLevel),
			}

			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "http://any.url", nil)
			buf, _ := json.Marshal(tt.args.payload)
			r.Body = ioutil.NopCloser(bytes.NewReader(buf))

			s.ReplaceAuthConfig(w, r)

			resp := w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wants.statusCode {
				t.Errorf("%q. Config() = %v, want %v", tt.name, resp.StatusCode, tt.wants.statusCode)
			}
			if tt.wants.contentType != "" && content != tt.wants.contentType {
				t.Errorf("%q. Config() = %v, want %v", tt.name, content, tt.wants.contentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wants.body); tt.wants.body != "" && !eq {
				t.Errorf("%q. Config() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wants.body)
			}
		})
	}
}
