-- hosts: registered agent nodes (Salt minions or other sources)
CREATE TABLE IF NOT EXISTS hosts (
    -- PK
    id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, -- [PK] surrogate key, auto-generated UUID

    -- identity
    hostname      TEXT        NOT NULL DEFAULT '',  -- human-readable node name
    minion_id     TEXT        NOT NULL DEFAULT '',  -- Salt minion ID; '' for non-Salt sources

    -- network
    ip            TEXT        NOT NULL DEFAULT '',  -- representative IP (first private IP from ip_interfaces)

    -- hardware
    os            TEXT        NOT NULL DEFAULT '',  -- operating system name (e.g. Ubuntu, Windows)
    os_family     TEXT        NOT NULL DEFAULT '',  -- OS family (e.g. Debian, RedHat)
    os_version    TEXT        NOT NULL DEFAULT '',  -- OS version string
    kernel        TEXT        NOT NULL DEFAULT '',  -- kernel version
    arch          TEXT        NOT NULL DEFAULT '',  -- CPU architecture (e.g. x86_64, arm64)
    mem_total_kb  BIGINT      NOT NULL DEFAULT 0,   -- total physical memory in kilobytes
    swap_total_kb BIGINT      NOT NULL DEFAULT 0,   -- total swap space in kilobytes
    cpu_cores     INT         NOT NULL DEFAULT 0,   -- number of logical CPU cores
    cpu_model     TEXT        NOT NULL DEFAULT '',  -- CPU model string
    bios_version  TEXT        NOT NULL DEFAULT '',  -- BIOS/UEFI version string

    -- metadata
    source_type   TEXT        NOT NULL DEFAULT 'salt', -- registration source (salt | snmp | syslog)
    org_id        TEXT        NOT NULL DEFAULT '',     -- organization this host belongs to
    status        TEXT        NOT NULL DEFAULT 'accepted', -- lifecycle status (accepted | rejected)

    -- audit
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- record creation time
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- last update time
    delete_yn     BOOLEAN     NOT NULL DEFAULT false  -- soft-delete flag; true means logically deleted
);

-- unique active minion: only one active (delete_yn=false) row per non-empty minion_id
-- empty string ('') is allowed for non-Salt sources (SNMP, Syslog)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_minion_id_active
    ON hosts (minion_id) WHERE delete_yn = false AND minion_id != '';

CREATE INDEX IF NOT EXISTS idx_hosts_org_id ON hosts (org_id);

CREATE INDEX IF NOT EXISTS idx_hosts_hostname_active
    ON hosts (hostname) WHERE delete_yn = false;

-- host_ip_interfaces: network interfaces belonging to a host
CREATE TABLE IF NOT EXISTS host_ip_interfaces (
    host_id        UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, -- [PK][FK → hosts.id] parent host; cascades on hard delete
    interface_name TEXT NOT NULL,                                         -- [PK] network interface name (e.g. eth0, lo)
    ip_address     TEXT NOT NULL,                                         -- [PK] IP address assigned to the interface
    PRIMARY KEY (host_id, interface_name, ip_address)
);

-- host_disks: disk mount points belonging to a host
CREATE TABLE IF NOT EXISTS host_disks (
    host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, -- [PK][FK → hosts.id] parent host; cascades on hard delete
    device      TEXT NOT NULL,                                         -- [PK] block device path (e.g. /dev/sda1)
    mount_point TEXT NOT NULL,                                         -- filesystem mount point (e.g. /, /data)
    PRIMARY KEY (host_id, device)
);

-- host_gpus: GPU devices belonging to a host
CREATE TABLE IF NOT EXISTS host_gpus (
    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, -- [PK][FK → hosts.id] parent host; cascades on hard delete
    slot    INT  NOT NULL,                                         -- [PK] internal ordering index from Salt grains dict key (not a physical slot)
    vendor  TEXT NOT NULL,                                         -- GPU vendor (e.g. NVIDIA, AMD)
    model   TEXT NOT NULL,                                         -- GPU model name (e.g. RTX 4090, RX 7900)
    PRIMARY KEY (host_id, slot)
);

-- column comments: stored in DB, visible via \d+ or pg_catalog
COMMENT ON TABLE hosts IS 'registered agent nodes (Salt minions or other sources)';
COMMENT ON COLUMN hosts.id            IS '[PK] surrogate key, auto-generated UUID';
COMMENT ON COLUMN hosts.hostname      IS 'human-readable node name';
COMMENT ON COLUMN hosts.minion_id     IS 'Salt minion ID; empty string for non-Salt sources';
COMMENT ON COLUMN hosts.ip            IS 'representative IP — cached from first private IP in host_ip_interfaces';
COMMENT ON COLUMN hosts.os            IS 'operating system name (e.g. Ubuntu, Windows)';
COMMENT ON COLUMN hosts.os_family     IS 'OS family (e.g. Debian, RedHat)';
COMMENT ON COLUMN hosts.os_version    IS 'OS version string';
COMMENT ON COLUMN hosts.kernel        IS 'kernel version';
COMMENT ON COLUMN hosts.arch          IS 'CPU architecture (e.g. x86_64, arm64)';
COMMENT ON COLUMN hosts.mem_total_kb  IS 'total physical memory in kilobytes';
COMMENT ON COLUMN hosts.swap_total_kb IS 'total swap space in kilobytes';
COMMENT ON COLUMN hosts.cpu_cores     IS 'number of logical CPU cores';
COMMENT ON COLUMN hosts.cpu_model     IS 'CPU model string';
COMMENT ON COLUMN hosts.bios_version  IS 'BIOS/UEFI version string';
COMMENT ON COLUMN hosts.source_type   IS 'registration source (salt | snmp | syslog)';
COMMENT ON COLUMN hosts.org_id        IS 'organization this host belongs to';
COMMENT ON COLUMN hosts.status        IS 'lifecycle status (accepted | rejected)';
COMMENT ON COLUMN hosts.created_at    IS 'record creation time';
COMMENT ON COLUMN hosts.updated_at    IS 'last update time; used as deletion time when delete_yn = true';
COMMENT ON COLUMN hosts.delete_yn     IS 'soft-delete flag; true means logically deleted';

COMMENT ON TABLE host_ip_interfaces IS 'network interfaces belonging to a host';
COMMENT ON COLUMN host_ip_interfaces.host_id        IS '[PK][FK → hosts.id] parent host; cascades on hard delete';
COMMENT ON COLUMN host_ip_interfaces.interface_name IS '[PK] network interface name (e.g. eth0, lo)';
COMMENT ON COLUMN host_ip_interfaces.ip_address     IS '[PK] IP address assigned to the interface';

COMMENT ON TABLE host_disks IS 'disk mount points belonging to a host';
COMMENT ON COLUMN host_disks.host_id     IS '[PK][FK → hosts.id] parent host; cascades on hard delete';
COMMENT ON COLUMN host_disks.device      IS '[PK] block device path (e.g. /dev/sda1)';
COMMENT ON COLUMN host_disks.mount_point IS 'filesystem mount point (e.g. /, /data); key for InfluxDB disk metric lookup';

COMMENT ON TABLE host_gpus IS 'GPU devices belonging to a host';
COMMENT ON COLUMN host_gpus.host_id IS '[PK][FK → hosts.id] parent host; cascades on hard delete';
COMMENT ON COLUMN host_gpus.slot    IS '[PK] internal ordering index from Salt grains dict key; not a physical slot number';
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
