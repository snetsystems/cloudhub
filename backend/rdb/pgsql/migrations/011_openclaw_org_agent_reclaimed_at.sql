-- 워크스페이스 회수 완료 여부를 기록한다.
--
-- 조직을 지울 때 Gateway가 닿지 않으면 워크스페이스 파일이 호스트에 남는데,
-- 지금까지는 회수 성공 여부와 무관하게 매핑을 소프트 딜리트해서 "남은 것"과
-- "치운 것"이 같은 행으로 보였다. 이 컬럼이 그 둘을 가른다.
--
-- 회수 대기 = deleted_at IS NOT NULL AND reclaimed_at IS NULL
ALTER TABLE openclaw_org_agents
    ADD COLUMN IF NOT EXISTS reclaimed_at timestamptz;

-- 이 마이그레이션 이전에 소프트 딜리트된 행은 회수 여부를 알 수 없으므로
-- 대기로 남는다. 재회수는 멱등이라 이미 지워진 워크스페이스를 다시 지워도
-- 성공으로 끝난다.
CREATE INDEX IF NOT EXISTS openclaw_org_agents_pending_reclaim_idx
    ON openclaw_org_agents (deleted_at)
    WHERE deleted_at IS NOT NULL AND reclaimed_at IS NULL;
