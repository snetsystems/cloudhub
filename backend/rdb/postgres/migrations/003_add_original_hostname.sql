-- add original_hostname column to hosts
ALTER TABLE hosts
    ADD COLUMN IF NOT EXISTS original_hostname TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN hosts.original_hostname IS 'user-defined display name for the server; hostname remains the agent collection key';

---- create above / drop below ----

ALTER TABLE hosts DROP COLUMN IF EXISTS original_hostname;
