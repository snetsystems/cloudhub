package server

import (
	"fmt"
	"testing"

	"github.com/gosnmp/gosnmp"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var mockSNMPConnection = &mocks.SNMPConnection{
	Host: "127.0.0.1",
	Data: map[string]interface{}{
		"1.3.6.1.2.1.1.1.0": "Mocked SNMP Data",
		"1.3.6.1.2.1.1.5":   []byte("TestHostname"),
		"1.3.6.1.2.1.1.7":   []byte("TestDeviceType"),
		"1.3.6.1.2.1.1.1":   []byte("TestDeviceOS"),
	},
}

// TestParseVersion tests the parseSNMPVersion function.
func TestParseVersion(t *testing.T) {
	tests := []struct {
		input    string
		expected gosnmp.SnmpVersion
		err      bool
	}{
		{"1", gosnmp.Version1, false},
		{"v1", gosnmp.Version1, false},
		{"2c", gosnmp.Version2c, false},
		{"v2c", gosnmp.Version2c, false},
		{"3", gosnmp.Version3, false},
		{"v3", gosnmp.Version3, false},
		{"invalid", 0, true},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			version, err := parseSNMPVersion(test.input)
			if test.err {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, test.expected, version)
			}
		})
	}
}

func TestValidateDeviceIP(t *testing.T) {
	tests := []struct {
		input    string
		expected error
	}{
		{"", fmt.Errorf("device_ip required in device request body")}, // Empty IP, should fail
		{"256.256.256.256", fmt.Errorf("invalid device_ip format")},   // Invalid IPv4, should fail
		{"192.168.1.1", nil},                                   // Valid IPv4, should pass
		{"2001:0db8:85a3:0000:0000:8a2e:0370:7334", nil},       // Valid IPv6, should pass
		{"invalid_ip", fmt.Errorf("invalid device_ip format")}, // Invalid IP, should fail
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			err := ValidateDeviceIP(test.input)
			if test.expected != nil {
				require.Error(t, err)
				assert.Equal(t, test.expected.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// TestNewSNMPManager tests the NewSNMPManager function.
func TestNewSNMPManager(t *testing.T) {
	tests := []struct {
		name     string
		config   *SNMPConfig
		hasError bool
	}{
		{
			name: "SNMPv2c",
			config: &SNMPConfig{
				Community:    "public",
				DeviceIP:     "127.0.0.1",
				Port:         161,
				Version:      "2c",
				SecurityName: "",
				AuthPass:     "",
				AuthProtocol: "",
				PrivPass:     "",
				PrivProtocol: "",
				Protocol:     "udp",
			},
			hasError: false,
		},
		{
			name: "SNMPv3 authNoPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "authpass",
				AuthProtocol:  "SHA",
				PrivPass:      "",
				PrivProtocol:  "",
				Protocol:      "udp",
				SecurityLevel: "authNoPriv",
			},
			hasError: false,
		},
		{
			name: "SNMPv3 authPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "authpass",
				AuthProtocol:  "SHA",
				PrivPass:      "privpass",
				PrivProtocol:  "AES",
				Protocol:      "udp",
				SecurityLevel: "authPriv",
			},
			hasError: false,
		},
		{
			name: "SNMPv3 noAuthNoPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "",
				AuthProtocol:  "",
				PrivPass:      "",
				PrivProtocol:  "",
				Protocol:      "udp",
				SecurityLevel: "noAuthNoPriv",
			},
			hasError: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			manager, err := NewSNMPManager(test.config)
			if test.hasError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, manager)
				require.NotNil(t, manager.SNMP)
				assert.Equal(t, test.config.DeviceIP, manager.Config.DeviceIP)
				assert.Equal(t, test.config.Port, manager.Config.Port)
				assert.Equal(t, test.config.Version, manager.Config.Version)
			}
		})
	}
}

// TestSNMPManagerConnectDisconnect tests the Connect and Disconnect methods of SNMPManager.
func TestSNMPManagerConnectDisconnect(t *testing.T) {
	tests := []struct {
		name       string
		config     *SNMPConfig
		shouldFail bool
	}{
		{
			name: "SNMPv1",
			config: &SNMPConfig{
				Community:     "public",
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "1",
				Protocol:      "udp",
				SecurityLevel: "",
			},
			shouldFail: false,
		},
		{
			name: "SNMPv2c",
			config: &SNMPConfig{
				Community:     "public",
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "2c",
				Protocol:      "udp",
				SecurityLevel: "",
			},
			shouldFail: false,
		},
		{
			name: "SNMPv3 noAuthNoPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				SecurityLevel: "noAuthNoPriv",
				Protocol:      "udp",
			},
			shouldFail: false,
		},
		{
			name: "SNMPv3 authNoPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "authPass",
				AuthProtocol:  "SHA",
				SecurityLevel: "authNoPriv",
				Protocol:      "udp",
			},
			shouldFail: false,
		},
		{
			name: "SNMPv3 authPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "authPass",
				AuthProtocol:  "SHA",
				PrivPass:      "privPass",
				PrivProtocol:  "AES",
				SecurityLevel: "authPriv",
				Protocol:      "udp",
			},
			shouldFail: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			manager := &SNMPManager{
				Config: test.config,
				SNMP:   mockSNMPConnection,
			}

			err := manager.Connect()
			if test.shouldFail {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				manager.Disconnect()
				assert.False(t, mockSNMPConnection.Connected)
			}
		})
	}
}

// TestSNMPCollector tests the CollectData method of SNMPCollector.
func TestSNMPCollector(t *testing.T) {
	tests := []struct {
		name   string
		config *SNMPConfig
	}{
		{
			name: "SNMPv2c",
			config: &SNMPConfig{
				Community: "public",
				DeviceIP:  "127.0.0.1",
				Port:      161,
				Version:   "2c",
			},
		},
		{
			name: "SNMPv3 authPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "authpass",
				AuthProtocol:  "SHA",
				PrivPass:      "privpass",
				PrivProtocol:  "AES",
				Protocol:      "udp",
				SecurityLevel: "authPriv",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mockConn := &mocks.SNMPConnection{
				Host:      "127.0.0.1",
				Connected: true,
				Data: map[string]interface{}{
					"1.3.6.1.2.1.1.5": []byte("TestHostname"),
					"1.3.6.1.2.1.1.7": []byte("TestDeviceType"),
					"1.3.6.1.2.1.1.1": []byte("TestDeviceOS"),
				},
			}

			manager := &SNMPManager{
				Config: test.config,
				SNMP:   mockConn,
			}

			collector := &SNMPCollector{
				Manager: manager,
				Queries: []SNMPQuery{
					{Oid: "1.3.6.1.2.1.1.5", Key: "hostname"},
					{Oid: "1.3.6.1.2.1.1.7", Key: "deviceType"},
					{Oid: "1.3.6.1.2.1.1.1", Key: "deviceOS"},
				},
			}

			results, err := collector.CollectData()
			require.NoError(t, err)
			require.NotNil(t, results)
			assert.Contains(t, results, "hostname")
			assert.Contains(t, results, "deviceType")
			assert.Contains(t, results, "deviceOS")
			assert.Equal(t, "TestHostname", results["hostname"])
			assert.Equal(t, "TestDeviceType", results["deviceType"])
			assert.Equal(t, "TestDeviceOS", results["deviceOS"])
		})
	}
}

// TestSNMPCollectorWithProcessing tests the CollectData method of SNMPCollector with processing functions.
func TestSNMPCollectorWithProcessing(t *testing.T) {
	tests := []struct {
		name   string
		config *SNMPConfig
	}{
		{
			name: "SNMPv2c",
			config: &SNMPConfig{
				Community: "public",
				DeviceIP:  "127.0.0.1",
				Port:      161,
				Version:   "2c",
			},
		},
		{
			name: "SNMPv3 authPriv",
			config: &SNMPConfig{
				DeviceIP:      "127.0.0.1",
				Port:          161,
				Version:       "3",
				SecurityName:  "user",
				AuthPass:      "authpass",
				AuthProtocol:  "SHA",
				PrivPass:      "privpass",
				PrivProtocol:  "AES",
				Protocol:      "udp",
				SecurityLevel: "authPriv",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mockConn := &mocks.SNMPConnection{
				Host:      "127.0.0.1",
				Connected: true,
				Data: map[string]interface{}{
					"1.3.6.1.2.1.1.5": []byte("TestHostname.example.com"),
					"1.3.6.1.2.1.1.7": []byte(":4"),
					"1.3.6.1.2.1.1.1": []byte("Cisco IOS XE Software"),
				},
			}

			manager := &SNMPManager{
				Config: test.config,
				SNMP:   mockConn,
			}

			collector := &SNMPCollector{
				Manager: manager,
				Queries: []SNMPQuery{
					{Oid: "1.3.6.1.2.1.1.5", Key: "hostname", Process: processHostname},
					{Oid: "1.3.6.1.2.1.1.7", Key: "deviceType", Process: processDeviceType},
					{Oid: "1.3.6.1.2.1.1.1", Key: "deviceOS", Process: processDeviceOS},
				},
			}

			results, err := collector.CollectData()
			require.NoError(t, err)
			require.NotNil(t, results)
			assert.Contains(t, results, "hostname")
			assert.Contains(t, results, "deviceType")
			assert.Contains(t, results, "deviceOS")
			assert.Equal(t, "TestHostname", results["hostname"])
			assert.Equal(t, "switch", results["deviceType"])
			assert.Equal(t, "iosxe", results["deviceOS"])
		})
	}
}
