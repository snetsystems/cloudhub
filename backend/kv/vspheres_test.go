package kv_test

import (
	"fmt"
	"context"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure an VsphereStore can store, retrieve, update, and delete vspheress.
func TestVsphereStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.VspheresStore()

	vss := []cloudhub.Vsphere{
		{
			ID:              "123",
			Host:            "1.1.1.1",
			UserName:        "test@vmware.com",
			Password:        "*&^T$$iiiii",
			Protocol:        "http",
			Port:            45,
			Organization:    "133",
			Minion:          "minion01",
			DataSource:      "23",
		},
		{
			ID:              "456",
			Host:            "2.2.2.2",
			UserName:        "adbdd@vmware.com",
			Password:        "asdfididsd",
			Protocol:        "tcp",
			Port:            8476,
			Organization:    "133",
			Minion:          "minion02",
			DataSource:      "23",
		},
	}

	// Add new vsphere.
	ctx := context.Background()
	for i, vs := range vss {
		if vss[i], err = s.Add(ctx, vs); err != nil {
			t.Fatal(err)
		}
		// Confirm first vs in the store is the same as the original.
		if actual, err := s.Get(ctx, vss[i].ID); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(actual, vss[i]) {
			t.Fatalf("vsphere loaded is different then vsphere saved; actual: %v, expected %v", actual, vss[i])
		}
	}

	// Update vsphere.
	vss[0].Password = "!@#$uuuuuuuuuuu"
	vss[1].Port = 4325
	vss[1].Organization = "1234"
	vss[1].DataSource = "56"
	if err := s.Update(ctx, vss[0]); err != nil {
		t.Fatal(err)
	} else if err := s.Update(ctx, vss[1]); err != nil {
		t.Fatal(err)
	}

	// Confirm vsphere have updated.
	vs, err := s.Get(ctx, vss[0].ID);
	fmt.Println(vs)
	if err != nil {
		t.Fatal(err)
	} else if vs.Password != "!@#$uuuuuuuuuuu" {
		t.Fatalf("vsphere 0 update error: got %v, expected %v", vs.Password, "!@#$uuuuuuuuuuu")
	}

	vs, err = s.Get(ctx, vss[1].ID);
	fmt.Println(vs)
	if  err != nil {
		t.Fatal(err)
	} else if vs.Port != 4325 {
		t.Fatalf("vsphere 1 update error: got %v, expected %d", vs.Port, 4325)
	} else if vs.Organization != "1234" {
		t.Fatalf("vsphere 1 update error: got %v, expected %v", vs.Organization, "1234")
	} else if vs.DataSource != "56" {
		t.Fatalf("vsphere 1 update error: got %v, expected %v", vs.DataSource, "56")
	}

	// Delete an vsphere.
	if err := s.Delete(ctx, vss[0]); err != nil {
		t.Fatal(err)
	}

	// Confirm vsphere has been deleted.
	if _, err := s.Get(ctx, vss[0].ID); err != cloudhub.ErrVsphereNotFound {
		t.Fatalf("vsphere delete error: got %v, expected %v", err, cloudhub.ErrVsphereNotFound)
	}

	if bvss, err := s.All(ctx); err != nil {
		t.Fatal(err)
	} else if len(bvss) != 1 {
		t.Fatalf("After delete All returned incorrect number of vss; got %d, expected %d", len(bvss), 1)
	} else if !reflect.DeepEqual(bvss[0], vss[1]) {
		t.Fatalf("After delete All returned incorrect vsphere; got %v, expected %v", bvss[0], vss[1])
	}
}
