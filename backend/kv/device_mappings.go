package kv

import (
	"context"
	"fmt"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// Ensure deviceMappingsStore implements cloudhub.DeviceMappingsStore.
var _ cloudhub.DeviceMappingsStore = &deviceMappingsStore{}

// deviceMappingsStore is the bolt and etcd implementation of storing device mappings
type deviceMappingsStore struct {
	client *Service
}

// Key prefixes for device mappings in etcd
const (
	orgDevicePrefix     = "Org"    // /DeviceMappings/Org/{orgId}/Device/{hostname}
	deviceToOrgPrefix   = "Device" // /DeviceMappings/Device/{hostname}
	aliasToDevicePrefix = "Alias"  // /DeviceMappings/Alias/{aliasName}
	defaultOrgID        = "default"
)

// buildOrgDeviceKey builds forward mapping key: /DeviceMappings/Org/{orgId}/Device/{hostname}
func buildOrgDeviceKey(orgID, hostname string) string {
	return fmt.Sprintf("%s/%s/Device/%s", orgDevicePrefix, orgID, hostname)
}

// buildDeviceToOrgKey builds reverse 1 mapping key: /DeviceMappings/Device/{hostname}
func buildDeviceToOrgKey(hostname string) string {
	return fmt.Sprintf("%s/%s", deviceToOrgPrefix, hostname)
}

// buildAliasToDeviceKey builds reverse 2 mapping key: /DeviceMappings/Alias/{aliasName}
func buildAliasToDeviceKey(aliasName string) string {
	return fmt.Sprintf("%s/%s", aliasToDevicePrefix, aliasName)
}

// AddDevice creates a new device mapping with atomic transaction
func (s *deviceMappingsStore) AddDevice(ctx context.Context, meta *cloudhub.DeviceMeta) error {
	if meta == nil {
		return fmt.Errorf("device meta cannot be nil")
	}
	if meta.Hostname == "" {
		return fmt.Errorf("hostname is required")
	}
	if meta.OrgID == "" {
		meta.OrgID = defaultOrgID
	}
	if meta.AliasName == "" {
		meta.AliasName = ""
	}

	return s.client.kv.Update(ctx, func(tx Tx) error {
		bucket := tx.Bucket(deviceMappingsBucket)

		deviceToOrgKey := buildDeviceToOrgKey(meta.Hostname)
		if v, _ := bucket.Get([]byte(deviceToOrgKey)); v != nil {
			return fmt.Errorf("device with hostname %s already exists", meta.Hostname)
		}

		var aliasKey string
		if meta.AliasName != "" {
			aliasKey = buildAliasToDeviceKey(meta.AliasName)
			if v, _ := bucket.Get([]byte(aliasKey)); v != nil {
				return fmt.Errorf("alias %s already exists", meta.AliasName)
			}
		}

		metaData, err := internal.MarshalDeviceMeta(meta)
		if err != nil {
			return fmt.Errorf("failed to marshal device meta: %w", err)
		}

		deviceToOrg := &cloudhub.DeviceToOrg{
			OrgID:     meta.OrgID,
			AliasName: meta.AliasName,
		}
		deviceToOrgData, err := internal.MarshalDeviceToOrg(deviceToOrg)
		if err != nil {
			return fmt.Errorf("failed to marshal device to org: %w", err)
		}

		var aliasToDeviceData []byte
		if meta.AliasName != "" {
			aliasToDevice := &cloudhub.AliasToDevice{
				OrgID:    meta.OrgID,
				Hostname: meta.Hostname,
			}
			aliasToDeviceData, err = internal.MarshalAliasToDevice(aliasToDevice)
			if err != nil {
				return fmt.Errorf("failed to marshal alias to device: %w", err)
			}
		}

		orgDeviceKey := buildOrgDeviceKey(meta.OrgID, meta.Hostname)
		if err := bucket.Put([]byte(orgDeviceKey), metaData); err != nil {
			return fmt.Errorf("failed to store org-device mapping: %w", err)
		}

		if err := bucket.Put([]byte(deviceToOrgKey), deviceToOrgData); err != nil {
			return fmt.Errorf("failed to store device-to-org mapping: %w", err)
		}

		if meta.AliasName != "" {
			if err := bucket.Put([]byte(aliasKey), aliasToDeviceData); err != nil {
				return fmt.Errorf("failed to store alias-to-device mapping: %w", err)
			}
		}

		return nil
	})
}

// GetDevice retrieves a device's metadata by hostname.
func (s *deviceMappingsStore) GetDevice(ctx context.Context, hostname string) (*cloudhub.DeviceMeta, error) {
	if hostname == "" {
		return nil, fmt.Errorf("hostname is required")
	}

	deviceToOrg, err := s.GetByHostname(ctx, hostname)
	if err != nil {
		return nil, err
	}

	var meta cloudhub.DeviceMeta
	err = s.client.kv.View(ctx, func(tx Tx) error {
		orgDeviceKey := buildOrgDeviceKey(deviceToOrg.OrgID, hostname)
		v, err := tx.Bucket(deviceMappingsBucket).Get([]byte(orgDeviceKey))
		if v == nil || err != nil {
			return cloudhub.ErrDeviceNotFound
		}
		return internal.UnmarshalDeviceMeta(v, &meta)
	})

	if err != nil {
		return nil, err
	}

	return &meta, nil
}

func (s *deviceMappingsStore) each(ctx context.Context, prefix string, fn func(*cloudhub.DeviceMeta)) error {
	return s.client.kv.View(ctx, func(tx Tx) error {
		bucket := tx.Bucket(deviceMappingsBucket, prefix)
		return bucket.ForEach(func(k, v []byte) error {
			var meta cloudhub.DeviceMeta
			if err := internal.UnmarshalDeviceMeta(v, &meta); err == nil {
				fn(&meta)
			}
			return nil
		})
	})
}
func (s *deviceMappingsStore) AllDevices(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
	var devices []*cloudhub.DeviceMeta
	var prefix string
	if access.IsSuperAdmin {
		prefix = "Org/"
	} else if access.OrgID != "" {
		prefix = fmt.Sprintf("Org/%s/Device", access.OrgID)
	} else {
		return nil, fmt.Errorf("organization not found")
	}
	if err := s.each(ctx, prefix, func(meta *cloudhub.DeviceMeta) {
		devices = append(devices, meta)
	}); err != nil {
		return nil, err
	}
	return devices, nil
}

// UpdateDevice updates the metadata of a device atomically (org / alias / ip / type ...).
// - If OrgID changes, old org-device key is deleted and the new one is written.
// - If AliasName changes, duplicate check is performed, old alias mapping is removed, new one is written.
// - All writes happen in a single STM/transaction for consistency.
func (s *deviceMappingsStore) UpdateDevice(ctx context.Context, hostname string, patch *cloudhub.DeviceMeta) error {
	if hostname == "" {
		return fmt.Errorf("hostname is required")
	}
	if patch == nil {
		return fmt.Errorf("patch data cannot be nil")
	}

	// 1) Load current metadata
	current, err := s.GetDevice(ctx, hostname)
	if err != nil {
		return err
	}

	// 2) Basic sanity checks
	if patch.Hostname != "" && patch.Hostname != hostname {
		return fmt.Errorf("hostname mismatch: patch=%s request=%s", patch.Hostname, hostname)
	}

	// 3) Build the updated snapshot (apply non-zero patch fields)
	updated := *current
	if patch.IP != "" {
		updated.IP = patch.IP
	}
	if patch.DeviceType != "" {
		updated.DeviceType = patch.DeviceType
	}
	if patch.AliasName != current.AliasName { // allow empty "" to clear alias
		updated.AliasName = patch.AliasName
	}
	if patch.OrgID != "" && patch.OrgID != current.OrgID {
		updated.OrgID = patch.OrgID
	}

	// 4) Start transactional update
	return s.client.kv.Update(ctx, func(tx Tx) error {
		bucket := tx.Bucket(deviceMappingsBucket)

		// 4-1) Alias duplication check (only when alias actually changes and new alias is not empty)
		if current.AliasName != updated.AliasName && updated.AliasName != "" {
			newAliasKey := buildAliasToDeviceKey(updated.AliasName)
			if existingAliasData, _ := bucket.Get([]byte(newAliasKey)); existingAliasData != nil {
				var existingMapping cloudhub.AliasToDevice
				if err := internal.UnmarshalAliasToDevice(existingAliasData, &existingMapping); err == nil {
					if existingMapping.Hostname != updated.Hostname {
						return fmt.Errorf("alias %q already exists for device %q",
							updated.AliasName, existingMapping.Hostname)
					}
				}
			}
		}

		if current.OrgID != updated.OrgID {
			oldOrgKey := buildOrgDeviceKey(current.OrgID, current.Hostname)
			if err := bucket.Delete([]byte(oldOrgKey)); err != nil {
				return fmt.Errorf("failed to delete old org-device mapping: %w", err)
			}
		}

		metaData, err := internal.MarshalDeviceMeta(&updated)
		if err != nil {
			return fmt.Errorf("failed to marshal device meta: %w", err)
		}

		newOrgKey := buildOrgDeviceKey(updated.OrgID, updated.Hostname)
		if err := bucket.Put([]byte(newOrgKey), metaData); err != nil {
			return fmt.Errorf("failed to put org-device mapping: %w", err)
		}

		deviceToOrg := &cloudhub.DeviceToOrg{
			OrgID:     updated.OrgID,
			AliasName: updated.AliasName,
		}
		deviceToOrgData, err := internal.MarshalDeviceToOrg(deviceToOrg)
		if err != nil {
			return fmt.Errorf("failed to marshal device-to-org: %w", err)
		}
		if err := bucket.Put([]byte(buildDeviceToOrgKey(updated.Hostname)), deviceToOrgData); err != nil {
			return fmt.Errorf("failed to put device-to-org mapping: %w", err)
		}

		if current.AliasName != updated.AliasName && current.AliasName != "" {
			oldAliasKey := buildAliasToDeviceKey(current.AliasName)
			if err := bucket.Delete([]byte(oldAliasKey)); err != nil {
				return fmt.Errorf("failed to delete old alias mapping: %w", err)
			}
		}

		if updated.AliasName != "" {
			aliasToDevice := &cloudhub.AliasToDevice{
				OrgID:    updated.OrgID,
				Hostname: updated.Hostname,
			}
			aliasToDeviceData, err := internal.MarshalAliasToDevice(aliasToDevice)
			if err != nil {
				return fmt.Errorf("failed to marshal alias-to-device: %w", err)
			}
			aliasKey := buildAliasToDeviceKey(updated.AliasName)
			if err := bucket.Put([]byte(aliasKey), aliasToDeviceData); err != nil {
				return fmt.Errorf("failed to put alias-to-device mapping: %w", err)
			}
		}

		return nil
	})
}

// DeleteDevice deletes a device and all associated mappings (atomic via STM)
func (s *deviceMappingsStore) DeleteDevice(ctx context.Context, hostname string) error {
	if hostname == "" {
		return fmt.Errorf("hostname is required")
	}

	current, err := s.GetDevice(ctx, hostname)
	if err != nil {
		return err
	}

	return s.client.kv.Update(ctx, func(tx Tx) error {
		bucket := tx.Bucket(deviceMappingsBucket)

		orgDeviceKey := buildOrgDeviceKey(current.OrgID, current.Hostname)
		if err := bucket.Delete([]byte(orgDeviceKey)); err != nil {
			return fmt.Errorf("failed to delete org-device mapping: %w", err)
		}

		deviceToOrgKey := buildDeviceToOrgKey(current.Hostname)
		if err := bucket.Delete([]byte(deviceToOrgKey)); err != nil {
			return fmt.Errorf("failed to delete device-to-org mapping: %w", err)
		}

		if current.AliasName != "" {
			aliasKey := buildAliasToDeviceKey(current.AliasName)
			if err := bucket.Delete([]byte(aliasKey)); err != nil {
				return fmt.Errorf("failed to delete alias-to-device mapping: %w", err)
			}
		}

		return nil
	})
}

// AddAlias adds a new alias mapping (alias -> device).
func (s *deviceMappingsStore) AddAlias(ctx context.Context, alias, orgID, hostname string) error {
	if alias == "" {
		return fmt.Errorf("alias is required")
	}
	if orgID == "" {
		return fmt.Errorf("org ID is required")
	}
	if hostname == "" {
		return fmt.Errorf("hostname is required")
	}

	return s.client.kv.Update(ctx, func(tx Tx) error {
		// Check if alias already exists
		aliasKey := buildAliasToDeviceKey(alias)
		if v, _ := tx.Bucket(deviceMappingsBucket).Get([]byte(aliasKey)); v != nil {
			return fmt.Errorf("alias %s already exists", alias)
		}

		aliasToDevice := &cloudhub.AliasToDevice{
			OrgID:    orgID,
			Hostname: hostname,
		}
		aliasToDeviceData, err := internal.MarshalAliasToDevice(aliasToDevice)
		if err != nil {
			return fmt.Errorf("failed to marshal alias to device: %w", err)
		}

		bucket := tx.Bucket(deviceMappingsBucket)
		if err := bucket.Put([]byte(aliasKey), aliasToDeviceData); err != nil {
			return fmt.Errorf("failed to store alias mapping: %w", err)
		}

		return nil
	})
}

// UpdateAlias updates the device mapped to an alias.
func (s *deviceMappingsStore) UpdateAlias(ctx context.Context, alias, orgID, hostname string) error {
	if alias == "" {
		return fmt.Errorf("alias is required")
	}
	if orgID == "" {
		return fmt.Errorf("org ID is required")
	}
	if hostname == "" {
		return fmt.Errorf("hostname is required")
	}

	return s.client.kv.Update(ctx, func(tx Tx) error {
		aliasToDevice := &cloudhub.AliasToDevice{
			OrgID:    orgID,
			Hostname: hostname,
		}
		aliasToDeviceData, err := internal.MarshalAliasToDevice(aliasToDevice)
		if err != nil {
			return fmt.Errorf("failed to marshal alias to device: %w", err)
		}

		bucket := tx.Bucket(deviceMappingsBucket)
		aliasKey := buildAliasToDeviceKey(alias)
		if err := bucket.Put([]byte(aliasKey), aliasToDeviceData); err != nil {
			return fmt.Errorf("failed to update alias mapping: %w", err)
		}

		return nil
	})
}

// DeleteAlias removes an alias mapping.
func (s *deviceMappingsStore) DeleteAlias(ctx context.Context, alias string) error {
	if alias == "" {
		return fmt.Errorf("alias is required")
	}

	return s.client.kv.Update(ctx, func(tx Tx) error {
		bucket := tx.Bucket(deviceMappingsBucket)
		aliasKey := buildAliasToDeviceKey(alias)
		if err := bucket.Delete([]byte(aliasKey)); err != nil {
			return fmt.Errorf("failed to delete alias mapping: %w", err)
		}
		return nil
	})
}

// GetByAlias retrieves orgId and hostname by alias.
func (s *deviceMappingsStore) GetByAlias(ctx context.Context, alias string) (*cloudhub.AliasToDevice, error) {
	if alias == "" {
		return nil, fmt.Errorf("alias is required")
	}

	var aliasToDevice cloudhub.AliasToDevice
	err := s.client.kv.View(ctx, func(tx Tx) error {
		aliasKey := buildAliasToDeviceKey(alias)
		v, err := tx.Bucket(deviceMappingsBucket).Get([]byte(aliasKey))
		if v == nil || err != nil {
			return fmt.Errorf("alias %s not found", alias)
		}
		return internal.UnmarshalAliasToDevice(v, &aliasToDevice)
	})

	if err != nil {
		return nil, err
	}

	return &aliasToDevice, nil
}

// GetByHostname retrieves orgId and aliasName by hostname.
func (s *deviceMappingsStore) GetByHostname(ctx context.Context, hostname string) (*cloudhub.DeviceToOrg, error) {
	if hostname == "" {
		return nil, fmt.Errorf("hostname is required")
	}

	var deviceToOrg cloudhub.DeviceToOrg
	err := s.client.kv.View(ctx, func(tx Tx) error {
		deviceToOrgKey := buildDeviceToOrgKey(hostname)
		v, err := tx.Bucket(deviceMappingsBucket).Get([]byte(deviceToOrgKey))
		if v == nil || err != nil {
			return fmt.Errorf("hostname %s not found", hostname)
		}
		return internal.UnmarshalDeviceToOrg(v, &deviceToOrg)
	})

	if err != nil {
		return nil, err
	}

	return &deviceToOrg, nil
}

func fullPrefix(bucket []byte, prefix string) string {
	if len(prefix) == 0 {
		return "/" + string(bucket) + "/"
	}
	if strings.HasPrefix(prefix, "/") {
		return "/" + string(bucket) + prefix
	}
	return "/" + string(bucket) + "/" + prefix
}

func (s *deviceMappingsStore) BatchAddDevices(
	ctx context.Context,
	metas []*cloudhub.DeviceMeta,
) error {

	if len(metas) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(metas))

	return s.client.kv.Update(ctx, func(tx Tx) error {

		if tx.Bucket(deviceMappingsBucket) == nil {
			return fmt.Errorf("bucket %q not found", deviceMappingsBucket)
		}

		for _, m := range metas {
			if m == nil || m.Hostname == "" {
				continue
			}
			if m.OrgID == "" {
				m.OrgID = defaultOrgID
			}

			dupKey := m.Hostname
			if _, ok := seen[dupKey]; ok {
				continue
			}
			seen[dupKey] = struct{}{}

			d2oKey := buildDeviceToOrgKey(m.Hostname)
			if v, _ := tx.Bucket(deviceMappingsBucket).Get([]byte(d2oKey)); v != nil {
				continue
			}

			if m.AliasName != "" {
				aliasKey := buildAliasToDeviceKey(m.AliasName)
				if v, _ := tx.Bucket(deviceMappingsBucket).Get([]byte(aliasKey)); v != nil {
					return fmt.Errorf("alias %s already exists", m.AliasName)
				}
			}

			metaData, err := internal.MarshalDeviceMeta(m)
			if err != nil {
				return fmt.Errorf("marshal device meta: %w", err)
			}
			dtoBytes, err := internal.MarshalDeviceToOrg(&cloudhub.DeviceToOrg{
				OrgID:     m.OrgID,
				AliasName: m.AliasName,
			})
			if err != nil {
				return fmt.Errorf("marshal device‑to‑org: %w", err)
			}
			var aliasBytes []byte
			if m.AliasName != "" {
				aliasBytes, err = internal.MarshalAliasToDevice(&cloudhub.AliasToDevice{
					OrgID:    m.OrgID,
					Hostname: m.Hostname,
				})
				if err != nil {
					return fmt.Errorf("marshal alias‑to‑device: %w", err)
				}
			}

			// ── put KV entries ──────────────────────────
			if err := tx.Bucket(deviceMappingsBucket).Put(
				[]byte(buildOrgDeviceKey(m.OrgID, m.Hostname)), metaData,
			); err != nil {
				return err
			}
			if err := tx.Bucket(deviceMappingsBucket).Put([]byte(d2oKey), dtoBytes); err != nil {
				return err
			}
			if m.AliasName != "" {
				if err := tx.Bucket(deviceMappingsBucket).Put(
					[]byte(buildAliasToDeviceKey(m.AliasName)), aliasBytes,
				); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
