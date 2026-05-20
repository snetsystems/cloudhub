-- backend/rdb/pgsql/migrations/003_create_alert_groups.sql
--
-- Alert grouping / Kapacitor rule schema (greenfield).
--
-- Domain-extension model:
--   Layer 1 (neutral)  : recipient_groups, recipient_group_members
--   Layer 2 (alert ext): alert_recipient_groups (1:1), alert_recipient_member_prefs (1:1)
--                        — member receive-time window is inlined in member_prefs
--   Layer 3 (engine)   : alert_rules, alert_rule_conditions,
--                        alert_rule_hosts, alert_rule_recipient_groups,
--                        alert_kapacitors, alert_kapacitor_mappings
--
--   alert_rules transform columns (stream-only TICK nodes, 1:0..1 inline):
--     derivative_* — |derivative() between |from() and the alert pipeline.
--     eval_*       — |eval(lambda).as(alias).keep(); thresholds use eval_as.
--     Order in tickscript: |from() → |eval() → |derivative() → alert pipeline.
--
-- All alert recipients flow through recipient_groups -> recipient_group_members.
-- There is no rule-level direct-email escape hatch — ad-hoc external recipients
-- should be modeled as a group member with user_id = email (or similar convention).
--
-- Reminder / repetition policy is per-rule via alert_rules columns
-- (pause_seconds, occurrence_*, conditions) rendered into TICKscript
-- (stateChangeOnly, stateCount chaining).
--
-- Group-level burst suppression ("대량 알림 발생 방지") lives on
-- alert_recipient_groups (suppression_*) and is enforced at the alert
-- delivery layer (cross-rule, group-scoped) — not in TICKscript.
--
-- Deletion policy follows 001/002 convention:
--   - Entities with independent lifecycle carry delete_yn (soft delete):
--       recipient_groups, recipient_group_members, alert_kapacitors, alert_rules
--   - Domain extensions (Layer 2) and N:M / mapping tables use ON DELETE CASCADE
--     as a safety net; their existence itself is the activation/binding signal.
--   - Active indexes filter WHERE delete_yn = false.
--
-- Future domains (report, etc.) extend Layer 1 via their own *_recipient_groups /
-- *_recipient_member_prefs tables.
--
-- recipient_groups.is_default: at most one per org (partial unique index).
-- System bootstrap marks the org default group; name is display-only (e.g. "<Org Name> Default Recipients").

-- =====================================================================
-- Layer 1: 도메인 중립 (recipient identity)
-- =====================================================================

-- recipient_groups: alert/report 등 모든 수신 도메인이 공유하는 그룹
CREATE TABLE IF NOT EXISTS recipient_groups (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      TEXT        NOT NULL DEFAULT '',
    name        TEXT        NOT NULL,
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    delete_yn   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipient_groups_org_id_active
    ON recipient_groups (org_id) WHERE delete_yn = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipient_groups_org_default_active
    ON recipient_groups (org_id) WHERE is_default = true AND delete_yn = false;

-- recipient_group_members: 그룹 멤버 정체성 + 연락처 (도메인 중립)
--   email / phone_number: 연락처 데이터. SMS 채널이 phone_number를 사용.
CREATE TABLE IF NOT EXISTS recipient_group_members (
    id                 UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_group_id UUID    NOT NULL REFERENCES recipient_groups(id) ON DELETE CASCADE,
    user_id            TEXT    NOT NULL,
    user_name          TEXT    NOT NULL,
    email              TEXT    NOT NULL DEFAULT '',
    phone_number       TEXT    NOT NULL DEFAULT '',
    delete_yn          BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipient_group_members_group_id_active
    ON recipient_group_members (recipient_group_id) WHERE delete_yn = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipient_group_members_user_active
    ON recipient_group_members (recipient_group_id, user_id) WHERE delete_yn = false;

-- =====================================================================
-- Layer 2: Alert 도메인 확장 (Layer 1 위에 alert 전용 설정 캡슐화)
-- =====================================================================

-- alert_recipient_groups: 그룹의 alert 도메인 활성 + 그룹 단위 버스트 방지 정책 (1:1 with recipient_groups)
--   suppression_* : "대량 알림 발생 방지" — 그룹 단위 버스트 차단 (alert 발송 레이어에서 적용).
--   채널/레벨/에스컬레이션/수신 시간은 사용자별 정책이므로 alert_recipient_member_prefs에 위치.
--   행 존재 자체가 "이 그룹은 alert 도메인 활성"을 의미.
CREATE TABLE IF NOT EXISTS alert_recipient_groups (
    recipient_group_id         UUID        NOT NULL PRIMARY KEY
                                           REFERENCES recipient_groups(id) ON DELETE CASCADE,
    suppression_enabled        BOOLEAN     NOT NULL DEFAULT false,
    suppression_window_seconds INT         NOT NULL DEFAULT 300,
    suppression_count          INT         NOT NULL DEFAULT 20,
    suppression_pause_seconds  INT         NOT NULL DEFAULT 300,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- alert_recipient_member_prefs: 멤버의 alert 채널 ON/OFF + 채널별 수신 레벨 + 시간 윈도우 + 에스컬레이션 (1:1 with members)
--   notify_weekdays/start_hm/end_hm: 이 멤버가 alert을 받는 시간 윈도우 (기본값 = 제한 없음).
--   escalation_seconds: 사용자별 반복 알림 간격(초). 0이면 비활성.
CREATE TABLE IF NOT EXISTS alert_recipient_member_prefs (
    recipient_group_member_id UUID    NOT NULL PRIMARY KEY
                                      REFERENCES recipient_group_members(id) ON DELETE CASCADE,
    email_enabled             BOOLEAN NOT NULL DEFAULT false,
    email_level               TEXT    NOT NULL DEFAULT 'all',
    sms_enabled               BOOLEAN NOT NULL DEFAULT false,
    sms_level                 TEXT    NOT NULL DEFAULT 'all',
    notify_weekdays           TEXT    NOT NULL DEFAULT '1,2,3,4,5,6,7',
    notify_start_hm           TEXT    NOT NULL DEFAULT '00:00',
    notify_end_hm             TEXT    NOT NULL DEFAULT '23:59',
    escalation_seconds        INT     NOT NULL DEFAULT 0
);

-- =====================================================================
-- Layer 3: Alert 규칙 엔진 (Kapacitor 통합)
-- =====================================================================

-- alert_kapacitors: alert 시스템 전용 Kapacitor 인스턴스 (KV servers와 분리)
CREATE TABLE IF NOT EXISTS alert_kapacitors (
    id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id               TEXT        NOT NULL DEFAULT '',
    name                 TEXT        NOT NULL,
    url                  TEXT        NOT NULL,
    username             TEXT        NOT NULL DEFAULT '',
    password             TEXT        NOT NULL DEFAULT '',
    insecure_skip_verify BOOLEAN     NOT NULL DEFAULT false,
    delete_yn            BOOLEAN     NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_kapacitors_org_id_active
    ON alert_kapacitors (org_id) WHERE delete_yn = false;

-- alert_kapacitor_mappings: legacy KV Server(Kapacitor) <-> v2 alert_kapacitors 영구 동기화 다리
--   legacy KV 측 (source_id, kapacitor_id) 식별자와 v2 PG 측 UUID를 잇는 cross-reference.
--   KV Server 생성/수정/삭제 시 v2 alert_kapacitors 동기 반영을 위해 지속적으로 사용됨.
--   source_id / legacy_kapacitor_id 는 Go int(KV int64)와 맞추기 위해 BIGINT 사용.
CREATE TABLE IF NOT EXISTS alert_kapacitor_mappings (
    source_id           BIGINT      NOT NULL,
    legacy_kapacitor_id BIGINT      NOT NULL,
    alert_kapacitor_id  UUID        NOT NULL REFERENCES alert_kapacitors(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_id, legacy_kapacitor_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_kapacitor_mappings_alert_kapacitor_id
    ON alert_kapacitor_mappings (alert_kapacitor_id);

-- alert_rules: 알림 규칙 (1행 = Kapacitor task 1개)
CREATE TABLE IF NOT EXISTS alert_rules (
    id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id            TEXT        NOT NULL DEFAULT '',
    kapacitor_id      TEXT        NOT NULL DEFAULT '',
    name              TEXT        NOT NULL,
    database          TEXT        NOT NULL DEFAULT '',
    retention_policy  TEXT        NOT NULL DEFAULT 'autogen',
    measurement       TEXT        NOT NULL DEFAULT '',
    field             TEXT        NOT NULL DEFAULT '',
    trigger_operator  TEXT        NOT NULL DEFAULT 'greater',
    rule_trigger      TEXT        NOT NULL DEFAULT 'threshold',
    task_type         TEXT        NOT NULL DEFAULT 'stream',
    every             TEXT        NOT NULL DEFAULT '30s',
    occurrence_type   TEXT        NOT NULL DEFAULT 'consecutive',
    occurrence_count  INT         NOT NULL DEFAULT 1,
    occurrence_window TEXT        NOT NULL DEFAULT '5m',
    pause_seconds     INT         NOT NULL DEFAULT 0,
    notify_recovery   BOOLEAN     NOT NULL DEFAULT false,
    message                 TEXT    NOT NULL DEFAULT '',
    active                  BOOLEAN NOT NULL DEFAULT true,
    derivative_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    derivative_non_negative BOOLEAN NOT NULL DEFAULT TRUE,
    derivative_unit         TEXT    NOT NULL DEFAULT '',
    eval_expression         TEXT    NOT NULL DEFAULT '',
    eval_as                 TEXT    NOT NULL DEFAULT '',
    delete_yn               BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id_active
    ON alert_rules (org_id) WHERE delete_yn = false;

-- alert_rule_conditions: 규칙의 level별 임계값 (warning / critical / info 등)
--   1 rule : N conditions (보통 1~3행). TICKscript 생성 시 level별 stateCount 체이닝.
CREATE TABLE IF NOT EXISTS alert_rule_conditions (
    alert_rule_id UUID             NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    level         TEXT             NOT NULL,           -- 'critical' | 'warning' | 'info'
    value         DOUBLE PRECISION NOT NULL,
    enabled       BOOLEAN          NOT NULL DEFAULT true,
    PRIMARY KEY (alert_rule_id, level)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_conditions_alert_rule_id
    ON alert_rule_conditions (alert_rule_id);

-- alert_rule_trigger_values: trigger-specific settings for relative/deadman rules
--   1 rule : 0..1 trigger values row. Threshold rules usually do not need one.
CREATE TABLE IF NOT EXISTS alert_rule_trigger_values (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE PRIMARY KEY,
    change        TEXT NOT NULL DEFAULT '',
    period        TEXT NOT NULL DEFAULT '',
    shift         TEXT NOT NULL DEFAULT '',
    operator      TEXT NOT NULL DEFAULT '',
    value         TEXT NOT NULL DEFAULT '',
    range_value   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_trigger_values_alert_rule_id
    ON alert_rule_trigger_values (alert_rule_id);

-- alert_rule_hosts: 규칙 대상 호스트명 (Influx 보고되는 hostname; hosts FK 없음)
CREATE TABLE IF NOT EXISTS alert_rule_hosts (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    hostname      TEXT NOT NULL,
    PRIMARY KEY (alert_rule_id, hostname)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_hosts_alert_rule_id ON alert_rule_hosts (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_hosts_hostname      ON alert_rule_hosts (hostname);

-- alert_rule_recipient_groups: 규칙 ↔ 수신자 그룹 N:M (Layer 1 그룹을 직접 참조)
CREATE TABLE IF NOT EXISTS alert_rule_recipient_groups (
    alert_rule_id      UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    recipient_group_id UUID NOT NULL REFERENCES recipient_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, recipient_group_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_recipient_groups_alert_rule_id
    ON alert_rule_recipient_groups (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_recipient_groups_recipient_group_id
    ON alert_rule_recipient_groups (recipient_group_id);

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE recipient_groups IS
  'Layer 1: domain-neutral recipient grouping. Shared by alert / report / future domains.';
COMMENT ON TABLE recipient_group_members IS
  'Layer 1: member identity + contact info (email, phone_number). Domain-neutral. phone_number is consumed by the SMS channel via prefs in Layer 2.';

COMMENT ON TABLE alert_recipient_groups IS
  'Layer 2: alert-domain extension of recipient_groups (1:1). Row existence marks the group as alert-active; columns hold group-level burst suppression policy (suppression_*).';
COMMENT ON TABLE alert_recipient_member_prefs IS
  'Layer 2: alert-domain extension of recipient_group_members (1:1). Per-member channel toggles, per-channel level, receive-time window, escalation interval.';

COMMENT ON TABLE alert_kapacitors IS
  'Layer 3: Kapacitor instances for alert system (separate from KV servers for PG FK integrity).';
COMMENT ON TABLE alert_kapacitor_mappings IS
  'Layer 3: persistent cross-reference between legacy KV Server (source_id, kapacitor_id) and v2 alert_kapacitors.id. Kept in sync on every KV Server create/update/delete.';
COMMENT ON TABLE alert_rules IS
  'Layer 3: alert rule (1 rule = 1 Kapacitor task).';
COMMENT ON TABLE alert_rule_conditions IS
  'Layer 3: alert_rule -> conditions 1:N. Per-level threshold (warning/critical/info). Rendered as chained stateCount nodes in TICKscript.';
COMMENT ON TABLE alert_rule_hosts IS
  'Layer 3: alert_rule -> hostname N:M (hostname stored directly, no FK to hosts table).';
COMMENT ON TABLE alert_rule_recipient_groups IS
  'Layer 3: alert_rule -> recipient_groups N:M.';

-- alert_rules columns
COMMENT ON COLUMN alert_rules.kapacitor_id IS
  'Kapacitor instance this rule is deployed to (TEXT, not FK to alert_kapacitors — also accepts legacy KV identifiers).';
COMMENT ON COLUMN alert_rules.database IS
  'Source InfluxDB database name to query.';
COMMENT ON COLUMN alert_rules.retention_policy IS
  'InfluxDB retention policy under the source database. Default: autogen.';
COMMENT ON COLUMN alert_rules.measurement IS
  'InfluxDB measurement to query (e.g. cpu, mem, disk).';
COMMENT ON COLUMN alert_rules.field IS
  'Measurement field that conditions evaluate against (e.g. usage_idle).';
COMMENT ON COLUMN alert_rules.trigger_operator IS
  'Comparison applied between field value and condition value. greater | less | equal | not_equal | greater_equal | less_equal. Applies to all conditions of this rule.';
COMMENT ON COLUMN alert_rules.rule_trigger IS
  'threshold (compare to fixed value) | relative (compare to past) | deadman (data absent). deadman requires task_type=stream.';
COMMENT ON COLUMN alert_rules.task_type IS
  'Kapacitor task mode. stream (continuous, evaluated on each point) | batch (periodic InfluxQL query). Only batch uses alert_rules.every.';
COMMENT ON COLUMN alert_rules.every IS
  'BATCH task only: query execution interval AND the InfluxDB time window (WHERE time > -<every>). Format: Kapacitor duration string (30s, 5m, 1h). Ignored for stream tasks.';
COMMENT ON COLUMN alert_rules.occurrence_type IS
  'How occurrences are counted for trigger firing. consecutive (N points in a row) | recent (N points within occurrence_window).';
COMMENT ON COLUMN alert_rules.occurrence_count IS
  'Number of qualifying occurrences required before the rule fires.';
COMMENT ON COLUMN alert_rules.occurrence_window IS
  'Time window used when occurrence_type=recent. Kapacitor duration (e.g. 5m). Ignored for consecutive.';
COMMENT ON COLUMN alert_rules.pause_seconds IS
  'Reminder interval while state stays non-OK. 0 = no reminders (alert once on state change only). Rendered as stateChangeOnly(<n>s) in TICKscript. Distinct from alert_recipient_groups.suppression_pause_seconds (group-level burst).';
COMMENT ON COLUMN alert_rules.notify_recovery IS
  'When true, also emit an alert when state returns to OK.';
COMMENT ON COLUMN alert_rules.message IS
  'Alert message template, including TICKscript placeholders (e.g. {{ .Level }} {{ index .Tags "host" }}).';
COMMENT ON COLUMN alert_rules.active IS
  'When false, this rule is not deployed to Kapacitor / not evaluated.';
COMMENT ON COLUMN alert_rules.derivative_enabled IS
  'When true, tickscript inserts |derivative() before the alert pipeline.';
COMMENT ON COLUMN alert_rules.derivative_non_negative IS
  'TICK |derivative().nonNegative() — drop negative diffs (counter resets).';
COMMENT ON COLUMN alert_rules.derivative_unit IS
  'TICK |derivative().unit(<duration>) — duration literal like "1s". Empty falls back to "1s" at generation time.';
COMMENT ON COLUMN alert_rules.eval_expression IS
  'TICK |eval(lambda: <expression>). Active when both eval_expression and eval_as are non-empty.';
COMMENT ON COLUMN alert_rules.eval_as IS
  'TICK |eval(...).as(<alias>) — result field name. Threshold lambdas reference this instead of rule.field.';
COMMENT ON TABLE alert_rule_trigger_values IS
  'Layer 3: optional 1:1 trigger-specific settings for alert_rules. Relative uses change/shift/operator; deadman uses period.';
COMMENT ON COLUMN alert_rule_trigger_values.change IS
  'Relative trigger change type: change | % change.';
COMMENT ON COLUMN alert_rule_trigger_values.period IS
  'Deadman period duration before data absence triggers an alert.';
COMMENT ON COLUMN alert_rule_trigger_values.shift IS
  'Relative trigger shift duration used to compare current value to past value.';
COMMENT ON COLUMN alert_rule_trigger_values.operator IS
  'Relative trigger comparison operator in UI form, e.g. greater than.';
COMMENT ON COLUMN alert_rule_trigger_values.value IS
  'Optional trigger-level value retained for compatibility; alert_group level thresholds live in alert_rule_conditions.';
COMMENT ON COLUMN alert_rule_trigger_values.range_value IS
  'Optional trigger-level range upper value retained for compatibility.';

-- alert_recipient_member_prefs columns
COMMENT ON COLUMN alert_recipient_member_prefs.email_enabled IS
  'When true, this member receives alerts via email channel.';
COMMENT ON COLUMN alert_recipient_member_prefs.email_level IS
  'Minimum severity this member receives via email. Allowed: all (info+warn+crit) | warning (warn+crit) | critical (crit only). Empty = all.';
COMMENT ON COLUMN alert_recipient_member_prefs.sms_enabled IS
  'When true, this member receives alerts via SMS channel (uses recipient_group_members.phone_number).';
COMMENT ON COLUMN alert_recipient_member_prefs.sms_level IS
  'Minimum severity this member receives via SMS. Allowed: all (info+warn+crit) | warning (warn+crit) | critical (crit only). Empty = all.';
COMMENT ON COLUMN alert_recipient_member_prefs.notify_weekdays IS
  'Weekday filter for alert reception. CSV of ISO 8601 weekday numbers (1=Mon … 7=Sun). Default 1..7 = no restriction.';
COMMENT ON COLUMN alert_recipient_member_prefs.notify_start_hm IS
  'Start of daily reception window (HH:MM, 24h). Default 00:00 = no lower bound.';
COMMENT ON COLUMN alert_recipient_member_prefs.notify_end_hm IS
  'End of daily reception window (HH:MM, 24h). Default 23:59 = no upper bound.';
COMMENT ON COLUMN alert_recipient_member_prefs.escalation_seconds IS
  'Per-member repeat interval (seconds) while state stays non-OK. 0 = no per-member repeats. Independent of alert_rules.pause_seconds.';

COMMENT ON COLUMN alert_rule_conditions.level IS
  'Severity level (e.g. critical | warning | info). PK with alert_rule_id ensures one row per level per rule.';
COMMENT ON COLUMN alert_rule_conditions.value IS
  'Threshold value compared against alert_rules.field using alert_rules.trigger_operator.';
COMMENT ON COLUMN alert_rule_conditions.enabled IS
  'When false, this level is skipped during TICKscript generation.';
COMMENT ON COLUMN alert_recipient_groups.suppression_enabled IS
  'Whether group-level burst suppression is active.';
COMMENT ON COLUMN alert_recipient_groups.suppression_window_seconds IS
  'Detection window (seconds): if alerts to this group exceed suppression_count within this window, pause for suppression_pause_seconds.';
COMMENT ON COLUMN alert_recipient_groups.suppression_count IS
  'Detection threshold (count of alerts to this group inside the window).';
COMMENT ON COLUMN alert_recipient_groups.suppression_pause_seconds IS
  'Pause duration (seconds) applied to this group after burst detection. Distinct from alert_rules.pause_seconds (rule-level reminder cadence).';

-- recipient_group_members columns
COMMENT ON COLUMN recipient_group_members.user_id IS
  'CloudHub user identifier. For ad-hoc external recipients (not a CloudHub user), use the email or a prefixed convention (e.g. external:vendor@x.com).';
COMMENT ON COLUMN recipient_group_members.user_name IS
  'Display name for this member.';
COMMENT ON COLUMN recipient_group_members.email IS
  'Email address (channel-neutral data). Used by email channel when alert_recipient_member_prefs.email_enabled.';
COMMENT ON COLUMN recipient_group_members.phone_number IS
  'Phone number. Consumed by the SMS channel (see alert_recipient_member_prefs.sms_*).';

-- alert_kapacitors columns
COMMENT ON COLUMN alert_kapacitors.url IS
  'Kapacitor HTTP endpoint (scheme://host:port).';
COMMENT ON COLUMN alert_kapacitors.username IS
  'Basic auth username for Kapacitor API. Empty when Kapacitor has no auth.';
COMMENT ON COLUMN alert_kapacitors.password IS
  'Basic auth password for Kapacitor API. Empty when Kapacitor has no auth.';
COMMENT ON COLUMN alert_kapacitors.insecure_skip_verify IS
  'When true, TLS certificate verification is skipped for Kapacitor connections.';

-- alert_kapacitor_mappings columns
COMMENT ON COLUMN alert_kapacitor_mappings.source_id IS
  'Legacy KV Source ID component of the cross-reference key (BIGINT, matches Go int).';
COMMENT ON COLUMN alert_kapacitor_mappings.legacy_kapacitor_id IS
  'Legacy KV Kapacitor (Server) ID component of the cross-reference key (BIGINT, matches Go int).';
COMMENT ON COLUMN alert_kapacitor_mappings.alert_kapacitor_id IS
  'Resolved v2 alert_kapacitors.id for the legacy identifier pair.';

-- alert_rule_hosts columns
COMMENT ON COLUMN alert_rule_hosts.hostname IS
  'Hostname as reported to InfluxDB. Stored directly as text — NOT a FK to the hosts table.';

-- Soft-delete flags
COMMENT ON COLUMN recipient_groups.is_default         IS 'true = org-wide default recipient group (system-managed membership sync); at most one per org';
COMMENT ON COLUMN recipient_groups.delete_yn          IS 'soft-delete flag; true means logically deleted';
COMMENT ON COLUMN recipient_group_members.delete_yn   IS 'soft-delete flag; true means logically deleted';
COMMENT ON COLUMN alert_kapacitors.delete_yn          IS 'soft-delete flag; true means logically deleted';
COMMENT ON COLUMN alert_rules.delete_yn               IS 'soft-delete flag; true means logically deleted';

---- create above / drop below ----

DROP TABLE IF EXISTS alert_rule_recipient_groups;
DROP TABLE IF EXISTS alert_rule_hosts;
DROP TABLE IF EXISTS alert_rule_trigger_values;
DROP TABLE IF EXISTS alert_rule_conditions;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS alert_kapacitor_mappings;
DROP TABLE IF EXISTS alert_kapacitors;
DROP TABLE IF EXISTS alert_recipient_member_prefs;
DROP TABLE IF EXISTS alert_recipient_groups;
DROP TABLE IF EXISTS recipient_group_members;
DROP TABLE IF EXISTS recipient_groups;
