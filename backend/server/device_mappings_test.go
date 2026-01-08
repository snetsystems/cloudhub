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
			body: `{"ip": "1.2.3.4", "hostname": "test-host", "aliasName": "alias", "deviceType": "baremetal", "orgId": "default"}`,
			ctxSetup: func(req *http.Request) *http.Request {
				user := &cloudhub.User{SuperAdmin: true}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				ctx = context.WithValue(ctx, organizations.ContextKey, "default")
				return req.WithContext(ctx)
			},
			expectedStatus: http.StatusCreated,
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"baremetal","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newTestService(t, tt.store)
			router := httprouter.New()
			router.POST("/cloudhub/v1/device-mappings/devices", s.RegisterDevice)

			req := httptest.NewRequest("POST", "/cloudhub/v1/device-mappings/devices", bytes.NewBufferString(tt.body))
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
		DeviceType: "baremetal",
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
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"baremetal","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
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
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"baremetal","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
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

func TestService_UpdateDeviceMapping(t *testing.T) {
	initialDevice := &cloudhub.DeviceMeta{
		IP: "1.2.3.4", Hostname: "test-host", AliasName: "alias", DeviceType: "baremetal", OrgID: "default",
	}

	tests := []struct {
		name           string
		body           string
		isSuperAdmin   bool
		currentOrg     string
		targetHostname string
		mockSetup      func(*mocks.DeviceMappingsStore, *mocks.OrganizationsStore)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "update alias name successfully",
			body:           `{"aliasName": "new-alias"}`,
			isSuperAdmin:   true,
			currentOrg:     "default",
			targetHostname: "test-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore, os *mocks.OrganizationsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
					return initialDevice, nil
				}
				dms.UpdateDeviceFunc = func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
					if patch.AliasName != "new-alias" {
						t.Errorf("Expected alias to be updated to 'new-alias', but got %s", patch.AliasName)
					}
					return nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"new-alias","deviceType":"baremetal","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/test-host"},"isDeletable":false}`,
		},
		{
			name:           "superadmin can change orgId",
			body:           `{"orgId": "new-org"}`,
			isSuperAdmin:   true,
			currentOrg:     "default",
			targetHostname: "test-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore, os *mocks.OrganizationsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) { return initialDevice, nil }
				dms.UpdateDeviceFunc = func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error { return nil }
				os.GetF = func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "new-org"}, nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"ip":"1.2.3.4","hostname":"test-host","aliasName":"alias","deviceType":"baremetal","orgId":"new-org","links":{"self":"/cloudhub/v1/device-mappings/new-org/devices/test-host"},"isDeletable":false}`,
		},
		{
			name:           "non-superadmin cannot change orgId",
			body:           `{"orgId": "new-org"}`,
			isSuperAdmin:   false,
			currentOrg:     "default",
			targetHostname: "test-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore, os *mocks.OrganizationsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) { return initialDevice, nil }
			},
			expectedStatus: http.StatusForbidden,
			expectedBody:   `{"code":403,"message":"only superAdmin can change orgId"}`,
		},
		{
			name:           "device not found",
			body:           `{"aliasName": "new-alias"}`,
			isSuperAdmin:   true,
			currentOrg:     "default",
			targetHostname: "not-found-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore, os *mocks.OrganizationsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
					return nil, fmt.Errorf("hostname %s not found", hostname)
				}
			},
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"code":404,"message":"device not found"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dms := &mocks.DeviceMappingsStore{}
			os := &mocks.OrganizationsStore{}
			if tt.mockSetup != nil {
				tt.mockSetup(dms, os)
			}
			// This is a bit of a hack to get the updated device back for the response.
			if dms.UpdateDeviceFunc != nil {
				originalUpdate := dms.UpdateDeviceFunc
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
					var req updateDeviceMappingRequest
					json.NewDecoder(bytes.NewReader([]byte(tt.body))).Decode(&req)
					final := *initialDevice
					if req.AliasName != nil {
						final.AliasName = *req.AliasName
					}
					if req.OrgID != nil {
						final.OrgID = *req.OrgID
					}
					if req.AppName != nil {
						final.AppName = *req.AppName
					}
					return &final, nil
				}
				dms.UpdateDeviceFunc = func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
					return originalUpdate(ctx, hostname, patch)
				}
			}

			store := &mocks.Store{DeviceMappingsStore: dms, OrganizationsStore: os}
			s := newTestService(t, store)
			router := httprouter.New()
			router.PATCH("/cloudhub/v1/device-mappings/devices/:hostname", s.UpdateDeviceMapping)

			req := httptest.NewRequest("PATCH", "/cloudhub/v1/device-mappings/devices/"+tt.targetHostname, bytes.NewBufferString(tt.body))
			user := &cloudhub.User{SuperAdmin: tt.isSuperAdmin}
			ctx := context.WithValue(req.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, organizations.ContextKey, tt.currentOrg)
			req = req.WithContext(ctx)

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

func TestService_DeleteDeviceMapping(t *testing.T) {
	initialDevice := &cloudhub.DeviceMeta{
		IP: "1.2.3.4", Hostname: "test-host", AliasName: "alias", DeviceType: "baremetal", OrgID: "default",
	}

	tests := []struct {
		name           string
		isSuperAdmin   bool
		currentOrg     string
		targetHostname string
		mockSetup      func(*mocks.DeviceMappingsStore)
		expectedStatus int
	}{
		{
			name:           "delete device successfully",
			isSuperAdmin:   true,
			currentOrg:     "default",
			targetHostname: "test-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) { return initialDevice, nil }
				dms.DeleteDeviceFunc = func(ctx context.Context, hostname string) error { return nil }
			},
			expectedStatus: http.StatusNoContent,
		},
		{
			name:           "device not found",
			isSuperAdmin:   true,
			currentOrg:     "default",
			targetHostname: "not-found-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
					return nil, fmt.Errorf("hostname %s not found", hostname)
				}
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "permission denied",
			isSuperAdmin:   false,
			currentOrg:     "other-org",
			targetHostname: "test-host",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) { return initialDevice, nil }
			},
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dms := &mocks.DeviceMappingsStore{}
			if tt.mockSetup != nil {
				tt.mockSetup(dms)
			}
			store := &mocks.Store{DeviceMappingsStore: dms}
			s := newTestService(t, store)
			router := httprouter.New()
			router.DELETE("/cloudhub/v1/device-mappings/devices/:hostname", s.DeleteDeviceMapping)

			req := httptest.NewRequest("DELETE", "/cloudhub/v1/device-mappings/devices/"+tt.targetHostname, nil)
			user := &cloudhub.User{SuperAdmin: tt.isSuperAdmin}
			ctx := context.WithValue(req.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, organizations.ContextKey, tt.currentOrg)
			req = req.WithContext(ctx)

			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.expectedStatus {
				t.Errorf("handler returned wrong status code: got %v want %v", res.Code, tt.expectedStatus)
			}
		})
	}
}

func TestService_AllDeviceMappings(t *testing.T) {
	allDevices := []*cloudhub.DeviceMeta{
		{OrgID: "org1", Hostname: "host1"},
		{OrgID: "org2", Hostname: "host2"},
	}
	org1Devices := []*cloudhub.DeviceMeta{
		{OrgID: "org1", Hostname: "host1"},
	}

	tests := []struct {
		name           string
		isSuperAdmin   bool
		currentOrg     string
		url            string
		mockSetup      func(*mocks.DeviceMappingsStore)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:         "superadmin gets all devices",
			isSuperAdmin: true,
			currentOrg:   "any-org",
			url:          "/cloudhub/v1/device-mappings/devices",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.AllDevicesFunc = func(ctx context.Context, ac cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
					if !ac.IsSuperAdmin {
						t.Error("Expected superadmin access")
					}
					return allDevices, nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"org1":[{"ip":"","hostname":"host1","aliasName":"","deviceType":"","orgId":"org1","links":{"self":"/cloudhub/v1/device-mappings/org1/devices/host1"},"isDeletable":false}],"org2":[{"ip":"","hostname":"host2","aliasName":"","deviceType":"","orgId":"org2","links":{"self":"/cloudhub/v1/device-mappings/org2/devices/host2"},"isDeletable":false}]}`,
		},
		{
			name:         "regular user gets only their org's devices",
			isSuperAdmin: false,
			currentOrg:   "org1",
			url:          "/cloudhub/v1/device-mappings/devices",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.AllDevicesFunc = func(ctx context.Context, ac cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
					if ac.IsSuperAdmin || ac.OrgID != "org1" {
						t.Errorf("Expected access for org1, got superadmin: %v, org: %s", ac.IsSuperAdmin, ac.OrgID)
					}
					return org1Devices, nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"org1":[{"ip":"","hostname":"host1","aliasName":"","deviceType":"","orgId":"org1","links":{"self":"/cloudhub/v1/device-mappings/org1/devices/host1"},"isDeletable":false}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dms := &mocks.DeviceMappingsStore{}
			if tt.mockSetup != nil {
				tt.mockSetup(dms)
			}
			store := &mocks.Store{DeviceMappingsStore: dms}
			s := newTestService(t, store)
			router := httprouter.New()
			router.GET("/cloudhub/v1/device-mappings/devices", s.AllDeviceMappings)

			req := httptest.NewRequest("GET", tt.url, nil)
			user := &cloudhub.User{SuperAdmin: tt.isSuperAdmin}
			ctx := context.WithValue(req.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, organizations.ContextKey, tt.currentOrg)
			req = req.WithContext(ctx)

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

func TestService_GetDeviceByAlias(t *testing.T) {
	aliasToDevice := &cloudhub.AliasToDevice{OrgID: "default", Hostname: "test-host"}

	tests := []struct {
		name           string
		isSuperAdmin   bool
		currentOrg     string
		targetAlias    string
		mockSetup      func(*mocks.DeviceMappingsStore)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:         "get device by alias successfully",
			isSuperAdmin: true,
			currentOrg:   "any-org",
			targetAlias:  "my-alias",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.GetByAliasFunc = func(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
					return aliasToDevice, nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"aliasName":"my-alias","orgId":"default","hostname":"test-host"}`,
		},
		{
			name:         "alias not found",
			isSuperAdmin: true,
			currentOrg:   "any-org",
			targetAlias:  "not-found-alias",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.GetByAliasFunc = func(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
					return nil, fmt.Errorf("alias %s not found", alias)
				}
			},
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"code":404,"message":"alias not found"}`,
		},
		{
			name:         "permission denied for different org",
			isSuperAdmin: false,
			currentOrg:   "other-org",
			targetAlias:  "my-alias",
			mockSetup: func(dms *mocks.DeviceMappingsStore) {
				dms.GetByAliasFunc = func(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
					return aliasToDevice, nil
				}
			},
			expectedStatus: http.StatusForbidden,
			expectedBody:   `{"code":403,"message":"access to alias denied"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dms := &mocks.DeviceMappingsStore{}
			if tt.mockSetup != nil {
				tt.mockSetup(dms)
			}
			store := &mocks.Store{DeviceMappingsStore: dms}
			s := newTestService(t, store)
			router := httprouter.New()
			router.GET("/cloudhub/v1/device-mappings/aliases/:aliasName", s.GetDeviceByAlias)

			req := httptest.NewRequest("GET", "/cloudhub/v1/device-mappings/aliases/"+tt.targetAlias, nil)
			user := &cloudhub.User{SuperAdmin: tt.isSuperAdmin}
			ctx := context.WithValue(req.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, organizations.ContextKey, tt.currentOrg)
			req = req.WithContext(ctx)

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

func TestService_EnsureDevice(t *testing.T) {
	foundDevice := &cloudhub.DeviceMeta{Hostname: "found-host", OrgID: "default"}

	tests := []struct {
		name           string
		body           string
		isSuperAdmin   bool
		mockSetup      func(*mocks.DeviceMappingsStore, *Service)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:         "device already found",
			body:         `{"hostname": "found-host"}`,
			isSuperAdmin: true,
			mockSetup: func(dms *mocks.DeviceMappingsStore, s *Service) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
					return foundDevice, nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"meta":{"ip":"","hostname":"found-host","aliasName":"","deviceType":"","orgId":"default","links":{"self":"/cloudhub/v1/device-mappings/default/devices/found-host"},"isDeletable":false},"status":"found"}`,
		},
		{
			name:         "device not found and user is not superadmin",
			body:         `{"hostname": "not-found-host"}`,
			isSuperAdmin: false,
			mockSetup: func(dms *mocks.DeviceMappingsStore, s *Service) {
				dms.GetDeviceFunc = func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
					return nil, fmt.Errorf("not found")
				}
			},
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"status":"not_found"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dms := &mocks.DeviceMappingsStore{}
			store := &mocks.Store{DeviceMappingsStore: dms}
			s := newTestService(t, store)

			if tt.mockSetup != nil {
				tt.mockSetup(dms, s)
			}

			router := httprouter.New()
			router.POST("/cloudhub/v1/device-mappings/ensure", s.EnsureDevice)

			req := httptest.NewRequest("POST", "/cloudhub/v1/device-mappings/ensure", bytes.NewBufferString(tt.body))
			user := &cloudhub.User{SuperAdmin: tt.isSuperAdmin}
			ctx := context.WithValue(req.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, organizations.ContextKey, "default")
			req = req.WithContext(ctx)

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

func TestService_RemoveOrganizationWithDeviceMappings(t *testing.T) {
	orgToDelete := &cloudhub.Organization{
		ID:   "org-to-delete",
		Name: "Organization to Delete",
	}

	deviceMappingsInOrg := []*cloudhub.DeviceMeta{
		{
			IP:         "192.168.1.1",
			Hostname:   "device1",
			AliasName:  "alias1",
			DeviceType: "baremetal",
			OrgID:      "org-to-delete",
			AppName:    "app1",
		},
		{
			IP:         "192.168.1.2",
			Hostname:   "device2",
			AliasName:  "alias2",
			DeviceType: "baremetal",
			OrgID:      "org-to-delete",
			AppName:    "app2",
		},
	}

	networkDevices := []cloudhub.NetworkDevice{
		{
			ID:           "net-device-1",
			Organization: "other-org",
			DeviceIP:     "10.0.0.1",
			Hostname:     "net-device1",
		},
		{
			ID:           "net-device-2",
			Organization: "other-org",
			DeviceIP:     "10.0.0.2",
			Hostname:     "net-device2",
		},
	}

	tests := []struct {
		name           string
		orgID          string
		mockSetup      func(*mocks.Store)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:  "successfully remove organization and move device mappings to default",
			orgID: "org-to-delete",
			mockSetup: func(store *mocks.Store) {
				// Mock Organizations store
				store.OrganizationsStore = &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						if q.ID != nil && *q.ID == "org-to-delete" {
							return orgToDelete, nil
						}
						return nil, fmt.Errorf("organization not found")
					},
					DeleteF: func(ctx context.Context, org *cloudhub.Organization) error {
						return nil
					},
				}

				// Mock NetworkDevice store - no devices in the org to be deleted
				store.NetworkDeviceStore = &mocks.NetworkDeviceStore{
					AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
						return networkDevices, nil
					},
				}

				// Mock DeviceMappings store
				store.DeviceMappingsStore = &mocks.DeviceMappingsStore{
					AllDevicesFunc: func(ctx context.Context, ac cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
						if ac.OrgID == "org-to-delete" {
							return deviceMappingsInOrg, nil
						}
						return []*cloudhub.DeviceMeta{}, nil
					},
					UpdateDeviceFunc: func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
						// Verify that devices are being moved to default organization
						if patch.OrgID != cloudhub.DefaultOrgID {
							t.Errorf("Expected device to be moved to default org, got %s", patch.OrgID)
						}
						return nil
					},
				}
			},
			expectedStatus: http.StatusNoContent,
			expectedBody:   "",
		},
		{
			name:  "organization not found",
			orgID: "non-existent-org",
			mockSetup: func(store *mocks.Store) {
				store.OrganizationsStore = &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return nil, fmt.Errorf("organization not found")
					},
				}
			},
			expectedStatus: http.StatusNotFound,
			expectedBody:   `{"code":404,"message":"organization not found"}`,
		},
		{
			name:  "cannot delete organization with network devices",
			orgID: "org-with-network-devices",
			mockSetup: func(store *mocks.Store) {
				orgWithDevices := &cloudhub.Organization{
					ID:   "org-with-network-devices",
					Name: "Organization with Network Devices",
				}

				store.OrganizationsStore = &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						if q.ID != nil && *q.ID == "org-with-network-devices" {
							return orgWithDevices, nil
						}
						return nil, fmt.Errorf("organization not found")
					},
				}

				// Mock NetworkDevice store - has devices in the org to be deleted
				networkDevicesWithOrg := []cloudhub.NetworkDevice{
					{
						ID:           "net-device-in-org",
						Organization: "org-with-network-devices",
						DeviceIP:     "10.0.0.3",
						Hostname:     "net-device-in-org",
					},
				}

				store.NetworkDeviceStore = &mocks.NetworkDeviceStore{
					AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
						return networkDevicesWithOrg, nil
					},
				}
			},
			expectedStatus: http.StatusConflict,
			expectedBody:   `{"code":409,"message":"The organization cannot be deleted because there are registered devices associated with it."}`,
		},
		{
			name:  "error getting device mappings",
			orgID: "org-to-delete",
			mockSetup: func(store *mocks.Store) {
				store.OrganizationsStore = &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						if q.ID != nil && *q.ID == "org-to-delete" {
							return orgToDelete, nil
						}
						return nil, fmt.Errorf("organization not found")
					},
				}

				store.NetworkDeviceStore = &mocks.NetworkDeviceStore{
					AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
						return networkDevices, nil
					},
				}

				store.DeviceMappingsStore = &mocks.DeviceMappingsStore{
					AllDevicesFunc: func(ctx context.Context, ac cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
						return nil, fmt.Errorf("database error")
					},
				}
			},
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"code":500,"message":"database error"}`,
		},
		{
			name:  "error updating device mapping",
			orgID: "org-to-delete",
			mockSetup: func(store *mocks.Store) {
				store.OrganizationsStore = &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						if q.ID != nil && *q.ID == "org-to-delete" {
							return orgToDelete, nil
						}
						return nil, fmt.Errorf("organization not found")
					},
				}

				store.NetworkDeviceStore = &mocks.NetworkDeviceStore{
					AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
						return networkDevices, nil
					},
				}

				store.DeviceMappingsStore = &mocks.DeviceMappingsStore{
					AllDevicesFunc: func(ctx context.Context, ac cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
						if ac.OrgID == "org-to-delete" {
							return deviceMappingsInOrg, nil
						}
						return []*cloudhub.DeviceMeta{}, nil
					},
					UpdateDeviceFunc: func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
						return fmt.Errorf("update device error")
					},
				}
			},
			expectedStatus: http.StatusInternalServerError,
			expectedBody:   `{"code":500,"message":"update device error"}`,
		},
		{
			name:  "error deleting organization",
			orgID: "org-to-delete",
			mockSetup: func(store *mocks.Store) {
				store.OrganizationsStore = &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						if q.ID != nil && *q.ID == "org-to-delete" {
							return orgToDelete, nil
						}
						return nil, fmt.Errorf("organization not found")
					},
					DeleteF: func(ctx context.Context, org *cloudhub.Organization) error {
						return fmt.Errorf("delete organization error")
					},
				}

				store.NetworkDeviceStore = &mocks.NetworkDeviceStore{
					AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
						return networkDevices, nil
					},
				}

				store.DeviceMappingsStore = &mocks.DeviceMappingsStore{
					AllDevicesFunc: func(ctx context.Context, ac cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
						if ac.OrgID == "org-to-delete" {
							return deviceMappingsInOrg, nil
						}
						return []*cloudhub.DeviceMeta{}, nil
					},
					UpdateDeviceFunc: func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
						return nil
					},
				}
			},
			expectedStatus: http.StatusBadRequest,
			expectedBody:   `{"code":400,"message":"delete organization error"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &mocks.Store{}
			if tt.mockSetup != nil {
				tt.mockSetup(store)
			}

			s := newTestService(t, store)
			router := httprouter.New()
			router.DELETE("/cloudhub/v1/organizations/:oid", s.RemoveOrganization)

			req := httptest.NewRequest("DELETE", "/cloudhub/v1/organizations/"+tt.orgID, nil)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)

			if res.Code != tt.expectedStatus {
				t.Errorf("handler returned wrong status code: got %v want %v", res.Code, tt.expectedStatus)
			}

			if tt.expectedBody != "" {
				var got, want interface{}
				json.Unmarshal(res.Body.Bytes(), &got)
				json.Unmarshal([]byte(tt.expectedBody), &want)

				gotStr, _ := json.Marshal(got)
				wantStr, _ := json.Marshal(want)

				if string(gotStr) != string(wantStr) {
					t.Errorf("handler returned unexpected body: got %s want %s", string(gotStr), string(wantStr))
				}
			}
		})
	}
}
