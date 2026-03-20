-- hosts: registered agent nodes (Salt minions or other sources)
CREATE TABLE IF NOT EXISTS hosts (
    -- PK
    id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, -- [PK] surrogate key, auto-generated UUID

    -- identity
    hostname      TEXT        NOT NULL DEFAULT '',  -- human-readable node name
    minion_id     TEXT,                             -- Salt minion ID; NULL allowed for non-Salt sources

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

-- unique active minion: only one active (delete_yn=false) row per minion_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_minion_id_active
    ON hosts (minion_id) WHERE delete_yn = false;

CREATE INDEX IF NOT EXISTS idx_hosts_org_id ON hosts (org_id);

-- host_ip_interfaces: network interfaces belonging to a host
CREATE TABLE IF NOT EXISTS host_ip_interfaces (
    host_id        UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, -- [FK] hosts.id
    interface_name TEXT NOT NULL, -- network interface name (e.g. eth0, lo)
    ip_address     TEXT NOT NULL, -- IP address assigned to the interface
    PRIMARY KEY (host_id, interface_name, ip_address)
);

-- host_disks: disk mount points belonging to a host
CREATE TABLE IF NOT EXISTS host_disks (
    host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, -- [FK] hosts.id
    device      TEXT NOT NULL, -- block device path (e.g. /dev/sda1)
    mount_point TEXT NOT NULL, -- filesystem mount point (e.g. /, /data)
    PRIMARY KEY (host_id, device)
);

-- host_gpus: GPU devices belonging to a host
CREATE TABLE IF NOT EXISTS host_gpus (
    host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE, -- [FK] hosts.id
    vendor  TEXT NOT NULL, -- GPU vendor (e.g. NVIDIA, AMD)
    model   TEXT NOT NULL, -- GPU model name (e.g. RTX 4090, RX 7900)
    PRIMARY KEY (host_id, vendor, model)
);

---- create above / drop below ----

DROP INDEX IF EXISTS idx_hosts_org_id;
DROP INDEX IF EXISTS idx_hosts_minion_id_active;
DROP TABLE IF EXISTS host_gpus;
DROP TABLE IF EXISTS host_disks;
DROP TABLE IF EXISTS host_ip_interfaces;
DROP TABLE IF EXISTS hosts;
