package server

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

func TestGetDeviceMapping(t *testing.T) {
	type fields struct {
		DeviceMappingsStore cloudhub.DeviceMappingsStore
		Logger              cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		hostname        string
		user            *cloudhub.User
		orgID           string
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Get a device mapping as SuperAdmin",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					GetDeviceFunc: func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
						return &cloudhub.DeviceMeta{
							IP:         "192.168.1.1",
							Hostname:   "test-host",
							AliasName:  "alias-host",
							DeviceType: "server",
							OrgID:      "org1",
						}, nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			hostname:        "test-host",
			user:            &cloudhub.User{SuperAdmin: true},
			orgID:           "any-org",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"ip":"192.168.1.1","hostname":"test-host","aliasName":"alias-host","deviceType":"server","orgId":"org1","links":{"self":"/cloudhub/v1/device-mappings/org1/devices/test-host"}}`,
		},
		{
			name: "Get a device mapping as a user in the same org",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					GetDeviceFunc: func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
						return &cloudhub.DeviceMeta{
							IP:         "192.168.1.1",
							Hostname:   "test-host",
							AliasName:  "alias-host",
							DeviceType: "server",
							OrgID:      "org1",
						}, nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			hostname:        "test-host",
			user:            &cloudhub.User{SuperAdmin: false},
			orgID:           "org1",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"ip":"192.168.1.1","hostname":"test-host","aliasName":"alias-host","deviceType":"server","orgId":"org1","links":{"self":"/cloudhub/v1/device-mappings/org1/devices/test-host"}}`,
		},
		{
			name: "Attempt to get a device from another org",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					GetDeviceFunc: func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
						return &cloudhub.DeviceMeta{
							IP:         "192.168.1.1",
							Hostname:   "test-host",
							AliasName:  "alias-host",
							DeviceType: "server",
							OrgID:      "org2",
						}, nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			hostname:        "test-host",
			user:            &cloudhub.User{SuperAdmin: false},
			orgID:           "org1",
			wantStatus:      http.StatusForbidden,
			wantContentType: "application/json",
			wantBody:        `{"code":403,"message":"access to device denied"}`,
		},
		{
			name: "Device not found",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					GetDeviceFunc: func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
						return nil, fmt.Errorf("hostname %s not found", hostname)
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			hostname:        "unknown-host",
			user:            &cloudhub.User{SuperAdmin: true},
			orgID:           "any-org",
			wantStatus:      http.StatusNotFound,
			wantContentType: "application/json",
			wantBody:        `{"code":404,"message":"device not found"}`,
		},
		{
			name: "Missing hostname parameter",
			fields: fields{
				Logger: log.New(log.DebugLevel),
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			hostname:        "",
			user:            &cloudhub.User{SuperAdmin: true},
			orgID:           "any-org",
			wantStatus:      http.StatusBadRequest,
			wantContentType: "application/json",
			wantBody:        `{"code":400,"message":"hostname parameter is required"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					DeviceMappingsStore: tt.fields.DeviceMappingsStore,
				},
				Logger: tt.fields.Logger,
			}

			ctx := context.Background()
			ctx = httprouter.WithParams(ctx, httprouter.Params{{Key: "hostname", Value: tt.hostname}})
			ctx = context.WithValue(ctx, UserContextKey, tt.user)
			ctx = context.WithValue(ctx, organizations.ContextKey, tt.orgID)

			tt.args.r = tt.args.r.WithContext(ctx)

			s.GetDeviceMapping(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. GetDeviceMapping() status = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. GetDeviceMapping() content-type = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. GetDeviceMapping() body = \n***%s***\n,\nwant\n***%s***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestAllDeviceMappings(t *testing.T) {
	type fields struct {
		DeviceMappingsStore cloudhub.DeviceMappingsStore
		Logger              cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		user            *cloudhub.User
		orgID           string
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Get all device mappings as SuperAdmin",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					AllDevicesFunc: func(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
						return []*cloudhub.DeviceMeta{
							{IP: "192.168.1.1", Hostname: "host1", OrgID: "org1", DeviceType: "server"},
							{IP: "192.168.1.2", Hostname: "host2", OrgID: "org2", DeviceType: "switch"},
						}, nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			user:            &cloudhub.User{SuperAdmin: true},
			orgID:           "any-org",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"org1":[{"ip":"192.168.1.1","hostname":"host1","aliasName":"","deviceType":"server","orgId":"org1","links":{"self":"/cloudhub/v1/device-mappings/org1/devices/host1"}}],"org2":[{"ip":"192.168.1.2","hostname":"host2","aliasName":"","deviceType":"switch","orgId":"org2","links":{"self":"/cloudhub/v1/device-mappings/org2/devices/host2"}}]}`,
		},
		{
			name: "Get device mappings for a specific org",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					AllDevicesFunc: func(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
						if access.OrgID == "org1" && !access.IsSuperAdmin {
							return []*cloudhub.DeviceMeta{
								{IP: "192.168.1.1", Hostname: "host1", OrgID: "org1", DeviceType: "server"},
							}, nil
						}
						return nil, fmt.Errorf("unexpected access context")
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			user:            &cloudhub.User{SuperAdmin: false},
			orgID:           "org1",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"org1":[{"ip":"192.168.1.1","hostname":"host1","aliasName":"","deviceType":"server","orgId":"org1","links":{"self":"/cloudhub/v1/device-mappings/org1/devices/host1"}}]}`,
		},
		{
			name: "Request fails if organization is not in context",
			fields: fields{
				Logger: log.New(log.DebugLevel),
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest("GET", "http://any.url", nil),
			},
			user:            &cloudhub.User{SuperAdmin: false},
			orgID:           "", // No organization in context
			wantStatus:      http.StatusInternalServerError,
			wantContentType: "application/json",
			wantBody:        `{"code":500,"message":"organization not found"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					DeviceMappingsStore: tt.fields.DeviceMappingsStore,
				},
				Logger: tt.fields.Logger,
			}

			ctx := context.Background()
			ctx = context.WithValue(ctx, UserContextKey, tt.user)
			ctx = context.WithValue(ctx, organizations.ContextKey, tt.orgID)

			tt.args.r = tt.args.r.WithContext(ctx)

			s.AllDeviceMappings(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. AllDeviceMappings() status = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. AllDeviceMappings() content-type = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. AllDeviceMappings() body = \n***%s***\n,\nwant\n***%s***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}