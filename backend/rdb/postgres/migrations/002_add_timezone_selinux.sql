-- add timezone and selinux_state columns to hosts
ALTER TABLE hosts
    ADD COLUMN IF NOT EXISTS timezone      TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS selinux_state TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN hosts.timezone      IS 'host timezone abbreviation (e.g. KST, UTC, EST); from grains.locale_info.timezone';
COMMENT ON COLUMN hosts.selinux_state IS 'SELinux enforcement mode (e.g. Enforcing, Permissive, Disabled); empty string for non-Linux hosts';

---- create above / drop below ----

ALTER TABLE hosts DROP COLUMN IF EXISTS selinux_state;
ALTER TABLE hosts DROP COLUMN IF EXISTS timezone;
