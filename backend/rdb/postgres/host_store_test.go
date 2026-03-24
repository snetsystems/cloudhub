package postgres_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/postgres"
)

func setupTestDB(t *testing.T) (*postgres.Client, func()) {
	t.Helper()
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN not set")
	}
	ctx := context.Background()
	client, err := postgres.NewClient(ctx, dsn)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if err := client.Migrate(ctx); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	cleanup := func() {
		_, _ = client.ExecContext(ctx, "TRUNCATE TABLE hosts RESTART IDENTITY CASCADE")
		client.Close()
	}
	return client, cleanup
}

func TestHostStore_AddAndGet_WithInterfaces(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	host := &cloudhub.Host{
		MinionID: "minion-001",
		Hostname: "server01",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "192.168.1.10"},
			{InterfaceName: "lo", IPAddress: "127.0.0.1"},
		},
		OS:         "Ubuntu",
		OSVersion:  "22.04",
		Arch:       "x86_64",
		MemTotalKB: 8192000,
		CPUCores:   4,
		Disks: []cloudhub.Disk{
			{Device: "/dev/sda1", MountPoint: "/"},
			{Device: "/dev/sdb1", MountPoint: "/data"},
		},
		GPUs: []cloudhub.GPU{
			{Slot: 0, Vendor: "NVIDIA", Model: "RTX 4090"},
		},
		SourceType: "salt",
		OrgID:      "",
		CreatedAt:  time.Now().Truncate(time.Millisecond),
	}

	created, err := store.Add(ctx, host)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected non-empty ID after Add")
	}
	if created.UpdatedAt.IsZero() {
		t.Error("expected UpdatedAt to be set after Add")
	}
	if created.DeleteYN {
		t.Error("expected DeleteYN=false after Add")
	}

	got, err := store.Get(ctx, cloudhub.HostQuery{MinionID: &host.MinionID})
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Hostname != host.Hostname {
		t.Errorf("hostname: got %q, want %q", got.Hostname, host.Hostname)
	}
	if got.SourceType != host.SourceType {
		t.Errorf("sourceType: got %q, want %q", got.SourceType, host.SourceType)
	}
	if got.CPUCores != host.CPUCores {
		t.Errorf("cpuCores: got %d, want %d", got.CPUCores, host.CPUCores)
	}
	if len(got.IPInterfaces) != len(host.IPInterfaces) {
		t.Errorf("ipInterfaces count: got %d, want %d", len(got.IPInterfaces), len(host.IPInterfaces))
	}
	if len(got.Disks) != len(host.Disks) {
		t.Errorf("disks count: got %d, want %d", len(got.Disks), len(host.Disks))
	}
	if len(got.GPUs) != 1 || got.GPUs[0].Vendor != "NVIDIA" || got.GPUs[0].Model != "RTX 4090" {
		t.Errorf("gpus: got %+v", got.GPUs)
	}
}

// TestHostStore_Add_NewRowOnReregister verifies that soft-deleting then re-accepting
// the same minion creates a new row (new UUID) rather than updating the old one.
func TestHostStore_Add_NewRowOnReregister(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	minionID := "rereg-minion"

	first := &cloudhub.Host{
		MinionID: minionID,
		Hostname: "host-first",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "10.0.0.1"},
		},
		SourceType: "salt",
	}
	created1, err := store.Add(ctx, first)
	if err != nil {
		t.Fatalf("first Add: %v", err)
	}
	firstID := created1.ID

	// Soft delete the first registration
	if err := store.Delete(ctx, minionID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// Re-register with new data
	second := &cloudhub.Host{
		MinionID: minionID,
		Hostname: "host-second",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth1", IPAddress: "10.0.0.2"},
			{InterfaceName: "eth2", IPAddress: "10.0.0.3"},
		},
		GPUs: []cloudhub.GPU{
			{Vendor: "NVIDIA", Model: "A100"},
		},
		SourceType: "salt",
	}
	created2, err := store.Add(ctx, second)
	if err != nil {
		t.Fatalf("re-register Add: %v", err)
	}

	// New row must have a different UUID
	if created2.ID == firstID {
		t.Errorf("expected new UUID on re-register, got same ID %q", firstID)
	}

	// Get returns the new (active) row
	got, err := store.Get(ctx, cloudhub.HostQuery{MinionID: &minionID})
	if err != nil {
		t.Fatalf("Get after re-register: %v", err)
	}
	if got.ID != created2.ID {
		t.Errorf("Get returned old row ID %q, want new ID %q", got.ID, created2.ID)
	}
	if got.Hostname != "host-second" {
		t.Errorf("hostname: got %q, want %q", got.Hostname, "host-second")
	}
	if len(got.IPInterfaces) != 2 {
		t.Errorf("expected 2 IPInterfaces, got %d", len(got.IPInterfaces))
	}
	if len(got.GPUs) != 1 {
		t.Errorf("expected 1 GPU, got %d", len(got.GPUs))
	}

	// All returns only 1 active host
	all, err := store.All(ctx)
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(all) != 1 {
		t.Errorf("All: expected 1 active host, got %d", len(all))
	}
}

// TestHostStore_Delete_SoftDelete verifies that Delete marks delete_yn=true
// and the host disappears from Get and All without removing child data.
func TestHostStore_Delete_SoftDelete(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	host := &cloudhub.Host{
		MinionID: "del-minion",
		Hostname: "to-delete",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "192.168.1.1"},
		},
		Disks: []cloudhub.Disk{
			{Device: "/dev/sda1", MountPoint: "/"},
		},
		SourceType: "salt",
	}
	if _, err := store.Add(ctx, host); err != nil {
		t.Fatalf("Add: %v", err)
	}
	if err := store.Delete(ctx, host.MinionID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// Get must return ErrHostNotFound (active row gone)
	_, err := store.Get(ctx, cloudhub.HostQuery{MinionID: &host.MinionID})
	if err != cloudhub.ErrHostNotFound {
		t.Errorf("expected ErrHostNotFound after soft delete, got %v", err)
	}

	// All must not include the deleted host
	all, err := store.All(ctx)
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	for _, h := range all {
		if h.MinionID == host.MinionID {
			t.Errorf("soft-deleted host still appears in All()")
		}
	}
}

func TestHostStore_All(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	for i, id := range []string{"minion-a", "minion-b", "minion-c"} {
		id := id
		i := i
		_, err := store.Add(ctx, &cloudhub.Host{
			MinionID: id,
			Hostname: fmt.Sprintf("host-%d", i),
			IPInterfaces: []cloudhub.IPInterface{
				{InterfaceName: "eth0", IPAddress: fmt.Sprintf("10.0.0.%d", i+1)},
			},
			SourceType: "salt",
		})
		if err != nil {
			t.Fatalf("Add %s: %v", id, err)
		}
	}

	all, err := store.All(ctx)
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(all) != 3 {
		t.Errorf("expected 3 hosts, got %d", len(all))
	}
	for _, h := range all {
		if len(h.IPInterfaces) != 1 {
			t.Errorf("host %s: expected 1 IPInterface, got %d", h.MinionID, len(h.IPInterfaces))
		}
	}
}

func TestHostStoreDeleteNotFound(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	err := store.Delete(ctx, "non-existent-minion")
	if err != cloudhub.ErrHostNotFound {
		t.Fatalf("expected ErrHostNotFound, got %v", err)
	}
}

// TestHostStore_Add_DuplicateConflict verifies that Add returns an error
// when an active host with the same minion_id already exists (no upsert).
func TestHostStore_Add_DuplicateConflict(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	host := &cloudhub.Host{
		MinionID:   "dup-minion",
		Hostname:   "host-dup",
		SourceType: "salt",
	}
	if _, err := store.Add(ctx, host); err != nil {
		t.Fatalf("first Add: %v", err)
	}

	// Second Add with same active minion_id must fail (unique constraint)
	_, err := store.Add(ctx, &cloudhub.Host{
		MinionID:   "dup-minion",
		Hostname:   "host-dup-2",
		SourceType: "salt",
	})
	if err == nil {
		t.Fatal("expected error on duplicate Add, got nil")
	}
}

// TestHostStore_Update_ChangesAllFields verifies that Update replaces hardware
// info and related tables (ip_interfaces, disks, gpus).
func TestHostStore_Update_ChangesAllFields(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	orig := &cloudhub.Host{
		MinionID: "upd-minion",
		Hostname: "old-host",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "192.168.1.1"},
		},
		Disks:      []cloudhub.Disk{{Device: "/dev/sda1", MountPoint: "/"}},
		GPUs:       []cloudhub.GPU{{Vendor: "NVIDIA", Model: "GTX 1080"}},
		SourceType: "salt",
		Status:     "accepted",
	}
	if _, err := store.Add(ctx, orig); err != nil {
		t.Fatalf("Add: %v", err)
	}

	updated := &cloudhub.Host{
		MinionID: "upd-minion",
		Hostname: "new-host",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "10.0.0.99"},
			{InterfaceName: "eth1", IPAddress: "10.0.0.100"},
		},
		Disks:      []cloudhub.Disk{{Device: "/dev/nvme0n1", MountPoint: "/data"}},
		GPUs:       []cloudhub.GPU{{Vendor: "AMD", Model: "RX 7900"}},
		CPUCores:   16,
		MemTotalKB: 32768000,
		SourceType: "salt",
		Status:     "accepted",
	}
	if _, err := store.Update(ctx, updated); err != nil {
		t.Fatalf("Update: %v", err)
	}

	got, err := store.Get(ctx, cloudhub.HostQuery{MinionID: func() *string { s := "upd-minion"; return &s }()})
	if err != nil {
		t.Fatalf("Get after Update: %v", err)
	}
	if got.Hostname != "new-host" {
		t.Errorf("hostname: got %q, want %q", got.Hostname, "new-host")
	}
	if got.IP != "10.0.0.99" {
		t.Errorf("ip: got %q, want 10.0.0.99", got.IP)
	}
	if len(got.IPInterfaces) != 2 {
		t.Errorf("ipInterfaces: got %d, want 2", len(got.IPInterfaces))
	}
	if len(got.Disks) != 1 || got.Disks[0].Device != "/dev/nvme0n1" {
		t.Errorf("disks: got %+v", got.Disks)
	}
	if len(got.GPUs) != 1 || got.GPUs[0].Vendor != "AMD" {
		t.Errorf("gpus: got %+v", got.GPUs)
	}
	if got.CPUCores != 16 {
		t.Errorf("cpuCores: got %d, want 16", got.CPUCores)
	}
}

// TestHostStore_Update_NotFound verifies that Update returns ErrHostNotFound
// when the minion does not exist.
func TestHostStore_Update_NotFound(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	_, err := store.Update(ctx, &cloudhub.Host{
		MinionID: "ghost-minion",
		Hostname: "ghost",
	})
	if err != cloudhub.ErrHostNotFound {
		t.Errorf("expected ErrHostNotFound, got %v", err)
	}
}

// TestHostStore_Patch_StatusOnly verifies that Patch changes only the
// specified field and leaves other fields intact.
func TestHostStore_Patch_StatusOnly(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	minionID := "patch-minion"
	host := &cloudhub.Host{
		MinionID:   minionID,
		Hostname:   "patch-host",
		CPUCores:   8,
		SourceType: "salt",
		Status:     "accepted",
	}
	if _, err := store.Add(ctx, host); err != nil {
		t.Fatalf("Add: %v", err)
	}

	rejected := "rejected"
	patched, err := store.Patch(ctx, minionID, cloudhub.HostPatch{Status: &rejected})
	if err != nil {
		t.Fatalf("Patch: %v", err)
	}
	if patched.Status != "rejected" {
		t.Errorf("status: got %q, want rejected", patched.Status)
	}
	// Other fields untouched
	if patched.Hostname != "patch-host" {
		t.Errorf("hostname changed unexpectedly: %q", patched.Hostname)
	}
	if patched.CPUCores != 8 {
		t.Errorf("cpuCores changed unexpectedly: %d", patched.CPUCores)
	}
}

// TestHostStore_Patch_NotFound verifies that Patch returns ErrHostNotFound
// for a non-existent minion.
func TestHostStore_Patch_NotFound(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	rejected := "rejected"
	_, err := store.Patch(ctx, "ghost-minion", cloudhub.HostPatch{Status: &rejected})
	if err != cloudhub.ErrHostNotFound {
		t.Errorf("expected ErrHostNotFound, got %v", err)
	}
}

func TestHostStore_GPU_SlotRoundTrip(t *testing.T) {
	client, cleanup := setupTestDB(t)
	defer cleanup()

	store := postgres.NewHostStore(client)
	ctx := context.Background()

	host := &cloudhub.Host{
		MinionID: "minion-gpu",
		Hostname: "gpu-server",
		IPInterfaces: []cloudhub.IPInterface{
			{InterfaceName: "eth0", IPAddress: "10.0.0.1"},
		},
		GPUs: []cloudhub.GPU{
			{Slot: 0, Vendor: "NVIDIA", Model: "Tesla T4"},
			{Slot: 1, Vendor: "NVIDIA", Model: "Tesla T4"},
			{Slot: 2, Vendor: "NVIDIA", Model: "RTX 4090"},
		},
		SourceType: "salt",
	}

	created, err := store.Add(ctx, host)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}

	got, err := store.Get(ctx, cloudhub.HostQuery{Hostname: &host.Hostname})
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if len(got.GPUs) != 3 {
		t.Fatalf("expected 3 GPUs, got %d", len(got.GPUs))
	}
	for i, gpu := range got.GPUs {
		if gpu.Slot != i {
			t.Errorf("GPU[%d].Slot = %d, want %d", i, gpu.Slot, i)
		}
	}
	if got.GPUs[0].Model != "Tesla T4" {
		t.Errorf("GPU[0].Model = %q, want Tesla T4", got.GPUs[0].Model)
	}
	if got.GPUs[2].Model != "RTX 4090" {
		t.Errorf("GPU[2].Model = %q, want RTX 4090", got.GPUs[2].Model)
	}

	all, err := store.All(ctx)
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	var found *cloudhub.Host
	for _, h := range all {
		if h.ID == created.ID {
			h := h
			found = &h
			break
		}
	}
	if found == nil {
		t.Fatal("host not found in All()")
	}
	if len(found.GPUs) != 3 {
		t.Fatalf("All: expected 3 GPUs, got %d", len(found.GPUs))
	}
}
