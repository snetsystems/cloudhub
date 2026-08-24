-- 009_create_openclaw_skill_authoring.sql
-- 조직 구성원이 저작한 OpenClaw 스킬의 원본과 리비전 이력. CloudHub가 권위를
-- 갖고, Gateway는 활성 리비전의 파일만 보유한다.

-- 조직별 스킬 차단 목록은 Gateway 설정이 담당하므로 더 이상 쓰지 않는다.
DROP TABLE IF EXISTS openclaw_skill_policies;

-- 조직이 사용하는 에이전트. purpose는 authoring 또는 execution.
CREATE TABLE IF NOT EXISTS openclaw_org_agents (
    organization_id text        NOT NULL,
    purpose         text        NOT NULL,
    agent_id        text        NOT NULL,
    created_at      timestamptz NOT NULL,
    PRIMARY KEY (organization_id, purpose)
);

-- 조직 스킬 마스터.
CREATE TABLE IF NOT EXISTS openclaw_skills (
    id                 uuid        PRIMARY KEY,
    organization_id    text        NOT NULL,
    name               text        NOT NULL,
    status             text        NOT NULL,
    active_revision    int,
    created_by         text        NOT NULL,
    created_at         timestamptz NOT NULL,
    updated_at         timestamptz NOT NULL,
    deleted_at         timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_openclaw_skills_org_name_active
    ON openclaw_skills (organization_id, name) WHERE deleted_at IS NULL;

-- 리비전. 승인 상태와 전체 파일 집합의 지문을 담는다.
CREATE TABLE IF NOT EXISTS openclaw_skill_revisions (
    id                  uuid        PRIMARY KEY,
    skill_id            uuid        NOT NULL REFERENCES openclaw_skills(id) ON DELETE CASCADE,
    revision            int         NOT NULL,
    tree_hash           text        NOT NULL,
    goal                text        NOT NULL DEFAULT '',
    author_id           text        NOT NULL,
    review_status       text        NOT NULL,
    reviewed_by         text,
    reviewed_at         timestamptz,
    review_note         text        NOT NULL DEFAULT '',
    gateway_proposal_id text,
    gateway_scan        jsonb,
    created_at          timestamptz NOT NULL,
    UNIQUE (skill_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_openclaw_skill_revisions_skill
    ON openclaw_skill_revisions (skill_id, revision DESC);

-- 리비전에 속한 파일. SKILL.md는 path='SKILL.md'로 항상 한 행 존재한다.
CREATE TABLE IF NOT EXISTS openclaw_skill_revision_files (
    revision_id  uuid        NOT NULL REFERENCES openclaw_skill_revisions(id) ON DELETE CASCADE,
    path         text        NOT NULL,
    content      text        NOT NULL,
    content_hash text        NOT NULL,
    size_bytes   int         NOT NULL,
    PRIMARY KEY (revision_id, path)
);
