-- hosts: registered agent nodes (Salt minions or other sources)
CREATE TABLE IF NOT EXISTS hosts (
    id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hostname          TEXT        NOT NULL DEFAULT '',
    original_hostname TEXT        NOT NULL DEFAULT '',
    minion_id         TEXT        NOT NULL DEFAULT '',
    ip                TEXT        NOT NULL DEFAULT '',
    os                TEXT        NOT NULL DEFAULT '',
    os_family         TEXT        NOT NULL DEFAULT '',
    os_version        TEXT        NOT NULL DEFAULT '',
    kernel            TEXT        NOT NULL DEFAULT '',
    arch              TEXT        NOT NULL DEFAULT '',
    mem_total_kb      BIGINT      NOT NULL DEFAULT 0,
    swap_total_kb     BIGINT      NOT NULL DEFAULT 0,
    cpu_cores         INT         NOT NULL DEFAULT 0,
    cpu_model         TEXT        NOT NULL DEFAULT '',
    bios_version      TEXT        NOT NULL DEFAULT '',
    timezone          TEXT        NOT NULL DEFAULT '',
    selinux_state     TEXT        NOT NULL DEFAULT '',
    source_type       TEXT        NOT NULL DEFAULT 'salt',
    org_id            TEXT        NOT NULL DEFAULT '',
    status            TEXT        NOT NULL DEFAULT 'accepted',
    is_collector      BOOLEAN     NOT NULL DEFAULT false,
    delete_yn         BOOLEAN     NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_minion_id_active
    ON hosts (minion_id) WHERE delete_yn = false AND minion_id != '';

CREATE INDEX IF NOT EXISTS idx_hosts_org_id ON hosts (org_id);

CREATE INDEX IF NOT EXISTS idx_hosts_hostname_active
    ON hosts (hostname) WHERE delete_yn = false;

-- host_ip_interfaces: network interfaces belonging to a host
CREATE TABLE IF NOT EXISTS host_ip_interfaces (
    id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id        UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    interface_name TEXT NOT NULL,
    ip_address     TEXT NOT NULL
);

-- host_disks: disk mount points belonging to a host
CREATE TABLE IF NOT EXISTS host_disks (
    id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    device      TEXT NOT NULL,
    mount_point TEXT NOT NULL
);

-- host_gpus: GPU devices belonging to a host
CREATE TABLE IF NOT EXISTS host_gpus (
    id      UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    vendor  TEXT NOT NULL,
    model   TEXT NOT NULL
);

-- schema_version: tracks applied migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version     INT         NOT NULL PRIMARY KEY,
    description TEXT        NOT NULL DEFAULT '',
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- column comments
COMMENT ON TABLE hosts IS 'registered agent nodes (Salt minions or other sources)';
COMMENT ON COLUMN hosts.id                IS '[PK] surrogate key, auto-generated UUID';
COMMENT ON COLUMN hosts.hostname          IS 'Salt minion ID used as agent collection key';
COMMENT ON COLUMN hosts.original_hostname IS 'user-defined display name for the server; populated from grains.hostname';
COMMENT ON COLUMN hosts.minion_id         IS 'Salt minion ID; empty string for non-Salt sources';
COMMENT ON COLUMN hosts.ip                IS 'representative IP cached from first private IP in host_ip_interfaces';
COMMENT ON COLUMN hosts.os                IS 'operating system name (e.g. Ubuntu, Windows)';
COMMENT ON COLUMN hosts.os_family         IS 'OS family (e.g. Debian, RedHat)';
COMMENT ON COLUMN hosts.os_version        IS 'OS version string';
COMMENT ON COLUMN hosts.kernel            IS 'kernel version';
COMMENT ON COLUMN hosts.arch              IS 'CPU architecture (e.g. x86_64, arm64)';
COMMENT ON COLUMN hosts.mem_total_kb      IS 'total physical memory in kilobytes';
COMMENT ON COLUMN hosts.swap_total_kb     IS 'total swap space in kilobytes';
COMMENT ON COLUMN hosts.cpu_cores         IS 'number of logical CPU cores';
COMMENT ON COLUMN hosts.cpu_model         IS 'CPU model string';
COMMENT ON COLUMN hosts.bios_version      IS 'BIOS/UEFI version string';
COMMENT ON COLUMN hosts.timezone          IS 'host timezone abbreviation (e.g. KST, UTC, EST); from grains.locale_info.timezone';
COMMENT ON COLUMN hosts.selinux_state     IS 'SELinux enforcement mode (e.g. Enforcing, Permissive, Disabled); empty string for non-Linux hosts';
COMMENT ON COLUMN hosts.source_type       IS 'registration source (salt | snmp | syslog)';
COMMENT ON COLUMN hosts.org_id            IS 'organization this host belongs to';
COMMENT ON COLUMN hosts.status            IS 'lifecycle status (accepted | rejected)';
COMMENT ON COLUMN hosts.is_collector      IS 'true if this host is a collector server; false by default';
COMMENT ON COLUMN hosts.created_at        IS 'record creation time';
COMMENT ON COLUMN hosts.updated_at        IS 'last update time; used as deletion time when delete_yn = true';
COMMENT ON COLUMN hosts.delete_yn         IS 'soft-delete flag; true means logically deleted';

COMMENT ON TABLE  host_ip_interfaces                IS 'network interfaces belonging to a host';
COMMENT ON COLUMN host_ip_interfaces.id             IS '[PK] surrogate UUID';
COMMENT ON COLUMN host_ip_interfaces.host_id        IS '[FK -> hosts.id] parent host; cascades on hard delete';
COMMENT ON COLUMN host_ip_interfaces.interface_name IS 'network interface name (e.g. eth0, lo)';
COMMENT ON COLUMN host_ip_interfaces.ip_address     IS 'IP address assigned to the interface';

COMMENT ON TABLE  host_disks             IS 'disk mount points belonging to a host';
COMMENT ON COLUMN host_disks.id          IS '[PK] surrogate UUID';
COMMENT ON COLUMN host_disks.host_id     IS '[FK -> hosts.id] parent host; cascades on hard delete';
COMMENT ON COLUMN host_disks.device      IS 'block device path (e.g. /dev/sda1)';
COMMENT ON COLUMN host_disks.mount_point IS 'filesystem mount point (e.g. /, /data); key for InfluxDB disk metric lookup';

COMMENT ON TABLE  host_gpus         IS 'GPU devices belonging to a host';
COMMENT ON COLUMN host_gpus.id      IS '[PK] surrogate UUID';
COMMENT ON COLUMN host_gpus.host_id IS '[FK -> hosts.id] parent host; cascades on hard delete';
COMMENT ON COLUMN host_gpus.vendor  IS 'GPU vendor (e.g. NVIDIA, AMD)';
COMMENT ON COLUMN host_gpus.model   IS 'GPU model name (e.g. RTX 4090, RX 7900)';

---- create above / drop below ----

DROP INDEX IF EXISTS idx_hosts_hostname_active;
DROP INDEX IF EXISTS idx_hosts_org_id;
DROP INDEX IF EXISTS idx_hosts_minion_id_active;
DROP TABLE IF EXISTS host_gpus;
DROP TABLE IF EXISTS host_disks;
DROP TABLE IF EXISTS host_ip_interfaces;
DROP TABLE IF EXISTS hosts;
DROP TABLE IF EXISTS schema_version;
