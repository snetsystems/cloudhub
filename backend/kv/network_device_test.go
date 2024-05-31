package kv_test

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure a NetworkDeviceStore can store, retrieve, update, and delete Device.
func TestNetworkDeviceStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.NetworkDeviceStore()

	devices := []cloudhub.NetworkDevice{
		{
			ID:                  "",
			Organization:        "Default",
			DeviceIP:            "192.168.1.1",
			Hostname:            "device01",
			DeviceType:          "Router",
			DeviceOS:            "Cisco IOS",
			IsMonitoringEnabled: true,
			IsModelingGenerated: false,
			SSHConfig: cloudhub.SSHConfig{
				SSHUserName:   "admin",
				SSHPassword:   "admin123",
				SSHEnPassword: "secret123",
				SSHPort:       22,
			},
			SNMPConfig: cloudhub.SNMPConfig{
				SNMPCommunity: "public",
				SNMPVersion:   "2c",
				SNMPUDPPort:   161,
				SNMPProtocol:  "udp",
			},
			LearnSettingGroupID: 101,
		},
		{
			ID:                  "",
			Organization:        "BetaCorp",
			DeviceIP:            "192.168.1.2",
			Hostname:            "device02",
			DeviceType:          "Switch",
			DeviceOS:            "JunOS",
			IsMonitoringEnabled: false,
			IsModelingGenerated: true,
			SSHConfig: cloudhub.SSHConfig{
				SSHUserName:   "root",
				SSHPassword:   "root123",
				SSHEnPassword: "enable123",
				SSHPort:       2222,
			},
			SNMPConfig: cloudhub.SNMPConfig{
				SNMPCommunity: "private",
				SNMPVersion:   "3",
				SNMPUDPPort:   162,
				SNMPProtocol:  "udp",
			},
			LearnSettingGroupID: 102,
		},
	}

	// Add new Device.
	ctx := context.Background()
	for i, device := range devices {
		var rtnDevice *cloudhub.NetworkDevice
		if rtnDevice, err = s.Add(ctx, &device); err != nil {
			t.Fatal(err)
		}
		devices[i].ID = rtnDevice.ID

		// Check out first device in the store is the same as the original.
		if actual, err := s.Get(ctx, cloudhub.NetworkDeviceQuery{ID: &rtnDevice.ID}); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, devices[i]) {
			t.Fatalf("Device loaded is different than Device saved; actual: %v, expected %v", *actual, devices[i])
		}
	}

	// Update Device.
	devices[1].Hostname = "device02_updated"
	if err := s.Update(ctx, &devices[1]); err != nil {
		t.Fatal(err)
	}

	// Get all test.
	getDevices, err := s.All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len := len(getDevices); len < 2 {
		t.Fatalf("Device gets all error: the expected length is 2 but the real length is %d", len)
	}

	// Get test.
	device, err := s.Get(ctx, cloudhub.NetworkDeviceQuery{ID: &devices[1].ID})
	fmt.Println(device)
	if err != nil {
		t.Fatal(err)
	} else if device.Hostname != "device02_updated" {
		t.Fatalf("Device update error: got %v, expected %v", device.Hostname, "device02_updated")
	}

	// Getting test for a wrong id.
	id := "1000"
	empty_device, err := s.Get(ctx, cloudhub.NetworkDeviceQuery{ID: &id})
	fmt.Println(empty_device)
	if err == nil {
		t.Fatalf("Must be occured error for a wrong id=%v, message=\"Device not found\"", id)
	}

	// Delete the Device.
	if err := s.Delete(ctx, device); err != nil {
		t.Fatal(err)
	}

	// Check out Device has been deleted.
	if _, err := s.Get(ctx, cloudhub.NetworkDeviceQuery{ID: &devices[1].ID}); err != cloudhub.ErrDeviceNotFound {
		t.Fatalf("Device delete error: got %v, expected %v", err, cloudhub.ErrDeviceNotFound)
	}
}
