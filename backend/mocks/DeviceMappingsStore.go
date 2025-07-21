package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.DeviceMappingsStore = &DeviceMappingsStore{}

// DeviceMappingsStore is a mock implementation of cloudhub.DeviceMappingsStore
type DeviceMappingsStore struct {
	AddDeviceFunc       func(ctx context.Context, meta *cloudhub.DeviceMeta) error
	GetDeviceFunc       func(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error)
	AllDevicesFunc      func(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error)
	UpdateDeviceFunc    func(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error
	DeleteDeviceFunc    func(ctx context.Context, hostname string) error
	MoveDeviceOrgFunc   func(ctx context.Context, hostname string, newOrg string) error
	AddAliasFunc        func(ctx context.Context, alias, orgId, hostname string) error
	UpdateAliasFunc     func(ctx context.Context, alias, orgId, hostname string) error
	DeleteAliasFunc     func(ctx context.Context, alias string) error
	GetByAliasFunc      func(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error)
	GetByHostnameFunc   func(ctx context.Context, hostname string) (*cloudhub.DeviceToOrg, error)
	BatchAddDevicesFunc func(ctx context.Context, metas []*cloudhub.DeviceMeta) error
}

// AddDevice mocks the AddDevice method
func (s *DeviceMappingsStore) AddDevice(ctx context.Context, meta *cloudhub.DeviceMeta) error {
	return s.AddDeviceFunc(ctx, meta)
}

// GetDevice mocks the GetDevice method
func (s *DeviceMappingsStore) GetDevice(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
	return s.GetDeviceFunc(ctx, hostname)
}

// AllDevices mocks the AllDevices method
func (s *DeviceMappingsStore) AllDevices(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
	return s.AllDevicesFunc(ctx, access)
}

// UpdateDevice mocks the UpdateDevice method
func (s *DeviceMappingsStore) UpdateDevice(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
	return s.UpdateDeviceFunc(ctx, hostname, patch)
}

// DeleteDevice mocks the DeleteDevice method
func (s *DeviceMappingsStore) DeleteDevice(ctx context.Context, hostname string) error {
	return s.DeleteDeviceFunc(ctx, hostname)
}

// MoveDeviceOrg mocks the MoveDeviceOrg method
func (s *DeviceMappingsStore) MoveDeviceOrg(ctx context.Context, hostname string, newOrg string) error {
	return s.MoveDeviceOrgFunc(ctx, hostname, newOrg)
}

// AddAlias mocks the AddAlias method
func (s *DeviceMappingsStore) AddAlias(ctx context.Context, alias string, orgID string, hostname string) error {
	return s.AddAliasFunc(ctx, alias, orgID, hostname)
}

// UpdateAlias mocks the UpdateAlias method
func (s *DeviceMappingsStore) UpdateAlias(ctx context.Context, alias string, orgID string, hostname string) error {
	return s.UpdateAliasFunc(ctx, alias, orgID, hostname)
}

// DeleteAlias mocks the DeleteAlias method
func (s *DeviceMappingsStore) DeleteAlias(ctx context.Context, alias string) error {
	return s.DeleteAliasFunc(ctx, alias)
}

// GetByAlias mocks the GetByAlias method
func (s *DeviceMappingsStore) GetByAlias(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
	return s.GetByAliasFunc(ctx, alias)
}

// GetByHostname mocks the GetByHostname method
func (s *DeviceMappingsStore) GetByHostname(ctx context.Context, hostname string) (*cloudhub.DeviceToOrg, error) {
	return s.GetByHostnameFunc(ctx, hostname)
}

// BatchAddDevices mocks the BatchAddDevices method
func (s *DeviceMappingsStore) BatchAddDevices(ctx context.Context, metas []*cloudhub.DeviceMeta) error {
	return s.BatchAddDevicesFunc(ctx, metas)
}
