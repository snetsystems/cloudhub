-- 004_create_alert_rule_specs.sql
-- 알람 룰 체계 고도화 (v2): 단일 알람 룰이 여러 개의 지표(specs)를 가질 수 있도록 스키마 분리
-- 데이터 손실이 없도록 무중단(Non-destructive) 데이터 마이그레이션 쿼리 포함

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

-- 2. 기존 데이터 마이그레이션 (alert_rules -> alert_rule_specs)
INSERT INTO alert_rule_specs (alert_rule_id, database, retention_policy, measurement, field, rule_trigger, every)
SELECT id, database, retention_policy, measurement, field, rule_trigger, every
FROM alert_rules;

-- 3. alert_rule_conditions 연결고리 변경 (alert_rule_id -> alert_rule_spec_id)
ALTER TABLE alert_rule_conditions ADD COLUMN IF NOT EXISTS alert_rule_spec_id UUID REFERENCES alert_rule_specs(id) ON DELETE CASCADE;

UPDATE alert_rule_conditions c
SET alert_rule_spec_id = s.id
FROM alert_rule_specs s
WHERE c.alert_rule_id = s.alert_rule_id;

ALTER TABLE alert_rule_conditions DROP CONSTRAINT IF EXISTS alert_rule_conditions_pkey;
ALTER TABLE alert_rule_conditions DROP COLUMN IF EXISTS alert_rule_id;
ALTER TABLE alert_rule_conditions ALTER COLUMN alert_rule_spec_id SET NOT NULL;
ALTER TABLE alert_rule_conditions ADD PRIMARY KEY (alert_rule_spec_id, level);

CREATE INDEX IF NOT EXISTS idx_alert_rule_conditions_alert_rule_spec_id
    ON alert_rule_conditions (alert_rule_spec_id);

-- 4. alert_rule_trigger_values 연결고리 변경
ALTER TABLE alert_rule_trigger_values ADD COLUMN IF NOT EXISTS alert_rule_spec_id UUID REFERENCES alert_rule_specs(id) ON DELETE CASCADE;

UPDATE alert_rule_trigger_values t
SET alert_rule_spec_id = s.id
FROM alert_rule_specs s
WHERE t.alert_rule_id = s.alert_rule_id;

ALTER TABLE alert_rule_trigger_values DROP CONSTRAINT IF EXISTS alert_rule_trigger_values_pkey;
ALTER TABLE alert_rule_trigger_values DROP COLUMN IF EXISTS alert_rule_id;
ALTER TABLE alert_rule_trigger_values ALTER COLUMN alert_rule_spec_id SET NOT NULL;
ALTER TABLE alert_rule_trigger_values ADD PRIMARY KEY (alert_rule_spec_id);

CREATE INDEX IF NOT EXISTS idx_alert_rule_trigger_values_alert_rule_spec_id
    ON alert_rule_trigger_values (alert_rule_spec_id);

-- 5. 기존 테이블에서 옛날 구조의 단일 지표 컬럼들 삭제 및 신규 컬럼 추가
ALTER TABLE alert_rules 
    DROP COLUMN IF EXISTS database,
    DROP COLUMN IF EXISTS retention_policy,
    DROP COLUMN IF EXISTS measurement,
    DROP COLUMN IF EXISTS field,
    DROP COLUMN IF EXISTS rule_trigger,
    DROP COLUMN IF EXISTS every,
    ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'host',
    ADD COLUMN IF NOT EXISTS template_key VARCHAR(255) NOT NULL DEFAULT '';

-- 6. alert_rule_urls 테이블 생성 (1 rule : N urls)
CREATE TABLE IF NOT EXISTS alert_rule_urls (
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    url_target_id UUID NOT NULL REFERENCES url_check_targets(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_rule_id, url_target_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_urls_alert_rule_id ON alert_rule_urls (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_urls_target_id     ON alert_rule_urls (url_target_id);

COMMENT ON TABLE alert_rule_urls IS
  'Layer 3: alert_rule -> url_check_targets N:M. URL monitoring targets.';


---- create above / drop below ----


-- 다운 마이그레이션 (롤백)

-- 1. alert_rules 기존 컬럼 복구 및 신규 컬럼 삭제
ALTER TABLE alert_rules 
    ADD COLUMN IF NOT EXISTS database TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS retention_policy TEXT NOT NULL DEFAULT 'autogen',
    ADD COLUMN IF NOT EXISTS measurement TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS field TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS rule_trigger TEXT NOT NULL DEFAULT 'threshold',
    ADD COLUMN IF NOT EXISTS every TEXT NOT NULL DEFAULT '30s',
    DROP COLUMN IF EXISTS target_type,
    DROP COLUMN IF EXISTS template_key;

-- 2. alert_rule_specs 에서 alert_rules 로 데이터 롤백 복원
UPDATE alert_rules r
SET database = s.database,
    retention_policy = s.retention_policy,
    measurement = s.measurement,
    field = s.field,
    rule_trigger = s.rule_trigger,
    every = s.every
FROM alert_rule_specs s
WHERE r.id = s.alert_rule_id;

-- 3. alert_rule_trigger_values 연결고리 원복
ALTER TABLE alert_rule_trigger_values ADD COLUMN IF NOT EXISTS alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE;

UPDATE alert_rule_trigger_values t
SET alert_rule_id = s.alert_rule_id
FROM alert_rule_specs s
WHERE t.alert_rule_spec_id = s.id;

ALTER TABLE alert_rule_trigger_values DROP CONSTRAINT IF EXISTS alert_rule_trigger_values_pkey;
ALTER TABLE alert_rule_trigger_values DROP COLUMN IF EXISTS alert_rule_spec_id;
ALTER TABLE alert_rule_trigger_values ALTER COLUMN alert_rule_id SET NOT NULL;
ALTER TABLE alert_rule_trigger_values ADD PRIMARY KEY (alert_rule_id);

CREATE INDEX IF NOT EXISTS idx_alert_rule_trigger_values_alert_rule_id
    ON alert_rule_trigger_values (alert_rule_id);

-- 4. alert_rule_conditions 연결고리 원복
ALTER TABLE alert_rule_conditions ADD COLUMN IF NOT EXISTS alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE;

UPDATE alert_rule_conditions c
SET alert_rule_id = s.alert_rule_id
FROM alert_rule_specs s
WHERE c.alert_rule_spec_id = s.id;

ALTER TABLE alert_rule_conditions DROP CONSTRAINT IF EXISTS alert_rule_conditions_pkey;
ALTER TABLE alert_rule_conditions DROP COLUMN IF EXISTS alert_rule_spec_id;
ALTER TABLE alert_rule_conditions ALTER COLUMN alert_rule_id SET NOT NULL;
ALTER TABLE alert_rule_conditions ADD PRIMARY KEY (alert_rule_id, level);

CREATE INDEX IF NOT EXISTS idx_alert_rule_conditions_alert_rule_id
    ON alert_rule_conditions (alert_rule_id);

-- 5. v2 스키마 전용 테이블 삭제
DROP TABLE IF EXISTS alert_rule_urls;
DROP TABLE IF EXISTS alert_rule_specs;

