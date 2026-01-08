package noop

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.DeviceMappingsStore = &DeviceMappingsStore{}

// DeviceMappingsStore is a no-op implementation of a DeviceMappingsStore.
type DeviceMappingsStore struct{}

// AddDevice is a no-op.
func (s *DeviceMappingsStore) AddDevice(ctx context.Context, meta *cloudhub.DeviceMeta) error {
	return nil
}

// GetDevice is a no-op.
func (s *DeviceMappingsStore) GetDevice(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
	return nil, cloudhub.ErrDeviceNotFound
}

// AllDevices is a no-op.
func (s *DeviceMappingsStore) AllDevices(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
	return nil, nil
}

// UpdateDevice is a no-op.
func (s *DeviceMappingsStore) UpdateDevice(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
	return nil
}

// DeleteDevice is a no-op.
func (s *DeviceMappingsStore) DeleteDevice(ctx context.Context, hostname string) error {
	return nil
}

// AddAlias is a no-op.
func (s *DeviceMappingsStore) AddAlias(ctx context.Context, alias, orgID, hostname string) error {
	return nil
}

// UpdateAlias is a no-op.
func (s *DeviceMappingsStore) UpdateAlias(ctx context.Context, alias, orgID, hostname string) error {
	return nil
}

// DeleteAlias is a no-op.
func (s *DeviceMappingsStore) DeleteAlias(ctx context.Context, alias string) error {
	return nil
}

// GetByAlias is a no-op.
func (s *DeviceMappingsStore) GetByAlias(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
	return nil, cloudhub.ErrDeviceNotFound
}

// GetByHostname is a no-op.
func (s *DeviceMappingsStore) GetByHostname(ctx context.Context, hostname string) (*cloudhub.DeviceToOrg, error) {
	return nil, cloudhub.ErrDeviceNotFound
}

// BatchAddDevices is a no-op.
func (s *DeviceMappingsStore) BatchAddDevices(ctx context.Context, metas []*cloudhub.DeviceMeta) error {
	return nil
}
