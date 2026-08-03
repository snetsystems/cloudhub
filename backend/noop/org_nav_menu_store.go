package noop

import (
	"context"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure OrgNavMenuStore implements cloudhub.OrgNavMenuStore at compile time.
var _ cloudhub.OrgNavMenuStore = (*OrgNavMenuStore)(nil)

// OrgNavMenuStore is a no-op / fallback implementation of cloudhub.OrgNavMenuStore.
type OrgNavMenuStore struct{}

// DefaultSystemMasterNavItems returns the 11 default SideNav items with 2-tier submenus.
func DefaultSystemMasterNavItems() []cloudhub.OrgNavMenuItem {
	return []cloudhub.OrgNavMenuItem{
		{ID: "visualize", Label: "Visualize", Icon: "graphline-2", Enabled: true},
		{ID: "dashboards", Label: "Dashboards", Icon: "dash-j", Enabled: true},
		{
			ID: "network-monitoring", Label: "Network Monitoring", Icon: "network", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "network-management", Label: "Device Management", Enabled: true},
				{ID: "network-anomaly", Label: "Anomaly Monitoring", Enabled: true},
			},
		},
		{
			ID: "server-monitoring", Label: "Server Monitoring", Icon: "server2", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "server-topology", Label: "Topology Builder", Enabled: true},
				{ID: "server-list", Label: "Server List", Enabled: true},
				{ID: "server-details", Label: "Server Details", Enabled: true},
				{ID: "gpu-monitoring", Label: "NVIDIA GPU Monitoring", Enabled: true},
				{ID: "server-alert", Label: "Server Alert", Enabled: true},
			},
		},
		{
			ID: "url-monitoring", Label: "URL Monitoring", Icon: "sphere", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "url-list", Label: "URL List", Enabled: true},
				{ID: "url-alert", Label: "URL Alert", Enabled: true},
			},
		},
		{ID: "db-monitoring", Label: "DB Monitoring", Icon: "disks", Enabled: true},
		{ID: "app-performance-monitoring", Label: "App. Performance Monitoring", Icon: "tachometer", Enabled: true},
		{
			ID: "kubernetes", Label: "Kubernetes", Icon: "kubernetes", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "k8s-clusters", Label: "Clusters", Enabled: true},
				{ID: "k8s-nodes", Label: "Nodes", Enabled: true},
				{ID: "k8s-pods", Label: "Pods", Enabled: true},
			},
		},
		{
			ID: "log-viewer", Label: "Log Viewer", Icon: "document", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "log-analysis", Label: "Log Analysis", Enabled: true},
				{ID: "logs", Label: "Log Viewer", Enabled: true},
				{ID: "activity-logs", Label: "Activity Logs", Enabled: true},
			},
		},
		{
			ID: "alert", Label: "Alert", Icon: "bell", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "alert-rules", Label: "Alert Setting", Enabled: true},
				{ID: "alerts", Label: "Alert History", Enabled: true},
			},
		},
		{
			ID: "admin", Label: "Admin", Icon: "crown-outline", Enabled: true,
			Children: []cloudhub.OrgNavSubMenuItem{
				{ID: "admin-cloudhub", Label: "CloudHub", Enabled: true},
				{ID: "admin-influxdb", Label: "InfluxDB", Enabled: true},
			},
		},
	}
}

// GetByOrgID in noop returns fallback default master navigation with IsDegraded: true warning.
func (s *OrgNavMenuStore) GetByOrgID(ctx context.Context, orgID string) (*cloudhub.OrgNavMenu, error) {
	now := time.Now()
	return &cloudhub.OrgNavMenu{
		OrgID:      orgID,
		NavItems:   DefaultSystemMasterNavItems(),
		IsDegraded: true,
		Warning:    "데이터베이스 연결이 원활하지 않아 시스템 기본 메뉴가 안전 모드(Safe Fallback)로 제공됩니다.",
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (s *OrgNavMenuStore) Upsert(ctx context.Context, menu *cloudhub.OrgNavMenu) (*cloudhub.OrgNavMenu, error) {
	return nil, cloudhub.ErrOrgNavMenuNotFound
}

func (s *OrgNavMenuStore) Patch(ctx context.Context, orgID string, items []cloudhub.OrgNavMenuItem) (*cloudhub.OrgNavMenu, error) {
	return nil, cloudhub.ErrOrgNavMenuNotFound
}

func (s *OrgNavMenuStore) Delete(ctx context.Context, orgID string) error {
	return cloudhub.ErrOrgNavMenuNotFound
}

func (s *OrgNavMenuStore) GetMasterMenu(ctx context.Context) ([]cloudhub.MasterNavMenuItem, error) {
	return []cloudhub.MasterNavMenuItem{}, nil
}

func (s *OrgNavMenuStore) UpdateMasterMenu(ctx context.Context, items []cloudhub.OrgNavMenuItem) error {
	return cloudhub.ErrOrgNavMenuNotFound
}

func (s *OrgNavMenuStore) DeleteMasterMenuItem(ctx context.Context, itemID string) error {
	return cloudhub.ErrOrgNavMenuNotFound
}
