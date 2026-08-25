-- 013_openclaw_skill_next_revision.sql
-- 리비전 번호를 스킬 행에서 단조 증가시킨다.
--
-- 다음 번호를 COALESCE(MAX(revision), 0) + 1로 구하면 남아 있는 행만 보게 되어,
-- 가장 높은 리비전을 지웠을 때 다음 리비전이 방금 사라진 번호를 물려받는다.
-- 그러면 "리비전 3"이라는 예전 언급이 전혀 다른 내용을 가리키게 된다.
-- 번호를 따로 들고 있으면 삭제와 무관하게 되돌아오지 않는다.

ALTER TABLE openclaw_skills
    ADD COLUMN IF NOT EXISTS next_revision integer;

-- 기존 스킬은 지금까지 쓴 가장 큰 번호의 다음 값에서 이어간다. 이미 지워진
-- 리비전이 있었다면 그 번호는 되살릴 수 없지만, 앞으로는 재사용되지 않는다.
UPDATE openclaw_skills s
SET next_revision = COALESCE(
        (SELECT MAX(r.revision) FROM openclaw_skill_revisions r WHERE r.skill_id = s.id),
        0
    ) + 1
WHERE next_revision IS NULL;

ALTER TABLE openclaw_skills
    ALTER COLUMN next_revision SET DEFAULT 1;

ALTER TABLE openclaw_skills
    ALTER COLUMN next_revision SET NOT NULL;
