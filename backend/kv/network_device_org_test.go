package kv_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure a networkDeviceOrgStore can store, retrieve, update, and delete.
func TestNetworkDeviceOrgStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.NetworkDeviceOrgStore()

	orgs := []cloudhub.NetworkDeviceOrg{
		{
			ID:                "default",
			LoadModule:        "earn.ch_nx_load",
			MLFunction:        "Algorithm_1",
			DataDuration:      1,
			LearnedDevicesIDs: []uint64{1, 2},
			CollectorServer:   "ch-collector-1",
		},
		{
			ID:                "1",
			LoadModule:        "earn.ch_nx_load",
			MLFunction:        "Algorithm_2",
			DataDuration:      2,
			LearnedDevicesIDs: []uint64{3, 4},
			CollectorServer:   "ch-collector-2"},
	}

	// Create an array to store the IDs and queries

	orgQueries := make([]cloudhub.NetworkDeviceOrgQuery, len(orgs))

	// Add new NetworkDeviceOrgs.
	ctx := context.Background()
	for i, org := range orgs {
		orgQueries[i] = cloudhub.NetworkDeviceOrgQuery{ID: &org.ID}

		if _, err = s.Add(ctx, &org); err != nil {
			t.Fatal(err)
		}
		// Check if the org in the store is the same as the original.
		if actual, err := s.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &org.ID}); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, orgs[i]) {
			t.Fatalf("Org loaded is different than Org saved; actual: %v, expected %v", *actual, orgs[i])
		}
	}

	// Update networkDeviceOrg.
	orgToUpdate := orgs[1]

	orgToUpdate.MLFunction = "Algorithm_2"
	if err := s.Update(ctx, &orgToUpdate); err != nil {
		t.Fatal(err)
	}

	// Get all test.

	getOrgs, err := s.All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(getOrgs) < 2 {
		t.Fatalf("Org gets all error: the expected length is 2 but the real length is %d", len(getOrgs))
	}

	// Get test.
	org, err := s.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgToUpdate.ID})
	if err != nil {
		t.Fatal(err)
	} else if org.MLFunction != "Algorithm_2" {
		t.Fatalf("Org update error: got %v, expected %v", org.MLFunction, "Algorithm_2")
	}

	// Getting test for a wrong id.
	wrongID := "wrong-id"
	_, err = s.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &wrongID})
	if err == nil {
		t.Fatalf("Must be occurred error for a wrong id=%v, message=\"Device not found\"", wrongID)
	}

	// Delete the networkDeviceOrg.
	if err := s.Delete(ctx, org); err != nil {
		t.Fatal(err)
	}

	// Check if the org has been deleted.
	if _, err := s.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &orgToUpdate.ID}); !errors.Is(err, cloudhub.ErrDeviceNotFound) {
		t.Fatalf("Org delete error: got %v, expected %v", err, cloudhub.ErrDeviceNotFound)
	}
}
