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
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						return &cloudhub.NetworkDevice{
							ID:                  "547",
							DeviceIP:            "172.16.11.168",
							Organization:        "76",
							Hostname:            "SWITCH_01",
							DeviceType:          "switch",
							DeviceCategory:      "network",
							DeviceOS:            "IOS",
							IsMonitoringEnabled: true,
							IsModelingGenerated: false,
							SSHConfig: cloudhub.SSHConfig{
								SSHUserName: "host",
								SSHPassword: "@1234",
								SSHPort:     22,
							},
							SNMPConfig: cloudhub.SNMPConfig{
								SNMPCommunity: "@1234",
								SNMPVersion:   "1",
								SNMPPort:      623,
								SNMPProtocol:  "udp",
							},
							LearnSettingGroupID: 1,
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody: `{
				"id": "547",
				"organization": "76",
				"device_ip": "172.16.11.168",
				"hostname": "SWITCH_01",
				"device_type": "switch",
				"device_category": "network",
				"device_os": "IOS",
				"is_monitoring_enabled": true,
				"is_modeling_generated": false,
				"ssh_conn": {
				  "ssh_user_name": "host",
				  "ssh_password": "@1234",
				  "ssh_en_password": "",
				  "ssh_port": 22
				},
				"snmp_config": {
				  "snmp_community": "@1234",
				  "snmp_version": "1",
				  "snmp_port": 623,
				  "snmp_protocol": "udp"
				},
				"learn_setting_group_id": 1,
				"learn_ratio": 0,
				"device_vendor": "",
				"links": {
				  "self": "/cloudhub/v1/device/547"
				}
			  }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
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
				formattedBody, _ := FormatTestResultJSON(string(body))
				formattedWantBody, _ := FormatTestResultJSON(tt.wantBody)
				t.Errorf("%q. DeviceID() = \n***%v***\n,\nwant\n***%v***", tt.name, formattedBody, formattedWantBody)
			}
		})
	}
}

func TestRemoveDevices(t *testing.T) {
	type fields struct {
		NetworkDeviceStore cloudhub.NetworkDeviceStore
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
					strings.NewReader(`{"devices_id": ["547", "548"]}`),
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					DeleteF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						if *q.ID == "547" {
							return &cloudhub.NetworkDevice{
								ID:                  "547",
								DeviceIP:            "172.16.11.168",
								Organization:        "76",
								Hostname:            "SWITCH_01",
								DeviceType:          "switch",
								DeviceOS:            "IOS",
								IsMonitoringEnabled: true,
								IsModelingGenerated: false,
							}, nil
						}
						if *q.ID == "548" {
							return &cloudhub.NetworkDevice{
								ID:                  "548",
								DeviceIP:            "192.168.1.1",
								Organization:        "76",
								Hostname:            "SWITCH_02",
								DeviceType:          "switch",
								DeviceOS:            "IOS",
								IsMonitoringEnabled: true,
								IsModelingGenerated: false,
							}, nil
						}
						return nil, cloudhub.ErrDeviceNotFound
					},
				},
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
					strings.NewReader(`{"devices_id": ["999"]}`),
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
					strings.NewReader(`{"devices_id": ["548"]}`),
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					DeleteF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return errors.New("deletion failed")
					},
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						if *q.ID == "548" {
							return &cloudhub.NetworkDevice{
								ID:                  "548",
								DeviceIP:            "192.168.1.1",
								Organization:        "76",
								Hostname:            "SWITCH_02",
								DeviceType:          "switch",
								DeviceOS:            "IOS",
								IsMonitoringEnabled: true,
								IsModelingGenerated: false,
							}, nil
						}
						return nil, cloudhub.ErrDeviceNotFound
					},
				},
			},
			wantStatus: http.StatusMultiStatus,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
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

const MockOrganizationID = "76"

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
					Community: req.SNMPConfig.SNMPCommunity,
					Version:   req.SNMPConfig.SNMPVersion,
					Port:      uint16(req.SNMPConfig.SNMPPort),
					Protocol:  req.SNMPConfig.SNMPProtocol,
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
				ID:                  fmt.Sprintf("%d", 547+index),
				Organization:        req.Organization,
				DeviceIP:            req.DeviceIP,
				Hostname:            snmp["hostname"],
				DeviceType:          snmp["deviceType"],
				DeviceOS:            snmp["deviceOS"],
				IsMonitoringEnabled: false,
				IsModelingGenerated: false,
				SSHConfig:           req.SSHConfig,
				SNMPConfig:          req.SNMPConfig,
				DeviceCategory:      req.DeviceCategory,
				DeviceVendor:        req.DeviceVendor,
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
				DeviceIP:       "172.16.11.168",
				Organization:   "Default",
				Hostname:       "test01",
				DeviceCategory: "network",
				SSHConfig: cloudhub.SSHConfig{
					SSHUserName: "host",
					SSHPassword: "@1234", SSHPort: 22},
				SNMPConfig: cloudhub.SNMPConfig{
					SNMPCommunity: "@1234",
					SNMPVersion:   "1",
					SNMPPort:      623,
					SNMPProtocol:  "udp"},
				DeviceVendor: "cisco",
			},
			{
				DeviceIP:       "192.168.1.101",
				Organization:   "Default",
				Hostname:       "test01",
				DeviceCategory: "network",
				SSHConfig: cloudhub.SSHConfig{
					SSHUserName: "admin",
					SSHPassword: "admin123", SSHPort: 22},
				SNMPConfig: cloudhub.SNMPConfig{
					SNMPCommunity: "public",
					SNMPVersion:   "2c",
					SNMPPort:      161,
					SNMPProtocol:  "tcp"},
				DeviceVendor: "cisco",
			},
		},
		DevicesFailures: []deviceRequest{
			{
				DeviceIP:       "",
				Organization:   "Default",
				DeviceCategory: "network",
				SSHConfig:      cloudhub.SSHConfig{SSHUserName: "", SSHPassword: "", SSHPort: 22},
				SNMPConfig: cloudhub.SNMPConfig{
					SNMPCommunity: "@1234",
					SNMPVersion:   "1",
					SNMPPort:      623},
			},
		},
	}
}
