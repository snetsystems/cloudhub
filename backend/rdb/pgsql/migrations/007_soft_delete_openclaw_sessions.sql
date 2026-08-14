ALTER TABLE openclaw_sessions
    ADD COLUMN IF NOT EXISTS delete_yn boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS openclaw_sessions_active_owner_idx
    ON openclaw_sessions (organization_id, user_id, updated_at DESC)
    WHERE delete_yn = false;
