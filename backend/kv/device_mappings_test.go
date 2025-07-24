package kv_test

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// TestDeviceMappingsStore_BasicOperations tests basic CRUD operations
func TestDeviceMappingsStore_BasicOperations(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DeviceMappingsStore()
	ctx := context.Background()

	// Test device metadata
	device := &cloudhub.DeviceMeta{
		IP:         "192.168.1.100",
		Hostname:   "test-server-01",
		AliasName:  "web-server",
		DeviceType: "VM",
		OrgID:      "org-123",
	}

	// Test 1: Add Device - verify all 3 keys are created atomically
	t.Run("AddDevice_AtomicCreation", func(t *testing.T) {
		err := s.AddDevice(ctx, device)
		if err != nil {
			t.Fatal("Failed to add device:", err)
		}

		// Verify all 3 mappings exist
		// 1. Forward mapping check
		retrieved, err := s.GetDevice(ctx, device.Hostname)
		if err != nil {
			t.Fatal("Failed to get device after creation:", err)
		}
		if !reflect.DeepEqual(*retrieved, *device) {
			t.Fatalf("Retrieved device differs: got %+v, want %+v", *retrieved, *device)
		}

		// 2. Reverse mapping 1 check (hostname -> org)
		deviceToOrg, err := s.GetByHostname(ctx, device.Hostname)
		if err != nil {
			t.Fatal("Failed to get device-to-org mapping:", err)
		}
		if deviceToOrg.OrgID != device.OrgID || deviceToOrg.AliasName != device.AliasName {
			t.Fatalf("Device-to-org mapping incorrect: got %+v", deviceToOrg)
		}

		// 3. Reverse mapping 2 check (alias -> device)
		aliasToDevice, err := s.GetByAlias(ctx, device.AliasName)
		if err != nil {
			t.Fatal("Failed to get alias-to-device mapping:", err)
		}
		if aliasToDevice.OrgID != device.OrgID || aliasToDevice.Hostname != device.Hostname {
			t.Fatalf("Alias-to-device mapping incorrect: got %+v", aliasToDevice)
		}

		t.Log("Verified all 3 keys are created atomically")
	})

	// Test 2: Update Device
	t.Run("UpdateDevice", func(t *testing.T) {
		patch := &cloudhub.DeviceMeta{
			IP:         "192.168.1.101", // IP change
			AliasName:  "updated-alias", // Alias change
			DeviceType: "baremetal",     // Type change
		}

		err := s.UpdateDevice(ctx, device.Hostname, patch)
		if err != nil {
			t.Fatal("Failed to update device:", err)
		}

		// Verify update
		updated, err := s.GetDevice(ctx, device.Hostname)
		if err != nil {
			t.Fatal("Failed to get updated device:", err)
		}

		if updated.IP != patch.IP || updated.AliasName != patch.AliasName || updated.DeviceType != patch.DeviceType {
			t.Fatalf("Device not properly updated: got %+v", *updated)
		}

		// Verify old alias is deleted and new alias is created
		_, err = s.GetByAlias(ctx, device.AliasName) // old alias
		if err == nil {
			t.Fatal("Old alias should be deleted but still exists")
		}

		newAlias, err := s.GetByAlias(ctx, patch.AliasName) // new alias
		if err != nil {
			t.Fatal("New alias should exist but not found:", err)
		}
		if newAlias.Hostname != device.Hostname {
			t.Fatal("New alias mapping incorrect")
		}

		// Update device info for next test
		device.IP = patch.IP
		device.AliasName = patch.AliasName
		device.DeviceType = patch.DeviceType
	})

	// Test 3: Delete Device - verify all 3 keys are deleted atomically
	t.Run("DeleteDevice_AtomicDeletion", func(t *testing.T) {
		err := s.DeleteDevice(ctx, device.Hostname)
		if err != nil {
			t.Fatal("Failed to delete device:", err)
		}

		// Verify all 3 mappings are deleted
		// 1. Verify forward mapping deletion
		_, err = s.GetDevice(ctx, device.Hostname)
		if err == nil {
			t.Fatal("Device should be deleted but still exists")
		}

		// 2. Verify reverse mapping 1 deletion
		_, err = s.GetByHostname(ctx, device.Hostname)
		if err == nil {
			t.Fatal("Device-to-org mapping should be deleted but still exists")
		}

		// 3. Verify reverse mapping 2 deletion
		_, err = s.GetByAlias(ctx, device.AliasName)
		if err == nil {
			t.Fatal("Alias-to-device mapping should be deleted but still exists")
		}

		t.Log("Verified all 3 keys are deleted atomically")
	})
}

// TestDeviceMappingsStore_DuplicateHandling tests duplicate prevention
func TestDeviceMappingsStore_DuplicateHandling(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DeviceMappingsStore()
	ctx := context.Background()

	device1 := &cloudhub.DeviceMeta{
		IP:         "192.168.1.100",
		Hostname:   "test-server-01",
		AliasName:  "web-server",
		DeviceType: "VM",
		OrgID:      "org-123",
	}

	device2 := &cloudhub.DeviceMeta{
		IP:         "192.168.1.101",
		Hostname:   "test-server-02", // different hostname
		AliasName:  "web-server",     // same alias (conflict!)
		DeviceType: "VM",
		OrgID:      "org-123",
	}

	// Add first device
	err = s.AddDevice(ctx, device1)
	if err != nil {
		t.Fatal("Failed to add first device:", err)
	}

	t.Run("DuplicateHostname_ShouldFail", func(t *testing.T) {
		// Attempt to add with same hostname
		err = s.AddDevice(ctx, device1)
		if err == nil {
			t.Fatal("Adding duplicate hostname should fail")
		}
		t.Log("Duplicate hostname addition correctly rejected")
	})

	t.Run("DuplicateAlias_ShouldFail", func(t *testing.T) {
		// Attempt to add with same alias
		err = s.AddDevice(ctx, device2)
		if err == nil {
			t.Fatal("Adding duplicate alias should fail")
		}

		// First device should still exist
		retrieved, err := s.GetDevice(ctx, device1.Hostname)
		if err != nil {
			t.Fatal("First device should still exist after failed duplicate add")
		}
		if !reflect.DeepEqual(*retrieved, *device1) {
			t.Fatal("First device data corrupted after failed duplicate add")
		}

		t.Log("Duplicate alias addition correctly rejected and existing data preserved")
	})
}

// TestDeviceMappingsStore_MoveDeviceOrg tests organization change
func TestDeviceMappingsStore_MoveDeviceOrg(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DeviceMappingsStore()
	ctx := context.Background()

	device := &cloudhub.DeviceMeta{
		IP:         "192.168.1.100",
		Hostname:   "test-server-01",
		AliasName:  "web-server",
		DeviceType: "VM",
		OrgID:      "org-123",
	}

	// Clean up test data before starting the test
	devices, _ := s.AllDevices(ctx, cloudhub.AccessContext{IsSuperAdmin: true})
	for _, d := range devices {
		if d.Hostname == device.Hostname {
			_ = s.DeleteDevice(ctx, d.Hostname)
		}
	}

	// Add device
	err = s.AddDevice(ctx, device)
	if err != nil {
		t.Fatal("Failed to add device:", err)
	}

}

// TestDeviceMappingsStore_AtomicityDemo demonstrates atomic transaction behavior
func TestDeviceMappingsStore_AtomicityDemo(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DeviceMappingsStore()
	ctx := context.Background()

	t.Run("TransactionAtomicity_Demonstration", func(t *testing.T) {
		device := &cloudhub.DeviceMeta{
			IP:         "192.168.1.100",
			Hostname:   "demo-server",
			AliasName:  "demo-alias",
			DeviceType: "VM",
			OrgID:      "demo-org",
		}

		// Clean up test data before starting the test
		devices, _ := s.AllDevices(ctx, cloudhub.AccessContext{IsSuperAdmin: true})
		if devices != nil {
			for _, d := range devices {
				fmt.Println("Before test - will delete:", device.Hostname)
				if d.Hostname == device.Hostname {
					_ = s.DeleteDevice(ctx, d.Hostname)
				}
			}
		}

		// Step 1: Add device
		t.Log("Step 1: Adding device with 3 keys...")
		err = s.AddDevice(ctx, device)
		if err != nil {
			t.Fatal("Failed to add device:", err)
		}
		t.Log("Device added successfully")

		// Verify: All 3 keys exist
		_, err1 := s.GetDevice(ctx, device.Hostname)
		_, err2 := s.GetByHostname(ctx, device.Hostname)
		_, err3 := s.GetByAlias(ctx, device.AliasName)

		if err1 != nil || err2 != nil || err3 != nil {
			t.Fatal("Not all 3 keys were created atomically")
		}
		t.Log("All 3 keys confirmed to exist")

		// Step 2: Attempt duplicate addition (should fail)
		t.Log("Step 2: Attempting to add duplicate (should fail)...")
		err = s.AddDevice(ctx, device)
		if err == nil {
			t.Fatal("Duplicate add should have failed")
		}
		t.Log("Duplicate add correctly rejected")

		// Verify: Existing data preserved even after failure
		_, err1 = s.GetDevice(ctx, device.Hostname)
		_, err2 = s.GetByHostname(ctx, device.Hostname)
		_, err3 = s.GetByAlias(ctx, device.AliasName)

		if err1 != nil || err2 != nil || err3 != nil {
			t.Fatal("Original data corrupted after failed operation")
		}
		t.Log("Original data preserved after failed operation")

		// Step 3: Update (atomic)
		t.Log("Step 3: Updating device (atomic)...")
		patch := &cloudhub.DeviceMeta{AliasName: "updated-demo-alias"}
		err = s.UpdateDevice(ctx, device.Hostname, patch)
		if err != nil {
			t.Fatal("Failed to update device:", err)
		}
		t.Log("Device updated successfully")

		// Verify: old alias deleted, new alias created
		_, err = s.GetByAlias(ctx, device.AliasName) // old alias
		if err == nil {
			t.Fatal("Old alias should be deleted")
		}
		_, err = s.GetByAlias(ctx, patch.AliasName) // new alias
		if err != nil {
			t.Fatal("New alias should exist:", err)
		}
		t.Log("Alias atomically updated (old deleted, new created)")

		// Step 4: Delete (atomic)
		t.Log("Step 4: Deleting device (atomic)...")
		err = s.DeleteDevice(ctx, device.Hostname)
		if err != nil {
			t.Fatal("Failed to delete device:", err)
		}
		t.Log("Device deleted successfully")

		// Verify: All 3 keys deleted
		_, err1 = s.GetDevice(ctx, device.Hostname)
		_, err2 = s.GetByHostname(ctx, device.Hostname)
		_, err3 = s.GetByAlias(ctx, patch.AliasName)

		if err1 == nil || err2 == nil || err3 == nil {
			t.Fatal("Not all 3 keys were deleted atomically")
		}
		t.Log("All 3 keys confirmed to be deleted")
	})
}

// TestDeviceMappingsStore_TransactionRollback tests actual rollback behavior
func TestDeviceMappingsStore_TransactionRollback(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DeviceMappingsStore()
	ctx := context.Background()

	t.Run("UpdateDevice_RollbackOnAliasConflict", func(t *testing.T) {
		// Step 1: Create initial devices
		device1 := &cloudhub.DeviceMeta{
			IP:         "192.168.1.100",
			Hostname:   "rollback-test-server-1",
			AliasName:  "original-alias-1",
			DeviceType: "VM",
			OrgID:      "org-123",
		}

		device2 := &cloudhub.DeviceMeta{
			IP:         "192.168.1.200",
			Hostname:   "rollback-test-server-2",
			AliasName:  "existing-alias-2",
			DeviceType: "VM",
			OrgID:      "org-123",
		}

		// Clean up test data before starting the test
		devices, _ := s.AllDevices(ctx, cloudhub.AccessContext{IsSuperAdmin: true})

		if devices != nil {
			for _, d := range devices {
				fmt.Println("Before test - will delete:", device1.Hostname)
				if d.Hostname == device1.Hostname {
					_ = s.DeleteDevice(ctx, d.Hostname)
				}
				if d.Hostname == device2.Hostname {
					_ = s.DeleteDevice(ctx, d.Hostname)
				}
			}
		}

		err := s.AddDevice(ctx, device1)
		if err != nil {
			t.Fatal("Failed to add device1:", err)
		}

		err = s.AddDevice(ctx, device2)
		if err != nil {
			t.Fatal("Failed to add device2:", err)
		}

		// Step 2: Verify existing state
		originalDevice1, err := s.GetDevice(ctx, device1.Hostname)
		if err != nil {
			t.Fatal("Failed to get original device1:", err)
		}

		originalAlias1, err := s.GetByAlias(ctx, device1.AliasName)
		if err != nil {
			t.Fatal("Failed to get original alias1:", err)
		}

		originalAlias2, err := s.GetByAlias(ctx, device2.AliasName)
		if err != nil {
			t.Fatal("Failed to get original alias2:", err)
		}

		t.Log("Original state confirmed")

		// Step 3: Attempt to update device1 with device2's alias (should fail)
		patch := &cloudhub.DeviceMeta{
			AliasName: device2.AliasName, // already existing alias
		}

		t.Log("Attempting update with conflicting alias (should fail and rollback)...")
		err = s.UpdateDevice(ctx, device1.Hostname, patch)
		if err == nil {
			t.Fatal("Update should have failed due to alias conflict")
		}
		t.Log("Update correctly failed:", err)

		// Step 4: Verify rollback - confirm original data is unchanged
		afterFailureDevice1, err := s.GetDevice(ctx, device1.Hostname)
		if err != nil {
			t.Fatal("Failed to get device1 after failed update:", err)
		}

		if !reflect.DeepEqual(*afterFailureDevice1, *originalDevice1) {
			t.Fatalf("Device1 data was corrupted after failed update: got %+v, want %+v",
				*afterFailureDevice1, *originalDevice1)
		}

		// Verify existing alias1 mapping is intact
		afterFailureAlias1, err := s.GetByAlias(ctx, device1.AliasName)
		if err != nil {
			t.Fatal("Failed to get original alias1 after failed update:", err)
		}

		if !reflect.DeepEqual(*afterFailureAlias1, *originalAlias1) {
			t.Fatalf("Alias1 mapping was corrupted after failed update: got %+v, want %+v",
				*afterFailureAlias1, *originalAlias1)
		}

		// Verify alias2 still points to device2
		afterFailureAlias2, err := s.GetByAlias(ctx, device2.AliasName)
		if err != nil {
			t.Fatal("Failed to get alias2 after failed update:", err)
		}

		if !reflect.DeepEqual(*afterFailureAlias2, *originalAlias2) {
			t.Fatalf("Alias2 mapping was corrupted after failed update: got %+v, want %+v",
				*afterFailureAlias2, *originalAlias2)
		}

		t.Log("ROLLBACK VERIFIED: All original data preserved after failed update")
	})

	t.Run("AddDevice_RollbackOnAliasConflict", func(t *testing.T) {
		// Step 5: Test rollback with duplicate alias addition attempt
		existingDevice := &cloudhub.DeviceMeta{
			IP:         "192.168.1.400",
			Hostname:   "existing-device",
			AliasName:  "shared-alias",
			DeviceType: "VM",
			OrgID:      "org-123",
		}

		err := s.AddDevice(ctx, existingDevice)
		if err != nil {
			t.Fatal("Failed to add existing device:", err)
		}

		// Attempt to add new device with same alias (should fail)
		newDevice := &cloudhub.DeviceMeta{
			IP:         "192.168.1.500",
			Hostname:   "new-device",
			AliasName:  "shared-alias", // duplicate alias
			DeviceType: "baremetal",
			OrgID:      "org-123",
		}

		t.Log("Attempting to add device with duplicate alias (should fail and rollback)...")
		err = s.AddDevice(ctx, newDevice)
		if err == nil {
			t.Fatal("Add should have failed due to duplicate alias")
		}
		t.Log("Add correctly failed:", err)

		// Verify rollback - confirm no keys were created for new device
		_, err = s.GetDevice(ctx, newDevice.Hostname)
		if err == nil {
			t.Fatal("New device should not exist after failed add (rollback failed)")
		}

		_, err = s.GetByHostname(ctx, newDevice.Hostname)
		if err == nil {
			t.Fatal("New device-to-org mapping should not exist after failed add (rollback failed)")
		}

		// Existing alias should still point to original device
		aliasMapping, err := s.GetByAlias(ctx, "shared-alias")
		if err != nil {
			t.Fatal("Original alias should still exist after failed add:", err)
		}
		if aliasMapping.Hostname != "existing-device" {
			t.Fatalf("Alias mapping corrupted: got %s, want existing-device", aliasMapping.Hostname)
		}

		t.Log("ROLLBACK VERIFIED: Failed add left no partial state")

	})

	t.Run("ContextCancellation_RollbackTest", func(t *testing.T) {
		// Test rollback through context cancellation
		testDevice := &cloudhub.DeviceMeta{
			IP:         "192.168.1.600",
			Hostname:   "context-cancel-test",
			AliasName:  "context-cancel-alias",
			DeviceType: "VM",
			OrgID:      "org-123",
		}

		// First verify success case
		err := s.AddDevice(ctx, testDevice)
		if err != nil {
			t.Fatal("Failed to add test device:", err)
		}

		// Save existing state
		original, err := s.GetDevice(ctx, testDevice.Hostname)
		if err != nil {
			t.Fatal("Failed to get original device:", err)
		}

		t.Log("Testing rollback with context cancellation...")

		// Attempt update with immediately cancelled context
		cancelCtx, cancel := context.WithCancel(ctx)
		cancel() // cancel immediately

		patch := &cloudhub.DeviceMeta{
			IP: "192.168.1.601", // attempt IP change
		}

		err = s.UpdateDevice(cancelCtx, testDevice.Hostname, patch)
		if err != nil {
			t.Log("Update correctly failed with cancelled context:", err)
		} else {
			t.Log("Update unexpectedly succeeded with cancelled context")
		}

		// Verify rollback - confirm data was not changed
		afterCancel, err := s.GetDevice(ctx, testDevice.Hostname)
		if err != nil {
			t.Fatal("Failed to get device after context cancellation:", err)
		}

		if !reflect.DeepEqual(*afterCancel, *original) {
			t.Log("Data was modified despite context cancellation - this may be implementation dependent")
			t.Logf("Original: %+v", *original)
			t.Logf("After cancel: %+v", *afterCancel)
		} else {
			t.Log("ROLLBACK VERIFIED: No changes made with cancelled context")
		}
	})

}
func TestDeviceMappingsStore_AllDevices(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DeviceMappingsStore()
	ctx := context.Background()
	// Clean up test data before starting the test
	devices, _ := s.AllDevices(ctx, cloudhub.AccessContext{IsSuperAdmin: true})
	for _, d := range devices {
		fmt.Println("Before test - will delete:", d.Hostname)
		_ = s.DeleteDevice(ctx, d.Hostname)
	}
	devices, _ = s.AllDevices(ctx, cloudhub.AccessContext{IsSuperAdmin: true})
	fmt.Printf("After delete: %d devices remain\n", len(devices))
	for _, d := range devices {
		fmt.Println("Residual device:", d.Hostname)
	}
	device1 := &cloudhub.DeviceMeta{
		IP:         "10.0.0.1",
		Hostname:   "server-1",
		AliasName:  "alias-1",
		DeviceType: "VM",
		OrgID:      "org-1",
	}
	device2 := &cloudhub.DeviceMeta{
		IP:         "10.0.0.2",
		Hostname:   "server-2",
		AliasName:  "alias-2",
		DeviceType: "baremetal",
		OrgID:      "org-2",
	}
	if err := s.AddDevice(ctx, device1); err != nil {
		t.Fatal("Failed to add device1:", err)
	}
	if err := s.AddDevice(ctx, device2); err != nil {
		t.Fatal("Failed to add device2:", err)
	}
	t.Run("AllDevices_SuperAdmin", func(t *testing.T) {
		access := cloudhub.AccessContext{IsSuperAdmin: true}
		devices, err := s.AllDevices(ctx, access)
		if err != nil {
			t.Fatal("AllDevices (superadmin) failed:", err)
		}
		if len(devices) != 2 {
			t.Fatalf("SuperAdmin should see all devices. got %d, want 2", len(devices))
		}
		var hostnames []string
		for _, d := range devices {
			hostnames = append(hostnames, d.Hostname)
		}
		if !contains(hostnames, "server-1") || !contains(hostnames, "server-2") {
			t.Fatalf("SuperAdmin missing devices: %v", hostnames)
		}
		t.Log("SuperAdmin sees all devices:", hostnames)
	})

	t.Run("AllDevices_OrgAdmin_Org1", func(t *testing.T) {
		access := cloudhub.AccessContext{OrgID: "org-1"}
		devices, err := s.AllDevices(ctx, access)
		if err != nil {
			t.Fatal("AllDevices (org admin org-1) failed:", err)
		}
		if len(devices) != 1 || devices[0].Hostname != "server-1" {
			t.Fatalf("Org-1 admin should see only server-1: got %+v", devices)
		}
		t.Log("Org-1 admin sees:", devices[0].Hostname)
	})

	t.Run("AllDevices_OrgAdmin_Org2", func(t *testing.T) {
		access := cloudhub.AccessContext{OrgID: "org-2"}
		devices, err := s.AllDevices(ctx, access)
		if err != nil {
			t.Fatal("AllDevices (org admin org-2) failed:", err)
		}
		if len(devices) != 1 || devices[0].Hostname != "server-2" {
			t.Fatalf("Org-2 admin should see only server-2: got %+v", devices)
		}
		t.Log("Org-2 admin sees:", devices[0].Hostname)
	})

	t.Run("AllDevices_NoOrgInfo", func(t *testing.T) {
		access := cloudhub.AccessContext{}
		_, err := s.AllDevices(ctx, access)
		if err == nil {
			t.Fatal("Org info is required")
		}
		t.Log("Org info is required:", err)
	})
}

func contains(list []string, item string) bool {
	for _, v := range list {
		if v == item {
			return true
		}
	}
	return false
}
