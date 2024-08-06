package kv_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure DLNxRstStore can store, retrieve, update, and delete.
func TestDLNxRstStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.DLNxRstStore()

	rsts := []cloudhub.DLNxRst{
		{
			Device:                 "192.168.1.1",
			LearningFinishDatetime: "2023-07-29T12:00:00Z",
			DLThreshold:            0.01,
			TrainLoss:              []float32{0.1, 0.2},
			ValidLoss:              []float32{0.3, 0.4},
			MSE:                    []float32{0.5, 0.6},
		},
		{
			Device:                 "192.168.1.2",
			LearningFinishDatetime: "2023-07-29T13:00:00Z",
			DLThreshold:            0.02,
			TrainLoss:              []float32{0.7, 0.8},
			ValidLoss:              []float32{0.9, 1.0},
			MSE:                    []float32{1.1, 1.2},
		},
	}

	// Add new DLNxRst.
	ctx := context.Background()
	for i, rst := range rsts {
		if _, err = s.Add(ctx, &rst); err != nil {
			t.Fatal(err)
		}
		// Check if the rst in the store is the same as the original.
		if actual, err := s.Get(ctx, cloudhub.DLNxRstQuery{ID: &rst.Device}); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, rsts[i]) {
			t.Fatalf("DLNxRst loaded is different than DLNxRst saved; actual: %v, expected %v", *actual, rsts[i])
		}
	}

	// Update DLNxRst.
	rstToUpdate := rsts[1]
	rstToUpdate.DLThreshold = 0.03
	if err := s.Update(ctx, &rstToUpdate); err != nil {
		t.Fatal(err)
	}

	// Get all test.
	getRsts, err := s.All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(getRsts) < 2 {
		t.Fatalf("DLNxRst gets all error: the expected length is 2 but the real length is %d", len(getRsts))
	}

	// Get test.
	rst, err := s.Get(ctx, cloudhub.DLNxRstQuery{ID: &rstToUpdate.Device})
	if err != nil {
		t.Fatal(err)
	} else if rst.DLThreshold != 0.03 {
		t.Fatalf("DLNxRst update error: got %v, expected %v", rst.DLThreshold, 0.03)
	}

	// Getting test for a wrong id.
	wrongID := "wrong-id"
	_, err = s.Get(ctx, cloudhub.DLNxRstQuery{ID: &wrongID})
	if err == nil {
		t.Fatalf("Must be occurred error for a wrong id=%v, message=\"DLNxRst not found\"", wrongID)
	}

	// Delete the DLNxRst.
	if err := s.Delete(ctx, rst); err != nil {
		t.Fatal(err)
	}

	// Check if the rst has been deleted.
	if _, err := s.Get(ctx, cloudhub.DLNxRstQuery{ID: &rstToUpdate.Device}); !errors.Is(err, cloudhub.ErrDLNxRstNotFound) {
		t.Fatalf("DLNxRst delete error: got %v, expected %v", err, cloudhub.ErrDLNxRstNotFound)
	}
}
