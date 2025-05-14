package kv_test

import (
	"context"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// TestEsSourceStore verifies Add/Get/Update/Delete and default logic for EsSourcesStore.
func TestEsSourceStore(t *testing.T) {
	c, err := NewTestClient()

	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.EsSourcesStore()
	ctx := context.Background()

	// Prepare sample sources
	esList := []cloudhub.EsSource{
		{
			Name:               "no-auth-es",
			Default:            false,
			Role:               "viewer",
			Version:            "7.10.2",
			URL:                "https://es.local:9200",
			InsecureSkipVerify: false,
			IndexPatterns:      []string{"index-*"},
			DefaultIndex:       "index-1",
			Organization:       "org-001",
		},
		{
			Name:               "basic-es",
			Default:            true,
			Role:               "admin",
			Version:            "8.0.0",
			URL:                "https://secure-es:9200",
			InsecureSkipVerify: true,
			IndexPatterns:      []string{"logs-*", "metrics-*"},
			DefaultIndex:       "logs-2025",
			Organization:       "org-001",
			BasicAuth: &cloudhub.BasicAuth{
				Username: "elastic",
				Password: "changeme",
			},
		},
		{
			Name:               "api-es",
			Default:            false,
			Role:               "reader",
			Version:            "7.9.3",
			URL:                "https://api-es:9200",
			InsecureSkipVerify: false,
			IndexPatterns:      []string{"*"},
			DefaultIndex:       "default",
			Organization:       "org-002",
			APIKeyAuth: &cloudhub.APIKeyAuth{
				ID:     "key-id",
				APIKey: "secret",
			},
		},
	}

	// Add and verify Get
	for i, src := range esList {
		added, err := s.Add(ctx, src)
		if err != nil {
			t.Fatalf("Add failed for case %d: %v", i, err)
		}
		esList[i] = added

		got, err := s.Get(ctx, added.ID)
		if err != nil {
			t.Fatalf("Get failed for ID %d: %v", added.ID, err)
		}
		if !reflect.DeepEqual(got, added) {
			t.Fatalf("Get mismatch: got %+v, want %+v", got, added)
		}
	}

	// Update name and defaultIndex of first and second
	esList[0].Name = "updated-noauth"
	esList[1].DefaultIndex = "updated-logs"
	mustUpdateEsSource(t, s, esList[0])
	mustUpdateEsSource(t, s, esList[1])

	// Verify updates
	if u, _ := s.Get(ctx, esList[0].ID); u.Name != "updated-noauth" {
		t.Fatalf("Update Name failed: got %s, want %s", u.Name, "updated-noauth")
	}
	if u, _ := s.Get(ctx, esList[1].ID); u.DefaultIndex != "updated-logs" {
		t.Fatalf("Update DefaultIndex failed: got %s, want %s", u.DefaultIndex, "updated-logs")
	}

	// Default logic: only one default must exist
	esList[2].Default = true
	mustUpdateEsSource(t, s, esList[2])

	all, err := s.All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defaults := 0
	for _, x := range all {
		if x.Default {
			defaults++
		}
	}
	if defaults != 1 {
		t.Fatalf("default count = %d; want 1", defaults)
	}

	// Delete first
	if err := s.Delete(ctx, esList[0]); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Get(ctx, esList[0].ID); err != cloudhub.ErrSourceNotFound {
		t.Fatalf("expected ErrSourceNotFound after delete, got %v", err)
	}

	// Final cleanup: delete rest
	for _, src := range []cloudhub.EsSource{esList[1], esList[2]} {
		if err := s.Delete(ctx, src); err != nil {
			t.Fatal(err)
		}
	}

	// Ensure store empty
	if remaining, err := s.All(ctx); err != nil {
		t.Fatal(err)
	} else if len(remaining) != 0 {
		t.Fatalf("expected empty store, got %d entries", len(remaining))
	}
}

func mustUpdateEsSource(t *testing.T, s cloudhub.EsSourcesStore, src cloudhub.EsSource) {
	t.Helper()
	if err := s.Update(context.Background(), src); err != nil {
		t.Fatalf("Update failed: %v", err)
	}
}
