package kv

import (
	"context"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// builtinDashboardMappingStore stores (orgID, name) -> dashboard ID for builtin dashboards.
type builtinDashboardMappingStore struct {
	client *Service
}

// mappingKey returns the KV key: orgID + "\x00" + name.
func mappingKey(orgID, name string) []byte {
	return []byte(orgID + "\x00" + name)
}

// Ensure builtinDashboardMappingStore implements cloudhub.BuiltinDashboardMappingStore.
var _ cloudhub.BuiltinDashboardMappingStore = (*builtinDashboardMappingStore)(nil)

// GetDashboardID returns the dashboard ID for the builtin dashboard named name in the given org.
func (s *builtinDashboardMappingStore) GetDashboardID(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
	if orgID == "" || name == "" {
		return 0, cloudhub.ErrDashboardNotFound
	}
	var idStr string
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		v, err := tx.Bucket(dashboardsBuiltinMappingBucket).Get(mappingKey(orgID, name))
		if err == nil && v != nil {
			idStr = string(v)
		}
		return nil
	}); err != nil {
		return 0, err
	}
	if idStr == "" {
		return 0, cloudhub.ErrDashboardNotFound
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return 0, cloudhub.ErrDashboardNotFound
	}
	return cloudhub.DashboardID(id), nil
}

// Register records that the builtin dashboard named name in org orgID is stored as dashboardID.
func (s *builtinDashboardMappingStore) Register(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error {
	if orgID == "" || name == "" {
		return nil
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		idStr := strconv.Itoa(int(dashboardID))
		return tx.Bucket(dashboardsBuiltinMappingBucket).Put(mappingKey(orgID, name), []byte(idStr))
	})
}
