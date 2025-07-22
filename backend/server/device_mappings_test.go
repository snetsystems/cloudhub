package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// newTestService creates a new service for testing.
func newTestService(t *testing.T, store *mocks.Store) *Service {
	t.Helper()
	s := &Service{
		Logger: mocks.NewLogger(),
	}
	s.Store = store
	return s
}

func TestService_RegisterDevice(t *testing.T) {
	tests := []struct {
		name           string
		store          *mocks.Store
		body           string
		ctxSetup       func(req *http.Request) *http.Request
		expectedStatus int
		expectedBody   string
	}{
		{
			name: "register new device",
			store: &mocks.Store{
				DeviceMappingsStore: &mocks.DeviceMappingsStore{
					AddDeviceFunc: func(ctx context.Context, dm *cloudhub.DeviceMeta) error {
						return nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						if q.ID != nil && *q.ID == "default" {
							return &cloudhub.Organization{ID: "default", Name: "Default"}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
			},
			body: `{"ip": "1.2.3.4", "hostname": "test-host", "aliasName": "alias", "deviceType": "BM", "orgId": "default"}`,
			ctxSetup: func(req *http.Request) *http.Request {
				user := &cloudhub.User{SuperAdmin: true}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				ctx = context.WithValue(ctx, organizations.ContextKey, "default")
				return req.WithContext(ctx)
			},
			expectedStatus: http.StatusCreated,
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"BM","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newTestService(t, tt.store)
			router := httprouter.New()
			router.POST("/cloudhub/v1/device-mappings", s.RegisterDevice)

			req := httptest.NewRequest("POST", "/cloudhub/v1/device-mappings", bytes.NewBufferString(tt.body))
			if tt.ctxSetup != nil {
				req = tt.ctxSetup(req)
			}
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.expectedStatus {
				t.Errorf("handler returned wrong status code: got %v want %v", res.Code, tt.expectedStatus)
			}

			var got, want interface{}
			json.Unmarshal(res.Body.Bytes(), &got)
			json.Unmarshal([]byte(tt.expectedBody), &want)

			gotStr, _ := json.Marshal(got)
			wantStr, _ := json.Marshal(want)

			if string(gotStr) != string(wantStr) {
				t.Errorf("handler returned unexpected body: got %s want %s", string(gotStr), string(wantStr))
			}
		})
	}
}

func TestService_GetDeviceMapping(t *testing.T) {
	testDevice := &cloudhub.DeviceMeta{
		IP:         "1.2.3.4",
		Hostname:   "test-host",
		AliasName:  "alias",
		DeviceType: "BM",
		OrgID:      "default",
	}

	storeWithDevice := &mocks.Store{
		DeviceMappingsStore: &mocks.DeviceMappingsStore{
			GetDeviceFunc: func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
				if hostname == "test-host" {
					return testDevice, nil
				}
				return nil, fmt.Errorf("hostname %s not found", hostname)
			},
		},
	}

	tests := []struct {
		name           string
		store          *mocks.Store
		url            string
		ctxSetup       func(req *http.Request) *http.Request
		expectedStatus int
		expectedBody   string
	}{
		{
			name:  "get device successfully as superadmin",
			store: storeWithDevice,
			url:   "/cloudhub/v1/device-mappings/devices/test-host",
			ctxSetup: func(req *http.Request) *http.Request {
				user := &cloudhub.User{SuperAdmin: true}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				ctx = context.WithValue(ctx, organizations.ContextKey, "any-org")
				return req.WithContext(ctx)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"BM","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
		},
		{
			name:  "get device successfully as org member",
			store: storeWithDevice,
			url:   "/cloudhub/v1/device-mappings/devices/test-host",
			ctxSetup: func(req *http.Request) *http.Request {
				user := &cloudhub.User{SuperAdmin: false}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				ctx = context.WithValue(ctx, organizations.ContextKey, "default")
				return req.WithContext(ctx)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"BM","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
		},
		{
			name:  "access denied for different org",
			store: storeWithDevice,
			url:   "/cloudhub/v1/device-mappings/devices/test-host",
			ctxSetup: func(req *http.Request) *http.Request {
				user := &cloudhub.User{SuperAdmin: false}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				ctx = context.WithValue(ctx, organizations.ContextKey, "other-org")
				return req.WithContext(ctx)
			},
			expectedStatus: http.StatusForbidden,
			expectedBody:   `{"code":403,"message":"access to device denied"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newTestService(t, tt.store)
			router := httprouter.New()
			router.GET("/cloudhub/v1/device-mappings/devices/:hostname", s.GetDeviceMapping)

			req := httptest.NewRequest("GET", tt.url, nil)
			if tt.ctxSetup != nil {
				req = tt.ctxSetup(req)
			}
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.expectedStatus {
				t.Errorf("handler returned wrong status code: got %v want %v", res.Code, tt.expectedStatus)
			}

			var got, want interface{}
			json.Unmarshal(res.Body.Bytes(), &got)
			json.Unmarshal([]byte(tt.expectedBody), &want)

			gotStr, _ := json.Marshal(got)
			wantStr, _ := json.Marshal(want)

			if string(gotStr) != string(wantStr) {
				t.Errorf("handler returned unexpected body: got %s want %s", string(gotStr), string(wantStr))
			}
		})
	}
}
