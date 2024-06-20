package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// MockDeviceManagementService is a mock implementation of DeviceAPIService
type MockDeviceManagementService struct{}

func TestNewDevices(t *testing.T) {
	mockData := NewMockData()

	type fields struct {
		NetworkDeviceStore cloudhub.NetworkDeviceStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w       *httptest.ResponseRecorder
		r       *http.Request
		devices []deviceRequest
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Create Multiple Devices",
			args: args{
				w:       httptest.NewRecorder(),
				r:       httptest.NewRequest("POST", "http://any.url", nil),
				devices: mockData.Devices,
			},
			fields: fields{
				Logger:             log.New(log.DebugLevel),
				NetworkDeviceStore: MockDeviceStoreSetup(mockData.Devices),
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"failed_devices":[]}`,
		},
		{
			name: "Create Multiple Devices with Some Failures",
			args: args{
				w:       httptest.NewRecorder(),
				r:       httptest.NewRequest("POST", "http://any.url", nil),
				devices: mockData.DevicesFailures,
			},
			fields: fields{
				Logger:             log.New(log.DebugLevel),
				NetworkDeviceStore: MockDeviceStoreSetup(mockData.DevicesFailures),
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			wantStatus:      http.StatusMultiStatus,
			wantContentType: "application/json",
			wantBody:        `{"failed_devices":[{"device_ip":"","errorMessage":"device_ip required in device request body","index":0}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					NetworkDeviceStore: tt.fields.NetworkDeviceStore,
				},
				Logger: tt.fields.Logger,
			}

			buf, _ := json.Marshal(tt.args.devices)
			tt.args.r.Body = io.NopCloser(bytes.NewReader(buf))
			s.NewDevices(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewDevices() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. NewDevices() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. NewDevices() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestDeviceID(t *testing.T) {

	type fields struct {
		NetworkDeviceStore cloudhub.NetworkDeviceStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}

	tests := []struct {
		name            string
		fields          fields
		args            args
		id              string
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Get Single Device",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url",
					nil,
				),
			},
			fields: fields{
				Logger:             log.New(log.DebugLevel),
				NetworkDeviceStore: MockNetworkDeviceStoreSetup(),
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody: `{
				"id":"547",
				"organization": "76",
				"device_ip": "172.16.11.168",
				"hostname": "SWITCH_01",
				"device_type": "switch",
				"device_category": "network",
				"device_os": "IOS",
				"is_collector_cfg_written": false,
				"is_modeling_generated": false,
				"ssh_config": {
				  "user_id": "host",
				  "password": "@1234",
				  "en_password": "",
				  "port": 22
				},
				"snmp_config": {
				  "community": "@1234",
				  "version": "1",
				  "port": 623,
				  "protocol": "udp"
				},
				"sensitivity":1.0,
				"device_vendor": ""
			  }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					NetworkDeviceStore: tt.fields.NetworkDeviceStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.id,
					},
				}))

			s.DeviceID(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. DeviceID() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. DeviceID() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				result, err := FormatTestResultJSONCompare(string(body), tt.wantBody)
				if err != nil {
					t.Fatalf("Error comparing JSON: %v", err)
				}
				if result != "" {
					t.Logf("Differences found DeviceID(): %s", result)
					t.Fail()
				}

			}
		})
	}
}

func TestUpdateNetworkDevice(t *testing.T) {
	type fields struct {
		NetworkDeviceStore cloudhub.NetworkDeviceStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w       *httptest.ResponseRecorder
		r       *http.Request
		request updateDeviceRequest
	}
	tests := []struct {
		name       string
		fields     fields
		args       args
		id         string
		wantStatus int
		wantBody   string
	}{
		{
			name: "Successfully Update Device",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PUT",
					"http://any.url",
					nil,
				),
				request: updateDeviceRequest{
					DeviceIP:               ptr("192.168.1.2"),
					Hostname:               ptr("UPDATED_SWITCH_01"),
					IsCollectingCfgWritten: ptr(false),
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					UpdateF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						if *q.ID == 547 {
							return &cloudhub.NetworkDevice{
								ID:                     547,
								DeviceIP:               "172.16.11.168",
								Organization:           "76",
								Hostname:               "SWITCH_01",
								DeviceType:             "switch",
								DeviceOS:               "IOS",
								IsCollectingCfgWritten: false,
								LearningState:          "ready",
							}, nil
						}
						return nil, cloudhub.ErrDeviceNotFound
					},
				},
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			id:         "547",
			wantStatus: http.StatusOK,
			wantBody: `{
				"id": "547",
				"organization": "76",
				"device_ip": "192.168.1.2",
				"hostname": "UPDATED_SWITCH_01",
				"device_type": "switch",
				"device_category": "",
				"device_os": "IOS",
				"is_monitoring_enabled": false,
				"is_modeling_generated": false,
				"ssh_config": {
				  "user_id": "",
				  "password": "",
				  "en_password": "",
				  "port": 0
				},
				"snmp_config": {
				  "community": "",
				  "version": "",
				  "port": 0,
				  "protocol": ""
				},
				"device_vendor": ""
			  }`,
		},
		{
			name: "Device Not Found",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PUT",
					"http://any.url",
					nil,
				),
				request: updateDeviceRequest{
					DeviceIP: ptr("192.168.1.2"),
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					UpdateF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						return nil, cloudhub.ErrDeviceNotFound
					},
				},
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			id:         "999",
			wantStatus: http.StatusNotFound,
			wantBody:   `{"code": 404,"message": "ID 999 not found"}`,
		},
		{
			name: "empty device_ip in Request Body",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PUT",
					"http://any.url",
					strings.NewReader(`invalid json`),
				),
				request: updateDeviceRequest{},
			},
			fields: fields{
				Logger:             log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{},
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			id:         "547",
			wantStatus: http.StatusUnprocessableEntity,
			wantBody:   `{"code": 422,"message": "device_ip required in device request body"}`,
		},
		{
			name: "Internal Server Error",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PUT",
					"http://any.url",
					nil,
				),
				request: updateDeviceRequest{
					DeviceIP: ptr("192.168.1.2"),
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					UpdateF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return errors.New("update failed")
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						return &cloudhub.NetworkDevice{
							ID:                     547,
							DeviceIP:               "172.16.11.168",
							Organization:           "76",
							Hostname:               "SWITCH_01",
							DeviceType:             "switch",
							DeviceOS:               "IOS",
							IsCollectingCfgWritten: false,
							LearningState:          "ready",
						}, nil
					},
				},
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			id:         "547",
			wantStatus: http.StatusInternalServerError,
			wantBody:   `{"code": 500,"message": "Error updating Device ID 547: update failed"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					NetworkDeviceStore: tt.fields.NetworkDeviceStore,
				},
				Logger: tt.fields.Logger,
			}

			buf, _ := json.Marshal(tt.args.request)
			tt.args.r.Body = io.NopCloser(bytes.NewReader(buf))
			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.id,
					},
				}))

			s.UpdateNetworkDevice(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UpdateNetworkDevice() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				result, err := FormatTestResultJSONCompare(string(body), tt.wantBody)
				if err != nil {
					t.Fatalf("Error comparing JSON: %v", err)
				}
				if result != "" {
					t.Logf("Differences found UpdateNetworkDevice(): %s", result)
					t.Fail()
				}

			}
		})
	}
}

func TestRemoveDevices(t *testing.T) {
	type fields struct {
		NetworkDeviceStore cloudhub.NetworkDeviceStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}
	tests := []struct {
		name       string
		fields     fields
		args       args
		request    interface{}
		wantStatus int
	}{
		{
			name: "Successfully Remove Devices",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url",
					strings.NewReader(`{"learned_devices_ids": [547, 548]}`),
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					DeleteF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						if *q.ID == 547 {
							return &cloudhub.NetworkDevice{
								ID:                     547,
								DeviceIP:               "172.16.11.168",
								Organization:           "76",
								Hostname:               "SWITCH_01",
								DeviceType:             "switch",
								DeviceOS:               "IOS",
								IsCollectingCfgWritten: false,
								LearningState:          "Ready",
							}, nil
						}
						if *q.ID == 548 {
							return &cloudhub.NetworkDevice{
								ID:                     548,
								DeviceIP:               "192.168.1.1",
								Organization:           "76",
								Hostname:               "SWITCH_02",
								DeviceType:             "switch",
								DeviceOS:               "IOS",
								IsCollectingCfgWritten: false,
								LearningState:          "Ready",
							}, nil
						}
						return nil, cloudhub.ErrDeviceNotFound
					},
				},

				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			wantStatus: http.StatusNoContent,
		},
		{
			name: "Device Not Found",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url",
					strings.NewReader(`{"learned_devices_ids": [999]}`),
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					DeleteF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						return nil, cloudhub.ErrDeviceNotFound
					},
				},
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			wantStatus: http.StatusMultiStatus,
		},
		{
			name: "Deletion Error",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url",
					strings.NewReader(`{"learned_devices_ids": [549]}`),
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					DeleteF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return errors.New("deletion failed")
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						if *q.ID == 548 {
							return &cloudhub.NetworkDevice{
								ID:                     548,
								DeviceIP:               "192.168.1.1",
								Organization:           "76",
								Hostname:               "SWITCH_02",
								DeviceType:             "switch",
								DeviceOS:               "IOS",
								IsCollectingCfgWritten: false,
								LearningState:          "Ready",
							}, nil
						}
						return nil, cloudhub.ErrDeviceNotFound
					},
				},
				OrganizationsStore: MockOrganizationsStoreSetup(),
			},
			wantStatus: http.StatusMultiStatus,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					NetworkDeviceStore: tt.fields.NetworkDeviceStore,
				},
				Logger: tt.fields.Logger,
			}

			s.RemoveDevices(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveDevices() got = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestSelectCollectorServer(t *testing.T) {
	type fields struct {
		NetworkDeviceStore    cloudhub.NetworkDeviceStore
		OrganizationsStore    cloudhub.OrganizationsStore
		NetworkDeviceOrgStore cloudhub.NetworkDeviceOrgStore
		Logger                cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}

	tests := []struct {
		name       string
		fields     fields
		args       args
		request    interface{}
		wantStatus int
	}{
		{
			name: "Manage Logstash Conf",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url",
					strings.NewReader(`{"learned_devices_ids": [547, 548,549,550]}`),
				),
			},
			fields: fields{
				Logger:                log.New(log.DebugLevel),
				NetworkDeviceStore:    MockNetworkDeviceStoreSetup(),
				OrganizationsStore:    MockOrganizationsStoreSetup(),
				NetworkDeviceOrgStore: MockNetworkDeviceOrgStoreSetup(),
			},
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore:    tt.fields.OrganizationsStore,
					NetworkDeviceStore:    tt.fields.NetworkDeviceStore,
					NetworkDeviceOrgStore: tt.fields.NetworkDeviceOrgStore,
				},
				Logger: tt.fields.Logger,
			}

			s.MonitoringConfigManagement(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveDevices() got = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestCreateLogstashConfig(t *testing.T) {
	// 테스트 구현
}
func TestRestartLogstash(t *testing.T) {
	// 테스트 구현
}

const MockOrganizationID = "76"
const MockOrganizationCompareID = "77"

func ptr[T any](v T) *T {
	return &v
}

func MockDeviceStoreSetup(mockData []deviceRequest) *mocks.NetworkDeviceStore {
	index := 0
	return &mocks.NetworkDeviceStore{
		AddF: func(ctx context.Context, device *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
			if index >= len(mockData) {
				return nil, fmt.Errorf("mock error")
			}
			req := mockData[index]

			mockConn := &mocks.SNMPConnection{
				Host:      req.DeviceIP,
				Connected: true,
				Data: map[string]interface{}{
					"1.3.6.1.2.1.1.5": []byte("TestHostname.example.com"),
					"1.3.6.1.2.1.1.7": []byte(":4"),
					"1.3.6.1.2.1.1.1": []byte("Cisco IOS XE Software"),
				},
			}

			manager := &SNMPManager{
				Config: &SNMPConfig{
					DeviceIP:  req.DeviceIP,
					Community: req.SNMPConfig.Community,
					Version:   req.SNMPConfig.Version,
					Port:      uint16(req.SNMPConfig.Port),
					Protocol:  req.SNMPConfig.Protocol,
				},
				SNMP: mockConn,
			}
			collector := &SNMPCollector{
				Manager: manager,
				Queries: []SNMPQuery{
					{Oid: "1.3.6.1.2.1.1.5", Key: "hostname", Process: processHostname},
					{Oid: "1.3.6.1.2.1.1.7", Key: "deviceType", Process: processDeviceType},
					{Oid: "1.3.6.1.2.1.1.1", Key: "deviceOS", Process: processDeviceOS},
				},
			}

			snmp, err := collector.CollectData()

			if err != nil {
				return nil, fmt.Errorf("failed to retrieve SNMP data: %v", err)
			}

			response := &cloudhub.NetworkDevice{
				ID:                     uint64(547 + index),
				Organization:           req.Organization,
				DeviceIP:               req.DeviceIP,
				Hostname:               snmp["hostname"],
				DeviceType:             snmp["deviceType"],
				DeviceOS:               snmp["deviceOS"],
				IsCollectingCfgWritten: false,
				LearningState:          "Ready",
				SSHConfig:              req.SSHConfig,
				SNMPConfig:             req.SNMPConfig,
				DeviceVendor:           req.DeviceVendor,
				Sensitivity:            1.0,
			}
			index++
			return response, nil
		},
	}
}

func MockOrganizationsStoreSetup() *mocks.OrganizationsStore {
	return &mocks.OrganizationsStore{
		DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
			return &cloudhub.Organization{
				ID:   MockOrganizationID,
				Name: "snet_org",
			}, nil
		},

		GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
			if q.ID == nil || *q.ID != MockOrganizationID {
				return nil, fmt.Errorf("Invalid organization query: missing or incorrect ID")
			}
			return &cloudhub.Organization{
				ID:   MockOrganizationID,
				Name: "snet_org",
			}, nil
		},
	}
}

func MockNetworkDeviceStoreSetup() *mocks.NetworkDeviceStore {
	return &mocks.NetworkDeviceStore{
		GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
			if *q.ID == 547 {
				return &cloudhub.NetworkDevice{
					ID:                     547,
					DeviceIP:               "172.16.11.168",
					Organization:           "76",
					Hostname:               "SWITCH_01",
					DeviceType:             "switch",
					DeviceCategory:         "network",
					DeviceOS:               "IOS",
					IsCollectingCfgWritten: false,
					LearningState:          "Ready",
					SSHConfig: cloudhub.SSHConfig{
						UserID:   "host",
						Password: "@1234",
						Port:     22,
					},
					SNMPConfig: cloudhub.SNMPConfig{
						Community: "@1234",
						Version:   "1",
						Port:      623,
						Protocol:  "udp",
					},
					Sensitivity: 1.0,
				}, nil
			}
			if *q.ID == 548 {
				return &cloudhub.NetworkDevice{
					ID:                     548,
					DeviceIP:               "172.16.11.169",
					Organization:           "76",
					Hostname:               "SWITCH_01",
					DeviceType:             "switch",
					DeviceCategory:         "network",
					DeviceOS:               "IOS",
					IsCollectingCfgWritten: false,
					LearningState:          "Ready",
					SSHConfig: cloudhub.SSHConfig{
						UserID:   "host",
						Password: "@1234",
						Port:     22,
					},
					SNMPConfig: cloudhub.SNMPConfig{
						Community: "@1234",
						Version:   "1",
						Port:      623,
						Protocol:  "udp",
					},
					Sensitivity: 1.0,
				}, nil
			}
			if *q.ID == 549 {
				return &cloudhub.NetworkDevice{
					ID:                     549,
					DeviceIP:               "172.16.11.170",
					Organization:           "77",
					Hostname:               "SWITCH_01",
					DeviceType:             "switch",
					DeviceCategory:         "network",
					DeviceOS:               "IOS",
					IsCollectingCfgWritten: false,
					LearningState:          "Ready",
					SSHConfig: cloudhub.SSHConfig{
						UserID:   "host",
						Password: "@1234",
						Port:     22,
					},
					SNMPConfig: cloudhub.SNMPConfig{
						Community: "@1234",
						Version:   "1",
						Port:      623,
						Protocol:  "udp",
					},
					Sensitivity: 1.0,
				}, nil
			}
			if *q.ID == 550 {
				return &cloudhub.NetworkDevice{
					ID:                     550,
					DeviceIP:               "172.16.11.171",
					Organization:           "77",
					Hostname:               "SWITCH_01",
					DeviceType:             "switch",
					DeviceCategory:         "network",
					DeviceOS:               "IOS",
					IsCollectingCfgWritten: false,
					LearningState:          "Ready",
					SSHConfig: cloudhub.SSHConfig{
						UserID:   "host",
						Password: "@1234",
						Port:     22,
					},
					SNMPConfig: cloudhub.SNMPConfig{
						Community: "@1234",
						Version:   "1",
						Port:      623,
						Protocol:  "udp",
					},
					Sensitivity: 1.0,
				}, nil
			}
			return &cloudhub.NetworkDevice{}, nil
		},
	}
}

type MockData struct {
	Devices         []deviceRequest
	DevicesFailures []deviceRequest
}

func NewMockData() *MockData {
	return &MockData{
		Devices: []deviceRequest{
			{
				DeviceIP:     "172.16.11.168",
				Organization: "76",
				Hostname:     "test01",
				SSHConfig: cloudhub.SSHConfig{
					UserID:   "host",
					Password: "@1234", Port: 22},
				SNMPConfig: cloudhub.SNMPConfig{
					Community: "@1234",
					Version:   "1",
					Port:      623,
					Protocol:  "udp"},
				DeviceVendor: "cisco",
			},
			{
				DeviceIP:     "192.168.1.101",
				Organization: "76",
				Hostname:     "test01",
				SSHConfig: cloudhub.SSHConfig{
					UserID:   "admin",
					Password: "admin123", Port: 22},
				SNMPConfig: cloudhub.SNMPConfig{
					Community: "public",
					Version:   "2c",
					Port:      161,
					Protocol:  "tcp"},
				DeviceVendor: "cisco",
			},
		},
		DevicesFailures: []deviceRequest{
			{
				DeviceIP:     "",
				Organization: "76",
				SSHConfig:    cloudhub.SSHConfig{UserID: "", Password: "", Port: 22},
				SNMPConfig: cloudhub.SNMPConfig{
					Community: "@1234",
					Version:   "1",
					Port:      623},
			},
		},
	}
}

func MockNetworkDeviceOrgStoreSetup() *mocks.NetworkDeviceOrgStore {
	return &mocks.NetworkDeviceOrgStore{
		AllF: func(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
			return []cloudhub.NetworkDeviceOrg{
				{
					ID:                "default",
					MLFunction:        "ml_multiplied",
					DataDuration:      1,
					LearnCycle:        2,
					LearnedDevicesIDs: []uint64{1, 2, 3},
					CollectorServer:   "ch-collector-2",
				},
			}, nil
		},
	}
}
func equalMaps(a, b map[string][]int) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if !equalSlices(v, b[k]) {
			return false
		}
	}
	return true
}
func equalSlices(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
