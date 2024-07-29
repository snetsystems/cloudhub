package kv_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure MLNxRstStore can store, retrieve, update, and delete.
func TestMLNxRstStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.MLNxRstStore()

	rsts := []cloudhub.MLNxRst{
		{
			Device:                 "192.168.1.1",
			LearningFinishDatetime: "2023-07-29T12:00:00Z",
			Epsilon:                0.01,
			MeanMatrix:             "[[1,0],[0,1]]",
			CovarianceMatrix:       "[[1,0],[0,1]]",
			K:                      1.0,
			Mean:                   0.0,
			MDThreshold:            0.5,
			MDArray:                []float32{0.1, 0.2},
			CPUArray:               []float32{10.0, 20.0},
			TrafficArray:           []float32{100.0, 200.0},
			GaussianArray:          []float32{0.1, 0.2},
		},
		{
			Device:                 "192.168.1.2",
			LearningFinishDatetime: "2023-07-29T13:00:00Z",
			Epsilon:                0.02,
			MeanMatrix:             "[[1,0],[0,1]]",
			CovarianceMatrix:       "[[1,0],[0,1]]",
			K:                      2.0,
			Mean:                   1.0,
			MDThreshold:            0.6,
			MDArray:                []float32{0.3, 0.4},
			CPUArray:               []float32{30.0, 40.0},
			TrafficArray:           []float32{300.0, 400.0},
			GaussianArray:          []float32{0.3, 0.4},
		},
	}

	// Add new MLNxRst.
	ctx := context.Background()
	for i, rst := range rsts {
		if _, err = s.Add(ctx, &rst); err != nil {
			t.Fatal(err)
		}
		// Check if the rst in the store is the same as the original.
		if actual, err := s.Get(ctx, cloudhub.MLNxRstQuery{ID: &rst.Device}); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, rsts[i]) {
			t.Fatalf("MLNxRst loaded is different than MLNxRst saved; actual: %v, expected %v", *actual, rsts[i])
		}
	}

	// Update MLNxRst.
	rstToUpdate := rsts[1]
	rstToUpdate.Mean = 2.0
	if err := s.Update(ctx, &rstToUpdate); err != nil {
		t.Fatal(err)
	}

	// Get all test.
	getRsts, err := s.All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(getRsts) < 2 {
		t.Fatalf("MLNxRst gets all error: the expected length is 2 but the real length is %d", len(getRsts))
	}

	// Get test.
	rst, err := s.Get(ctx, cloudhub.MLNxRstQuery{ID: &rstToUpdate.Device})
	if err != nil {
		t.Fatal(err)
	} else if rst.Mean != 2.0 {
		t.Fatalf("MLNxRst update error: got %v, expected %v", rst.Mean, 2.0)
	}

	// Getting test for a wrong id.
	wrongID := "wrong-id"
	_, err = s.Get(ctx, cloudhub.MLNxRstQuery{ID: &wrongID})
	if err == nil {
		t.Fatalf("Must be occurred error for a wrong id=%v, message=\"MLNxRst not found\"", wrongID)
	}

	// Delete the MLNxRst.
	if err := s.Delete(ctx, rst); err != nil {
		t.Fatal(err)
	}

	// Check if the rst has been deleted.
	if _, err := s.Get(ctx, cloudhub.MLNxRstQuery{ID: &rstToUpdate.Device}); !errors.Is(err, cloudhub.ErrMLNxRstNotFound) {
		t.Fatalf("MLNxRst delete error: got %v, expected %v", err, cloudhub.ErrMLNxRstNotFound)
	}
}
