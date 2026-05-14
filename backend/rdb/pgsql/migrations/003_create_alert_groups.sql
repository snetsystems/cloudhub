-- backend/rdb/pgsql/migrations/003_create_alert_groups.sql
--
-- Alert grouping / Kapacitor rule schema (greenfield).
-- Final layout consolidates former incremental migrations 007 (device_groups
-- removed → alert_rule_hosts), 008 (notification_tags removed →
-- alert_rule_user_groups), and 014 (alert_rule_hosts.hostname, no hosts FK).

-- user_groups: 알림 수신자 그룹 (alert_nodes JSONB로 채널 설정)
CREATE TABLE IF NOT EXISTS user_groups (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              TEXT        NOT NULL DEFAULT '',
    name                TEXT        NOT NULL,
    alert_nodes         JSONB       NOT NULL DEFAULT '{}',
    escalation_schedule TEXT        NOT NULL DEFAULT '',
    notify_days         TEXT        NOT NULL DEFAULT '1,2,3,4,5,6,7',
    notify_start_hm     TEXT        NOT NULL DEFAULT '00:00',
    notify_end_hm       TEXT        NOT NULL DEFAULT '23:59',
    receive_level       TEXT        NOT NULL DEFAULT 'all',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_groups_org_id ON user_groups (org_id);

-- user_group_members: user_group ↔ 사용자 (이메일/SMS 채널 설정)
CREATE TABLE IF NOT EXISTS user_group_members (
    id            UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_group_id UUID    NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id       TEXT    NOT NULL,
    user_name     TEXT    NOT NULL,
    email         TEXT    NOT NULL DEFAULT '',
    email_enabled BOOLEAN NOT NULL DEFAULT false,
    email_level   TEXT    NOT NULL DEFAULT 'all',
    sms           TEXT    NOT NULL DEFAULT '',
    sms_enabled   BOOLEAN NOT NULL DEFAULT false,
    sms_level     TEXT    NOT NULL DEFAULT 'all',
    UNIQUE (user_group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group_id ON user_group_members (user_group_id);

-- alert_kapacitors: 알림 시스템 전용 Kapacitor 등록
-- KV 스토어의 servers와 별개로 PostgreSQL FK 정합성을 위해 별도 관리
CREATE TABLE IF NOT EXISTS alert_kapacitors (
    id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id               TEXT        NOT NULL DEFAULT '',
    name                 TEXT        NOT NULL,
    url                  TEXT        NOT NULL,
    username             TEXT        NOT NULL DEFAULT '',
    password             TEXT        NOT NULL DEFAULT '',
    insecure_skip_verify BOOLEAN     NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_kapacitors_org_id ON alert_kapacitors (org_id);

-- alert_kapacitor_mappings: legacy v1 kapacitor(source_id, legacy_kapacitor_id) -> v2 alert_kapacitors.id
-- 과도기 동기화용 매핑 테이블이며 Alert Group이 완전히 v2로 이관되면 제거 대상이다.
CREATE TABLE IF NOT EXISTS alert_kapacitor_mappings (
    source_id            INT         NOT NULL,
    legacy_kapacitor_id  INT         NOT NULL,
    alert_kapacitor_id   UUID        NOT NULL REFERENCES alert_kapacitors(id) ON DELETE CASCADE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_id, legacy_kapacitor_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_kapacitor_mappings_alert_kapacitor_id
    ON alert_kapacitor_mappings (alert_kapacitor_id);

-- alert_rules: 알림 규칙 (1개 = Kapacitor task 1개)
CREATE TABLE IF NOT EXISTS alert_rules (
    id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id            TEXT        NOT NULL DEFAULT '',
    kapacitor_id      TEXT        NOT NULL DEFAULT '',
    name              TEXT        NOT NULL,
    database          TEXT        NOT NULL DEFAULT '',
    retention_policy  TEXT        NOT NULL DEFAULT 'autogen',
    measurement       TEXT        NOT NULL DEFAULT '',
    field             TEXT        NOT NULL DEFAULT '',
    conditions        JSONB       NOT NULL DEFAULT '[]',
    trigger_operator  TEXT        NOT NULL DEFAULT 'greater',
    rule_trigger      TEXT        NOT NULL DEFAULT 'threshold',
    task_type         TEXT        NOT NULL DEFAULT 'stream',
    every             TEXT        NOT NULL DEFAULT '30s',
    occurrence_type   TEXT        NOT NULL DEFAULT 'consecutive',
    occurrence_count  INT         NOT NULL DEFAULT 1,
    occurrence_window TEXT        NOT NULL DEFAULT '5m',
    pause_seconds     INT         NOT NULL DEFAULT 0,
    notify_recovery   BOOLEAN     NOT NULL DEFAULT false,
    message           TEXT        NOT NULL DEFAULT '',
    active            BOOLEAN     NOT NULL DEFAULT true,
    recipients        JSONB       NOT NULL DEFAULT '[]',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id ON alert_rules (org_id);

-- alert_rule_hosts: 규칙 대상 호스트명 (Influx에 보고되는 hostname; hosts 등록 불필요)
CREATE TABLE IF NOT EXISTS alert_rule_hosts (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    hostname      TEXT NOT NULL,
    PRIMARY KEY (alert_rule_id, hostname)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_hosts_alert_rule_id ON alert_rule_hosts (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_hosts_hostname      ON alert_rule_hosts (hostname);

COMMENT ON TABLE alert_rule_hosts IS 'alert_rule -> hostname N:M (hostname stored directly, no FK to hosts)';

-- alert_rule_user_groups: 규칙 ↔ 수신 user_group 직접 연결
CREATE TABLE IF NOT EXISTS alert_rule_user_groups (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    user_group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, user_group_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_user_groups_alert_rule_id ON alert_rule_user_groups (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_user_groups_user_group_id ON alert_rule_user_groups (user_group_id);

COMMENT ON TABLE alert_rule_user_groups IS 'alert_rule -> user_groups N:M (direct recipient-group targeting, no notification_tag intermediary)';

-- alert_time_tags: 이벤트 동작 시간 태그
CREATE TABLE IF NOT EXISTS alert_time_tags (
    id       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id   TEXT NOT NULL DEFAULT '',
    name     TEXT NOT NULL,
    weekdays TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    start_hm TEXT NOT NULL DEFAULT '00:00',
    end_hm   TEXT NOT NULL DEFAULT '23:59',
    color    TEXT NOT NULL DEFAULT '#7A5AF8'
);
CREATE INDEX IF NOT EXISTS idx_alert_time_tags_org_id ON alert_time_tags (org_id);

-- alert_rule_time_tags: alert_rule ↔ alert_time_tag N:M
CREATE TABLE IF NOT EXISTS alert_rule_time_tags (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    time_tag_id   UUID NOT NULL REFERENCES alert_time_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, time_tag_id)
);

-- alert_suppression_settings: 대량 알림 방지 (org 단위)
CREATE TABLE IF NOT EXISTS alert_suppression_settings (
    org_id                   TEXT    NOT NULL PRIMARY KEY,
    enabled                  BOOLEAN NOT NULL DEFAULT false,
    detection_window_seconds INT     NOT NULL DEFAULT 300,
    detection_count          INT     NOT NULL DEFAULT 20,
    pause_seconds            INT     NOT NULL DEFAULT 300
);

COMMENT ON TABLE user_groups IS 'alert notification recipient groups';
COMMENT ON TABLE alert_kapacitors IS 'Kapacitor instances for alert system (separate from KV servers for PG FK integrity)';
COMMENT ON TABLE alert_rules IS 'alert rule: 1 rule = 1 Kapacitor task';
COMMENT ON COLUMN alert_rules.kapacitor_id IS 'Kapacitor instance this rule is deployed to';
COMMENT ON COLUMN alert_rules.conditions IS 'JSON array of {level, value, enabled}';
COMMENT ON COLUMN alert_rules.rule_trigger IS 'threshold | relative | deadman; deadman requires task_type stream';
COMMENT ON COLUMN alert_rules.recipients IS 'JSON array of direct-input email recipients (in addition to user_group chain)';
COMMENT ON COLUMN user_groups.alert_nodes IS 'AlertNodes JSON: slack, email, pagerDuty2, post, etc.';

---- create above / drop below ----

DROP TABLE IF EXISTS alert_rule_time_tags;
DROP TABLE IF EXISTS alert_time_tags;
DROP TABLE IF EXISTS alert_suppression_settings;
DROP TABLE IF EXISTS alert_rule_user_groups;
DROP TABLE IF EXISTS alert_rule_hosts;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS alert_kapacitor_mappings;
DROP TABLE IF EXISTS alert_kapacitors;
DROP TABLE IF EXISTS user_group_members;
DROP TABLE IF EXISTS user_groups;
