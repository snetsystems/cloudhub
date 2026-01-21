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
			name:  "Initialize builtin dashboards for new organization",
			orgID:  "test-org-1",
			existingDashes: []cloudhub.Dashboard{},
			wantCount: 1, // hostpage.json
			wantErr:  false,
		},
		{
			name:  "Skip existing builtin dashboards",
			orgID:  "test-org-2",
			existingDashes: []cloudhub.Dashboard{
				{
					Name:         "Host Page",
					Organization:  "test-org-2",
					Type:         "builtin",
				},
			},
			wantCount: 0, // Already exists, should skip
			wantErr:  false,
		},
		{
			name:  "Add builtin dashboard even if normal dashboard exists",
			orgID:  "test-org-3",
			existingDashes: []cloudhub.Dashboard{
				{
					Name:         "Normal Dashboard",
					Organization:  "test-org-3",
					Type:         "normal",
				},
			},
			wantCount: 1, // Should still add builtin dashboard
			wantErr:  false,
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

			// Create context with organization
			ctx := context.WithValue(context.Background(), organizations.ContextKey, ts.orgID)

			// Initialize builtin dashboards
			err := InitializeBuiltinDashboards(
				ctx,
				ts.orgID,
				mockDashboardsStore,
				builtinStore,
				log.New(log.DebugLevel),
			)

			if (err != nil) != ts.wantErr {
				t.Errorf("InitializeBuiltinDashboards() error = %v, wantErr %v", err, ts.wantErr)
				return
			}

			if !ts.wantErr {
				if len(addedDashboards) != ts.wantCount {
					t.Errorf("InitializeBuiltinDashboards() added %d dashboards, want %d", len(addedDashboards), ts.wantCount)
				}

				// Verify added dashboards have correct properties
				for _, dashboard := range addedDashboards {
					if dashboard.Organization != ts.orgID {
						t.Errorf("InitializeBuiltinDashboards() added dashboard with organization %q, want %q", dashboard.Organization, ts.orgID)
					}
					if dashboard.Type != "builtin" {
						t.Errorf("InitializeBuiltinDashboards() added dashboard with type %q, want 'builtin'", dashboard.Type)
					}
				}
			}
		})
	}
}
