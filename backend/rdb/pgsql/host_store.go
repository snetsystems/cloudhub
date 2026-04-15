package pgsql

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

// Ensure HostStore implements cloudhub.HostStore at compile time.
var _ cloudhub.HostStore = (*HostStore)(nil)

// HostStore implements cloudhub.HostStore on top of postgres.Client.
type HostStore struct {
	client *Client
}

// NewHostStore returns a HostStore backed by the given postgres Client.
func NewHostStore(client *Client) *HostStore {
	return &HostStore{client: client}
}

func (s *HostStore) Add(ctx context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
	now := time.Now()
	if h.CreatedAt.IsZero() {
		h.CreatedAt = now
	}
	h.UpdatedAt = now
	h.DeleteYN = false

	// Derive representative IP from IPInterfaces (first private IP, or first IP if none private).
	if len(h.IPInterfaces) > 0 {
		h.IP = h.IPInterfaces[0].IPAddress
		for _, iface := range h.IPInterfaces {
			if isPrivateIPStr(iface.IPAddress) {
				h.IP = iface.IPAddress
				break
			}
		}
	}

	err := s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		const insertHost = `
INSERT INTO hosts (minion_id, hostname, original_hostname, ip, source_type, os, os_family, os_version, kernel, arch,
                   mem_total_kb, swap_total_kb, cpu_cores, cpu_model, bios_version,
                   timezone, selinux_state, is_collector,
                   org_id, status, created_at, updated_at, delete_yn)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, false)
RETURNING id`

		row := tx.QueryRowContext(ctx, insertHost,
			h.MinionID, h.Hostname, h.OriginalHostname, h.IP, h.SourceType,
			h.OS, h.OSFamily, h.OSVersion, h.Kernel, h.Arch,
			h.MemTotalKB, h.SwapTotalKB, h.CPUCores, h.CPUModel, h.BIOSVersion,
			h.Timezone, h.SelinuxState, h.IsCollector,
			h.OrgID, h.Status, h.CreatedAt, h.UpdatedAt,
		)
		if err := row.Scan(&h.ID); err != nil {
			return fmt.Errorf("hosts insert: %w", err)
		}

		if _, err := tx.ExecContext(ctx,
			`DELETE FROM host_ip_interfaces WHERE host_id = $1`, h.ID,
		); err != nil {
			return fmt.Errorf("hosts delete ip_interfaces: %w", err)
		}
		for _, iface := range h.IPInterfaces {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO host_ip_interfaces (host_id, interface_name, ip_address) VALUES ($1, $2, $3)`,
				h.ID, iface.InterfaceName, iface.IPAddress,
			); err != nil {
				return fmt.Errorf("hosts insert ip_interface: %w", err)
			}
		}

		if _, err := tx.ExecContext(ctx,
			`DELETE FROM host_gpus WHERE host_id = $1`, h.ID,
		); err != nil {
			return fmt.Errorf("hosts delete gpus: %w", err)
		}
		for _, gpu := range h.GPUs {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO host_gpus (host_id, vendor, model) VALUES ($1, $2, $3)`,
				h.ID, gpu.Vendor, gpu.Model,
			); err != nil {
				return fmt.Errorf("hosts insert gpu: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return h, nil
}

// Get looks up a single active host by MinionID or Hostname.
func (s *HostStore) Get(ctx context.Context, q cloudhub.HostQuery) (*cloudhub.Host, error) {
	var row rdb.Row
	switch {
	case q.MinionID != nil:
		const queryHost = `
SELECT id, minion_id, hostname, original_hostname, ip, source_type, os, os_family, os_version, kernel, arch,
       mem_total_kb, swap_total_kb, cpu_cores, cpu_model, bios_version,
       timezone, selinux_state, is_collector,
       org_id, status, created_at, updated_at
FROM hosts WHERE minion_id = $1 AND delete_yn = false`
		row = s.client.QueryRowContext(ctx, queryHost, *q.MinionID)
	case q.Hostname != nil:
		const queryHost = `
SELECT id, minion_id, hostname, original_hostname, ip, source_type, os, os_family, os_version, kernel, arch,
       mem_total_kb, swap_total_kb, cpu_cores, cpu_model, bios_version,
       timezone, selinux_state, is_collector,
       org_id, status, created_at, updated_at
FROM hosts WHERE hostname = $1 AND delete_yn = false`
		row = s.client.QueryRowContext(ctx, queryHost, *q.Hostname)
	default:
		return nil, fmt.Errorf("HostQuery must specify MinionID or Hostname")
	}
	var h cloudhub.Host
	if err := row.Scan(
		&h.ID, &h.MinionID, &h.Hostname, &h.OriginalHostname, &h.IP, &h.SourceType,
		&h.OS, &h.OSFamily, &h.OSVersion, &h.Kernel, &h.Arch,
		&h.MemTotalKB, &h.SwapTotalKB, &h.CPUCores, &h.CPUModel, &h.BIOSVersion,
		&h.Timezone, &h.SelinuxState, &h.IsCollector,
		&h.OrgID, &h.Status, &h.CreatedAt, &h.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, cloudhub.ErrHostNotFound
		}
		return nil, fmt.Errorf("hosts get: %w", err)
	}

	h.IPInterfaces = make([]cloudhub.IPInterface, 0)
	ifaceRows, err := s.client.QueryContext(ctx,
		`SELECT interface_name, ip_address FROM host_ip_interfaces WHERE host_id = $1`, h.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("hosts get ip_interfaces: %w", err)
	}
	defer ifaceRows.Close()
	for ifaceRows.Next() {
		var iface cloudhub.IPInterface
		if err := ifaceRows.Scan(&iface.InterfaceName, &iface.IPAddress); err != nil {
			return nil, fmt.Errorf("hosts get ip_interface scan: %w", err)
		}
		h.IPInterfaces = append(h.IPInterfaces, iface)
	}

	h.GPUs = make([]cloudhub.GPU, 0)
	gpuRows, err := s.client.QueryContext(ctx,
		`SELECT vendor, model FROM host_gpus WHERE host_id = $1`, h.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("hosts get gpus: %w", err)
	}
	defer gpuRows.Close()
	for gpuRows.Next() {
		var gpu cloudhub.GPU
		if err := gpuRows.Scan(&gpu.Vendor, &gpu.Model); err != nil {
			return nil, fmt.Errorf("hosts get gpu scan: %w", err)
		}
		h.GPUs = append(h.GPUs, gpu)
	}

	return &h, nil
}

func (s *HostStore) All(ctx context.Context) ([]cloudhub.Host, error) {
	const queryHosts = `
SELECT id, minion_id, hostname, original_hostname, ip, source_type, os, os_family, os_version, kernel, arch,
       mem_total_kb, swap_total_kb, cpu_cores, cpu_model, bios_version,
       timezone, selinux_state, is_collector,
       org_id, status, created_at, updated_at
FROM hosts WHERE delete_yn = false ORDER BY created_at DESC`

	rows, err := s.client.QueryContext(ctx, queryHosts)
	if err != nil {
		return nil, fmt.Errorf("hosts all: %w", err)
	}
	defer rows.Close()

	hosts := make([]cloudhub.Host, 0)
	ids := make([]string, 0)
	idxByID := make(map[string]int)

	for rows.Next() {
		var h cloudhub.Host
		h.IPInterfaces = make([]cloudhub.IPInterface, 0)
		h.GPUs = make([]cloudhub.GPU, 0)
		if err := rows.Scan(
			&h.ID, &h.MinionID, &h.Hostname, &h.OriginalHostname, &h.IP, &h.SourceType,
			&h.OS, &h.OSFamily, &h.OSVersion, &h.Kernel, &h.Arch,
			&h.MemTotalKB, &h.SwapTotalKB, &h.CPUCores, &h.CPUModel, &h.BIOSVersion,
			&h.Timezone, &h.SelinuxState, &h.IsCollector,
			&h.OrgID, &h.Status, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("hosts all scan: %w", err)
		}
		idxByID[h.ID] = len(hosts)
		ids = append(ids, h.ID)
		hosts = append(hosts, h)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("hosts all rows: %w", err)
	}

	if len(ids) == 0 {
		return hosts, nil
	}

	// Batch fetch ip_interfaces
	ifaceRows, err := s.client.QueryContext(ctx,
		`SELECT host_id, interface_name, ip_address FROM host_ip_interfaces WHERE host_id = ANY($1)`,
		ids,
	)
	if err != nil {
		return nil, fmt.Errorf("hosts all ip_interfaces: %w", err)
	}
	defer ifaceRows.Close()
	for ifaceRows.Next() {
		var hostID string
		var iface cloudhub.IPInterface
		if err := ifaceRows.Scan(&hostID, &iface.InterfaceName, &iface.IPAddress); err != nil {
			return nil, fmt.Errorf("hosts all ip_interface scan: %w", err)
		}
		if idx, ok := idxByID[hostID]; ok {
			hosts[idx].IPInterfaces = append(hosts[idx].IPInterfaces, iface)
		}
	}

	// Batch fetch gpus
	gpuRows, err := s.client.QueryContext(ctx,
		`SELECT host_id, vendor, model FROM host_gpus WHERE host_id = ANY($1)`,
		ids,
	)
	if err != nil {
		return nil, fmt.Errorf("hosts all gpus: %w", err)
	}
	defer gpuRows.Close()
	for gpuRows.Next() {
		var hostID string
		var gpu cloudhub.GPU
		if err := gpuRows.Scan(&hostID, &gpu.Vendor, &gpu.Model); err != nil {
			return nil, fmt.Errorf("hosts all gpu scan: %w", err)
		}
		if idx, ok := idxByID[hostID]; ok {
			hosts[idx].GPUs = append(hosts[idx].GPUs, gpu)
		}
	}

	return hosts, nil
}

// Update modifies mutable fields of an active host identified by Hostname.
func (s *HostStore) Update(ctx context.Context, h *cloudhub.Host) (*cloudhub.Host, error) {
	h.UpdatedAt = time.Now()

	// Derive representative IP from IPInterfaces.
	if len(h.IPInterfaces) > 0 {
		h.IP = h.IPInterfaces[0].IPAddress
		for _, iface := range h.IPInterfaces {
			if isPrivateIPStr(iface.IPAddress) {
				h.IP = iface.IPAddress
				break
			}
		}
	}

	err := s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		const query = `
UPDATE hosts SET
    minion_id         = $2,
    original_hostname = $3,
    ip                = $4,
    os                = $5,
    os_family         = $6,
    os_version        = $7,
    kernel            = $8,
    arch              = $9,
    mem_total_kb      = $10,
    swap_total_kb     = $11,
    cpu_cores         = $12,
    cpu_model         = $13,
    bios_version      = $14,
    timezone          = $15,
    selinux_state     = $16,
    is_collector      = $17,
    source_type       = $18,
    org_id            = $19,
    status            = $20,
    updated_at        = $21
WHERE hostname = $1 AND delete_yn = false`

		result, err := tx.ExecContext(ctx, query,
			h.Hostname, h.MinionID, h.OriginalHostname, h.IP,
			h.OS, h.OSFamily, h.OSVersion, h.Kernel, h.Arch,
			h.MemTotalKB, h.SwapTotalKB, h.CPUCores, h.CPUModel, h.BIOSVersion,
			h.Timezone, h.SelinuxState, h.IsCollector,
			h.SourceType, h.OrgID, h.Status, h.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("hosts update: %w", err)
		}
		if result.RowsAffected() == 0 {
			return cloudhub.ErrHostNotFound
		}

		if _, err := tx.ExecContext(ctx,
			`DELETE FROM host_ip_interfaces WHERE host_id = (SELECT id FROM hosts WHERE hostname = $1 AND delete_yn = false)`, h.Hostname,
		); err != nil {
			return fmt.Errorf("hosts update delete ip_interfaces: %w", err)
		}
		for _, iface := range h.IPInterfaces {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO host_ip_interfaces (host_id, interface_name, ip_address) SELECT id, $2, $3 FROM hosts WHERE hostname = $1 AND delete_yn = false`,
				h.Hostname, iface.InterfaceName, iface.IPAddress,
			); err != nil {
				return fmt.Errorf("hosts update insert ip_interface: %w", err)
			}
		}

		if _, err := tx.ExecContext(ctx,
			`DELETE FROM host_gpus WHERE host_id = (SELECT id FROM hosts WHERE hostname = $1 AND delete_yn = false)`, h.Hostname,
		); err != nil {
			return fmt.Errorf("hosts update delete gpus: %w", err)
		}
		for _, gpu := range h.GPUs {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO host_gpus (host_id, vendor, model) SELECT id, $2, $3 FROM hosts WHERE hostname = $1 AND delete_yn = false`,
				h.Hostname, gpu.Vendor, gpu.Model,
			); err != nil {
				return fmt.Errorf("hosts update insert gpu: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return h, nil
}

// Patch applies a partial update to an active host identified by hostname.
func (s *HostStore) Patch(ctx context.Context, hostname string, patch cloudhub.HostPatch) (*cloudhub.Host, error) {
	if patch.Status == nil && patch.OrgID == nil {
		return s.Get(ctx, cloudhub.HostQuery{Hostname: &hostname})
	}

	now := time.Now()
	const query = `
UPDATE hosts SET
    status     = COALESCE($2, status),
    org_id     = COALESCE($3, org_id),
    updated_at = $4
WHERE hostname = $1 AND delete_yn = false`

	result, err := s.client.ExecContext(ctx, query, hostname, patch.Status, patch.OrgID, now)
	if err != nil {
		return nil, fmt.Errorf("hosts patch: %w", err)
	}
	if result.RowsAffected() == 0 {
		return nil, cloudhub.ErrHostNotFound
	}
	return s.Get(ctx, cloudhub.HostQuery{Hostname: &hostname})
}

// Delete soft-deletes the active host with the given hostname.
func (s *HostStore) Delete(ctx context.Context, hostname string) error {
	const query = `
UPDATE hosts SET delete_yn = true, updated_at = now()
WHERE hostname = $1 AND delete_yn = false`
	result, err := s.client.ExecContext(ctx, query, hostname)
	if err != nil {
		return fmt.Errorf("hosts delete: %w", err)
	}
	if result.RowsAffected() == 0 {
		return cloudhub.ErrHostNotFound
	}
	return nil
}

// nilIfEmpty returns nil if s is empty, otherwise a pointer to s.
// Used for nullable TEXT columns like minion_id.
var privateRanges = func() []*net.IPNet {
	cidrs := []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}
	nets := make([]*net.IPNet, len(cidrs))
	for i, c := range cidrs {
		_, nets[i], _ = net.ParseCIDR(c)
	}
	return nets
}()

// isPrivateIPStr reports whether ipStr falls within a private IP range.
func isPrivateIPStr(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	for _, r := range privateRanges {
		if r.Contains(ip) {
			return true
		}
	}
	return false
}
