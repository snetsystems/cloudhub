package kv

import (
	"context"
	"strconv"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// fixedCellMappingStore stores (orgID, name) -> dashboard ID for fixed-cell dashboards.
type fixedCellMappingStore struct {
	client *Service
}

// mappingKey returns the KV key: orgID + "/" + name (hierarchy: e.g. default/server-details).
func mappingKey(orgID, name string) []byte {
	return []byte(orgID + "/" + name)
}

// Ensure fixedCellMappingStore implements cloudhub.FixedCellMappingStore.
var _ cloudhub.FixedCellMappingStore = (*fixedCellMappingStore)(nil)

// GetDashboardID returns the dashboard ID for the fixed-cell named name in the given org.
func (s *fixedCellMappingStore) GetDashboardID(ctx context.Context, orgID, name string) (cloudhub.DashboardID, error) {
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

// Unregister removes the fixed-cell mapping for (orgID, name).
func (s *fixedCellMappingStore) Unregister(ctx context.Context, orgID, name string) error {
	if orgID == "" || name == "" {
		return nil
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		return tx.Bucket(dashboardsBuiltinMappingBucket).Delete(mappingKey(orgID, name))
	})
}

// Register records that the fixed-cell named name in org orgID is stored as dashboardID.
func (s *fixedCellMappingStore) Register(ctx context.Context, orgID, name string, dashboardID cloudhub.DashboardID) error {
	if orgID == "" || name == "" {
		return nil
	}
	return s.client.kv.Update(ctx, func(tx Tx) error {
		idStr := strconv.Itoa(int(dashboardID))
		return tx.Bucket(dashboardsBuiltinMappingBucket).Put(mappingKey(orgID, name), []byte(idStr))
	})
}

// ListByTemplateName returns all (orgID, dashboardID) entries for the given template name.
func (s *fixedCellMappingStore) ListByTemplateName(ctx context.Context, name string) ([]cloudhub.FixedCellMappingEntry, error) {
	if name == "" {
		return nil, nil
	}
	suffix := "/" + name
	var out []cloudhub.FixedCellMappingEntry
	if err := s.client.kv.View(ctx, func(tx Tx) error {
		return tx.Bucket(dashboardsBuiltinMappingBucket).ForEach(func(k, v []byte) error {
			keyStr := string(k)
			if !strings.HasSuffix(keyStr, suffix) {
				return nil
			}
			orgID := keyStr[:len(keyStr)-len(suffix)]
			idStr := string(v)
			id, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil {
				return nil
			}
			out = append(out, cloudhub.FixedCellMappingEntry{
				OrgID:        orgID,
				DashboardID:  cloudhub.DashboardID(id),
			})
			return nil
		})
	}); err != nil {
		return nil, err
	}
	return out, nil
}
