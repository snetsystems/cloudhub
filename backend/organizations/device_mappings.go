package organizations

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ensure that DeviceMappingsStore implements cloudhub.DeviceMappingsStore
var _ cloudhub.DeviceMappingsStore = &DeviceMappingsStore{}

// DeviceMappingsStore facade on a DeviceMappingsStore that filters devices by organization.
type DeviceMappingsStore struct {
	store        cloudhub.DeviceMappingsStore
	organization string
	isSuperAdmin bool
}

// NewDeviceMappingsStore creates a new DeviceMappingsStore from an existing
// cloudhub.DeviceMappingsStore and an organization string
func NewDeviceMappingsStore(s cloudhub.DeviceMappingsStore, org string, isSuperAdmin bool) *DeviceMappingsStore {
	return &DeviceMappingsStore{
		store:        s,
		organization: org,
		isSuperAdmin: isSuperAdmin,
	}
}

// AddDevice creates a new device mapping. SuperAdmin can add to any org, others only to their org.
func (s *DeviceMappingsStore) AddDevice(ctx context.Context, meta *cloudhub.DeviceMeta) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// SuperAdmin can add devices to any organization
	if s.isSuperAdmin {
		return s.store.AddDevice(ctx, meta)
	}

	// Regular users can only add devices to their own organization
	if meta.OrgID != s.organization {
		return fmt.Errorf("cannot add device to organization %s: access denied", meta.OrgID)
	}

	// Set organization to current user's organization to ensure consistency
	meta.OrgID = s.organization
	return s.store.AddDevice(ctx, meta)
}

// GetDevice retrieves a device's metadata by hostname with organization filtering.
func (s *DeviceMappingsStore) GetDevice(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	device, err := s.store.GetDevice(ctx, hostname)
	if err != nil {
		return nil, err
	}

	// SuperAdmin can access devices from any organization
	if s.isSuperAdmin {
		return device, nil
	}

	// Regular users can only access devices from their organization
	if device.OrgID != s.organization {
		return nil, fmt.Errorf("device not found")
	}

	return device, nil
}

// AllDevices returns all devices, filtered by organization for non-SuperAdmin users.
func (s *DeviceMappingsStore) AllDevices(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}
	// Regular users can only see devices in their organization
	allDevices, err := s.store.AllDevices(ctx, access)
	if err != nil {
		return nil, err
	}

	return allDevices, nil
}

// UpdateDevice updates an existing device mapping with organization access control.
func (s *DeviceMappingsStore) UpdateDevice(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// First check if device exists and is accessible
	existingDevice, err := s.GetDevice(ctx, hostname)
	if err != nil {
		return err
	}

	// SuperAdmin can update any device
	if s.isSuperAdmin {
		return s.store.UpdateDevice(ctx, hostname, patch)
	}

	// Regular users can only update devices in their organization
	if existingDevice.OrgID != s.organization {
		return fmt.Errorf("device not found")
	}

	// Prevent regular users from changing organization
	if patch.OrgID != "" && patch.OrgID != s.organization {
		return fmt.Errorf("cannot move device to organization %s: access denied", patch.OrgID)
	}

	return s.store.UpdateDevice(ctx, hostname, patch)
}

// DeleteDevice deletes a device mapping with organization access control.
func (s *DeviceMappingsStore) DeleteDevice(ctx context.Context, hostname string) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// First check if device exists and is accessible
	existingDevice, err := s.GetDevice(ctx, hostname)
	if err != nil {
		return err
	}

	// SuperAdmin can delete any device
	if s.isSuperAdmin {
		return s.store.DeleteDevice(ctx, hostname)
	}

	// Regular users can only delete devices in their organization
	if existingDevice.OrgID != s.organization {
		return fmt.Errorf("device not found")
	}

	return s.store.DeleteDevice(ctx, hostname)
}

// MoveDeviceOrg moves a device to a new organization. SuperAdmin only.
func (s *DeviceMappingsStore) MoveDeviceOrg(ctx context.Context, hostname string, newOrgID string) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// Only SuperAdmin can move devices between organizations
	if !s.isSuperAdmin {
		return fmt.Errorf("insufficient permissions: only SuperAdmin can move devices between organizations")
	}

	return s.store.MoveDeviceOrg(ctx, hostname, newOrgID)
}

// AddAlias adds a new alias mapping with organization access control.
func (s *DeviceMappingsStore) AddAlias(ctx context.Context, alias, orgID, hostname string) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// SuperAdmin can add aliases for any organization
	if s.isSuperAdmin {
		return s.store.AddAlias(ctx, alias, orgID, hostname)
	}

	// Regular users can only add aliases for their organization
	if orgID != s.organization {
		return fmt.Errorf("cannot add alias for organization %s: access denied", orgID)
	}

	// Verify the device belongs to the user's organization
	device, err := s.GetDevice(ctx, hostname)
	if err != nil {
		return fmt.Errorf("device not found or access denied")
	}

	if device.OrgID != s.organization {
		return fmt.Errorf("device not found or access denied")
	}

	return s.store.AddAlias(ctx, alias, orgID, hostname)
}

// UpdateAlias updates an alias mapping with organization access control.
func (s *DeviceMappingsStore) UpdateAlias(ctx context.Context, alias, orgID, hostname string) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// SuperAdmin can update aliases for any organization
	if s.isSuperAdmin {
		return s.store.UpdateAlias(ctx, alias, orgID, hostname)
	}

	// Regular users can only update aliases for their organization
	if orgID != s.organization {
		return fmt.Errorf("cannot update alias for organization %s: access denied", orgID)
	}

	// Verify the alias exists and belongs to the user's organization
	existingAlias, err := s.store.GetByAlias(ctx, alias)
	if err != nil {
		return err
	}

	if existingAlias.OrgID != s.organization {
		return fmt.Errorf("alias not found")
	}

	return s.store.UpdateAlias(ctx, alias, orgID, hostname)
}

// DeleteAlias removes an alias mapping with organization access control.
func (s *DeviceMappingsStore) DeleteAlias(ctx context.Context, alias string) error {
	err := validOrganization(ctx)
	if err != nil {
		return err
	}

	// First check if alias exists and is accessible
	existingAlias, err := s.store.GetByAlias(ctx, alias)
	if err != nil {
		return err
	}

	// SuperAdmin can delete any alias
	if s.isSuperAdmin {
		return s.store.DeleteAlias(ctx, alias)
	}

	// Regular users can only delete aliases in their organization
	if existingAlias.OrgID != s.organization {
		return fmt.Errorf("alias not found")
	}

	return s.store.DeleteAlias(ctx, alias)
}

// GetByAlias retrieves orgId and hostname by alias with organization filtering.
func (s *DeviceMappingsStore) GetByAlias(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	aliasToDevice, err := s.store.GetByAlias(ctx, alias)
	if err != nil {
		return nil, err
	}

	// SuperAdmin can access any alias
	if s.isSuperAdmin {
		return aliasToDevice, nil
	}

	// Regular users can only access aliases in their organization
	if aliasToDevice.OrgID != s.organization {
		return nil, fmt.Errorf("alias not found")
	}

	return aliasToDevice, nil
}

// GetByHostname retrieves orgId and aliasName by hostname with organization filtering.
func (s *DeviceMappingsStore) GetByHostname(ctx context.Context, hostname string) (*cloudhub.DeviceToOrg, error) {
	err := validOrganization(ctx)
	if err != nil {
		return nil, err
	}

	deviceToOrg, err := s.store.GetByHostname(ctx, hostname)
	if err != nil {
		return nil, err
	}

	// SuperAdmin can access any device mapping
	if s.isSuperAdmin {
		return deviceToOrg, nil
	}

	// Regular users can only access devices in their organization
	if deviceToOrg.OrgID != s.organization {
		return nil, fmt.Errorf("hostname not found")
	}

	return deviceToOrg, nil
}
