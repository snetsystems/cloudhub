-- url_monitoring
CREATE TABLE IF NOT EXISTS url_monitoring (
    id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id               TEXT        NOT NULL DEFAULT '',
    collector_server     TEXT        NOT NULL DEFAULT '',
    delete_yn            BOOLEAN     NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_url_monitoring_org_id_active
    ON url_monitoring (org_id) WHERE delete_yn = false;

CREATE INDEX IF NOT EXISTS idx_url_monitoring_org_id ON url_monitoring (org_id);

COMMENT ON TABLE  url_monitoring                      IS 'org당 URL 모니터링 수집 설정';
COMMENT ON COLUMN url_monitoring.id                   IS '[PK] surrogate UUID';
COMMENT ON COLUMN url_monitoring.org_id               IS 'CloudHub org ID (etcd 호환, FK 없음)';
COMMENT ON COLUMN url_monitoring.collector_server     IS 'Salt를 통해 conf를 배포할 collector 서버명';
COMMENT ON COLUMN url_monitoring.delete_yn            IS 'soft-delete 플래그';
COMMENT ON COLUMN url_monitoring.created_at           IS '생성 시각';
COMMENT ON COLUMN url_monitoring.updated_at           IS '마지막 수정 시각';

-- url_monitoring_targets
CREATE TABLE IF NOT EXISTS url_monitoring_targets (
    id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    url_monitoring_id UUID        NOT NULL REFERENCES url_monitoring(id) ON DELETE CASCADE,
    name              TEXT        NOT NULL DEFAULT '',
    url               TEXT        NOT NULL DEFAULT '',
    interval          TEXT        NOT NULL DEFAULT '1m',
    response_timeout  TEXT        NOT NULL DEFAULT '5s',
    method            TEXT        NOT NULL DEFAULT 'GET',
    alert_rule_id     TEXT        NOT NULL DEFAULT '',
    delete_yn         BOOLEAN     NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_monitoring_targets_monitoring_id
    ON url_monitoring_targets (url_monitoring_id);

-- case-insensitive unique name per url_monitoring (active only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_url_monitoring_targets_url_monitoring_id_name_lower_active
    ON url_monitoring_targets (url_monitoring_id, lower(name))
    WHERE delete_yn = false;

COMMENT ON TABLE  url_monitoring_targets                    IS '개별 모니터링 대상 URL';
COMMENT ON COLUMN url_monitoring_targets.id                 IS '[PK] surrogate UUID';
COMMENT ON COLUMN url_monitoring_targets.url_monitoring_id  IS '[FK -> url_monitoring.id] 부모 설정';
COMMENT ON COLUMN url_monitoring_targets.name               IS '표시 이름';
COMMENT ON COLUMN url_monitoring_targets.url                IS '모니터링 대상 URL';
COMMENT ON COLUMN url_monitoring_targets.interval           IS '수집 주기 (1m, 2m 등)';
COMMENT ON COLUMN url_monitoring_targets.response_timeout   IS 'HTTP 응답 대기 시간 (예: 5s)';
COMMENT ON COLUMN url_monitoring_targets.method             IS 'HTTP 메서드 (GET, POST 등)';
COMMENT ON COLUMN url_monitoring_targets.alert_rule_id      IS '연결된 Kapacitor AlertRule ID';
COMMENT ON COLUMN url_monitoring_targets.delete_yn          IS 'soft-delete 플래그';
COMMENT ON COLUMN url_monitoring_targets.created_at         IS '생성 시각';
COMMENT ON COLUMN url_monitoring_targets.updated_at         IS '마지막 수정 시각';

---- create above / drop below ----

DROP INDEX IF EXISTS idx_url_monitoring_targets_url_monitoring_id_name_lower_active;
DROP INDEX IF EXISTS idx_url_monitoring_targets_monitoring_id;
DROP TABLE IF EXISTS url_monitoring_targets;
DROP INDEX IF EXISTS idx_url_monitoring_org_id_active;
DROP INDEX IF EXISTS idx_url_monitoring_org_id;
DROP TABLE IF EXISTS url_monitoring;
