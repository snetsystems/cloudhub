package kv_test

import (
	"context"
	"errors"
	"reflect"
	"strconv"
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
			Algorithm:       "Algorithm_1",
			DataDuration:    1,
			LearnCycle:      2,
			DevicesID:       []string{"1", "2"},
			CollectorServer: "ch-collector-1",
		},
		{
			Algorithm:       "Algorithm_2",
			DataDuration:    2,
			LearnCycle:      3,
			DevicesID:       []string{"3", "4"},
			CollectorServer: "ch-collector-2"},
	}

	// Create an array to store the IDs and queries
	ids := make([]string, len(orgs))
	orgQueries := make([]cloudhub.NetworkDeviceOrgQuery, len(orgs))

	// Add new NetworkDeviceOrgs.
	ctx := context.Background()
	for i, org := range orgs {
		ids[i] = "org_id_" + strconv.Itoa(i)
		orgQueries[i] = cloudhub.NetworkDeviceOrgQuery{ID: &ids[i]}

		if _, err = s.Add(ctx, &org, orgQueries[i]); err != nil {
			t.Fatal(err)
		}
		// Check if the org in the store is the same as the original.
		if actual, err := s.Get(ctx, orgQueries[i]); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, orgs[i]) {
			t.Fatalf("Org loaded is different than Org saved; actual: %v, expected %v", *actual, orgs[i])
		}
	}

	// Update networkDeviceOrg.
	orgToUpdate := orgs[1]
	orgToUpdateQuery := orgQueries[1]
	orgToUpdate.Algorithm = "Algorithm_2"
	if err := s.Update(ctx, &orgToUpdate, orgToUpdateQuery); err != nil {
		t.Fatal(err)
	}

	// Get all test.
	allOrgsQuery := cloudhub.NetworkDeviceOrgQuery{}
	getOrgs, err := s.All(ctx, allOrgsQuery)
	if err != nil {
		t.Fatal(err)
	}
	if len(getOrgs) < 2 {
		t.Fatalf("Org gets all error: the expected length is 2 but the real length is %d", len(getOrgs))
	}

	// Get test.
	org, err := s.Get(ctx, orgToUpdateQuery)
	if err != nil {
		t.Fatal(err)
	} else if org.Algorithm != "Algorithm_2" {
		t.Fatalf("Org update error: got %v, expected %v", org.Algorithm, "Algorithm_2")
	}

	// Getting test for a wrong id.
	wrongID := "wrong-id"
	_, err = s.Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &wrongID})
	if err == nil {
		t.Fatalf("Must be occurred error for a wrong id=%v, message=\"Device not found\"", wrongID)
	}

	// Delete the networkDeviceOrg.
	if err := s.Delete(ctx, org, orgToUpdateQuery); err != nil {
		t.Fatal(err)
	}

	// Check if the org has been deleted.
	if _, err := s.Get(ctx, orgToUpdateQuery); !errors.Is(err, cloudhub.ErrDeviceNotFound) {
		t.Fatalf("Org delete error: got %v, expected %v", err, cloudhub.ErrDeviceNotFound)
	}
}
