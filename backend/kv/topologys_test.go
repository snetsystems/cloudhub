package kv_test

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure an TopologiesStore can store, retrieve, update, and delete topology.
func TestTopologiesStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.TopologiesStore()

	tss := []cloudhub.Topology{
		{
			ID:           "",
			Organization: "133",
			Diagram:      "<mxGraphModel><root></root></mxGraphModel>",
			Preferences:  []string{"type:inlet,active:1,min:15,max:30"},
		},
		{
			ID:           "",
			Organization: "226541",
			Diagram:      "<mxGraphModel><root></root></mxGraphModel>",
			Preferences:  []string{"type:inlet,active:1,min:15,max:30"},
		},
	}

	// Add new topology.
	ctx := context.Background()
	for i, ts := range tss {
		var rtnTs *cloudhub.Topology
		if rtnTs, err = s.Add(ctx, &ts); err != nil {
			t.Fatal(err)
		}
		tss[i].ID = rtnTs.ID

		// Confirm first ts in the store is the same as the original.
		if actual, err := s.Get(ctx, cloudhub.TopologyQuery{ID: &rtnTs.ID}); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, tss[i]) {
			t.Fatalf("topology loaded is different then topology saved; actual: %v, expected %v", *actual, tss[i])
		}
	}

	// Update topology.
	tss[1].Diagram = "<mxGraphModel><root><mxCell></mxCell></root></mxGraphModel>"
	tss[1].Preferences = []string{
		"type:inlet,active:1,min:15,max:30",
	}
	if err := s.Update(ctx, &tss[1]); err != nil {
		t.Fatal(err)
	}

	// Confirm topology have updated.
	ts, err := s.Get(ctx, cloudhub.TopologyQuery{ID: &tss[1].ID})
	fmt.Println(ts)
	if err != nil {
		t.Fatal(err)
	} else if ts.Diagram != "<mxGraphModel><root><mxCell></mxCell></root></mxGraphModel>" {
		t.Fatalf("topology 1 update error: got %v, expected %v", ts.Diagram, "<mxGraphModel><root><mxCell></mxCell></root></mxGraphModel>")
	} else if ts.Preferences[0] != "type:inlet,active:1,min:15,max:30" {
		t.Fatalf("topology 1 update error: got %v, expected %v", ts.Preferences[0], "type:inlet,active:1,min:15,max:30")
	}

	// Delete an topology.
	if err := s.Delete(ctx, ts); err != nil {
		t.Fatal(err)
	}

	// Confirm topology has been deleted.
	if _, err := s.Get(ctx, cloudhub.TopologyQuery{ID: &tss[1].ID}); err != cloudhub.ErrTopologyNotFound {
		t.Fatalf("topology delete error: got %v, expected %v", err, cloudhub.ErrTopologyNotFound)
	}
}
