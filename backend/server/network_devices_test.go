package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
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
		NetworkDeviceStore    cloudhub.NetworkDeviceStore
		NetworkDeviceOrgStore cloudhub.NetworkDeviceOrgStore
		OrganizationsStore    cloudhub.OrganizationsStore
		Logger                cloudhub.Logger
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
		wantBody        cloudhub.NetworkDevice
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
				Logger:                log.New(log.DebugLevel),
				NetworkDeviceStore:    MockNetworkDeviceStoreSetup(),
				NetworkDeviceOrgStore: MockNetworkDeviceOrgStoreSetup(),
				OrganizationsStore:    MockOrganizationsStoreSetup(),
			},
			id:              "958172376138104800",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody: cloudhub.NetworkDevice{
				ID:                     "958172376138104800",
				Organization:           "76",
				DeviceIP:               "172.16.11.168",
				Hostname:               "SWITCH_01",
				DeviceType:             "switch",
				DeviceCategory:         "network",
				DeviceOS:               "IOS",
				IsCollectingCfgWritten: false,
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
				Sensitivity:   1.0,
				DeviceVendor:  "",
				IsLearning:    false,
				LearningState: "Ready",
			},
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

			var gotBody cloudhub.NetworkDevice
			err := json.Unmarshal(body, &gotBody)
			if err != nil {
				t.Fatalf("%q. DeviceID() = error decoding response body: %v", tt.name, err)
			}

			if !reflect.DeepEqual(gotBody, tt.wantBody) {
				t.Errorf("%q. DeviceID() = \n***%v***\n,\nwant\n***%v***", tt.name, gotBody, tt.wantBody)
			}
		})
	}
}

func TestUpdateNetworkDevice(t *testing.T) {
	type fields struct {
		NetworkDeviceStore    *mocks.NetworkDeviceStore
		OrganizationsStore    *mocks.OrganizationsStore
		NetworkDeviceOrgStore *mocks.NetworkDeviceOrgStore
		Logger                cloudhub.Logger
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
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						if *q.ID == "958172376138104800" {
							return &cloudhub.NetworkDevice{
								ID:                     "958172376138104800",
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
									Community:     "@1234",
									Version:       "1",
									Port:          623,
									Protocol:      "udp",
									SecurityName:  "user",
									AuthProtocol:  "sha",
									AuthPass:      "authPass",
									PrivProtocol:  "aes",
									PrivPass:      "privPass",
									SecurityLevel: "authPriv",
								},
								Sensitivity:            1.0,
								DeviceVendor:           "Cisco",
								LearningBeginDatetime:  "2023-01-04T00:00:00Z",
								LearningFinishDatetime: "2023-01-05T12:00:00Z",
								IsLearning:             false,
							}, nil
						}
						return nil, cloudhub.ErrDeviceNotFound
					},
					UpdateF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
						return []cloudhub.NetworkDevice{
							{
								ID:                     "958172376138104800",
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
									Community:     "@1234",
									Version:       "1",
									Port:          623,
									Protocol:      "udp",
									SecurityName:  "user",
									AuthProtocol:  "sha",
									AuthPass:      "authPass",
									PrivProtocol:  "aes",
									PrivPass:      "privPass",
									SecurityLevel: "authPriv",
								},
								Sensitivity:            1.0,
								DeviceVendor:           "Cisco",
								LearningBeginDatetime:  "2023-01-01T00:00:00Z",
								LearningFinishDatetime: "2023-01-01T12:00:00Z",
								IsLearning:             false,
							},
							{
								ID:                     "548",
								DeviceIP:               "172.16.11.169",
								Organization:           "76",
								Hostname:               "SWITCH_02",
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
									Community:     "@1234",
									Version:       "1",
									Port:          623,
									Protocol:      "udp",
									SecurityName:  "user",
									AuthProtocol:  "sha",
									AuthPass:      "authPass",
									PrivProtocol:  "aes",
									PrivPass:      "privPass",
									SecurityLevel: "authPriv",
								},
								Sensitivity:            1.0,
								DeviceVendor:           "Cisco",
								LearningBeginDatetime:  "2023-01-01T00:00:00Z",
								LearningFinishDatetime: "2023-01-01T12:00:00Z",
								IsLearning:             false,
							},
						}, nil
					},
				},
				OrganizationsStore:    MockOrganizationsStoreSetup(),
				NetworkDeviceOrgStore: MockNetworkDeviceOrgStoreSetup(),
			},
			id:         "958172376138104800",
			wantStatus: http.StatusOK,
			wantBody: `{
				"id": "958172376138104800",
				"organization": "76",
				"device_ip": "192.168.1.2",
				"hostname": "UPDATED_SWITCH_01",
				"device_type": "switch",
				"device_category": "network",
				"device_os": "IOS",
				"is_collecting_cfg_written": false,
				"learning_state": "Ready",
				"ssh_config": {
				  "en_password": "",
				  "password": "@1234",
				  "port": "22",
				  "user_id": "host"
				},
				"snmp_config": {
				  "community": "@1234",
				  "version": "1",
				  "port": 623,
				  "protocol": "udp",
				  "security_name": "user",
				  "auth_protocol": "sha",
				  "auth_pass": "authPass",
				  "priv_protocol": "aes",
				  "priv_pass": "privPass",
				  "security_level": "authPriv"
				},
				"sensitivity": 1.0,
				"device_vendor": "Cisco",
				"learning_update_datetime": "2023-01-04T00:00:00Z",
				"learning_finish_datetime": "2023-01-05T12:00:00Z",
				"ml_function":"ml_multiplied",
				"is_learning": false
			  }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore:    tt.fields.OrganizationsStore,
					NetworkDeviceOrgStore: tt.fields.NetworkDeviceOrgStore,
					NetworkDeviceStore:    tt.fields.NetworkDeviceStore,
				},
				Logger: tt.fields.Logger,
			}

			buf, _ := json.Marshal(tt.args.request)
			tt.args.r.Body = io.NopCloser(bytes.NewReader(buf))

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				tt.args.r.Context(),
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
		NetworkDeviceStore    cloudhub.NetworkDeviceStore
		NetworkDeviceOrgStore cloudhub.NetworkDeviceOrgStore
		OrganizationsStore    cloudhub.OrganizationsStore
		MLNxRstStore          cloudhub.MLNxRstStore
		DLNxRstStore          cloudhub.DLNxRstStore
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
			name: "Successfully Remove Devices",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url",
					strings.NewReader(`{"devices_ids": ["958172376138104800", "548"]}`),
				),
			},
			fields: fields{
				Logger:                log.New(log.DebugLevel),
				NetworkDeviceOrgStore: MockNetworkDeviceOrgStoreSetup(),
				NetworkDeviceStore:    MockNetworkDeviceStoreSetup(),
				OrganizationsStore:    MockOrganizationsStoreSetup(),
				MLNxRstStore:          MockMLNxRstStoreSetup(),
				DLNxRstStore:          MockDLNxRstStoreSetup(),
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
					strings.NewReader(`{"devices_ids": [999]}`),
				),
			},
			fields: fields{
				Logger:                log.New(log.DebugLevel),
				NetworkDeviceOrgStore: MockNetworkDeviceOrgStoreSetup(),
				NetworkDeviceStore: &mocks.NetworkDeviceStore{
					GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
						return nil, cloudhub.ErrDeviceNotFound
					},
					DeleteF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
						return nil
					},
				},
				OrganizationsStore: MockOrganizationsStoreSetup(),
				MLNxRstStore:       MockMLNxRstStoreSetup(),
				DLNxRstStore:       MockDLNxRstStoreSetup(),
			},
			wantStatus: http.StatusUnprocessableEntity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					NetworkDeviceOrgStore: tt.fields.NetworkDeviceOrgStore,
					OrganizationsStore:    tt.fields.OrganizationsStore,
					NetworkDeviceStore:    tt.fields.NetworkDeviceStore,
					MLNxRstStore:          tt.fields.MLNxRstStore,
					DLNxRstStore:          tt.fields.DLNxRstStore,
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
					strings.NewReader(`{"learned_devices_ids": ["958172376138104800", "548",549,550]}`),
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

func TestIsInvalidCronExpression(t *testing.T) {
	tests := []struct {
		cron     string
		expected bool
		comment  string
	}{
		{"* * * * *", false, "Every minute"},
		{"0 0 * * *", false, "Every day at midnight"},
		{"*/5 * * * *", false, "Every 5 minutes"},
		{"0 0 1 * *", false, "At midnight on the 1st day of every month"},
		{"0 0 1 1 *", false, "At midnight on January 1st every year"},
		{"0 0 1 1 0", false, "At midnight on January 1st and on Sunday every year"},
		{"0,15,30,45 * * * *", false, "At 0, 15, 30, and 45 minutes past the hour"},
		{"0-15 * * * *", false, "Every minute from 0 through 15 past the hour"},
		{"0-15/5 * * * *", false, "Every 5 minutes from 0 through 15 past the hour"},
		{"invalid cron", true, "Invalid cron expression"},
		{"* * * *", true, "Invalid cron expression (missing one field)"},
		{"60 * * * *", true, "Invalid cron expression (invalid minute value)"},
		{"* 24 * * *", true, "Invalid cron expression (invalid hour value)"},
		{"* * 32 * *", true, "Invalid cron expression (invalid day of the month value)"},
		{"* * * 13 *", true, "Invalid cron expression (invalid month value)"},
		{"* * * * 8", true, "Invalid cron expression (invalid day of the week value)"},
		{"1 0 1,15 * *", false, "At 1 minute past midnight on the 1st and 15th of every month"},
		{"0-59/2 * * * *", false, "Every 2 minutes from 0 through 59 past the hour"},
		{"*/10 0 * * *", false, "Every 10 minutes at midnight"},
		{"0 0-23/2 * * *", false, "Every 2 hours at midnight"},
		{"0 0 * 1-12/2 *", false, "At midnight every 2 months"},
		{"0 0 * * 1-5", false, "At midnight Monday through Friday"},
		{"0 0 * * 0,6", false, "At midnight on Saturday and Sunday"},
		{"0 0 1-7 * *", false, "At midnight on the 1st through 7th of every month"},
		{"*/15 0-23/2 * * 1-5", false, "Every 15 minutes every 2 hours Monday through Friday"},
		{"0 0 1 1 *", false, "At midnight on January 1st every year"},
		{"0 12 1 1 *", false, "At noon on January 1st every year"},
		{"0 12 1 1 0", false, "At noon on January 1st and on Sunday every year"},
		{"0 12 1 1 7", false, "At noon on January 1st and on Saturday every year"},
		{"0 12 1 1 6", false, "At noon on January 1st and on Friday every year"},
		{"0 12 1 1 5", false, "At noon on January 1st and on Thursday every year"},
		{"0 12 1 1 4", false, "At noon on January 1st and on Wednesday every year"},
		{"0 12 1 1 3", false, "At noon on January 1st and on Tuesday every year"},
		{"0 12 1 1 2", false, "At noon on January 1st and on Monday every year"},
		{"0 12 1 1 1", false, "At noon on January 1st and on Sunday every year"},
		{"0 12 1 1 0", false, "At noon on January 1st and on Sunday every year"},
		{"0 12 1 1 1,3,5", false, "At noon on January 1st and on Monday, Wednesday, and Friday every year"},
	}

	for _, test := range tests {
		result := isInvalidCronExpression(test.cron)
		if result != test.expected {
			t.Errorf("For cron expression '%s' (%s), expected %v but got %v", test.cron, test.comment, test.expected, result)
		}
	}
}

const MockOrganizationID = "76"
const MockOrganizationCompareID = "77"

func ptr[T any](v T) *T {
	return &v
}

func MockDeviceStoreSetup(mockData []deviceRequest) *mocks.NetworkDeviceStore {
	var devices []*cloudhub.NetworkDevice
	index := 0

	addFunc := func(ctx context.Context, device *cloudhub.NetworkDevice) (*cloudhub.NetworkDevice, error) {
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

		deviceResponse := &cloudhub.NetworkDevice{
			ID:                     "958172376138104800",
			Organization:           req.Organization,
			DeviceIP:               req.DeviceIP,
			Hostname:               snmp["hostname"],
			DeviceType:             snmp["deviceType"],
			DeviceOS:               snmp["deviceOS"],
			IsCollectingCfgWritten: false,
			IsLearning:             false,
			LearningState:          "",
			SSHConfig:              req.SSHConfig,
			SNMPConfig:             req.SNMPConfig,
			DeviceVendor:           req.DeviceVendor,
			Sensitivity:            1.0,
		}
		devices = append(devices, deviceResponse)
		index++
		return deviceResponse, nil
	}

	allFunc := func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
		var deviceList []cloudhub.NetworkDevice
		for _, dev := range devices {
			deviceList = append(deviceList, *dev)
		}
		return deviceList, nil
	}

	return &mocks.NetworkDeviceStore{
		AddF: addFunc,
		AllF: allFunc,
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
	updatedDevices := make(map[string]*cloudhub.NetworkDevice)

	return &mocks.NetworkDeviceStore{
		GetF: func(ctx context.Context, q cloudhub.NetworkDeviceQuery) (*cloudhub.NetworkDevice, error) {
			if *q.ID == "958172376138104800" {
				return &cloudhub.NetworkDevice{
					ID:                     "958172376138104800",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				}, nil
			}
			if *q.ID == "548" {
				return &cloudhub.NetworkDevice{
					ID:                     "548",
					DeviceIP:               "172.16.11.169",
					Organization:           "76",
					Hostname:               "SWITCH_02",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				}, nil
			}
			if *q.ID == "549" {
				return &cloudhub.NetworkDevice{
					ID:                     "549",
					DeviceIP:               "172.16.11.170",
					Organization:           "77",
					Hostname:               "SWITCH_03",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				}, nil
			}
			if *q.ID == "550" {
				return &cloudhub.NetworkDevice{
					ID:                     "550",
					DeviceIP:               "172.16.11.171",
					Organization:           "77",
					Hostname:               "SWITCH_04",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				}, nil
			}
			return &cloudhub.NetworkDevice{}, cloudhub.ErrDeviceNotFound
		},
		DeleteF: func(ctx context.Context, nd *cloudhub.NetworkDevice) error {
			return nil
		},
		UpdateF: func(ctx context.Context, device *cloudhub.NetworkDevice) error {
			updatedDevices[device.ID] = device
			return nil
		},
		AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
			return []cloudhub.NetworkDevice{
				{
					ID:                     "958172376138104800",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				},
				{
					ID:                     "548",
					DeviceIP:               "172.16.11.169",
					Organization:           "76",
					Hostname:               "SWITCH_02",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				},
				{
					ID:                     "549",
					DeviceIP:               "172.16.11.170",
					Organization:           "77",
					Hostname:               "SWITCH_03",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				},
				{
					ID:                     "550",
					DeviceIP:               "172.16.11.171",
					Organization:           "77",
					Hostname:               "SWITCH_04",
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
						Community:     "@1234",
						Version:       "1",
						Port:          623,
						Protocol:      "udp",
						SecurityName:  "user",
						AuthProtocol:  "sha",
						AuthPass:      "authPass",
						PrivProtocol:  "aes",
						PrivPass:      "privPass",
						SecurityLevel: "authPriv",
					},
					Sensitivity:            1.0,
					DeviceVendor:           "Cisco",
					LearningBeginDatetime:  "2023-01-01T00:00:00Z",
					LearningFinishDatetime: "2023-01-01T12:00:00Z",
					IsLearning:             false,
				},
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

func MockMLNxRstStoreSetup() *mocks.MLNxRstStore {

	return &mocks.MLNxRstStore{
		GetF: func(ctx context.Context, q cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) {
			return &cloudhub.MLNxRst{
				Device:                 "192.168.1.1",
				LearningFinishDatetime: "2023-01-01T00:00:00Z",
				Epsilon:                0.1,
				MeanMatrix:             "[1, 2]",
				CovarianceMatrix:       "[[1, 0], [0, 1]]",
				K:                      1.0,
				Mean:                   0.5,
				MDThreshold:            1.5,
				MDArray:                []float32{0.1, 0.2, 0.3},
				CPUArray:               []float32{0.1, 0.2, 0.3},
				TrafficArray:           []float32{0.1, 0.2, 0.3},
				GaussianArray:          []float32{0.1, 0.2, 0.3},
			}, nil
		},
		DeleteF: func(ctx context.Context, rst *cloudhub.MLNxRst) error {
			return nil
		},
	}
}
func MockDLNxRstStoreSetup() *mocks.DLNxRstStore {

	return &mocks.DLNxRstStore{
		GetF: func(ctx context.Context, q cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) {
			return &cloudhub.DLNxRst{
				Device:                 "192.168.1.1",
				LearningFinishDatetime: "2023-01-01T00:00:00Z",
				DLThreshold:            1.5,
				TrainLoss:              []float32{0.1, 0.2, 0.3},
				ValidLoss:              []float32{0.1, 0.2, 0.3},
				MSE:                    []float32{0.1, 0.2, 0.3},
			}, nil
		},
		DeleteF: func(ctx context.Context, rst *cloudhub.DLNxRst) error {
			return nil
		},
	}

}

func MockNetworkDeviceOrgStoreSetup() *mocks.NetworkDeviceOrgStore {
	return &mocks.NetworkDeviceOrgStore{
		AllF: func(ctx context.Context) ([]cloudhub.NetworkDeviceOrg, error) {
			return []cloudhub.NetworkDeviceOrg{
				{
					ID:                "default",
					LoadModule:        "",
					MLFunction:        "ml_multiplied",
					DataDuration:      1,
					LearnedDevicesIDs: []string{"1", "2", "3"},
					CollectorServer:   "ch-collector-2",
					AIKapacitor: cloudhub.AIKapacitor{
						SrcID:              1,
						KapaID:             1,
						KapaURL:            "http://example.com",
						Username:           "user",
						Password:           "password",
						InsecureSkipVerify: true,
					},
					LearningCron: "0 0 * * *",
					ProcCnt:      5,
				},
				{
					ID:                  "76",
					LoadModule:          "",
					MLFunction:          "ml_multiplied",
					DataDuration:        1,
					LearnedDevicesIDs:   []string{"1", "2", "3"},
					CollectedDevicesIDs: []string{"1", "2", "3"},
					CollectorServer:     "ch-collector-2",
					AIKapacitor: cloudhub.AIKapacitor{
						SrcID:              1,
						KapaID:             1,
						KapaURL:            "http://example.com",
						Username:           "user",
						Password:           "password",
						InsecureSkipVerify: true,
					},
					LearningCron: "0 0 * * *",
					ProcCnt:      5,
				},
			}, nil
		},
		GetF: func(ctx context.Context, q cloudhub.NetworkDeviceOrgQuery) (*cloudhub.NetworkDeviceOrg, error) {
			return &cloudhub.NetworkDeviceOrg{
				ID:                  "76",
				MLFunction:          "ml_multiplied",
				LoadModule:          "",
				DataDuration:        1,
				LearnedDevicesIDs:   []string{"1", "2", "3"},
				CollectedDevicesIDs: []string{"1", "2", "3"},
				CollectorServer:     "ch-collector-2",
				AIKapacitor: cloudhub.AIKapacitor{
					SrcID:              1,
					KapaID:             1,
					KapaURL:            "http://example.com",
					Username:           "user",
					Password:           "password",
					InsecureSkipVerify: true,
				},
				LearningCron: "0 0 * * *",
				ProcCnt:      5,
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

type NetworkDevice struct {
	ID         string     `json:"id,omitempty"`
	DeviceIP   string     `json:"device_ip"`
	SNMPConfig SNMPConfig `json:"snmp_config"`
}

func createDevice(id, ip string, snmpConfig SNMPConfig) NetworkDevice {
	return NetworkDevice{
		ID:         id,
		DeviceIP:   ip,
		SNMPConfig: snmpConfig,
	}
}

func TestFilterDevicesBySNMPConfigV3(t *testing.T) {

	snmpConfig1 := cloudhub.SNMPConfig{
		Version:       "v3",
		Port:          161,
		Protocol:      "udp",
		SecurityName:  "333",
		AuthProtocol:  "SHA",
		AuthPass:      "222!",
		PrivProtocol:  "AES",
		PrivPass:      "111!",
		SecurityLevel: "authPriv",
	}

	snmpConfig2 := cloudhub.SNMPConfig{
		Version:       "v3",
		Port:          162,
		Protocol:      "udp",
		SecurityName:  "334",
		AuthProtocol:  "MD5",
		AuthPass:      "223!",
		PrivProtocol:  "DES",
		PrivPass:      "112!",
		SecurityLevel: "authPriv",
	}

	snmpConfig3 := cloudhub.SNMPConfig{
		Version:       "v3",
		Port:          163,
		Protocol:      "tcp",
		SecurityName:  "335",
		AuthProtocol:  "SHA",
		AuthPass:      "224!",
		PrivProtocol:  "AES",
		PrivPass:      "113!",
		SecurityLevel: "authPriv",
	}

	devices := []cloudhub.NetworkDevice{
		{ID: "1", DeviceIP: "10.20.5.211", SNMPConfig: snmpConfig1},
		{ID: "2", DeviceIP: "10.20.5.212", SNMPConfig: snmpConfig2},
		{ID: "3", DeviceIP: "10.20.5.213", SNMPConfig: snmpConfig1},
		{ID: "4", DeviceIP: "10.20.5.214", SNMPConfig: snmpConfig2},
		{ID: "5", DeviceIP: "10.20.5.215", SNMPConfig: snmpConfig1},
		{ID: "6", DeviceIP: "10.20.5.216", SNMPConfig: snmpConfig3},
		{ID: "7", DeviceIP: "10.20.5.217", SNMPConfig: snmpConfig3},
		{ID: "8", DeviceIP: "10.20.5.218", SNMPConfig: snmpConfig3},
		{ID: "9", DeviceIP: "10.20.5.219", SNMPConfig: snmpConfig2},
		{ID: "10", DeviceIP: "10.20.5.220", SNMPConfig: snmpConfig1},
	}

	expected := map[cloudhub.SNMPConfig]string{
		snmpConfig1: "{host => \"udp:10.20.5.211/161\" version => \"3\" timeout => 50000}\n{host => \"udp:10.20.5.213/161\" version => \"3\" timeout => 50000}\n{host => \"udp:10.20.5.215/161\" version => \"3\" timeout => 50000}\n{host => \"udp:10.20.5.220/161\" version => \"3\" timeout => 50000}\n",
		snmpConfig2: "{host => \"udp:10.20.5.212/162\" version => \"3\" timeout => 50000}\n{host => \"udp:10.20.5.214/162\" version => \"3\" timeout => 50000}\n{host => \"udp:10.20.5.219/162\" version => \"3\" timeout => 50000}\n",
		snmpConfig3: "{host => \"tcp:10.20.5.216/163\" version => \"3\" timeout => 50000}\n{host => \"tcp:10.20.5.217/163\" version => \"3\" timeout => 50000}\n{host => \"tcp:10.20.5.218/163\" version => \"3\" timeout => 50000}\n",
	}

	filteredDevices := make(map[cloudhub.SNMPConfig]FilteredDeviceV3)
	s := &Service{}
	orgName := "exampleOrg"

	for _, device := range devices {
		s.filterDeviceBySNMPConfigV3(device, orgName, &filteredDevices)
	}

	for config, fd := range filteredDevices {
		if expected[config] != fd.HostEntries {
			t.Errorf("Expected host entries for config %v: %s, but got: %s", config, expected[config], fd.HostEntries)
		}
		if fd.OrgName != orgName {
			t.Errorf("Expected orgName %s, but got %s", orgName, fd.OrgName)
		}
	}
}
