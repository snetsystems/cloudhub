-- 004_create_alert_rule_specs.sql
-- 알람 룰 체계 고도화 (v2): 단일 알람 룰이 여러 개의 지표(specs)를 가질 수 있도록 스키마 분리

-- 1. alert_rule_specs 테이블 생성 (1 rule : N specs)
CREATE TABLE IF NOT EXISTS alert_rule_specs (
    id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_rule_id    UUID        NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    database         TEXT        NOT NULL DEFAULT '',
    retention_policy TEXT        NOT NULL DEFAULT 'autogen',
    measurement      TEXT        NOT NULL,
    field            TEXT        NOT NULL,
    rule_trigger     TEXT        NOT NULL DEFAULT 'threshold',
    every            TEXT        NOT NULL DEFAULT '30s',
    delete_yn        BOOLEAN     NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_specs_alert_rule_id_active
    ON alert_rule_specs (alert_rule_id) WHERE delete_yn = false;

COMMENT ON TABLE alert_rule_specs IS
  'Layer 3: alert_rule -> specs 1:N. Data collection fields and triggers.';

-- 2. 기존 테이블에서 옛날 구조의 단일 지표 컬럼들 삭제
ALTER TABLE alert_rules 
    DROP COLUMN IF EXISTS database,
    DROP COLUMN IF EXISTS retention_policy,
    DROP COLUMN IF EXISTS measurement,
    DROP COLUMN IF EXISTS field,
    DROP COLUMN IF EXISTS rule_trigger,
    DROP COLUMN IF EXISTS every;

-- 3. alert_rule_urls 테이블 생성 (1 rule : N urls)
CREATE TABLE IF NOT EXISTS alert_rule_urls (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    url_target_id UUID NOT NULL REFERENCES url_check_targets(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, url_target_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_urls_alert_rule_id ON alert_rule_urls (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_urls_target_id     ON alert_rule_urls (url_target_id);

COMMENT ON TABLE alert_rule_urls IS
  'Layer 3: alert_rule -> url_check_targets N:M. URL monitoring targets.';

-- 4. alert_rule_conditions 구조 변경 (alert_rule_id -> alert_rule_spec_id)
DROP TABLE IF EXISTS alert_rule_conditions;
CREATE TABLE IF NOT EXISTS alert_rule_conditions (
    alert_rule_spec_id UUID             NOT NULL REFERENCES alert_rule_specs(id) ON DELETE CASCADE,
    level              TEXT             NOT NULL,           -- 'critical' | 'warning' | 'info'
    value              DOUBLE PRECISION NOT NULL,
    operator           TEXT             NOT NULL DEFAULT 'greater',
    enabled            BOOLEAN          NOT NULL DEFAULT true,
    PRIMARY KEY (alert_rule_spec_id, level)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_conditions_alert_rule_spec_id
    ON alert_rule_conditions (alert_rule_spec_id);

-- 5. alert_rule_trigger_values 구조 변경 (alert_rule_id -> alert_rule_spec_id)
DROP TABLE IF EXISTS alert_rule_trigger_values;
CREATE TABLE IF NOT EXISTS alert_rule_trigger_values (
    alert_rule_spec_id UUID NOT NULL REFERENCES alert_rule_specs(id) ON DELETE CASCADE PRIMARY KEY,
    change             TEXT NOT NULL DEFAULT '',
    period             TEXT NOT NULL DEFAULT '',
    shift              TEXT NOT NULL DEFAULT '',
    operator           TEXT NOT NULL DEFAULT '',
    value              TEXT NOT NULL DEFAULT '',
    range_value        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_trigger_values_alert_rule_spec_id
    ON alert_rule_trigger_values (alert_rule_spec_id);


---- create above / drop below ----


-- 다운 마이그레이션 (롤백)

DROP TABLE IF EXISTS alert_rule_trigger_values;
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

DROP TABLE IF EXISTS alert_rule_conditions;
CREATE TABLE IF NOT EXISTS alert_rule_conditions (
    alert_rule_id UUID             NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    level         TEXT             NOT NULL,           -- 'critical' | 'warning' | 'info'
    value         DOUBLE PRECISION NOT NULL,
    operator      TEXT             NOT NULL DEFAULT 'greater',
    enabled       BOOLEAN          NOT NULL DEFAULT true,
    PRIMARY KEY (alert_rule_id, level)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_conditions_alert_rule_id
    ON alert_rule_conditions (alert_rule_id);

DROP TABLE IF EXISTS alert_rule_urls;
DROP TABLE IF EXISTS alert_rule_specs;

ALTER TABLE alert_rules 
    ADD COLUMN database TEXT NOT NULL DEFAULT '',
    ADD COLUMN retention_policy TEXT NOT NULL DEFAULT 'autogen',
    ADD COLUMN measurement TEXT NOT NULL DEFAULT '',
    ADD COLUMN field TEXT NOT NULL DEFAULT '',
    ADD COLUMN rule_trigger TEXT NOT NULL DEFAULT 'threshold',
    ADD COLUMN every TEXT NOT NULL DEFAULT '30s';
