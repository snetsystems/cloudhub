-- Per-organization OpenClaw skill visibility policy. The default is allow:
-- a skill is hidden from an organization only when a row exists here. Only
-- the Gateway skill slug is stored; skill metadata stays in the Gateway.
CREATE TABLE IF NOT EXISTS openclaw_skill_policies (
    organization_id text        NOT NULL,
    skill_name      text        NOT NULL,
    created_at      timestamptz NOT NULL,
    PRIMARY KEY (organization_id, skill_name)
);
