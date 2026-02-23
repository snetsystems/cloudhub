package server

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/builtin"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

func TestInitializeBuiltinDashboards(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		orgID          string
		existingDashes []cloudhub.Dashboard
		wantCount      int
		wantErr        bool
	}{
		{
			name:           "Initialize builtin dashboards for new organization",
			orgID:          "test-org-1",
			existingDashes: []cloudhub.Dashboard{},
			wantCount:      1, // hostpage.json
			wantErr:        false,
		},
		{
			name:  "Skip existing builtin dashboards",
			orgID: "test-org-2",
			existingDashes: []cloudhub.Dashboard{
				{
					Name:         "host_page",
					Organization: "test-org-2",
					Type:         cloudhub.DashboardTypeBuiltin,
				},
			},
			wantCount: 0, // Already exists, should skip
			wantErr:   false,
		},
		{
			name:  "Add builtin dashboard even if normal dashboard exists",
			orgID: "test-org-3",
			existingDashes: []cloudhub.Dashboard{
				{
					Name:         "Normal Dashboard",
					Organization: "test-org-3",
					Type:         cloudhub.DashboardTypeNormal,
				},
			},
			wantCount: 1, // Should still add builtin dashboard
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		ts := tt
		t.Run(ts.name, func(t *testing.T) {
			t.Parallel()

			// Create mock dashboards store
			addedDashboards := []cloudhub.Dashboard{}
			mockDashboardsStore := &mocks.DashboardsStore{
				AllF: func(ctx context.Context) ([]cloudhub.Dashboard, error) {
					return ts.existingDashes, nil
				},
				AddF: func(ctx context.Context, d cloudhub.Dashboard) (cloudhub.Dashboard, error) {
					addedDashboards = append(addedDashboards, d)
					d.ID = cloudhub.DashboardID(len(addedDashboards))
					return d, nil
				},
			}

			// Create builtin store
			builtinStore := &builtin.BinDashboardsStore{
				Logger: log.New(log.DebugLevel),
			}

			// Mock mapping store (no-op for tests; optional: verify Register calls)
			mockMappingStore := &mocks.BuiltinDashboardMappingStore{}

			// Create context with organization
			ctx := context.WithValue(context.Background(), organizations.ContextKey, tt.orgID)

			// Initialize builtin dashboards
			err := InitializeBuiltinDashboards(
				ctx,
				tt.orgID,
				mockDashboardsStore,
				builtinStore,
				mockMappingStore,
				log.New(log.DebugLevel),
			)

			if (err != nil) != tt.wantErr {
				t.Errorf("InitializeBuiltinDashboards() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if len(addedDashboards) != tt.wantCount {
					t.Errorf("InitializeBuiltinDashboards() added %d dashboards, want %d", len(addedDashboards), tt.wantCount)
				}

				// Verify added dashboards have correct properties
				for _, dashboard := range addedDashboards {
					if dashboard.Organization != tt.orgID {
						t.Errorf("InitializeBuiltinDashboards() added dashboard with organization %q, want %q", dashboard.Organization, tt.orgID)
					}
					if dashboard.Type != cloudhub.DashboardTypeBuiltin {
						t.Errorf("InitializeBuiltinDashboards() added dashboard with type %q, want %q", dashboard.Type, cloudhub.DashboardTypeBuiltin)
					}
					// Every cell in a builtin dashboard must have CellOrigin set to builtin
					for i, cell := range dashboard.Cells {
						if cell.CellOrigin != cloudhub.CellOriginBuiltin {
							t.Errorf("InitializeBuiltinDashboards() added dashboard %q cell[%d] has cellOrigin %q, want %q", dashboard.Name, i, cell.CellOrigin, cloudhub.CellOriginBuiltin)
						}
					}
				}
			}
		})
	}
}

func TestApplyBuiltinDashboardToOrg(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	realBuiltinStore := &builtin.BinDashboardsStore{Logger: log.New(log.DebugLevel)}
	template, err := realBuiltinStore.Get(ctx, "host_page")
	if err != nil {
		t.Skip("host_page builtin not available:", err)
	}

	// Org dashboard has one component cell (same ID as in template) and one non-component cell
	orgDash := cloudhub.Dashboard{
		ID: 1, Organization: "org1", Name: "host_page", Version: "1.0.0",
		Cells: []cloudhub.DashboardCell{
			{ID: "host-table-cell ", Type: "component", Name: "Host List", Queries: []cloudhub.DashboardQuery{{Command: "old-query"}}},
			{ID: "other", Type: "line", Name: "Other", Queries: []cloudhub.DashboardQuery{{Command: "other-query"}}},
		},
		Templates: []cloudhub.Template{{ID: "old", Label: "Old"}},
	}
	var updated cloudhub.Dashboard
	mockDashboardsStore := &mocks.DashboardsStore{
		GetF: func(ctx context.Context, id cloudhub.DashboardID) (cloudhub.Dashboard, error) {
			if id == 1 {
				return orgDash, nil
			}
			return cloudhub.Dashboard{}, cloudhub.ErrDashboardNotFound
		},
		UpdateF: func(ctx context.Context, d cloudhub.Dashboard) error {
			updated = d
			return nil
		},
	}
	mockMappingStore := &mocks.BuiltinDashboardMappingStore{
		GetDashboardIDF: func(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
			if orgID == "org1" && name == "host_page" {
				return 1, nil
			}
			return 0, cloudhub.ErrDashboardNotFound
		},
	}

	err = ApplyBuiltinDashboardToOrg(ctx, "org1", "host_page", mockDashboardsStore, realBuiltinStore, mockMappingStore, log.New(log.DebugLevel))
	if err != nil {
		t.Fatalf("ApplyBuiltinDashboardToOrg() error = %v", err)
	}
	if len(updated.Templates) != len(template.Templates) {
		t.Errorf("Templates length = %d, want %d", len(updated.Templates), len(template.Templates))
	}
	if updated.Version != template.Version {
		t.Errorf("Version = %q, want %q", updated.Version, template.Version)
	}
	// Component cell: Queries should come from template (matched by ID)
	var componentCell *cloudhub.DashboardCell
	for i := range updated.Cells {
		if updated.Cells[i].Type == "component" && updated.Cells[i].ID == "host-table-cell " {
			componentCell = &updated.Cells[i]
			break
		}
	}
	if componentCell == nil {
		t.Fatal("component cell not found in updated dashboard")
	}
	if len(componentCell.Queries) != len(template.Cells[0].Queries) {
		t.Errorf("component cell Queries length = %d, want %d (from template)", len(componentCell.Queries), len(template.Cells[0].Queries))
	}
	// Non-component cell: unchanged
	var otherCell *cloudhub.DashboardCell
	for i := range updated.Cells {
		if updated.Cells[i].ID == "other" {
			otherCell = &updated.Cells[i]
			break
		}
	}
	if otherCell == nil || len(otherCell.Queries) != 1 || otherCell.Queries[0].Command != "other-query" {
		t.Errorf("non-component cell should be unchanged: got %+v", otherCell)
	}
}
