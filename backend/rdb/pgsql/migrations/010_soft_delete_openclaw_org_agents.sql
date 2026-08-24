-- 조직 에이전트 매핑을 소프트 딜리트로 바꾼다.
--
-- 조직을 지우면 Gateway 워크스페이스는 파일까지 삭제하지만, 매핑은 남긴다.
-- 스킬 리비전이 CloudHub에 그대로 있으므로 매핑만 되살리면 워크스페이스를 다시
-- 만들어 스킬을 재발행할 수 있다. 회수한 파일이 복구의 걸림돌이 되지 않는다.
ALTER TABLE openclaw_org_agents
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 기본키를 부분 유니크 인덱스로 바꾼다. 소프트 딜리트된 행이 남으면 같은 조직을
-- 다시 프로비저닝할 때 (organization_id, purpose)가 충돌하기 때문이다.
ALTER TABLE openclaw_org_agents
    DROP CONSTRAINT IF EXISTS openclaw_org_agents_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS openclaw_org_agents_active_idx
    ON openclaw_org_agents (organization_id, purpose) WHERE deleted_at IS NULL;

-- 폐기된 매핑을 조직 단위로 훑기 위한 인덱스.
CREATE INDEX IF NOT EXISTS openclaw_org_agents_org_idx
    ON openclaw_org_agents (organization_id);
