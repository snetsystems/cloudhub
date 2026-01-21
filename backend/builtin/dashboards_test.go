package builtin

import (
	"context"
	"testing"

	"github.com/snetsystems/cloudhub/backend/log"
)

func TestBinDashboardsStore_All(t *testing.T) {
	t.Parallel()

	store := &BinDashboardsStore{
		Logger: log.New(log.DebugLevel),
	}

	ctx := context.Background()
	dashboards, err := store.All(ctx)
	if err != nil {
		t.Fatalf("BinDashboardsStore.All() error = %v", err)
	}

	// Should have at least one builtin dashboard (hostpage.json)
	if len(dashboards) == 0 {
		t.Error("BinDashboardsStore.All() returned no dashboards, expected at least one")
	}

	// Check that all returned dashboards have type "builtin"
	for _, dashboard := range dashboards {
		if dashboard.Type != "builtin" {
			t.Errorf("BinDashboardsStore.All() returned dashboard with type %q, expected 'builtin'", dashboard.Type)
		}
		if dashboard.Name == "" {
			t.Error("BinDashboardsStore.All() returned dashboard with empty name")
		}
	}
}

func TestBinDashboardsStore_Get(t *testing.T) {
	t.Parallel()

	store := &BinDashboardsStore{
		Logger: log.New(log.DebugLevel),
	}

	ctx := context.Background()

	// First, get all dashboards to find a valid name
	allDashboards, err := store.All(ctx)
	if err != nil {
		t.Fatalf("BinDashboardsStore.All() error = %v", err)
	}

	if len(allDashboards) == 0 {
		t.Skip("No builtin dashboards available for testing")
	}

	testName := allDashboards[0].Name

	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name:    "Get existing dashboard by name",
			input:   testName,
			wantErr: false,
		},
		{
			name:    "Get non-existent dashboard",
			input:   "NonExistentDashboard",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		ts := tt
		t.Run(ts.name, func(t *testing.T) {
			t.Parallel()
			dashboard, err := store.Get(ctx, ts.input)
			if (err != nil) != ts.wantErr {
				t.Errorf("BinDashboardsStore.Get() error = %v, wantErr %v", err, ts.wantErr)
				return
			}
			if !ts.wantErr {
				if dashboard.Name != ts.input {
					t.Errorf("BinDashboardsStore.Get() returned dashboard with name %q, expected %q", dashboard.Name, ts.input)
				}
				if dashboard.Type != "builtin" {
					t.Errorf("BinDashboardsStore.Get() returned dashboard with type %q, expected 'builtin'", dashboard.Type)
				}
			}
		})
	}
}

func TestBinDashboardsStore_GetByFileName(t *testing.T) {
	t.Parallel()

	store := &BinDashboardsStore{
		Logger: log.New(log.DebugLevel),
	}

	ctx := context.Background()

	tests := []struct {
		name      string
		fileName  string
		wantErr   bool
		wantName  string
	}{
		{
			name:     "Get hostpage dashboard by file name",
			fileName: "hostpage",
			wantErr:  false,
			wantName: "Host Page",
		},
		{
			name:     "Get hostpage dashboard by file name with extension",
			fileName: "hostpage.json",
			wantErr:  false,
			wantName: "Host Page",
		},
		{
			name:     "Get non-existent dashboard",
			fileName: "nonexistent",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		ts := tt
		t.Run(ts.name, func(t *testing.T) {
			t.Parallel()
			dashboard, err := store.GetByFileName(ctx, ts.fileName)
			if (err != nil) != ts.wantErr {
				t.Errorf("BinDashboardsStore.GetByFileName() error = %v, wantErr %v", err, ts.wantErr)
				return
			}
			if !ts.wantErr {
				if dashboard.Name != ts.wantName {
					t.Errorf("BinDashboardsStore.GetByFileName() returned dashboard with name %q, expected %q", dashboard.Name, ts.wantName)
				}
				if dashboard.Type != "builtin" {
					t.Errorf("BinDashboardsStore.GetByFileName() returned dashboard with type %q, expected 'builtin'", dashboard.Type)
				}
			}
		})
	}
}
